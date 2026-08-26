import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { criarPrismaMock, type PrismaMock } from '../test/prismaMock.js';

const prismaMock: PrismaMock = criarPrismaMock();
vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }));

const { buildApp } = await import('../app.js');

/**
 * A cozinha administrando a si mesma: cardápio, perfil, histórico, métricas.
 *
 * O que se testa aqui, acima de tudo, é o ISOLAMENTO. Toda rota daqui recebe um
 * id vindo da URL e precisa provar que aquele id é da cozinha logada antes de
 * tocar nele — senão bastaria conhecer um id para editar o cardápio da vizinha.
 * Por isso os testes olham o `where` que cada rota monta, e não só o status.
 */

let app: FastifyInstance;

const COZINHA = {
  id: 'k1',
  slug: 'lou-burger',
  name: 'Lou Burger',
  status: 'ativa' as const,
  spaceId: 'space-1',
};

const ITEM = {
  id: 'mi1',
  category: 'pratos',
  name: 'Smash Lou',
  description: null,
  priceCents: 3200,
  photoUrl: null,
  available: true,
  badge: null,
  sortOrder: 0,
};

function token() {
  return app.jwt.sign({
    kind: 'cozinha' as const,
    sub: 'ku1',
    kitchenId: COZINHA.id,
    kitchenSlug: COZINHA.slug,
    email: 'marcos@louburger.com',
    role: 'owner',
  });
}
const auth = () => ({ authorization: `Bearer ${token()}` });

beforeEach(async () => {
  vi.clearAllMocks();
  Object.assign(prismaMock, criarPrismaMock());
  prismaMock.kitchen.findUnique.mockResolvedValue(COZINHA);
  prismaMock.menuItem.findMany.mockResolvedValue([]);
  app = await buildApp({ socket: false, logger: false, cron: false });
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

// ─── Cardápio: leitura ──────────────────────────────────────────────────────

describe('GET /api/r/cardapio', () => {
  it('sem token, 401', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/r/cardapio' });
    expect(r.statusCode).toBe(401);
  });

  it('busca so o cardapio da PROPRIA cozinha', async () => {
    await app.inject({ method: 'GET', url: '/api/r/cardapio', headers: auth() });
    const where = prismaMock.menuItem.findMany.mock.calls[0][0].where;
    expect(where.kitchenId).toBe(COZINHA.id);
  });

  it('nao devolve item arquivado', async () => {
    await app.inject({ method: 'GET', url: '/api/r/cardapio', headers: auth() });
    const where = prismaMock.menuItem.findMany.mock.calls[0][0].where;
    // Item "excluido" continua no banco porque OrderItem aponta pra ele.
    expect(where.archivedAt).toBeNull();
  });

  it('traz esgotado — a cozinha precisa ver pra reativar', async () => {
    prismaMock.menuItem.findMany.mockResolvedValue([{ ...ITEM, available: false }]);
    const j = (
      await app.inject({ method: 'GET', url: '/api/r/cardapio', headers: auth() })
    ).json();
    expect(j.items[0].available).toBe(false);
  });

  it('traduz o badge de underscore pra hifen', async () => {
    prismaMock.menuItem.findMany.mockResolvedValue([{ ...ITEM, badge: 'sem_estoque' }]);
    const j = (
      await app.inject({ method: 'GET', url: '/api/r/cardapio', headers: auth() })
    ).json();
    // O Prisma nao aceita hifen em identificador de enum; a API usa hifen.
    expect(j.items[0].badge).toBe('sem-estoque');
  });
});

// ─── Cardápio: escrita ──────────────────────────────────────────────────────

describe('POST /api/r/cardapio', () => {
  const novo = { category: 'pratos', name: 'Smash Lou', priceCents: 3200 };

  it('cria com o kitchenId DO TOKEN', async () => {
    prismaMock.menuItem.create.mockResolvedValue(ITEM);
    await app.inject({ method: 'POST', url: '/api/r/cardapio', headers: auth(), payload: novo });
    expect(prismaMock.menuItem.create.mock.calls[0][0].data.kitchenId).toBe(COZINHA.id);
  });

  it('kitchenId no body e IGNORADO', async () => {
    prismaMock.menuItem.create.mockResolvedValue(ITEM);
    await app.inject({
      method: 'POST',
      url: '/api/r/cardapio',
      headers: auth(),
      payload: { ...novo, kitchenId: 'k-da-vizinha' },
    });
    // Aceitar do body deixaria qualquer cozinha escrever no cardapio alheio.
    expect(prismaMock.menuItem.create.mock.calls[0][0].data.kitchenId).toBe(COZINHA.id);
  });

  it('preco negativo e recusado', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/r/cardapio',
      headers: auth(),
      payload: { ...novo, priceCents: -100 },
    });
    expect(r.statusCode).toBe(400);
    expect(prismaMock.menuItem.create).not.toHaveBeenCalled();
  });

  it('preco fracionado e recusado', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/r/cardapio',
      headers: auth(),
      payload: { ...novo, priceCents: 32.5 },
    });
    // Centavo fracionado vira erro de arredondamento no fechamento do mes.
    expect(r.statusCode).toBe(400);
  });

  it('nome vazio e recusado', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/r/cardapio',
      headers: auth(),
      payload: { ...novo, name: ' ' },
    });
    expect(r.statusCode).toBe(400);
  });

  it('categoria fora da lista e recusada', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/r/cardapio',
      headers: auth(),
      payload: { ...novo, category: 'lanches' },
    });
    expect(r.statusCode).toBe(400);
  });
});

