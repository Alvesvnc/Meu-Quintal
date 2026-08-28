import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { criarPrismaMock, type PrismaMock, cozinhaLogada } from '../test/prismaMock.js';

const prismaMock: PrismaMock = criarPrismaMock();
vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }));

const { buildApp } = await import('../app.js');

/**
 * Rotas da alteração proposta.
 *
 * `lib/alteracao.ts` já cobre as regras (o que é proposta válida, o que cada
 * resposta faz). Aqui é o que só existe na rota: quem pode propor, quem pode
 * responder, e o que acontece quando a proposta já foi respondida ou expirou.
 */

let app: FastifyInstance;

const UUID_A = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const UUID_B = '3f2504e0-4f89-41d3-9a0c-0305e82c3302';

const COZINHA = {
  id: 'k-lou',
  slug: 'lou-burger',
  name: 'Lou Burger',
  status: 'ativa' as const,
  spaceId: 'space-1',
};

const MESA = {
  id: 'table-1',
  numero: 4,
  qrToken: 'mesa-4-dev',
  isActive: true,
  spaceId: 'space-1',
  space: { id: 'space-1', slug: 'sao-sebastiao' },
};

const tokenCozinha = () =>
  app.jwt.sign({
    kind: 'cozinha' as const,
    sub: 'ku1',
    kitchenId: COZINHA.id,
    kitchenSlug: COZINHA.slug,
    email: 'a@b.c',
    role: 'owner',
  });

const authCozinha = () => ({ authorization: `Bearer ${tokenCozinha()}` });
const authMesa = { authorization: 'Bearer mesa-4-dev' };

const itemDoPedido = (over: Record<string, unknown> = {}) => ({
  id: UUID_A,
  qty: 3,
  unitPriceCents: 1800,
  nameSnapshot: 'Batata-doce frita',
  status: 'novo',
  ...over,
});

