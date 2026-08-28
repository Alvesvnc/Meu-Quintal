import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { criarPrismaMock, type PrismaMock } from '../test/prismaMock.js';

const prismaMock: PrismaMock = criarPrismaMock();
vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }));

const { buildApp } = await import('../app.js');

/**
 * GET /api/m/pedido/:id — o que o cliente vê enquanto espera.
 *
 * O foco é o cancelamento parcial, corrigido em 2026-08-24: cancelar um item de
 * um pedido de dois fazia o cliente ler "cancelado" e ir embora achando que
 * perdeu tudo, enquanto a cozinha entregava o outro item no balcão. E o total
 * continuava mostrando o valor do item que não vinha mais.
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

const LOU = { slug: 'lou-burger', name: 'Lou Burger', slaMinutes: 12 };

function item(
  over: Partial<{
    id: string;
    qty: number;
    unitPriceCents: number;
    nameSnapshot: string;
    status: string;
    note: string | null;
    kitchen: { slug: string; name: string; slaMinutes: number };
  }> = {},
) {
  return {
    id: 'i1',
    qty: 1,
    unitPriceCents: 1800,
    nameSnapshot: 'Batata-doce frita',
    status: 'novo',
    note: null,
    acceptedAt: null,
    readyAt: null,
    pickedAt: null,
    kitchen: LOU,
    ...over,
  };
}

/** Pedido no formato que a rota espera do banco. */
function pedido(itens: ReturnType<typeof item>[], totalCents: number) {
  return {
    id: 'order-1',
    shortId: '12345',
    createdAt: new Date('2026-08-24T20:00:00Z'),
    totalCents,
    table: { numero: MESA.numero },
    items: itens,
  };
}

const comMesa = { authorization: 'Bearer mesa-4-dev' };