describe('PATCH /api/r/cardapio/:id', () => {
  it('o where amarra o item a cozinha logada', async () => {
    prismaMock.menuItem.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.menuItem.findUniqueOrThrow.mockResolvedValue(ITEM);

    await app.inject({
      method: 'PATCH',
      url: '/api/r/cardapio/mi1',
      headers: auth(),
      payload: { priceCents: 3500 },
    });

    const where = prismaMock.menuItem.updateMany.mock.calls[0][0].where;
    // `updateMany` com kitchenId no where, e nao `update` por id: com `update`
    // o registro seria achado antes de qualquer checagem de dono.
    expect(where).toMatchObject({ id: 'mi1', kitchenId: COZINHA.id, archivedAt: null });
  });

  it('item de outra cozinha devolve 404, nao 403', async () => {
    prismaMock.menuItem.updateMany.mockResolvedValue({ count: 0 });
    const r = await app.inject({
      method: 'PATCH',
      url: '/api/r/cardapio/mi-da-vizinha',
      headers: auth(),
      payload: { priceCents: 1 },
    });
    // 404 e nao 403: 403 confirmaria que o id existe em algum lugar.
    expect(r.statusCode).toBe(404);
  });

  it('body vazio e recusado', async () => {
    const r = await app.inject({
      method: 'PATCH',
      url: '/api/r/cardapio/mi1',
      headers: auth(),
      payload: {},
    });
    expect(r.statusCode).toBe(400);
    expect(prismaMock.menuItem.updateMany).not.toHaveBeenCalled();
  });

  it('esgotar e so um PATCH de available', async () => {
    prismaMock.menuItem.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.menuItem.findUniqueOrThrow.mockResolvedValue({ ...ITEM, available: false });

    const j = (
      await app.inject({
        method: 'PATCH',
        url: '/api/r/cardapio/mi1',
        headers: auth(),
        payload: { available: false },
      })
    ).json();

    expect(j.available).toBe(false);
  });
});