beforeEach(async () => {
  vi.clearAllMocks();
  Object.assign(prismaMock, criarPrismaMock());
  cozinhaLogada(prismaMock, COZINHA.id, 'ku1');
  prismaMock.kitchen.findUnique.mockResolvedValue(COZINHA);
  prismaMock.table.findUnique.mockResolvedValue(MESA);
  prismaMock.$transaction.mockResolvedValue([]);
  app = await buildApp({ socket: false, logger: false, cron: false });
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

// ─── Propor: quem pode ──────────────────────────────────────────────────────

/**
 * ATE QUANDO DA PRA PROPOR.
 *
 * A regra vive em validarProposta (lib/alteracao.ts). O que se prova AQUI e
 * que a rota realmente a aplica — antes ela deixava passar item ja pronto, e
 * nenhum teste, nem de lib nem de rota, dizia nada sobre isso.
 */
describe('POST /api/r/pedido/:id/alteracao — ate que status', () => {
  const propor = () =>
    app.inject({
      method: 'POST',
      url: '/api/r/pedido/o1/alteracao',
      headers: authCozinha(),
      payload: { motivo: 'sem-ingrediente', itens: [{ orderItemId: UUID_A, qtyProposta: 1 }] },
    });

  it('recusa quando o item ja esta PRONTO', async () => {
    prismaMock.orderItem.findMany.mockResolvedValue([itemDoPedido({ status: 'pronto' })]);
    prismaMock.orderChange.findFirst.mockResolvedValue(null);

    const r = await propor();

    expect(r.statusCode).toBe(400);
    // A comida ja existe: nada e criado.
    expect(prismaMock.orderChange.create).not.toHaveBeenCalled();
  });

  it('aceita enquanto o item esta preparando', async () => {
    prismaMock.orderItem.findMany.mockResolvedValue([itemDoPedido({ status: 'preparando' })]);
    prismaMock.orderChange.findFirst.mockResolvedValue(null);
    prismaMock.orderChange.create.mockResolvedValue({
      id: 'a1',
      items: [{ orderItemId: UUID_A, qtyAnterior: 3, qtyProposta: 1 }],
      kitchen: { slug: COZINHA.slug, name: COZINHA.name },
      reason: null,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 300000),
    });

    const r = await propor();

    expect(r.statusCode).toBe(201);
  });
});

describe('POST /api/r/pedido/:id/alteracao — quem pode propor', () => {
  it('sem token devolve 401', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/r/pedido/o1/alteracao',
      payload: { motivo: 'sem-ingrediente', itens: [{ orderItemId: UUID_A, qtyProposta: 1 }] },
    });
    expect(r.statusCode).toBe(401);
  });

  it('a busca dos itens filtra por kitchenId', async () => {
    prismaMock.orderItem.findMany.mockResolvedValue([itemDoPedido()]);
    prismaMock.orderChange.findFirst.mockResolvedValue(null);
    prismaMock.orderChange.create.mockResolvedValue({
      id: 'a1',
      items: [{ orderItemId: UUID_A, qtyAnterior: 3, qtyProposta: 1 }],
      kitchen: { slug: COZINHA.slug, name: COZINHA.name },
      reason: null,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });

    await app.inject({
      method: 'POST',
      url: '/api/r/pedido/o1/alteracao',
      headers: authCozinha(),
      payload: { motivo: 'sem-ingrediente', itens: [{ orderItemId: UUID_A, qtyProposta: 1 }] },
    });

    const where = prismaMock.orderItem.findMany.mock.calls[0][0].where;
    // É o que impede uma cozinha de alterar o item da vizinha no mesmo pedido.
    expect(where.kitchenId).toBe(COZINHA.id);
    expect(where.orderId).toBe('o1');
  });

  it('pedido sem item desta cozinha devolve 404', async () => {
    prismaMock.orderItem.findMany.mockResolvedValue([]);
    const r = await app.inject({
      method: 'POST',
      url: '/api/r/pedido/da-vizinha/alteracao',
      headers: authCozinha(),
      payload: { motivo: 'sem-ingrediente', itens: [{ orderItemId: UUID_A, qtyProposta: 1 }] },
    });
    expect(r.statusCode).toBe(404);
    expect(prismaMock.orderChange.create).not.toHaveBeenCalled();
  });

  it('item de outra cozinha no corpo devolve 400, nao altera nada', async () => {
    // A cozinha só tem UUID_A; o corpo pede UUID_B.
    prismaMock.orderItem.findMany.mockResolvedValue([itemDoPedido({ id: UUID_A })]);
    prismaMock.orderChange.findFirst.mockResolvedValue(null);

    const r = await app.inject({
      method: 'POST',
      url: '/api/r/pedido/o1/alteracao',
      headers: authCozinha(),
      payload: { motivo: 'sem-ingrediente', itens: [{ orderItemId: UUID_B, qtyProposta: 0 }] },
    });

    expect(r.statusCode).toBe(400);
    expect(prismaMock.orderChange.create).not.toHaveBeenCalled();
  });
});

// ─── Propor: validação ──────────────────────────────────────────────────────

