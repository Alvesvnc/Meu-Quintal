import { describe, it, expect } from 'vitest';
import {
  validarProposta,
  efeitosDaResposta,
  expirou,
  deltaDaProposta,
  PRAZO_DE_RESPOSTA_MS,
  EFEITO_DA_EXPIRACAO,
  type ItemDoPedido,
  type LinhaProposta,
} from './alteracao.js';

const item = (over: Partial<ItemDoPedido> = {}): ItemDoPedido => ({
  id: 'i1',
  qty: 2,
  unitPriceCents: 1800,
  status: 'novo',
  ...over,
});

const linha = (over: Partial<LinhaProposta> = {}): LinhaProposta => ({
  orderItemId: 'i1',
  qtyAnterior: 2,
  qtyProposta: 1,
  ...over,
});

describe('validarProposta', () => {
  it('aceita reducao de quantidade', () => {
    expect(validarProposta([linha({ qtyProposta: 1 })], [item({ qty: 2 })])).toEqual([]);
  });

  it('aceita cancelamento (qty 0)', () => {
    expect(validarProposta([linha({ qtyProposta: 0 })], [item({ qty: 2 })])).toEqual([]);
  });

  it('recusa proposta vazia', () => {
    expect(validarProposta([], [item()])).toEqual([{ tipo: 'sem-itens' }]);
  });

  // ── A trava de isolamento entre cozinhas ─────────────────────────────────
  it('recusa item que nao esta na lista da cozinha', () => {
    // O chamador filtra por kitchenId antes. Um id que nao apareca ali e de
    // outra cozinha ou nao existe — e a resposta e a mesma pros dois casos,
    // pra nao confirmar a existencia de um id alheio.
    const erros = validarProposta([linha({ orderItemId: 'da-vizinha' })], [item({ id: 'i1' })]);
    expect(erros).toEqual([{ tipo: 'item-fora-do-pedido', orderItemId: 'da-vizinha' }]);
  });

  it('recusa item ja retirado — ja foi entregue', () => {
    const erros = validarProposta([linha()], [item({ status: 'retirado' })]);
    expect(erros[0]).toMatchObject({ tipo: 'item-inativo', status: 'retirado' });
  });

  it('recusa item ja cancelado', () => {
    const erros = validarProposta([linha()], [item({ status: 'cancelado' })]);
    expect(erros[0]).toMatchObject({ tipo: 'item-inativo', status: 'cancelado' });
  });

  /**
   * ESTE CASO PASSAVA. A regra antiga recusava `cancelado` e `retirado` e
   * liberava o resto — `pronto` nao estava na lista, entao a cozinha conseguia
   * propor reduzir de 2 pra 1 um prato ja empratado no balcao. Comida feita, e
   * a proposta ainda podia cancela-la.
   *
   * Nenhum teste cobria `pronto`, o que e justamente como o furo sobreviveu.
   */
  it('recusa item ja PRONTO — a comida existe, reduzir vira desperdicio', () => {
    const erros = validarProposta([linha()], [item({ status: 'pronto' })]);
    expect(erros[0]).toMatchObject({ tipo: 'item-pronto' });
  });

  it('aceita ate `preparando`, e so ate la', () => {
    // A lista e do que PODE. Status novo que apareca um dia nasce bloqueado,
    // em vez de nascer permitido como aconteceu com `pronto`.
    expect(validarProposta([linha()], [item({ status: 'novo' })])).toEqual([]);
    expect(validarProposta([linha()], [item({ status: 'preparando' })])).toEqual([]);
  });

  /**
   * `pronto` e `retirado` sao situacoes diferentes e a mensagem na tela nao
   * pode trata-las igual: uma e comida esperando ser buscada, a outra ja foi
   * entregue. Se os dois virarem o mesmo erro, o texto mente pra um deles.
   */
  it('distingue pronto de retirado', () => {
    const pronto = validarProposta([linha()], [item({ status: 'pronto' })]);
    const retirado = validarProposta([linha()], [item({ status: 'retirado' })]);
    expect(pronto[0].tipo).not.toBe(retirado[0].tipo);
  });

  it('recusa AUMENTO de quantidade', () => {
    // Aumentar seria a cozinha vendendo o que o cliente nao pediu.
    const erros = validarProposta([linha({ qtyProposta: 5 })], [item({ qty: 2 })]);
    expect(erros[0]).toMatchObject({ tipo: 'nao-reduz', qtyAtual: 2, qtyProposta: 5 });
  });

  it('recusa proposta que nao muda nada', () => {
    const erros = validarProposta([linha({ qtyProposta: 2 })], [item({ qty: 2 })]);
    expect(erros[0]).toMatchObject({ tipo: 'nao-reduz' });
  });

  it('recusa quantidade negativa ou fracionada', () => {
    expect(validarProposta([linha({ qtyProposta: -1 })], [item()])[0]).toMatchObject({
      tipo: 'qty-negativa',
    });
    expect(validarProposta([linha({ qtyProposta: 1.5 })], [item()])[0]).toMatchObject({
      tipo: 'qty-negativa',
    });
  });

  it('recusa o mesmo item duas vezes na proposta', () => {
    const erros = validarProposta(
      [linha({ orderItemId: 'i1', qtyProposta: 1 }), linha({ orderItemId: 'i1', qtyProposta: 0 })],
      [item({ id: 'i1', qty: 2 })],
    );
    expect(erros[0]).toMatchObject({ tipo: 'linha-duplicada' });
  });

  it('junta os erros de varias linhas em vez de parar na primeira', () => {
    const erros = validarProposta(
      [
        linha({ orderItemId: 'i1', qtyProposta: 9 }),
        linha({ orderItemId: 'nao-existe' }),
        linha({ orderItemId: 'i3', qtyProposta: 1 }),
      ],
      [item({ id: 'i1', qty: 2 }), item({ id: 'i3', qty: 3, status: 'cancelado' })],
    );
    // A cozinha corrige tudo de uma vez em vez de descobrir um erro por vez.
    expect(erros).toHaveLength(3);
  });

  it('valida varias linhas validas de uma vez', () => {
    const erros = validarProposta(
      [linha({ orderItemId: 'i1', qtyProposta: 1 }), linha({ orderItemId: 'i2', qtyProposta: 0 })],
      [item({ id: 'i1', qty: 2 }), item({ id: 'i2', qty: 1 })],
    );
    expect(erros).toEqual([]);
  });
});

