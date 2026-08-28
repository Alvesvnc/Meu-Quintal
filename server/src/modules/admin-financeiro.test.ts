import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { criarPrismaMock, ESPACO, CONTA, usuarioDono, type PrismaMock } from '../test/prismaMock.js';

const prismaMock: PrismaMock = criarPrismaMock();
vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }));

const { buildApp } = await import('../app.js');

/**
 * GET /api/a/financeiro — a montagem dos números que o dono vê.
 *
 * `lib/cobranca.ts` já testa o cálculo por cozinha. Aqui é a camada de cima:
 * agregar as linhas, somar os totais e escolher entre o valor AO VIVO (ciclo
 * aberto) e o valor CONGELADO (ciclo fechado). Errar aqui não quebra nada —
 * mostra o valor errado na tela de cobrança do cliente.
 */

let app: FastifyInstance;

function token(role: 'owner' | 'admin' | 'staff' = 'owner') {
  return app.jwt.sign({
    kind: 'dono' as const,
    sub: 'user-1',
    accountId: CONTA.id,
    accountSlug: CONTA.slug,
    email: 'marina@qro.app',
    role,
  });
}

const auth = () => ({ authorization: `Bearer ${token()}` });

/** Cozinha com os itens vendidos no período. */
function cozinha(
  over: Partial<{
    id: string;
    slug: string;
    name: string;
    chargeCommission: boolean;
    commissionPct: number | null;
    chargeRent: boolean;
    rentCents: number;
    orderItems: Array<{ qty: number; unitPriceCents: number }>;
  }> = {},
) {
  return {
    id: 'k1',
    slug: 'lou-burger',
    name: 'Lou Burger',
    chargeCommission: true,
    commissionPct: null,
    chargeRent: false,
    rentCents: 0,
    orderItems: [],
    ...over,
  };
}