describe('DELETE /api/r/cardapio/:id', () => {
  it('ARQUIVA, nao apaga', async () => {
    prismaMock.menuItem.updateMany.mockResolvedValue({ count: 1 });

    const r = await app.inject({
      method: 'DELETE',
      url: '/api/r/cardapio/mi1',
      headers: auth(),
    });

    expect(r.statusCode).toBe(200);
    // OrderItem referencia MenuItem com Restrict: um DELETE de verdade falharia
    // em qualquer item ja vendido, e trocar por Cascade apagaria o historico de
    // pedidos junto — reescrevendo faturamento de ciclo ja fechado.
    expect(prismaMock.menuItem.delete).not.toHaveBeenCalled();
    expect(prismaMock.menuItem.updateMany).toHaveBeenCalled();
    const data = prismaMock.menuItem.updateMany.mock.calls[0][0].data;
    expect(data.archivedAt).toBeInstanceOf(Date);
  });

  it('arquivar tambem tira de disponivel', async () => {
    prismaMock.menuItem.updateMany.mockResolvedValue({ count: 1 });
    await app.inject({ method: 'DELETE', url: '/api/r/cardapio/mi1', headers: auth() });
    // Duas travas: quem filtra por arquivado e quem filtra so por available.
    expect(prismaMock.menuItem.updateMany.mock.calls[0][0].data.available).toBe(false);
  });

  it('nao arquiva item de outra cozinha', async () => {
    prismaMock.menuItem.updateMany.mockResolvedValue({ count: 0 });
    const r = await app.inject({
      method: 'DELETE',
      url: '/api/r/cardapio/mi-da-vizinha',
      headers: auth(),
    });
    expect(r.statusCode).toBe(404);
    expect(prismaMock.menuItem.updateMany.mock.calls[0][0].where.kitchenId).toBe(COZINHA.id);
  });
});

// ─── Perfil ─────────────────────────────────────────────────────────────────

describe('PATCH /api/r/perfil', () => {
  const PERFIL = {
    ...COZINHA,
    category: 'Hamburgueria',
    tagline: null,
    description: null,
    photoUrl: null,
    slaMinutes: 12,
  };

  it('atualiza a cozinha DO TOKEN', async () => {
    prismaMock.kitchen.update.mockResolvedValue(PERFIL);
    await app.inject({
      method: 'PATCH',
      url: '/api/r/perfil',
      headers: auth(),
      payload: { name: 'Lou Burger & Cia' },
    });
    expect(prismaMock.kitchen.update.mock.calls[0][0].where.id).toBe(COZINHA.id);
  });

  it('o slug NAO pode ser alterado', async () => {
    prismaMock.kitchen.update.mockResolvedValue(PERFIL);
    await app.inject({
      method: 'PATCH',
      url: '/api/r/perfil',
      headers: auth(),
      payload: { name: 'Novo', slug: 'outro-slug' },
    });
    // O slug e o endereco da cozinha: mudar quebraria QR impresso, link salvo e
    // sala de socket. Trocar slug e operacao do dono do espaco.
    expect(prismaMock.kitchen.update.mock.calls[0][0].data.slug).toBeUndefined();
  });

  it('a cozinha pode se pausar', async () => {
    prismaMock.kitchen.update.mockResolvedValue({ ...PERFIL, status: 'pausada' });
    const j = (
      await app.inject({
        method: 'PATCH',
        url: '/api/r/perfil',
        headers: auth(),
        payload: { status: 'pausada' },
      })
    ).json();
    expect(j.status).toBe('pausada');
  });

  it('nao pode se pôr em rascunho', async () => {
    const r = await app.inject({
      method: 'PATCH',
      url: '/api/r/perfil',
      headers: auth(),
      payload: { status: 'rascunho' },
    });
    // `rascunho` e estado do fluxo de convite, nao um botao da cozinha.
    expect(r.statusCode).toBe(400);
  });

  it('SLA zero e recusado', async () => {
    const r = await app.inject({
      method: 'PATCH',
      url: '/api/r/perfil',
      headers: auth(),
      payload: { slaMinutes: 0 },
    });
    // SLA zero deixaria todo pedido "atrasado" no segundo seguinte.
    expect(r.statusCode).toBe(400);
  });

  it('photoUrl que nao e URL e recusada', async () => {
    const r = await app.inject({
      method: 'PATCH',
      url: '/api/r/perfil',
      headers: auth(),
      payload: { photoUrl: 'foto.jpg' },
    });
    expect(r.statusCode).toBe(400);
  });
});

