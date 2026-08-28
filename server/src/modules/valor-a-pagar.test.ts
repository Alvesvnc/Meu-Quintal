import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { criarPrismaMock, ESPACO, CONTA, usuarioDono, type PrismaMock , cozinhaLogada } from '../test/prismaMock.js';

const prismaMock: PrismaMock = criarPrismaMock();
vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }));

const { buildApp } = await import('../app.js');

/**
 * UMA REGRA, TODOS OS LUGARES: reduziu quantidade ou cancelou item, o valor
 * cai junto.
 *
 * `Order.totalCents` é o snapshot do que foi PEDIDO — registro histórico que
 * não se reescreve. Somá-lo produz um número inflado, e cada rota que fizer
 * isso vai divergir das outras.
 *
 * Este arquivo existe porque a regra escapou em três rotas de uma vez, e a pior
 * foi a de fechar conta: a cozinha era avisada para cobrar o valor original.
 * Testes aqui são o que impede a quarta.
 */

let app: FastifyInstance;

const MESA = {
  id: 'table-1',
  numero: 4,
  qrToken: 'mesa-4-dev',
  isActive: true,
  spaceId: 'space-1',
  space: { id: 'space-1', slug: 'sao-sebastiao' },
};

/**
 * Pedido de R$ 90 originalmente; R$ 18 depois de reduzir e cancelar.
 *
 * `kitchen.chargeCommission: true` porque nas telas do dono o bruto so entra
 * na soma quando ele pode ver — ver lib/faturamento.ts. Este arquivo testa a
 * outra regra (valor acompanha a reducao), entao a cozinha e visivel pra que
 * uma coisa nao mascare a outra.
 */
const ITENS_APOS_MUDANCA = [
  // era 3x R$ 18 = R$ 54, ficou 1x = R$ 18
  { qty: 1, unitPriceCents: 1800, status: 'novo', kitchen: { id: 'k1', chargeCommission: true } },
  // era 1x R$ 36, foi cancelado
  {
    qty: 1,
    unitPriceCents: 3600,
    status: 'cancelado',
    kitchen: { id: 'k1', chargeCommission: true },
  },
];
const ORIGINAL_CENTS = 9000;
const A_PAGAR_CENTS = 1800;

const authMesa = { authorization: 'Bearer mesa-4-dev' };

function tokenDono() {
  return app.jwt.sign({
    kind: 'dono' as const,
    sub: 'user-1',
    accountId: CONTA.id,
    accountSlug: CONTA.slug,
    email: 'marina@qro.app',
    role: 'owner',
  });
}
const authDono = () => ({ authorization: `Bearer ${tokenDono()}` });

/** O que foi emitido no socket. O app de teste usa o `io` de mentira. */
const emitidos: Array<{ evento: string; payload: Record<string, unknown> }> = [];

function eventoEmitido(nome: string): Record<string, unknown> | undefined {
  return emitidos.find((e) => e.evento === nome)?.payload;
}

beforeEach(async () => {
  vi.clearAllMocks();
  emitidos.length = 0;
  Object.assign(prismaMock, criarPrismaMock());
  cozinhaLogada(prismaMock, 'k1', 'ku1');
  prismaMock.table.findUnique.mockResolvedValue(MESA);
  prismaMock.accountUser.findUnique.mockResolvedValue(usuarioDono('owner'));
  prismaMock.space.findFirst.mockResolvedValue(ESPACO);
  prismaMock.account.findUnique.mockResolvedValue({ status: 'ativa' });
  app = await buildApp({ socket: false, logger: false, cron: false });

  // Intercepta o io de mentira pra ler o payload dos eventos. E o unico jeito
  // de verificar um valor que so existe dentro do evento.
  Object.defineProperty(app.io, 'to', {
    configurable: true,
    value: () => ({
      emit: (evento: string, payload: Record<string, unknown>) => {
        emitidos.push({ evento, payload });
        return true;
      },
    }),
  });

  await app.ready();
});

afterEach(async () => {
  await app.close();
});

// ─── O momento do pagamento ─────────────────────────────────────────────────

