import { describe, it, expect } from 'vitest';
import { ranquearMesas, type MesaParaRanquear } from './desempenhoMesa.js';

/**
 * O ranking de mesas.
 *
 * O que se testa aqui é sobretudo QUEM ENTRA NA MÉDIA, porque é onde o número
 * mente com mais facilidade: uma mesa cadastrada no dia 28 puxa a média para
 * baixo e faz todas as outras parecerem melhores do que são.
 */

const INICIO = new Date('2026-08-01T00:00:00.000Z');
const ANTES = new Date('2026-07-01T00:00:00.000Z');

function mesa(over: Partial<MesaParaRanquear> & { numero: number }): MesaParaRanquear {
  return {
    id: `t${over.numero}`,
    isActive: true,
    criadaEm: ANTES,
    pedidos: [],
    ...over,
  };
}

/** Atalho: N pedidos de mesmo valor, todos em dias diferentes. */
function pedidos(quantos: number, cents: number) {
  return Array.from({ length: quantos }, (_, i) => ({
    em: new Date(Date.UTC(2026, 7, i + 1, 20)),
    grossCents: cents,
  }));
}

describe('o ranking em si', () => {
  it('ordena por faturamento, maior primeiro', () => {
    const r = ranquearMesas(
      [
        mesa({ numero: 1, pedidos: pedidos(1, 5_000) }),
        mesa({ numero: 2, pedidos: pedidos(1, 30_000) }),
        mesa({ numero: 3, pedidos: pedidos(1, 12_000) }),
      ],
      INICIO,
    );
    expect(r.mesas.map((m) => m.numero)).toEqual([2, 3, 1]);
  });

  it('empate desempata pelo numero da mesa', () => {
    const r = ranquearMesas(
      [
        mesa({ numero: 7, pedidos: pedidos(1, 1000) }),
        mesa({ numero: 2, pedidos: pedidos(1, 1000) }),
      ],
      INICIO,
    );
    // Sem desempate estavel a lista dancaria entre dois carregamentos iguais,
    // e o dono acharia que algo mudou.
    expect(r.mesas.map((m) => m.numero)).toEqual([2, 7]);
  });

  it('conta giro e ticket medio separados do total', () => {
    const r = ranquearMesas([mesa({ numero: 1, pedidos: pedidos(4, 5_000) })], INICIO);
    expect(r.mesas[0].grossCents).toBe(20_000);
    expect(r.mesas[0].pedidos).toBe(4);
    // 20.000 / 4 grupos. E o que diz quanto cada grupo gasta ali.
    expect(r.mesas[0].ticketMedioCents).toBe(5_000);
  });

  it('dias com movimento separa a mesa boa da noite cheia', () => {
    const umDiaSo = [
      { em: new Date('2026-08-10T19:00:00Z'), grossCents: 10_000 },
      { em: new Date('2026-08-10T20:00:00Z'), grossCents: 10_000 },
      { em: new Date('2026-08-10T21:00:00Z'), grossCents: 10_000 },
    ];
    const r = ranquearMesas(
      [mesa({ numero: 1, pedidos: umDiaSo }), mesa({ numero: 2, pedidos: pedidos(3, 10_000) })],
      INICIO,
    );

    // Mesmo faturamento, historias diferentes: uma pegou uma noite, a outra
    // trabalha todo dia. Sem isso as duas seriam indistinguiveis no ranking.
    const m1 = r.mesas.find((m) => m.numero === 1)!;
    const m2 = r.mesas.find((m) => m.numero === 2)!;
    expect(m1.grossCents).toBe(m2.grossCents);
    expect(m1.diasComMovimento).toBe(1);
    expect(m2.diasComMovimento).toBe(3);
  });
});

