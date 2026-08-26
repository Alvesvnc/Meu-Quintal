import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { criarPrismaMock, type PrismaMock } from '../test/prismaMock.js';

const prismaMock: PrismaMock = criarPrismaMock();
vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }));

const { buildApp } = await import('../app.js');

let app: FastifyInstance;

const UUID_ITEM = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const UUID_ITEM_2 = '3f2504e0-4f89-41d3-9a0c-0305e82c3302';

const MESA = {
  id: 'table-1',
  numero: 4,
  qrToken: 'mesa-4-dev',
  isActive: true,
  spaceId: 'space-1',
  space: { id: 'space-1', slug: 'sao-sebastiao' },
};

/** MenuItem no formato que a rota espera do banco (com kitchen embutida). */
function itemDeCardapio(id: string, spaceId = 'space-1', priceCents = 1800) {
  return {
    id,
    name: 'Batata-doce frita',
    priceCents,
    available: true,
    kitchenId: 'kitchen-1',
    kitchen: { id: 'kitchen-1', slug: 'lou-burger', spaceId },
  };
}

const comMesa = (token = 'mesa-4-dev') => ({ authorization: `Bearer ${token}` });

beforeEach(async () => {
  vi.clearAllMocks();
  Object.assign(prismaMock, criarPrismaMock());
  app = await buildApp({ socket: false, logger: false, cron: false });
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

// ─── O guarda de mesa ───────────────────────────────────────────────────────

describe('auth de mesa em /api/m/*', () => {
  it('sem Authorization devolve 401', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/m/quintal' });
    expect(r.statusCode).toBe(401);
  });

  it('sem o prefixo Bearer devolve 401', async () => {
    const r = await app.inject({
      method: 'GET',
      url: '/api/m/quintal',
      headers: { authorization: 'mesa-4-dev' },
    });
    expect(r.statusCode).toBe(401);
  });

  it('qrToken desconhecido devolve 401', async () => {
    prismaMock.table.findUnique.mockResolvedValue(null);
    const r = await app.inject({
      method: 'GET',
      url: '/api/m/quintal',
      headers: comMesa('token-inventado'),
    });
    expect(r.statusCode).toBe(401);
  });

  it('mesa desativada devolve 401 — desativar precisa ter efeito imediato', async () => {
    prismaMock.table.findUnique.mockResolvedValue({ ...MESA, isActive: false });
    const r = await app.inject({
      method: 'GET',
      url: '/api/m/quintal',
      headers: comMesa(),
    });
    expect(r.statusCode).toBe(401);
  });

  it('o guarda so vale pra /api/m/* — /health passa livre', async () => {
    const r = await app.inject({ method: 'GET', url: '/health' });
    expect(r.statusCode).toBe(200);
  });
});

// ─── Criação de pedido ──────────────────────────────────────────────────────

describe('POST /api/m/pedido — validacao', () => {
  beforeEach(() => {
    prismaMock.table.findUnique.mockResolvedValue(MESA);
  });

  it('recusa carrinho vazio', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/m/pedido',
      headers: comMesa(),
      payload: { items: [] },
    });
    expect(r.statusCode).toBe(400);
  });

  it('recusa qty acima do teto', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/m/pedido',
      headers: comMesa(),
      payload: { items: [{ menuItemId: UUID_ITEM, qty: 999 }] },
    });
    expect(r.statusCode).toBe(400);
  });

  it('recusa menuItemId que nao e uuid', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/m/pedido',
      headers: comMesa(),
      payload: { items: [{ menuItemId: 'nao-e-uuid', qty: 1 }] },
    });
    expect(r.statusCode).toBe(400);
  });

  it('recusa item que nao existe', async () => {
    prismaMock.menuItem.findMany.mockResolvedValue([]);
    const r = await app.inject({
      method: 'POST',
      url: '/api/m/pedido',
      headers: comMesa(),
      payload: { items: [{ menuItemId: UUID_ITEM, qty: 1 }] },
    });
    expect(r.statusCode).toBe(400);
    expect(r.json().error).toMatch(/nao existe/i);
  });

  // ── A trava de isolamento do lado do cliente ─────────────────────────────
  it('recusa item de cozinha de OUTRO quintal', async () => {
    // Item existe, mas pertence a um espaco diferente do da mesa. Sem esta
    // checagem, saber o UUID de um item bastaria pra fazer pedido cruzado
    // entre clientes do SaaS.
    prismaMock.menuItem.findMany.mockResolvedValue([itemDeCardapio(UUID_ITEM, 'space-DE-OUTRO')]);

    const r = await app.inject({
      method: 'POST',
      url: '/api/m/pedido',
      headers: comMesa(),
      payload: { items: [{ menuItemId: UUID_ITEM, qty: 1 }] },
    });

    expect(r.statusCode).toBe(400);
    expect(r.json().error).toMatch(/fora do quintal/i);
    expect(prismaMock.order.create).not.toHaveBeenCalled();
  });

  it('recusa se UM item entre varios for de outro quintal', async () => {
    prismaMock.menuItem.findMany.mockResolvedValue([
      itemDeCardapio(UUID_ITEM, 'space-1'),
      itemDeCardapio(UUID_ITEM_2, 'space-DE-OUTRO'),
    ]);

    const r = await app.inject({
      method: 'POST',
      url: '/api/m/pedido',
      headers: comMesa(),
      payload: {
        items: [
          { menuItemId: UUID_ITEM, qty: 1 },
          { menuItemId: UUID_ITEM_2, qty: 1 },
        ],
      },
    });

    expect(r.statusCode).toBe(400);
    expect(prismaMock.order.create).not.toHaveBeenCalled();
  });

  it('a busca de itens acontece antes de qualquer escrita', async () => {
    prismaMock.menuItem.findMany.mockResolvedValue([]);
    await app.inject({
      method: 'POST',
      url: '/api/m/pedido',
      headers: comMesa(),
      payload: { items: [{ menuItemId: UUID_ITEM, qty: 1 }] },
    });
    // Pedido invalido nao pode deixar rastro no banco
    expect(prismaMock.order.create).not.toHaveBeenCalled();
  });
});