beforeEach(async () => {
  vi.clearAllMocks();
  Object.assign(prismaMock, criarPrismaMock());
  prismaMock.table.findUnique.mockResolvedValue(MESA);
  app = await buildApp({ socket: false, logger: false, cron: false });
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

// ─── Escopo ─────────────────────────────────────────────────────────────────

describe('GET /api/m/pedido/:id — escopo', () => {
  it('busca amarrada a mesa da credencial', async () => {
    prismaMock.order.findFirst.mockResolvedValue(null);
    await app.inject({ method: 'GET', url: '/api/m/pedido/qualquer', headers: comMesa });

    const where = prismaMock.order.findFirst.mock.calls[0][0].where;
    // Sem o tableId, saber o id do pedido bastaria pra espiar o de outra mesa.
    expect(where.tableId).toBe(MESA.id);
    expect(where.id).toBe('qualquer');
  });

  it('pedido de outra mesa devolve 404', async () => {
    prismaMock.order.findFirst.mockResolvedValue(null);
    const r = await app.inject({
      method: 'GET',
      url: '/api/m/pedido/pedido-alheio',
      headers: comMesa,
    });
    expect(r.statusCode).toBe(404);
  });
});

// ─── Sem cancelamento ───────────────────────────────────────────────────────

describe('pedido sem cancelamento', () => {
  it('os dois totais sao iguais', async () => {
    prismaMock.order.findFirst.mockResolvedValue(
      pedido([item({ id: 'i1', qty: 2, unitPriceCents: 1800 })], 3600),
    );

    const j = (
      await app.inject({ method: 'GET', url: '/api/m/pedido/order-1', headers: comMesa })
    ).json();

    expect(j.totalCents).toBe(3600);
    expect(j.totalAtivosCents).toBe(3600);
  });

  it('status agregado e o item mais atrasado', async () => {
    prismaMock.order.findFirst.mockResolvedValue(
      pedido(
        [item({ id: 'i1', status: 'pronto' }), item({ id: 'i2', status: 'preparando' })],
        3600,
      ),
    );

    const j = (
      await app.inject({ method: 'GET', url: '/api/m/pedido/order-1', headers: comMesa })
    ).json();

    expect(j.kitchens[0].status).toBe('preparando');
  });
});

// ─── O caso que motivou a correção ──────────────────────────────────────────

describe('cancelamento PARCIAL', () => {
  const comUmCancelado = () =>
    pedido(
      [
        item({
          id: 'i1',
          qty: 1,
          unitPriceCents: 3200,
          nameSnapshot: 'Smash Lou',
          status: 'pronto',
        }),
        item({
          id: 'i2',
          qty: 1,
          unitPriceCents: 1800,
          nameSnapshot: 'Batata-doce frita',
          status: 'cancelado',
        }),
      ],
      5000,
    );

  it('o grupo NAO fica cancelado — mostra o progresso do que sobrou', async () => {
    prismaMock.order.findFirst.mockResolvedValue(comUmCancelado());

    const j = (
      await app.inject({ method: 'GET', url: '/api/m/pedido/order-1', headers: comMesa })
    ).json();

    // Antes da correcao isto era 'cancelado', e o cliente ia embora.
    expect(j.kitchens[0].status).toBe('pronto');
  });

  it('o total a pagar exclui o item cancelado', async () => {
    prismaMock.order.findFirst.mockResolvedValue(comUmCancelado());

    const j = (
      await app.inject({ method: 'GET', url: '/api/m/pedido/order-1', headers: comMesa })
    ).json();

    // O snapshot do que foi pedido continua intacto — e registro historico...
    expect(j.totalCents).toBe(5000);
    // ...e este e o que a pessoa paga no balcao.
    expect(j.totalAtivosCents).toBe(3200);
  });

  it('o item cancelado CONTINUA na resposta, com o status dele', async () => {
    prismaMock.order.findFirst.mockResolvedValue(comUmCancelado());

    const j = (
      await app.inject({ method: 'GET', url: '/api/m/pedido/order-1', headers: comMesa })
    ).json();

    // Omitir o item faria o pedido encolher sem explicacao: a pessoa lembra de
    // ter pedido duas coisas e ve uma na tela. A tela mostra riscado.
    expect(j.kitchens[0].items).toHaveLength(2);
    const cancelado = j.kitchens[0].items.find(
      (i: { name: string }) => i.name === 'Batata-doce frita',
    );
    expect(cancelado.status).toBe('cancelado');
  });
});

// ─── Tudo cancelado ─────────────────────────────────────────────────────────

describe('cancelamento TOTAL', () => {
  it('o grupo fica cancelado e o total a pagar zera', async () => {
    prismaMock.order.findFirst.mockResolvedValue(
      pedido(
        [
          item({ id: 'i1', unitPriceCents: 3200, status: 'cancelado' }),
          item({ id: 'i2', unitPriceCents: 1800, status: 'cancelado' }),
        ],
        5000,
      ),
    );

    const j = (
      await app.inject({ method: 'GET', url: '/api/m/pedido/order-1', headers: comMesa })
    ).json();

    expect(j.kitchens[0].status).toBe('cancelado');
    expect(j.totalAtivosCents).toBe(0);
    expect(j.totalCents).toBe(5000);
  });
});

// ─── Várias cozinhas ────────────────────────────────────────────────────────

describe('pedido com duas cozinhas', () => {
  it('cada cozinha agrega o proprio status, e o total soma as duas', async () => {
    const CUMBUCA = { slug: 'cumbuca-caicara', name: 'Cumbuca', slaMinutes: 18 };
    prismaMock.order.findFirst.mockResolvedValue(
      pedido(
        [
          item({ id: 'i1', unitPriceCents: 3200, status: 'pronto' }),
          item({ id: 'i2', unitPriceCents: 1800, status: 'cancelado' }),
          item({ id: 'i3', unitPriceCents: 5800, status: 'novo', kitchen: CUMBUCA }),
        ],
        10_800,
      ),
    );

    const j = (
      await app.inject({ method: 'GET', url: '/api/m/pedido/order-1', headers: comMesa })
    ).json();

    expect(j.kitchens).toHaveLength(2);

    const lou = j.kitchens.find((k: { kitchenSlug: string }) => k.kitchenSlug === 'lou-burger');
    const cumbuca = j.kitchens.find(
      (k: { kitchenSlug: string }) => k.kitchenSlug === 'cumbuca-caicara',
    );

    // O cancelamento numa cozinha nao afeta o status da outra
    expect(lou.status).toBe('pronto');
    expect(cumbuca.status).toBe('novo');

    expect(j.totalAtivosCents).toBe(3200 + 5800);
  });
});