describe('POST /api/m/pedidos/fechar-conta', () => {
  it('a cozinha e avisada do valor REAL, nao do original', async () => {
    prismaMock.order.findMany.mockResolvedValue([
      { id: 'o1', totalCents: ORIGINAL_CENTS, items: ITENS_APOS_MUDANCA },
    ]);
    prismaMock.kitchen.findFirst.mockResolvedValue({ id: 'k1' });

    const r = await app.inject({
      method: 'POST',
      url: '/api/m/pedidos/fechar-conta',
      headers: authMesa,
      payload: { kitchenSlug: 'lou-burger' },
    });

    expect(r.statusCode).toBe(200);

    // O EVENTO e o que a cozinha recebe dizendo quanto cobrar. Somando o
    // snapshot, ela cobraria R$ 90 de quem deve R$ 18 — no balcao, na frente
    // do cliente. E o ponto onde o erro custa mais caro.
    expect(eventoEmitido('payment:requested')?.totalCents).toBe(A_PAGAR_CENTS);
  });

  it('sem cancelamento, o valor do evento e o mesmo do pedido', async () => {
    prismaMock.order.findMany.mockResolvedValue([
      {
        id: 'o1',
        totalCents: 5400,
        items: [{ qty: 3, unitPriceCents: 1800, status: 'novo' }],
      },
    ]);
    prismaMock.kitchen.findFirst.mockResolvedValue({ id: 'k1' });

    await app.inject({
      method: 'POST',
      url: '/api/m/pedidos/fechar-conta',
      headers: authMesa,
      payload: { kitchenSlug: 'lou-burger' },
    });

    expect(eventoEmitido('payment:requested')?.totalCents).toBe(5400);
  });

  it('tudo cancelado: o evento leva zero', async () => {
    prismaMock.order.findMany.mockResolvedValue([
      {
        id: 'o1',
        totalCents: 5400,
        items: [{ qty: 3, unitPriceCents: 1800, status: 'cancelado' }],
      },
    ]);
    prismaMock.kitchen.findFirst.mockResolvedValue({ id: 'k1' });

    await app.inject({
      method: 'POST',
      url: '/api/m/pedidos/fechar-conta',
      headers: authMesa,
      payload: { kitchenSlug: 'lou-burger' },
    });

    expect(eventoEmitido('payment:requested')?.totalCents).toBe(0);
  });

  it('so conta os itens DESTA cozinha', async () => {
    prismaMock.order.findMany.mockResolvedValue([]);
    await app.inject({
      method: 'POST',
      url: '/api/m/pedidos/fechar-conta',
      headers: authMesa,
      payload: { kitchenSlug: 'lou-burger' },
    });

    // "Fechar conta dessa cozinha" e o que se deve a ela, nao o pedido inteiro.
    const select = prismaMock.order.findMany.mock.calls[0][0].select;
    expect(select.items.where.kitchen.slug).toBe('lou-burger');
  });

  it('busca os ITENS, nao so o total do pedido', async () => {
    prismaMock.order.findMany.mockResolvedValue([]);
    await app.inject({
      method: 'POST',
      url: '/api/m/pedidos/fechar-conta',
      headers: authMesa,
      payload: { kitchenSlug: 'lou-burger' },
    });

    const select = prismaMock.order.findMany.mock.calls[0][0].select;
    // Sem os itens nao ha como calcular o valor real — foi exatamente o que
    // faltava quando a rota somava `o.totalCents`.
    expect(select.items.select).toMatchObject({ qty: true, unitPriceCents: true, status: true });
  });
});

// ─── A tela do cliente ──────────────────────────────────────────────────────

describe('o que o cliente ve', () => {
  it('GET /api/m/pedido/:id separa o pedido do a-pagar', async () => {
    prismaMock.order.findFirst.mockResolvedValue({
      id: 'o1',
      shortId: '123',
      createdAt: new Date(),
      totalCents: ORIGINAL_CENTS,
      table: { numero: 4 },
      items: ITENS_APOS_MUDANCA.map((i, n) => ({
        ...i,
        id: `i${n}`,
        nameSnapshot: `item ${n}`,
        note: null,
        acceptedAt: null,
        readyAt: null,
        pickedAt: null,
        kitchen: { slug: 'lou-burger', name: 'Lou Burger', slaMinutes: 12 },
      })),
    });

    const j = (
      await app.inject({ method: 'GET', url: '/api/m/pedido/o1', headers: authMesa })
    ).json();

    expect(j.totalCents).toBe(ORIGINAL_CENTS);
    expect(j.totalAtivosCents).toBe(A_PAGAR_CENTS);
  });
});