// ─── Histórico ──────────────────────────────────────────────────────────────

describe('GET /api/r/historico', () => {
  const item = (over: Record<string, unknown> = {}) => ({
    qty: 2,
    unitPriceCents: 1800,
    nameSnapshot: 'Smash Lou',
    status: 'retirado',
    pickedAt: new Date('2026-08-25T20:00:00Z'),
    canceledAt: null,
    ...over,
  });
  const pedido = (itens: Array<ReturnType<typeof item>>, id = 'o1') => ({
    id,
    shortId: '123',
    createdAt: new Date('2026-08-25T19:00:00Z'),
    table: { numero: 4 },
    items: itens,
  });

  it('busca so pedidos com item DESTA cozinha', async () => {
    prismaMock.order.findMany.mockResolvedValue([]);
    await app.inject({ method: 'GET', url: '/api/r/historico', headers: auth() });
    const args = prismaMock.order.findMany.mock.calls[0][0];
    expect(args.where.items.some.kitchenId).toBe(COZINHA.id);
    // E os itens trazidos tambem sao filtrados: sem isso a cozinha veria o que
    // a mesa pediu na vizinha.
    expect(args.select.items.where.kitchenId).toBe(COZINHA.id);
  });

  it('pedido ainda em preparo NAO entra no historico', async () => {
    prismaMock.order.findMany.mockResolvedValue([
      pedido([item({ status: 'preparando', pickedAt: null })]),
    ]);
    const j = (
      await app.inject({ method: 'GET', url: '/api/r/historico', headers: auth() })
    ).json();
    // Ele esta na FILA. Aparecer nos dois lugares confunde quem confere o dia.
    expect(j.pedidos).toHaveLength(0);
  });

  it('pedido entregue entra, com o total dos itens ativos', async () => {
    prismaMock.order.findMany.mockResolvedValue([pedido([item()])]);
    const j = (
      await app.inject({ method: 'GET', url: '/api/r/historico', headers: auth() })
    ).json();
    expect(j.pedidos[0].status).toBe('retirado');
    expect(j.pedidos[0].totalCents).toBe(3600);
  });

  it('pedido todo cancelado conta como cancelado, com total zero', async () => {
    prismaMock.order.findMany.mockResolvedValue([
      pedido([item({ status: 'cancelado', pickedAt: null, canceledAt: new Date() })]),
    ]);
    const j = (
      await app.inject({ method: 'GET', url: '/api/r/historico', headers: auth() })
    ).json();
    expect(j.pedidos[0].status).toBe('cancelado');
    expect(j.pedidos[0].totalCents).toBe(0);
  });

  it('item cancelado no meio nao derruba o pedido nem entra no total', async () => {
    prismaMock.order.findMany.mockResolvedValue([
      pedido([item(), item({ status: 'cancelado', pickedAt: null, canceledAt: new Date() })]),
    ]);
    const j = (
      await app.inject({ method: 'GET', url: '/api/r/historico', headers: auth() })
    ).json();
    expect(j.pedidos[0].status).toBe('retirado');
    expect(j.pedidos[0].totalCents).toBe(3600);
  });

  it('o ticket medio divide pelos ENTREGUES', async () => {
    prismaMock.order.findMany.mockResolvedValue([
      pedido([item()], 'o1'),
      pedido([item({ status: 'cancelado', pickedAt: null, canceledAt: new Date() })], 'o2'),
    ]);
    const j = (
      await app.inject({ method: 'GET', url: '/api/r/historico', headers: auth() })
    ).json();
    // Incluir cancelado no denominador derrubaria o ticket sem nada ter mudado
    // no que a cozinha vende.
    expect(j.totais.entregues).toBe(1);
    expect(j.totais.cancelados).toBe(1);
    expect(j.totais.ticketMedioCents).toBe(3600);
  });

  it('dias fora de 1..90 e recusado', async () => {
    const r = await app.inject({
      method: 'GET',
      url: '/api/r/historico?dias=999',
      headers: auth(),
    });
    expect(r.statusCode).toBe(400);
  });
});