// ─── Rotas de leitura ───────────────────────────────────────────────────────

describe('GET /api/m/k/:slug — cardapio', () => {
  beforeEach(() => {
    prismaMock.table.findUnique.mockResolvedValue(MESA);
  });

  it('a busca da cozinha filtra pelo spaceId da mesa', async () => {
    prismaMock.kitchen.findFirst.mockResolvedValue(null);
    await app.inject({
      method: 'GET',
      url: '/api/m/k/lou-burger',
      headers: comMesa(),
    });

    const where = prismaMock.kitchen.findFirst.mock.calls[0][0].where;
    // Com slug unico por espaco, buscar so por slug acertaria a cozinha
    // homonima de outro cliente do SaaS.
    expect(where.spaceId).toBe(MESA.spaceId);
    expect(where.slug).toBe('lou-burger');
  });

  it('cozinha de outro quintal devolve 404', async () => {
    prismaMock.kitchen.findFirst.mockResolvedValue(null);
    const r = await app.inject({
      method: 'GET',
      url: '/api/m/k/cozinha-de-outro-quintal',
      headers: comMesa(),
    });
    expect(r.statusCode).toBe(404);
    expect(r.json().error).toMatch(/nesse quintal/i);
  });
});

describe('GET /api/m/quintal', () => {
  it('lista so as cozinhas ativas do espaco da mesa', async () => {
    prismaMock.table.findUnique.mockResolvedValue(MESA);
    prismaMock.kitchen.findMany.mockResolvedValue([]);
    prismaMock.space.findUnique.mockResolvedValue({ name: 'Meu Quintal' });

    const r = await app.inject({
      method: 'GET',
      url: '/api/m/quintal',
      headers: comMesa(),
    });

    expect(r.statusCode).toBe(200);
    const where = prismaMock.kitchen.findMany.mock.calls[0][0].where;
    expect(where.spaceId).toBe(MESA.spaceId);
    expect(where.status).toBe('ativa');
  });
});

// ─── Rota de desenvolvimento ────────────────────────────────────────────────

describe('rota /api/_dev', () => {
  it('nao existe fora de development', async () => {
    // O setup de teste fixa NODE_ENV=test, entao a rota nao e registrada.
    prismaMock.table.findUnique.mockResolvedValue(MESA);
    const r = await app.inject({
      method: 'PATCH',
      url: '/api/_dev/order/qualquer-id/advance',
      payload: { kitchenSlug: 'lou-burger' },
    });
    expect(r.statusCode).toBe(404);
  });
});

// ─── Limites do processo ────────────────────────────────────────────────────

describe('limites', () => {
  it('body acima do teto devolve 413, nao 500', async () => {
    prismaMock.table.findUnique.mockResolvedValue(MESA);
    const gigante = {
      items: Array.from({ length: 60_000 }, () => ({ menuItemId: UUID_ITEM, qty: 1 })),
    };
    const r = await app.inject({
      method: 'POST',
      url: '/api/m/pedido',
      headers: comMesa(),
      payload: gigante,
    });
    expect(r.statusCode).toBe(413);
  });

  it('rota inexistente devolve 404 com mensagem, nao stack', async () => {
    const r = await app.inject({ method: 'GET', url: '/rota/que/nao/existe' });
    expect(r.statusCode).toBe(404);
    expect(r.body).not.toMatch(/at .*\.ts:/);
  });
});
