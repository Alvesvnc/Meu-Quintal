import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { criarPrismaMock, type PrismaMock } from '../test/prismaMock.js';

const prismaMock: PrismaMock = criarPrismaMock();
vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }));

const { buildApp } = await import('../app.js');
// Uma implementacao so, compartilhada pelo cliente e pela cozinha.
const { aggregateStatus: agregado } = await import('../lib/orderStatus.js');

/**
 * Rotas do app da cozinha (/api/r/*).
 *
 * O foco é o escopo por `kitchenId`: num quintal, uma cozinha não pode ver nem
 * mexer no pedido da vizinha — e o pedido do cliente é compartilhado entre
 * várias cozinhas, então o recorte acontece no nível do ITEM, não do pedido.
 */

let app: FastifyInstance;

const COZINHA = {
  id: 'k-lou',
  slug: 'lou-burger',
  name: 'Lou Burger',
  status: 'ativa' as const,
  spaceId: 'space-1',
};

function token(kitchenId = COZINHA.id, slug = COZINHA.slug) {
  return app.jwt.sign({
    kind: 'cozinha' as const,
    sub: 'kuser-1',
    kitchenId,
    kitchenSlug: slug,
    email: 'marcos@louburger.com',
    role: 'owner',
  });
}

const auth = () => ({ authorization: `Bearer ${token()}` });