describe('a media e a comparacao', () => {
  it('compara cada mesa com a media em %', () => {
    const r = ranquearMesas(
      [
        mesa({ numero: 1, pedidos: pedidos(1, 20_000) }),
        mesa({ numero: 2, pedidos: pedidos(1, 10_000) }),
      ],
      INICIO,
    );
    // Media = 15.000. A de 20.000 rende +33%, a de 10.000 rende -33%.
    expect(r.media.grossCents).toBe(15_000);
    expect(r.mesas.find((m) => m.numero === 1)!.vsMediaPct).toBe(33);
    expect(r.mesas.find((m) => m.numero === 2)!.vsMediaPct).toBe(-33);
  });

  it('mesa NOVA no periodo fica fora da media', () => {
    const r = ranquearMesas(
      [
        mesa({ numero: 1, pedidos: pedidos(1, 20_000) }),
        mesa({ numero: 2, pedidos: pedidos(1, 10_000) }),
        // Cadastrada dia 28: teve tres dias pra faturar.
        mesa({ numero: 9, criadaEm: new Date('2026-08-28T00:00:00Z'), pedidos: pedidos(1, 1_000) }),
      ],
      INICIO,
    );

    // Media segue 15.000. Incluindo a mesa 9 cairia pra ~10.300 e as duas
    // antigas pareceriam melhores do que sao — o oposto do que a tela promete.
    expect(r.media.grossCents).toBe(15_000);
    expect(r.media.mesasNaBase).toBe(2);
  });

  it('mas a mesa nova continua no ranking, marcada', () => {
    const r = ranquearMesas(
      [mesa({ numero: 9, criadaEm: new Date('2026-08-28T00:00:00Z'), pedidos: pedidos(1, 1_000) })],
      INICIO,
    );
    // Some-la esconderia do dono que a mesa existe.
    expect(r.mesas).toHaveLength(1);
    expect(r.mesas[0].novaNoPeriodo).toBe(true);
  });

  it('mesa DESATIVADA fica fora da media', () => {
    const r = ranquearMesas(
      [
        mesa({ numero: 1, pedidos: pedidos(1, 20_000) }),
        mesa({ numero: 2, pedidos: pedidos(1, 10_000) }),
        mesa({ numero: 3, isActive: false, pedidos: [] }),
      ],
      INICIO,
    );
    // A media descreve o salao EM OPERACAO. Mesa fora de uso somaria dias
    // parados a ela.
    expect(r.media.mesasNaBase).toBe(2);
    expect(r.media.grossCents).toBe(15_000);
  });

  it('mesa ativa que vendeu ZERO entra na media — e o sinal, nao ruido', () => {
    const r = ranquearMesas(
      [mesa({ numero: 1, pedidos: pedidos(1, 20_000) }), mesa({ numero: 2, pedidos: [] })],
      INICIO,
    );
    // Mesa parada e exatamente o que o dono quer descobrir. Tira-la da media
    // esconderia o problema dentro do proprio indicador.
    expect(r.media.mesasNaBase).toBe(2);
    expect(r.media.grossCents).toBe(10_000);
    expect(r.mesas.find((m) => m.numero === 2)!.vsMediaPct).toBe(-100);
  });

  it('mesa criada EXATAMENTE no inicio do periodo conta como antiga', () => {
    const r = ranquearMesas(
      [mesa({ numero: 1, criadaEm: INICIO, pedidos: pedidos(1, 5_000) })],
      INICIO,
    );
    // Ela teve o periodo inteiro. Barrar aqui seria descartar mesa legitima
    // todo comeco de mes.
    expect(r.mesas[0].novaNoPeriodo).toBe(false);
    expect(r.media.mesasNaBase).toBe(1);
  });

  it('o ticket medio do salao e total/pedidos, nao a media das medias', () => {
    const r = ranquearMesas(
      [
        // 1 pedido de 30.000
        mesa({ numero: 1, pedidos: pedidos(1, 30_000) }),
        // 9 pedidos de 1.000
        mesa({ numero: 2, pedidos: pedidos(9, 1_000) }),
      ],
      INICIO,
    );
    // Total 39.000 em 10 pedidos = 3.900. A media das medias daria
    // (30.000 + 1.000) / 2 = 15.500, um numero que nao descreve nada: da o
    // mesmo peso a uma mesa com 1 pedido e a outra com 9.
    expect(r.media.ticketMedioCents).toBe(3_900);
  });
});

describe('quando nao ha o que comparar', () => {
  it('salao sem faturamento devolve vsMediaPct null, nao zero', () => {
    const r = ranquearMesas([mesa({ numero: 1 }), mesa({ numero: 2 })], INICIO);
    // 0% se leria como "esta na media" — uma afirmacao sem dado que a sustente.
    expect(r.mesas[0].vsMediaPct).toBeNull();
    expect(r.media.grossCents).toBe(0);
  });

  it('so mesas novas: media vazia, sem divisao por zero', () => {
    const r = ranquearMesas(
      [mesa({ numero: 1, criadaEm: new Date('2026-08-20T00:00:00Z'), pedidos: pedidos(1, 5_000) })],
      INICIO,
    );
    expect(r.media.mesasNaBase).toBe(0);
    expect(r.media.ticketMedioCents).toBe(0);
    expect(r.mesas[0].vsMediaPct).toBeNull();
  });

  it('quintal sem mesa nenhuma nao quebra', () => {
    const r = ranquearMesas([], INICIO);
    expect(r.mesas).toEqual([]);
    expect(r.media.mesasNaBase).toBe(0);
  });
});