describe('efeitosDaResposta — ACEITA', () => {
  it('reduzir quantidade so muda a qty', () => {
    const [efeito] = efeitosDaResposta([linha({ qtyProposta: 1 })], 'aceita');
    expect(efeito).toEqual({ orderItemId: 'i1', novaQty: 1, novoStatus: null });
  });

  it('proposta de qty 0 cancela o item', () => {
    const [efeito] = efeitosDaResposta([linha({ qtyProposta: 0 })], 'aceita');
    expect(efeito).toEqual({ orderItemId: 'i1', novaQty: null, novoStatus: 'cancelado' });
  });
});

describe('efeitosDaResposta — RECUSADA', () => {
  it('cancela o item INTEIRO, mesmo quando a proposta era so reduzir', () => {
    // "Nao aceito 1 no lugar de 2" so pode significar "entao nao quero": a
    // cozinha nao tem o ingrediente pra entregar os 2 originais.
    const [efeito] = efeitosDaResposta([linha({ qtyProposta: 1 })], 'recusada');
    expect(efeito).toEqual({ orderItemId: 'i1', novaQty: null, novoStatus: 'cancelado' });
  });

  it('cancela todas as linhas da proposta', () => {
    const efeitos = efeitosDaResposta(
      [linha({ orderItemId: 'i1' }), linha({ orderItemId: 'i2', qtyProposta: 0 })],
      'recusada',
    );
    expect(efeitos.every((e) => e.novoStatus === 'cancelado')).toBe(true);
  });
});

describe('expiracao', () => {
  it('so expira depois do prazo', () => {
    const agora = new Date('2026-08-25T12:00:00Z');
    expect(expirou(new Date('2026-08-25T12:00:01Z'), agora)).toBe(false);
    expect(expirou(new Date('2026-08-25T11:59:59Z'), agora)).toBe(true);
  });

  it('o instante exato do prazo ja conta como expirado', () => {
    const t = new Date('2026-08-25T12:00:00Z');
    expect(expirou(t, t)).toBe(true);
  });

  it('o prazo padrao e de 5 minutos', () => {
    expect(PRAZO_DE_RESPOSTA_MS).toBe(5 * 60 * 1000);
  });

  it('sem resposta vale o mesmo que recusa', () => {
    // Se esta constante mudar pra 'aceita', o cliente passa a receber (e pagar
    // por) uma quantidade com que nunca concordou. E decisao de produto, e o
    // teste existe pra a mudanca ser consciente.
    expect(EFEITO_DA_EXPIRACAO).toBe('recusada');
  });
});

describe('deltaDaProposta', () => {
  it('reduzir de 2 pra 1 devolve o preco de uma unidade, negativo', () => {
    expect(
      deltaDaProposta([linha({ qtyProposta: 1 })], [item({ qty: 2, unitPriceCents: 1800 })]),
    ).toBe(-1800);
  });

  it('cancelar devolve o valor cheio da linha', () => {
    expect(
      deltaDaProposta([linha({ qtyProposta: 0 })], [item({ qty: 3, unitPriceCents: 1800 })]),
    ).toBe(-5400);
  });

  it('soma varias linhas', () => {
    const d = deltaDaProposta(
      [linha({ orderItemId: 'i1', qtyProposta: 1 }), linha({ orderItemId: 'i2', qtyProposta: 0 })],
      [
        item({ id: 'i1', qty: 2, unitPriceCents: 1800 }),
        item({ id: 'i2', qty: 1, unitPriceCents: 3200 }),
      ],
    );
    expect(d).toBe(-1800 - 3200);
  });

  it('nunca e positivo — a proposta so reduz', () => {
    const d = deltaDaProposta([linha({ qtyProposta: 1 })], [item({ qty: 2 })]);
    expect(d).toBeLessThanOrEqual(0);
  });

  it('ignora linha de item desconhecido em vez de estourar', () => {
    expect(deltaDaProposta([linha({ orderItemId: 'sumiu' })], [item({ id: 'i1' })])).toBe(0);
  });
});