// ─── Métricas ───────────────────────────────────────────────────────────────

describe('GET /api/r/metricas', () => {
  const linha = (nome: string, qty: number, cents: number, orderId = 'o1', hora = 12) => ({
    qty,
    unitPriceCents: cents,
    nameSnapshot: nome,
    createdAt: new Date(2026, 7, 25, hora),
    orderId,
  });

  it('busca so itens desta cozinha e exclui cancelado', async () => {
    prismaMock.orderItem.findMany.mockResolvedValue([]);
    await app.inject({ method: 'GET', url: '/api/r/metricas', headers: auth() });
    const where = prismaMock.orderItem.findMany.mock.calls[0][0].where;
    expect(where.kitchenId).toBe(COZINHA.id);
    // Contar como carro-chefe o prato que mais some do estoque seria o inverso
    // da verdade.
    expect(where.status).toEqual({ not: 'cancelado' });
  });

  it('carro-chefe soma quantidade, maior primeiro', async () => {
    prismaMock.orderItem.findMany.mockResolvedValue([
      linha('Smash Lou', 2, 1800, 'o1'),
      linha('Smash Lou', 3, 1800, 'o2'),
      linha('Batata', 4, 1200, 'o3'),
    ]);
    const j = (await app.inject({ method: 'GET', url: '/api/r/metricas', headers: auth() })).json();
    expect(j.carroChefe[0]).toMatchObject({ name: 'Smash Lou', qty: 5 });
    expect(j.carroChefe[1]).toMatchObject({ name: 'Batata', qty: 4 });
  });

  it('agrupa pelo NOME EM SNAPSHOT', async () => {
    prismaMock.orderItem.findMany.mockResolvedValue([linha('Smash Lou', 1, 1800)]);
    const j = (await app.inject({ method: 'GET', url: '/api/r/metricas', headers: auth() })).json();
    // Item renomeado ou arquivado ainda precisa aparecer no ranking do periodo
    // em que vendeu — por isso o nome do snapshot, nao o menuItemId.
    expect(j.carroChefe[0].name).toBe('Smash Lou');
  });

  it('ticket medio divide por PEDIDO, nao por linha', async () => {
    prismaMock.orderItem.findMany.mockResolvedValue([
      linha('Smash Lou', 1, 2000, 'o1'),
      linha('Batata', 1, 1000, 'o1'),
    ]);
    const j = (await app.inject({ method: 'GET', url: '/api/r/metricas', headers: auth() })).json();
    // Um pedido de R$ 30 em duas linhas: o ticket e 30, nao 15.
    expect(j.pedidosCount).toBe(1);
    expect(j.ticketMedioCents).toBe(3000);
  });

  it('hora de pico conta pedidos distintos', async () => {
    prismaMock.orderItem.findMany.mockResolvedValue([
      linha('Smash Lou', 1, 2000, 'o1', 12),
      linha('Batata', 1, 1000, 'o1', 12),
      linha('Smash Lou', 1, 2000, 'o2', 20),
    ]);
    const j = (await app.inject({ method: 'GET', url: '/api/r/metricas', headers: auth() })).json();
    expect(j.porHora).toEqual([
      { hora: 12, pedidos: 1, receitaCents: 3000 },
      { hora: 20, pedidos: 1, receitaCents: 2000 },
    ]);
  });

  it('cozinha sem venda devolve zeros, nao erro', async () => {
    prismaMock.orderItem.findMany.mockResolvedValue([]);
    const r = await app.inject({ method: 'GET', url: '/api/r/metricas', headers: auth() });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({
      carroChefe: [],
      ticketMedioCents: 0,
      pedidosCount: 0,
      porHora: [],
    });
  });
});