beforeEach(async () => {
  vi.clearAllMocks();
  Object.assign(prismaMock, criarPrismaMock());
  prismaMock.kitchen.findUnique.mockResolvedValue(COZINHA);
  prismaMock.$transaction.mockResolvedValue([{ count: 1 }]);
  app = await buildApp({ socket: false, logger: false, cron: false });
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

// ─── Porta de entrada ───────────────────────────────────────────────────────

describe('/api/r/* — autenticacao', () => {
  it('sem token devolve 401', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/r/fila' });
    expect(r.statusCode).toBe(401);
  });

  it('cozinha PAUSADA continua entrando — pausar nao e se trancar pra fora', async () => {
    prismaMock.kitchen.findUnique.mockResolvedValue({ ...COZINHA, status: 'pausada' });
    const r = await app.inject({ method: 'GET', url: '/api/r/fila', headers: auth() });

    // Bloquear aqui trancava a cozinha fora do proprio app: depois de apertar
    // "pausar" na tela de conta, ela nao conseguia nem despausar — a unica
    // saida era editar o banco. `pausada` significa "o cliente nao me ve e nao
    // me manda pedido", e quem cuida disso e quintal.ts, kitchen.ts e a criacao
    // de pedido em order.ts.
    expect(r.statusCode).toBe(200);
  });

  it('cozinha excluida derruba o token que ainda nao expirou', async () => {
    prismaMock.kitchen.findUnique.mockResolvedValue(null);
    const r = await app.inject({ method: 'GET', url: '/api/r/fila', headers: auth() });
    expect(r.statusCode).toBe(401);
  });
});

// ─── Fila ───────────────────────────────────────────────────────────────────

describe('GET /api/r/fila', () => {
  it('filtra por espaco E por itens desta cozinha', async () => {
    prismaMock.order.findMany.mockResolvedValue([]);
    await app.inject({ method: 'GET', url: '/api/r/fila', headers: auth() });

    const chamada = prismaMock.order.findMany.mock.calls[0][0];
    expect(chamada.where.spaceId).toBe(COZINHA.spaceId);
    // O pedido do cliente pode ter itens de várias cozinhas; a fila só mostra
    // os que têm ao menos um item DESTA.
    expect(chamada.where.items.some.kitchenId).toBe(COZINHA.id);
  });

  it('so traz os itens DESTA cozinha dentro de cada pedido', async () => {
    prismaMock.order.findMany.mockResolvedValue([]);
    await app.inject({ method: 'GET', url: '/api/r/fila', headers: auth() });

    const chamada = prismaMock.order.findMany.mock.calls[0][0];
    // Sem este `where` no include, a cozinha veria o que o cliente pediu na
    // concorrente ao lado — inclusive preço e quantidade.
    expect(chamada.include.items.where.kitchenId).toBe(COZINHA.id);
  });

  it('so status ativo entra na fila', async () => {
    prismaMock.order.findMany.mockResolvedValue([]);
    await app.inject({ method: 'GET', url: '/api/r/fila', headers: auth() });

    const statuses = prismaMock.order.findMany.mock.calls[0][0].where.items.some.status.in;
    expect(statuses).toEqual(['novo', 'preparando', 'pronto']);
    expect(statuses).not.toContain('retirado');
    expect(statuses).not.toContain('cancelado');
  });
});

// ─── Transições de status ───────────────────────────────────────────────────

describe('avancar pedido', () => {
  const rotas = [
    { url: 'aceitar', destino: 'preparando', carimbo: 'acceptedAt' },
    { url: 'pronto', destino: 'pronto', carimbo: 'readyAt' },
    { url: 'retirado', destino: 'retirado', carimbo: 'pickedAt' },
  ] as const;

  for (const { url, destino, carimbo } of rotas) {
    it(`${url} leva os itens pra "${destino}" e carimba ${carimbo}`, async () => {
      prismaMock.orderItem.findMany.mockResolvedValue([
        { id: 'i1', status: 'novo' },
        { id: 'i2', status: 'novo' },
      ]);

      const r = await app.inject({
        method: 'PATCH',
        url: `/api/r/pedido/pedido-1/${url}`,
        headers: auth(),
      });

      expect(r.statusCode).toBe(200);
      expect(r.json().status).toBe(destino);

      const update = prismaMock.orderItem.updateMany.mock.calls[0][0];
      expect(update.data.status).toBe(destino);
      expect(update.data[carimbo]).toBeInstanceOf(Date);
    });
  }

  it('a busca dos itens ja filtra pela cozinha', async () => {
    prismaMock.orderItem.findMany.mockResolvedValue([{ id: 'i1', status: 'novo' }]);
    await app.inject({
      method: 'PATCH',
      url: '/api/r/pedido/pedido-1/aceitar',
      headers: auth(),
    });

    const where = prismaMock.orderItem.findMany.mock.calls[0][0].where;
    expect(where.kitchenId).toBe(COZINHA.id);
    expect(where.orderId).toBe('pedido-1');
  });

  it('pedido de outra cozinha devolve 404, nao 200 silencioso', async () => {
    // Nenhum item daquele pedido pertence a esta cozinha
    prismaMock.orderItem.findMany.mockResolvedValue([]);

    const r = await app.inject({
      method: 'PATCH',
      url: '/api/r/pedido/pedido-da-vizinha/aceitar',
      headers: auth(),
    });

    expect(r.statusCode).toBe(404);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('nao mexe em item ja cancelado ou retirado', async () => {
    prismaMock.orderItem.findMany.mockResolvedValue([
      { id: 'i1', status: 'novo' },
      { id: 'i2', status: 'cancelado' },
    ]);

    await app.inject({
      method: 'PATCH',
      url: '/api/r/pedido/pedido-1/pronto',
      headers: auth(),
    });

    // Reabrir um item cancelado seria ressuscitar algo que o cliente ja viu
    // como encerrado.
    const where = prismaMock.orderItem.updateMany.mock.calls[0][0].where;
    expect(where.status.notIn).toEqual(['cancelado', 'retirado']);
  });
});

describe('cancelar', () => {
  // Retorno anotado: sem isto o TypeScript infere o tipo ENCADEAVEL do
  // `inject` (`void & Promise<Response> & Chain`), e `await` sobre essa
  // intersecao nao chega em `.statusCode`.
  const cancelar = (payload: Record<string, unknown>): Promise<LightMyRequestResponse> =>
    app.inject({
      method: 'PATCH',
      url: '/api/r/pedido/pedido-1/cancelar',
      headers: auth(),
      payload,
    });

  it('cancela com motivo', async () => {
    prismaMock.orderItem.findMany.mockResolvedValue([{ id: 'i1', status: 'novo' }]);
    const r = await cancelar({ motivo: 'sem-ingrediente' });
    expect(r.statusCode).toBe(200);
    expect(r.json().status).toBe('cancelado');
  });

  it('recusa cancelamento SEM motivo', async () => {
    // O motivo virou obrigatorio: e ele que responde "o que mais me faz
    // cancelar?" na tela de metricas. Antes era validado e descartado.
    prismaMock.orderItem.findMany.mockResolvedValue([{ id: 'i1', status: 'novo' }]);
    expect((await cancelar({})).statusCode).toBe(400);
  });

  it('recusa motivo fora da lista', async () => {
    expect((await cancelar({ motivo: 'porque-sim' })).statusCode).toBe(400);
  });

  it('"outro" SEM texto e recusado', async () => {
    expect((await cancelar({ motivo: 'outro' })).statusCode).toBe(400);
  });

  it('"outro" COM texto passa', async () => {
    prismaMock.orderItem.findMany.mockResolvedValue([{ id: 'i1', status: 'novo' }]);
    const r = await cancelar({ motivo: 'outro', reason: 'o forno apagou' });
    expect(r.statusCode).toBe(200);
  });

  it('recusa texto acima de 140 chars', async () => {
    const r = await cancelar({ motivo: 'sem-ingrediente', reason: 'x'.repeat(141) });
    expect(r.statusCode).toBe(400);
  });

  it('grava motivo, texto e a data do cancelamento no ITEM', async () => {
    prismaMock.orderItem.findMany.mockResolvedValue([{ id: 'i1', status: 'novo' }]);
    await cancelar({ motivo: 'demanda-alta', reason: 'fila enorme' });

    const data = prismaMock.orderItem.updateMany.mock.calls[0][0].data;
    // No item e nao no pedido: e por item que a metrica agrega.
    // API usa hifen, Prisma usa underscore — ver lib/motivo.ts.
    expect(data.cancelMotivo).toBe('demanda_alta');
    expect(data.cancelReason).toBe('fila enorme');
    expect(data.canceledAt).toBeInstanceOf(Date);
  });

  it('cancelar NAO carimba data de preparo', async () => {
    prismaMock.orderItem.findMany.mockResolvedValue([{ id: 'i1', status: 'novo' }]);
    await cancelar({ motivo: 'sem-ingrediente' });

    const data = prismaMock.orderItem.updateMany.mock.calls[0][0].data;
    expect(data.status).toBe('cancelado');
    expect(data.acceptedAt).toBeUndefined();
    expect(data.readyAt).toBeUndefined();
    expect(data.pickedAt).toBeUndefined();
  });
});

// ─── Cliente e cozinha agora agregam igual ──────────────────────────────────

describe('agregacao de status unificada', () => {
  /**
   * Ate 2026-08-24 existiam DUAS implementacoes de aggregateStatus: uma local
   * aqui em restaurante.ts (filtrava cancelados) e a de lib/orderStatus.ts
   * (deixava cancelado contaminar). O mesmo pedido aparecia como "cancelado"
   * pro cliente e "pronto" pra cozinha no mesmo instante.
   *
   * A local foi apagada. Estes testes existem pra que a duplicata nao volte:
   * se alguem reintroduzir uma copia com semantica propria, o comportamento
   * aqui muda e o teste cai.
   */
  it('cancelamento parcial nao encerra o grupo', () => {
    expect(agregado(['pronto', 'cancelado'])).toBe('pronto');
    expect(agregado(['preparando', 'cancelado'])).toBe('preparando');
  });

  it('so encerra quando tudo esta cancelado', () => {
    expect(agregado(['cancelado', 'cancelado'])).toBe('cancelado');
  });

  it('sem cancelamento, e o item mais atrasado', () => {
    expect(agregado(['novo', 'pronto'])).toBe('novo');
    expect(agregado(['preparando', 'retirado'])).toBe('preparando');
  });

  it('lista vazia cai em novo', () => {
    expect(agregado([])).toBe('novo');
  });
});

// ─── A fila também precisa marcar o cancelado ───────────────────────────────

describe('GET /api/r/fila — item cancelado', () => {
  /** Item no formato que a rota espera do banco. */
  const it_ = (over: Record<string, unknown> = {}) => ({
    id: 'i1',
    qty: 1,
    note: null,
    unitPriceCents: 3200,
    nameSnapshot: 'Smash Lou',
    status: 'novo',
    createdAt: new Date('2026-08-24T20:00:00Z'),
    acceptedAt: null,
    readyAt: null,
    pickedAt: null,
    ...over,
  });

  const pedidoNaFila = (itens: ReturnType<typeof it_>[], changes: unknown[] = []) => ({
    id: 'o1',
    shortId: '12345',
    createdAt: new Date('2026-08-24T20:00:00Z'),
    paymentRequestedAt: null,
    table: { numero: 7 },
    items: itens,
    // O include da rota sempre traz este array; vazio = nenhuma proposta aberta.
    changes,
  });

  it('o total da fila EXCLUI o item cancelado', async () => {
    prismaMock.kitchen.findUnique.mockResolvedValue(COZINHA);
    prismaMock.order.findMany.mockResolvedValue([
      pedidoNaFila([
        it_({ id: 'i1', unitPriceCents: 3200, status: 'novo' }),
        it_({ id: 'i2', unitPriceCents: 1800, status: 'cancelado' }),
      ]),
    ]);

    const j = (await app.inject({ method: 'GET', url: '/api/r/fila', headers: auth() })).json();

    // Mesma regra do lado do cliente. Se divergirem, a cozinha cobra um valor
    // e o cliente ve outro na tela.
    expect(j.orders[0].totalCents).toBe(3200);
  });

  it('o item cancelado vem na lista COM o status', async () => {
    prismaMock.kitchen.findUnique.mockResolvedValue(COZINHA);
    prismaMock.order.findMany.mockResolvedValue([
      pedidoNaFila([
        it_({ id: 'i1', status: 'novo', nameSnapshot: 'Smash Lou' }),
        it_({ id: 'i2', status: 'cancelado', nameSnapshot: 'Batata' }),
      ]),
    ]);

    const j = (await app.inject({ method: 'GET', url: '/api/r/fila', headers: auth() })).json();

    // Sem o campo `status`, o operador via os dois itens iguais e preparava o
    // cancelado. A tela risca com base neste campo.
    const batata = j.orders[0].items.find((i: { name: string }) => i.name === 'Batata');
    expect(batata.status).toBe('cancelado');
  });

  it('pedido com um item cancelado NAO some da fila', async () => {
    prismaMock.kitchen.findUnique.mockResolvedValue(COZINHA);
    prismaMock.order.findMany.mockResolvedValue([
      pedidoNaFila([
        it_({ id: 'i1', status: 'preparando' }),
        it_({ id: 'i2', status: 'cancelado' }),
      ]),
    ]);

    const j = (await app.inject({ method: 'GET', url: '/api/r/fila', headers: auth() })).json();

    expect(j.orders).toHaveLength(1);
    // E o status agregado mostra o que ainda ha pra fazer
    expect(j.orders[0].status).toBe('preparando');
  });
});

// ─── Proposta pendente aparece pra cozinha ──────────────────────────────────

describe('GET /api/r/fila — proposta aguardando resposta', () => {
  const it2 = (over: Record<string, unknown> = {}) => ({
    id: 'i1',
    qty: 3,
    note: null,
    unitPriceCents: 1800,
    nameSnapshot: 'Batata-doce frita',
    status: 'novo',
    createdAt: new Date('2026-08-24T20:00:00Z'),
    acceptedAt: null,
    readyAt: null,
    pickedAt: null,
    ...over,
  });

  const pedido = (changes: unknown[]) => ({
    id: 'o1',
    shortId: '12345',
    createdAt: new Date('2026-08-24T20:00:00Z'),
    paymentRequestedAt: null,
    table: { numero: 7 },
    items: [it2()],
    changes,
  });

  beforeEach(() => {
    prismaMock.kitchen.findUnique.mockResolvedValue(COZINHA);
  });

  it('a busca so traz proposta DESTA cozinha, pendente e dentro do prazo', async () => {
    prismaMock.order.findMany.mockResolvedValue([]);
    await app.inject({ method: 'GET', url: '/api/r/fila', headers: auth() });

    const where = prismaMock.order.findMany.mock.calls[0][0].include.changes.where;
    expect(where.kitchenId).toBe(COZINHA.id);
    expect(where.status).toBe('pendente');
    // Filtra por prazo tambem: entre o vencimento e a varredura do cron ha ate
    // 30s, e nesse intervalo a proposta nao deve aparecer como pendente.
    expect(where.expiresAt.gt).toBeInstanceOf(Date);
  });

  it('sem proposta aberta, o campo vem null', async () => {
    prismaMock.order.findMany.mockResolvedValue([pedido([])]);
    const j = (await app.inject({ method: 'GET', url: '/api/r/fila', headers: auth() })).json();
    expect(j.orders[0].alteracaoAguardando).toBeNull();
  });

  it('com proposta aberta, a cozinha ve o que propos e ate quando', async () => {
    const expira = new Date(Date.now() + 4 * 60_000);
    prismaMock.order.findMany.mockResolvedValue([
      pedido([
        {
          id: 'a1',
          createdAt: new Date('2026-08-24T20:01:00Z'),
          expiresAt: expira,
          reason: 'acabou a batata',
          items: [{ orderItemId: 'i1', qtyAnterior: 3, qtyProposta: 1 }],
        },
      ]),
    ]);

    const j = (await app.inject({ method: 'GET', url: '/api/r/fila', headers: auth() })).json();
    const a = j.orders[0].alteracaoAguardando;

    // Sem isto o card voltava ao normal depois de enviar, e o operador nao via
    // que havia algo pendente — podia tentar propor de novo e levar 409.
    expect(a.id).toBe('a1');
    expect(a.reason).toBe('acabou a batata');
    expect(a.expiresAt).toBe(expira.toISOString());
    expect(a.linhas[0]).toMatchObject({
      name: 'Batata-doce frita',
      qtyAnterior: 3,
      qtyProposta: 1,
    });
  });
});

// ─── Métricas de cancelamento ───────────────────────────────────────────────

describe('GET /api/r/metricas/cancelamentos', () => {
  const cancelado = (over: Record<string, unknown> = {}) => ({
    qty: 1,
    unitPriceCents: 1800,
    nameSnapshot: 'Batata-doce frita',
    cancelMotivo: 'sem_ingrediente',
    ...over,
  });

  beforeEach(() => {
    prismaMock.kitchen.findUnique.mockResolvedValue(COZINHA);
  });

  it('sem token devolve 401', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/r/metricas/cancelamentos' });
    expect(r.statusCode).toBe(401);
  });

  it('filtra por kitchenId, status cancelado e a JANELA de canceledAt', async () => {
    prismaMock.orderItem.findMany.mockResolvedValue([]);
    await app.inject({
      method: 'GET',
      url: '/api/r/metricas/cancelamentos?dias=7',
      headers: auth(),
    });

    const where = prismaMock.orderItem.findMany.mock.calls[0][0].where;
    // Uma cozinha nao ve o numero da vizinha.
    expect(where.kitchenId).toBe(COZINHA.id);
    expect(where.status).toBe('cancelado');
    // canceledAt e nao createdAt: a pergunta e QUANDO foi cancelado, nao
    // quando o pedido entrou.
    expect(where.canceledAt.gte).toBeInstanceOf(Date);
  });

  it('recusa janela invalida', async () => {
    for (const dias of ['0', '-5', '400', 'abc']) {
      const r = await app.inject({
        method: 'GET',
        url: `/api/r/metricas/cancelamentos?dias=${dias}`,
        headers: auth(),
      });
      expect(r.statusCode, `dias=${dias}`).toBe(400);
    }
  });

  it('agrupa por motivo e soma a perda', async () => {
    prismaMock.orderItem.findMany.mockResolvedValue([
      cancelado({ qty: 2, unitPriceCents: 1800, cancelMotivo: 'sem_ingrediente' }),
      cancelado({ qty: 1, unitPriceCents: 3200, cancelMotivo: 'sem_ingrediente' }),
      cancelado({ qty: 1, unitPriceCents: 5000, cancelMotivo: 'demanda_alta' }),
    ]);

    const j = (
      await app.inject({ method: 'GET', url: '/api/r/metricas/cancelamentos', headers: auth() })
    ).json();

    expect(j.totalItens).toBe(4);
    expect(j.perdaTotalCents).toBe(3600 + 3200 + 5000);

    // Ordenado pela causa dominante — e onde olhar primeiro.
    expect(j.porMotivo[0].motivo).toBe('sem-ingrediente');
    expect(j.porMotivo[0].itens).toBe(3);
    expect(j.porMotivo[0].perdaCents).toBe(6800);
  });

  it('traduz o motivo do formato do banco pro da API', async () => {
    prismaMock.orderItem.findMany.mockResolvedValue([
      cancelado({ cancelMotivo: 'item_errado_no_cardapio' }),
    ]);

    const j = (
      await app.inject({ method: 'GET', url: '/api/r/metricas/cancelamentos', headers: auth() })
    ).json();

    expect(j.porMotivo[0].motivo).toBe('item-errado-no-cardapio');
  });

  it('cancelamento ANTIGO, sem motivo gravado, cai em "outro"', async () => {
    // Os cancelamentos feitos antes desta funcionalidade nao tem categoria.
    // Descarta-los faria o total da tela nao bater com a realidade.
    prismaMock.orderItem.findMany.mockResolvedValue([cancelado({ cancelMotivo: null })]);

    const j = (
      await app.inject({ method: 'GET', url: '/api/r/metricas/cancelamentos', headers: auth() })
    ).json();

    expect(j.porMotivo[0].motivo).toBe('outro');
    expect(j.totalItens).toBe(1);
  });

  it('lista os itens que mais caem, no maximo 5', async () => {
    prismaMock.orderItem.findMany.mockResolvedValue([
      cancelado({ nameSnapshot: 'Smash Lou', qty: 5 }),
      cancelado({ nameSnapshot: 'Batata', qty: 2 }),
      cancelado({ nameSnapshot: 'Onion', qty: 1 }),
      cancelado({ nameSnapshot: 'Brownie', qty: 1 }),
      cancelado({ nameSnapshot: 'Chopp', qty: 1 }),
      cancelado({ nameSnapshot: 'Agua', qty: 1 }),
    ]);

    const j = (
      await app.inject({ method: 'GET', url: '/api/r/metricas/cancelamentos', headers: auth() })
    ).json();

    // A lista inteira viraria parede de texto; a resposta e "onde olhar
    // primeiro", nao um relatorio.
    expect(j.itensMaisCancelados).toHaveLength(5);
    expect(j.itensMaisCancelados[0].name).toBe('Smash Lou');
  });

  it('cozinha sem cancelamento devolve zeros, nao erro', async () => {
    prismaMock.orderItem.findMany.mockResolvedValue([]);
    const r = await app.inject({
      method: 'GET',
      url: '/api/r/metricas/cancelamentos',
      headers: auth(),
    });

    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ totalItens: 0, perdaTotalCents: 0, porMotivo: [] });
  });
});