beforeEach(async () => {
  vi.clearAllMocks();
  Object.assign(prismaMock, criarPrismaMock());
  prismaMock.accountUser.findUnique.mockResolvedValue(usuarioDono('owner'));
  prismaMock.space.findFirst.mockResolvedValue(ESPACO);
  prismaMock.account.findUnique.mockResolvedValue({ status: 'ativa' });
  app = await buildApp({ socket: false, logger: false, cron: false });
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

// ─── Ciclo aberto: calcula ao vivo ──────────────────────────────────────────

describe('ciclo em andamento', () => {
  it('soma o bruto a partir dos itens vendidos', async () => {
    prismaMock.billingCycle.findUnique.mockResolvedValue(null);
    prismaMock.kitchen.findMany.mockResolvedValue([
      cozinha({
        orderItems: [
          { qty: 2, unitPriceCents: 1800 },
          { qty: 1, unitPriceCents: 3200 },
        ],
      }),
    ]);

    const r = await app.inject({
      method: 'GET',
      url: '/api/a/financeiro?refMonth=2026-01',
      headers: auth(),
    });

    expect(r.statusCode).toBe(200);
    const j = r.json();
    expect(j.fechado).toBe(false);
    expect(j.linhas[0].grossCents).toBe(1800 * 2 + 3200);
    // 15% do padrão do quintal
    expect(j.linhas[0].commissionCents).toBe(Math.round(6800 * 0.15));
  });

  it('a busca dos itens respeita a janela do mes', async () => {
    prismaMock.billingCycle.findUnique.mockResolvedValue(null);
    prismaMock.kitchen.findMany.mockResolvedValue([]);

    await app.inject({
      method: 'GET',
      url: '/api/a/financeiro?refMonth=2026-02',
      headers: auth(),
    });

    const where = prismaMock.kitchen.findMany.mock.calls[0][0].include.orderItems.where;
    expect(where.createdAt.gte.toISOString()).toBe('2026-02-01T00:00:00.000Z');
    // Fevereiro de 2026 tem 28 dias — a janela não pode vazar pra março
    expect(where.createdAt.lte.toISOString()).toBe('2026-02-28T23:59:59.999Z');
  });

  it('item cancelado NAO entra no bruto', async () => {
    prismaMock.billingCycle.findUnique.mockResolvedValue(null);
    prismaMock.kitchen.findMany.mockResolvedValue([]);

    await app.inject({
      method: 'GET',
      url: '/api/a/financeiro?refMonth=2026-01',
      headers: auth(),
    });

    // Cobrar comissão sobre pedido cancelado é cobrar por venda que não houve
    const where = prismaMock.kitchen.findMany.mock.calls[0][0].include.orderItems.where;
    expect(where.status.not).toBe('cancelado');
  });

  it('a busca de cozinhas fica presa ao espaco', async () => {
    prismaMock.billingCycle.findUnique.mockResolvedValue(null);
    prismaMock.kitchen.findMany.mockResolvedValue([]);

    await app.inject({
      method: 'GET',
      url: '/api/a/financeiro?refMonth=2026-01',
      headers: auth(),
    });

    expect(prismaMock.kitchen.findMany.mock.calls[0][0].where.spaceId).toBe(ESPACO.id);
  });

  it('todas as linhas saem como "aberta" e sem data de pagamento', async () => {
    prismaMock.billingCycle.findUnique.mockResolvedValue(null);
    prismaMock.kitchen.findMany.mockResolvedValue([cozinha(), cozinha({ id: 'k2', slug: 'b' })]);

    const j = (
      await app.inject({
        method: 'GET',
        url: '/api/a/financeiro?refMonth=2026-01',
        headers: auth(),
      })
    ).json();

    for (const l of j.linhas) {
      expect(l.status).toBe('aberta');
      expect(l.paidAt).toBeNull();
    }
  });
});

// ─── Totais ─────────────────────────────────────────────────────────────────

describe('totais do ciclo', () => {
  it('somam as linhas, e aReceber bate com comissao + aluguel', async () => {
    prismaMock.billingCycle.findUnique.mockResolvedValue(null);
    prismaMock.kitchen.findMany.mockResolvedValue([
      // padrão 15%, sem aluguel
      cozinha({ orderItems: [{ qty: 10, unitPriceCents: 1000 }] }),
      // 12% negociado + aluguel de 800
      cozinha({
        id: 'k2',
        slug: 'cumbuca',
        name: 'Cumbuca',
        commissionPct: 12,
        chargeRent: true,
        rentCents: 80_000,
        orderItems: [{ qty: 5, unitPriceCents: 5000 }],
      }),
      // âncora: não paga nada
      cozinha({
        id: 'k3',
        slug: 'taverna',
        name: 'Taverna',
        chargeCommission: false,
        orderItems: [{ qty: 3, unitPriceCents: 2000 }],
      }),
    ]);

    const j = (
      await app.inject({
        method: 'GET',
        url: '/api/a/financeiro?refMonth=2026-01',
        headers: auth(),
      })
    ).json();

    // k1: 10 x 1000 = 10.000, comissao 15%  = 1.500
    // k2:  5 x 5000 = 25.000, comissao 12%  = 3.000, + aluguel 80.000
    // k3:  3 x 2000 =  6.000, sem comissao  =     0  <- e o bruto NAO aparece
    //
    // O total soma so quem o dono pode ver. Somar os 6.000 da ancora aqui
    // entregaria o faturamento dela por subtracao, tornando inutil escondê-lo
    // na linha.
    expect(j.totais.grossCents).toBe(10_000 + 25_000);
    expect(j.totais.grossParcial).toBe(true);
    expect(j.totais.cozinhasOcultas).toBe(1);

    // O que ela DEVE continua somando normalmente: isso e dinheiro do dono.
    expect(j.totais.commissionCents).toBe(1_500 + 3_000 + 0);
    expect(j.totais.rentCents).toBe(80_000);
    expect(j.totais.aReceberCents).toBe(j.totais.commissionCents + j.totais.rentCents);

    // A âncora aparece na lista, devendo zero — sumir dela esconderia do dono
    // que aquela cozinha existe e não paga.
    const taverna = j.linhas.find((l: { kitchenSlug: string }) => l.kitchenSlug === 'taverna');
    expect(taverna.totalDueCents).toBe(0);
    // Mas o bruto dela vem `null`, e nao `0`: zero se leria como "nao vendeu".
    expect(taverna.grossCents).toBeNull();
  });

  it('quintal sem venda nenhuma devolve zeros, nao erro', async () => {
    prismaMock.billingCycle.findUnique.mockResolvedValue(null);
    prismaMock.kitchen.findMany.mockResolvedValue([]);

    const r = await app.inject({
      method: 'GET',
      url: '/api/a/financeiro?refMonth=2026-01',
      headers: auth(),
    });

    expect(r.statusCode).toBe(200);
    expect(r.json().totais).toEqual({
      grossCents: 0,
      commissionCents: 0,
      rentCents: 0,
      aReceberCents: 0,
      grossParcial: false,
      cozinhasOcultas: 0,
    });
  });

  it('cozinha sem venda ainda deve o aluguel', async () => {
    prismaMock.billingCycle.findUnique.mockResolvedValue(null);
    prismaMock.kitchen.findMany.mockResolvedValue([
      cozinha({ chargeRent: true, rentCents: 80_000, orderItems: [] }),
    ]);

    const j = (
      await app.inject({
        method: 'GET',
        url: '/api/a/financeiro?refMonth=2026-01',
        headers: auth(),
      })
    ).json();

    expect(j.linhas[0].grossCents).toBe(0);
    expect(j.linhas[0].totalDueCents).toBe(80_000);
  });
});

// ─── Ciclo fechado: lê o congelado ──────────────────────────────────────────

describe('ciclo fechado', () => {
  it('le os valores gravados, sem recalcular', async () => {
    prismaMock.billingCycle.findUnique.mockResolvedValue({
      id: 'ciclo-1',
      status: 'fechado',
      charges: [
        {
          kitchenId: 'k1',
          kitchen: { slug: 'lou-burger', name: 'Lou Burger' },
          grossCents: 100_000,
          // Percentual do acordo VIGENTE quando o ciclo fechou
          commissionPct: 15,
          commissionCents: 15_000,
          rentCents: 0,
          totalDueCents: 15_000,
          status: 'paga',
          paidAt: new Date('2026-02-03T10:00:00Z'),
        },
      ],
    });

    const j = (
      await app.inject({
        method: 'GET',
        url: '/api/a/financeiro?refMonth=2026-01',
        headers: auth(),
      })
    ).json();

    expect(j.fechado).toBe(true);
    expect(j.linhas[0].totalDueCents).toBe(15_000);
    expect(j.linhas[0].status).toBe('paga');
    expect(j.linhas[0].paidAt).toBe('2026-02-03T10:00:00.000Z');

    // Não pode ter ido buscar item de pedido: o valor é snapshot. Recalcular
    // faria uma renegociação de comissão mudar uma cobrança já emitida.
    expect(prismaMock.kitchen.findMany).not.toHaveBeenCalled();
  });

  it('ciclo ABERTO no banco ainda calcula ao vivo', async () => {
    prismaMock.billingCycle.findUnique.mockResolvedValue({
      id: 'ciclo-1',
      status: 'aberto',
      charges: [],
    });
    prismaMock.kitchen.findMany.mockResolvedValue([cozinha()]);

    const j = (
      await app.inject({
        method: 'GET',
        url: '/api/a/financeiro?refMonth=2026-01',
        headers: auth(),
      })
    ).json();

    expect(j.fechado).toBe(false);
    expect(prismaMock.kitchen.findMany).toHaveBeenCalled();
  });

  it('busca o ciclo pela chave composta espaco+mes', async () => {
    prismaMock.billingCycle.findUnique.mockResolvedValue(null);
    prismaMock.kitchen.findMany.mockResolvedValue([]);

    await app.inject({
      method: 'GET',
      url: '/api/a/financeiro?refMonth=2026-01',
      headers: auth(),
    });

    const where = prismaMock.billingCycle.findUnique.mock.calls[0][0].where;
    expect(where.spaceId_refMonth).toEqual({ spaceId: ESPACO.id, refMonth: '2026-01' });
  });
});

// ─── Mês de referência ──────────────────────────────────────────────────────

describe('refMonth', () => {
  it('sem refMonth usa o mes corrente', async () => {
    prismaMock.billingCycle.findUnique.mockResolvedValue(null);
    prismaMock.kitchen.findMany.mockResolvedValue([]);

    const j = (
      await app.inject({ method: 'GET', url: '/api/a/financeiro', headers: auth() })
    ).json();

    const agora = new Date();
    const esperado = `${agora.getUTCFullYear()}-${String(agora.getUTCMonth() + 1).padStart(2, '0')}`;
    expect(j.refMonth).toBe(esperado);
  });

  it('devolve a janela junto — a tela precisa mostrar o periodo', async () => {
    prismaMock.billingCycle.findUnique.mockResolvedValue(null);
    prismaMock.kitchen.findMany.mockResolvedValue([]);

    const j = (
      await app.inject({
        method: 'GET',
        url: '/api/a/financeiro?refMonth=2026-12',
        headers: auth(),
      })
    ).json();

    expect(j.startsAt).toBe('2026-12-01T00:00:00.000Z');
    expect(j.endsAt).toBe('2026-12-31T23:59:59.999Z');
    expect(j.closingDay).toBe(ESPACO.closingDay);
  });
});