describe('POST /api/r/pedido/:id/alteracao — validacao', () => {
  beforeEach(() => {
    prismaMock.orderItem.findMany.mockResolvedValue([itemDoPedido({ qty: 3 })]);
    prismaMock.orderChange.findFirst.mockResolvedValue(null);
  });

  it('recusa lista vazia', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/r/pedido/o1/alteracao',
      headers: authCozinha(),
      payload: { motivo: 'sem-ingrediente', itens: [] },
    });
    expect(r.statusCode).toBe(400);
  });

  it('recusa AUMENTO de quantidade', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/r/pedido/o1/alteracao',
      headers: authCozinha(),
      payload: { motivo: 'sem-ingrediente', itens: [{ orderItemId: UUID_A, qtyProposta: 9 }] },
    });
    expect(r.statusCode).toBe(400);
    expect(prismaMock.orderChange.create).not.toHaveBeenCalled();
  });

  it('recusa motivo acima de 140 chars', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/r/pedido/o1/alteracao',
      headers: authCozinha(),
      payload: {
        motivo: 'sem-ingrediente',
        reason: 'x'.repeat(141),
        itens: [{ orderItemId: UUID_A, qtyProposta: 1 }],
      },
    });
    expect(r.statusCode).toBe(400);
  });

  it('recusa segunda proposta enquanto a primeira aguarda', async () => {
    // Duas abertas fariam o cliente responder uma enquanto a outra altera os
    // mesmos itens por baixo.
    prismaMock.orderChange.findFirst.mockResolvedValue({
      id: 'ja-existe',
      expiresAt: new Date(Date.now() + 60_000),
    });

    const r = await app.inject({
      method: 'POST',
      url: '/api/r/pedido/o1/alteracao',
      headers: authCozinha(),
      payload: { motivo: 'sem-ingrediente', itens: [{ orderItemId: UUID_A, qtyProposta: 1 }] },
    });

    expect(r.statusCode).toBe(409);
    expect(r.json().alteracaoId).toBe('ja-existe');
  });
});

// ─── Responder: quem pode ───────────────────────────────────────────────────