// ─── O painel do dono ───────────────────────────────────────────────────────

describe('faturamento que o dono ve', () => {
  it('o overview soma o VENDIDO, nao o pedido', async () => {
    prismaMock.order.findMany.mockResolvedValue([{ items: ITENS_APOS_MUDANCA }]);

    const j = (
      await app.inject({ method: 'GET', url: '/api/a/overview', headers: authDono() })
    ).json();

    // Somar o snapshot inflaria o faturamento do dia — e ficaria em desacordo
    // com o financeiro da MESMA tela, que ja calcula por item.
    expect(j.hoje.grossCents).toBe(A_PAGAR_CENTS);
  });

  it('o overview busca os itens de cada pedido', async () => {
    prismaMock.order.findMany.mockResolvedValue([]);
    await app.inject({ method: 'GET', url: '/api/a/overview', headers: authDono() });

    const select = prismaMock.order.findMany.mock.calls[0][0].select;
    expect(select.items.select).toMatchObject({ qty: true, unitPriceCents: true, status: true });
  });

  it('a tela de mesas soma o consumido, nao o pedido', async () => {
    prismaMock.table.findMany.mockResolvedValue([
      {
        id: 't1',
        numero: 4,
        status: 'ocupada',
        isActive: true,
        qrToken: 'segredo',
        orders: [{ items: ITENS_APOS_MUDANCA }],
      },
    ]);

    const j = (
      await app.inject({ method: 'GET', url: '/api/a/mesas', headers: authDono() })
    ).json();

    expect(j[0].grossTodayCents).toBe(A_PAGAR_CENTS);
  });

  it('o financeiro ja usava a regra certa — nao regrediu', async () => {
    prismaMock.billingCycle.findUnique.mockResolvedValue(null);
    prismaMock.kitchen.findMany.mockResolvedValue([
      {
        id: 'k1',
        slug: 'lou-burger',
        name: 'Lou Burger',
        chargeCommission: true,
        commissionPct: null,
        chargeRent: false,
        rentCents: 0,
        // A query do financeiro ja filtra cancelado no proprio `where`, entao
        // aqui chega so o item ativo.
        orderItems: [{ qty: 1, unitPriceCents: 1800 }],
      },
    ]);

    const j = (
      await app.inject({
        method: 'GET',
        url: '/api/a/financeiro?refMonth=2026-01',
        headers: authDono(),
      })
    ).json();

    expect(j.linhas[0].grossCents).toBe(A_PAGAR_CENTS);
  });
});

// ─── A fila da cozinha ──────────────────────────────────────────────────────

describe('o que a cozinha ve na fila', () => {
  it('o total da fila e o valor real', async () => {
    prismaMock.kitchen.findUnique.mockResolvedValue({
      id: 'k1',
      slug: 'lou-burger',
      name: 'Lou Burger',
      status: 'ativa',
      spaceId: 'space-1',
    });
    prismaMock.order.findMany.mockResolvedValue([
      {
        id: 'o1',
        shortId: '123',
        createdAt: new Date(),
        paymentRequestedAt: null,
        table: { numero: 4 },
        items: ITENS_APOS_MUDANCA.map((i, n) => ({
          ...i,
          id: `i${n}`,
          note: null,
          nameSnapshot: `item ${n}`,
          createdAt: new Date(),
          acceptedAt: null,
          readyAt: null,
          pickedAt: null,
        })),
        changes: [],
      },
    ]);

    const token = app.jwt.sign({
      kind: 'cozinha' as const,
      sub: 'ku1',
      kitchenId: 'k1',
      kitchenSlug: 'lou-burger',
      email: 'a@b.c',
      role: 'owner',
    });

    const j = (
      await app.inject({
        method: 'GET',
        url: '/api/r/fila',
        headers: { authorization: `Bearer ${token}` },
      })
    ).json();

    // Se a cozinha ve um valor e o cliente outro, alguem discute no balcao.
    expect(j.orders[0].totalCents).toBe(A_PAGAR_CENTS);
  });
});