describe('POST /api/m/pedido/:id/alteracao/:aid/:resposta', () => {
  const pendente = (over: Record<string, unknown> = {}) => ({
    id: 'a1',
    status: 'pendente',
    expiresAt: new Date(Date.now() + 60_000),
    items: [{ orderItemId: UUID_A, qtyAnterior: 3, qtyProposta: 1 }],
    kitchen: { id: COZINHA.id, slug: COZINHA.slug },
    ...over,
  });

  it('sem token de mesa devolve 401', async () => {
    const r = await app.inject({ method: 'POST', url: '/api/m/pedido/o1/alteracao/a1/aceitar' });
    expect(r.statusCode).toBe(401);
  });

  it('a busca amarra alteracao + pedido + MESA', async () => {
    prismaMock.orderChange.findFirst.mockResolvedValue(null);
    await app.inject({
      method: 'POST',
      url: '/api/m/pedido/o1/alteracao/a1/aceitar',
      headers: authMesa,
    });

    const where = prismaMock.orderChange.findFirst.mock.calls[0][0].where;
    // Sem o tableId, saber o id da alteracao bastaria pra responder pela mesa
    // de outra pessoa.
    expect(where.order.tableId).toBe(MESA.id);
    expect(where.orderId).toBe('o1');
    expect(where.id).toBe('a1');
  });

  it('alteracao de outra mesa devolve 404', async () => {
    prismaMock.orderChange.findFirst.mockResolvedValue(null);
    const r = await app.inject({
      method: 'POST',
      url: '/api/m/pedido/o1/alteracao/alheia/aceitar',
      headers: authMesa,
    });
    expect(r.statusCode).toBe(404);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('resposta fora de aceitar/recusar devolve 404', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/m/pedido/o1/alteracao/a1/talvez',
      headers: authMesa,
    });
    expect(r.statusCode).toBe(404);
  });

  it('aceitar aplica e responde ok', async () => {
    prismaMock.orderChange.findFirst.mockResolvedValue(pendente());
    const r = await app.inject({
      method: 'POST',
      url: '/api/m/pedido/o1/alteracao/a1/aceitar',
      headers: authMesa,
    });

    expect(r.statusCode).toBe(200);
    expect(r.json().resposta).toBe('aceita');
    expect(prismaMock.$transaction).toHaveBeenCalled();
  });

  it('recusar aplica e responde ok', async () => {
    prismaMock.orderChange.findFirst.mockResolvedValue(pendente());
    const r = await app.inject({
      method: 'POST',
      url: '/api/m/pedido/o1/alteracao/a1/recusar',
      headers: authMesa,
    });

    expect(r.statusCode).toBe(200);
    expect(r.json().resposta).toBe('recusada');
  });

  it('responder duas vezes devolve 409', async () => {
    prismaMock.orderChange.findFirst.mockResolvedValue(pendente({ status: 'aceita' }));
    const r = await app.inject({
      method: 'POST',
      url: '/api/m/pedido/o1/alteracao/a1/recusar',
      headers: authMesa,
    });

    expect(r.statusCode).toBe(409);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('responder depois do prazo devolve 409 e encerra como expirada', async () => {
    prismaMock.orderChange.findFirst.mockResolvedValue(
      pendente({ expiresAt: new Date(Date.now() - 1000) }),
    );

    const r = await app.inject({
      method: 'POST',
      url: '/api/m/pedido/o1/alteracao/a1/aceitar',
      headers: authMesa,
    });

    expect(r.statusCode).toBe(409);
    expect(r.json().status).toBe('expirada');
    // Expirar tambem aplica: o item e cancelado, como numa recusa.
    expect(prismaMock.$transaction).toHaveBeenCalled();
  });
});

// ─── Motivo: a categoria que vira metrica ───────────────────────────────────

describe('motivo da proposta', () => {
  beforeEach(() => {
    prismaMock.orderItem.findMany.mockResolvedValue([itemDoPedido({ qty: 3 })]);
    prismaMock.orderChange.findFirst.mockResolvedValue(null);
  });

  it('recusa proposta SEM motivo', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/r/pedido/o1/alteracao',
      headers: authCozinha(),
      payload: { itens: [{ orderItemId: UUID_A, qtyProposta: 1 }] },
    });
    expect(r.statusCode).toBe(400);
  });

  it('recusa motivo fora da lista', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/r/pedido/o1/alteracao',
      headers: authCozinha(),
      payload: { motivo: 'porque-sim', itens: [{ orderItemId: UUID_A, qtyProposta: 1 }] },
    });
    expect(r.statusCode).toBe(400);
  });

  it('"outro" SEM texto e recusado', async () => {
    // Sem esta regra, "outro" vira a escolha mais rapida pra quem esta com a
    // mao ocupada — e a metrica volta a nao dizer nada.
    const r = await app.inject({
      method: 'POST',
      url: '/api/r/pedido/o1/alteracao',
      headers: authCozinha(),
      payload: { motivo: 'outro', itens: [{ orderItemId: UUID_A, qtyProposta: 1 }] },
    });
    expect(r.statusCode).toBe(400);
  });

  it('"outro" COM texto passa', async () => {
    prismaMock.orderChange.create.mockResolvedValue({
      id: 'a1',
      items: [{ orderItemId: UUID_A, qtyAnterior: 3, qtyProposta: 1 }],
      kitchen: { slug: COZINHA.slug, name: COZINHA.name },
      reason: 'o forno apagou',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });

    const r = await app.inject({
      method: 'POST',
      url: '/api/r/pedido/o1/alteracao',
      headers: authCozinha(),
      payload: {
        motivo: 'outro',
        reason: 'o forno apagou',
        itens: [{ orderItemId: UUID_A, qtyProposta: 1 }],
      },
    });
    expect(r.statusCode).toBe(201);
  });

  it('grava a categoria traduzida pro formato do banco', async () => {
    prismaMock.orderChange.create.mockResolvedValue({
      id: 'a1',
      items: [{ orderItemId: UUID_A, qtyAnterior: 3, qtyProposta: 1 }],
      kitchen: { slug: COZINHA.slug, name: COZINHA.name },
      reason: null,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });

    await app.inject({
      method: 'POST',
      url: '/api/r/pedido/o1/alteracao',
      headers: authCozinha(),
      payload: { motivo: 'sem-ingrediente', itens: [{ orderItemId: UUID_A, qtyProposta: 1 }] },
    });

    // API usa hifen, Prisma usa underscore — ver lib/motivo.ts.
    expect(prismaMock.orderChange.create.mock.calls[0][0].data.motivo).toBe('sem_ingrediente');
  });
});
