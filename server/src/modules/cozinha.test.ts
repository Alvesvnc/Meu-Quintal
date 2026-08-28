import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  criarPrismaMock,
  type PrismaMock,
  cozinhaLogada,
  secaoDaCozinha,
} from '../test/prismaMock.js';

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

// UUID de verdade: o schema do item exige uuid no `categoriaId`, entao um
// 'cat-1' seria recusado pela validacao antes de chegar na regra em teste.
const SECAO = { id: '44444444-4444-4444-8444-444444444444', name: 'Os smash', sortOrder: 0 };

const ITEM = {
  id: 'mi1',
  categoriaId: SECAO.id,
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
  cozinhaLogada(prismaMock, COZINHA.id, 'ku1');
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

  it('busca so as secoes da PROPRIA cozinha', async () => {
    await app.inject({ method: 'GET', url: '/api/r/cardapio', headers: auth() });
    const where = prismaMock.menuCategoria.findMany.mock.calls[0][0].where;
    expect(where.kitchenId).toBe(COZINHA.id);
  });

  it('devolve as secoes na ordem da cozinha, com a contagem de itens', async () => {
    prismaMock.menuCategoria.findMany.mockResolvedValue([
      { id: 'cat-1', name: 'Os smash', sortOrder: 0, _count: { items: 2 } },
      { id: 'cat-2', name: 'Pra beber', sortOrder: 1, _count: { items: 0 } },
    ]);
    const j = (await app.inject({ method: 'GET', url: '/api/r/cardapio', headers: auth() })).json();
    expect(j.categorias).toEqual([
      { id: 'cat-1', name: 'Os smash', sortOrder: 0, itemCount: 2 },
      // Vazia vem junto: e onde a cozinha vai por o proximo item.
      { id: 'cat-2', name: 'Pra beber', sortOrder: 1, itemCount: 0 },
    ]);
  });

  it('nao devolve item arquivado', async () => {
    await app.inject({ method: 'GET', url: '/api/r/cardapio', headers: auth() });
    const where = prismaMock.menuItem.findMany.mock.calls[0][0].where;
    // Item "excluido" continua no banco porque OrderItem aponta pra ele.
    expect(where.archivedAt).toBeNull();
  });

  it('traz esgotado — a cozinha precisa ver pra reativar', async () => {
    prismaMock.menuItem.findMany.mockResolvedValue([{ ...ITEM, available: false }]);
    const j = (await app.inject({ method: 'GET', url: '/api/r/cardapio', headers: auth() })).json();
    expect(j.items[0].available).toBe(false);
  });

  it('traduz o badge de underscore pra hifen', async () => {
    prismaMock.menuItem.findMany.mockResolvedValue([{ ...ITEM, badge: 'sem_estoque' }]);
    const j = (await app.inject({ method: 'GET', url: '/api/r/cardapio', headers: auth() })).json();
    // O Prisma nao aceita hifen em identificador de enum; a API usa hifen.
    expect(j.items[0].badge).toBe('sem-estoque');
  });
});

// ─── Cardápio: escrita ──────────────────────────────────────────────────────

describe('POST /api/r/cardapio', () => {
  const novo = { categoriaId: SECAO.id, name: 'Smash Lou', priceCents: 3200 };

  it('cria com o kitchenId DO TOKEN', async () => {
    secaoDaCozinha(prismaMock, SECAO.id);
    prismaMock.menuItem.create.mockResolvedValue(ITEM);
    await app.inject({ method: 'POST', url: '/api/r/cardapio', headers: auth(), payload: novo });
    expect(prismaMock.menuItem.create.mock.calls[0][0].data.kitchenId).toBe(COZINHA.id);
  });

  it('kitchenId no body e IGNORADO', async () => {
    secaoDaCozinha(prismaMock, SECAO.id);
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

  it('secao que nao e um id e recusada', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/r/cardapio',
      headers: auth(),
      payload: { ...novo, categoriaId: 'lanches' },
    });
    expect(r.statusCode).toBe(400);
  });

  it('secao de OUTRA cozinha e recusada', async () => {
    // O mock recusa por padrao: `categoriaDaCozinha` nao acha a secao dentro da
    // cozinha logada. Sem esta checagem bastaria conhecer um id pra pendurar um
    // prato no cardapio da vizinha.
    const r = await app.inject({
      method: 'POST',
      url: '/api/r/cardapio',
      headers: auth(),
      payload: { ...novo, categoriaId: '11111111-1111-4111-8111-111111111111' },
    });
    expect(r.statusCode).toBe(400);
    expect(prismaMock.menuItem.create).not.toHaveBeenCalled();
  });

  it('a secao e procurada DENTRO da cozinha logada', async () => {
    secaoDaCozinha(prismaMock, SECAO.id);
    prismaMock.menuItem.create.mockResolvedValue(ITEM);
    await app.inject({ method: 'POST', url: '/api/r/cardapio', headers: auth(), payload: novo });
    const where = prismaMock.menuCategoria.findFirst.mock.calls[0][0].where;
    expect(where).toMatchObject({ id: SECAO.id, kitchenId: COZINHA.id });
  });
});

// ─── Seções do cardápio (escritas pela própria cozinha) ─────────────────────
//
// Eram um enum de quatro valores até 2026-08-27. O que se testa aqui, além do
// isolamento de sempre, é a regra que impede o cardápio de ficar quebrado:
// seção não some levando prato junto, e nunca sobra cardápio sem seção nenhuma.

describe('POST /api/r/cardapio/categorias', () => {
  it('sem token, 401', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/r/cardapio/categorias',
      payload: { name: 'Do forno' },
    });
    expect(r.statusCode).toBe(401);
  });

  it('cria com o kitchenId DO TOKEN', async () => {
    prismaMock.menuCategoria.count.mockResolvedValue(2);
    prismaMock.menuCategoria.create.mockResolvedValue({ ...SECAO, name: 'Do forno' });
    await app.inject({
      method: 'POST',
      url: '/api/r/cardapio/categorias',
      headers: auth(),
      payload: { name: 'Do forno', kitchenId: 'k-da-vizinha' },
    });
    expect(prismaMock.menuCategoria.create.mock.calls[0][0].data.kitchenId).toBe(COZINHA.id);
  });

  it('a nova entra DEPOIS da ultima', async () => {
    prismaMock.menuCategoria.count.mockResolvedValue(3);
    prismaMock.menuCategoria.findFirst.mockResolvedValue({ sortOrder: 4 });
    prismaMock.menuCategoria.create.mockResolvedValue({ ...SECAO, sortOrder: 5 });
    await app.inject({
      method: 'POST',
      url: '/api/r/cardapio/categorias',
      headers: auth(),
      payload: { name: 'Do forno' },
    });
    // Entrar no meio mexeria numa ordem que a cozinha decidiu.
    expect(prismaMock.menuCategoria.create.mock.calls[0][0].data.sortOrder).toBe(5);
  });

  it('cardapio sem secao nenhuma comeca do zero', async () => {
    prismaMock.menuCategoria.count.mockResolvedValue(0);
    prismaMock.menuCategoria.findFirst.mockResolvedValue(null);
    prismaMock.menuCategoria.create.mockResolvedValue(SECAO);
    await app.inject({
      method: 'POST',
      url: '/api/r/cardapio/categorias',
      headers: auth(),
      payload: { name: 'Do forno' },
    });
    expect(prismaMock.menuCategoria.create.mock.calls[0][0].data.sortOrder).toBe(0);
  });

  it('nome de uma letra e recusado', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/r/cardapio/categorias',
      headers: auth(),
      payload: { name: 'X' },
    });
    expect(r.statusCode).toBe(400);
    expect(prismaMock.menuCategoria.create).not.toHaveBeenCalled();
  });

  it('nome longo demais e recusado', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/r/cardapio/categorias',
      headers: auth(),
      // A linha de secoes do cliente e uma grade: nome longo trunca e some.
      payload: { name: 'Pratos principais da casa da vovo' },
    });
    expect(r.statusCode).toBe(400);
  });

  it('nome repetido devolve 409 com frase que se entende', async () => {
    prismaMock.menuCategoria.count.mockResolvedValue(2);
    prismaMock.menuCategoria.create.mockRejectedValue({ code: 'P2002' });
    const r = await app.inject({
      method: 'POST',
      url: '/api/r/cardapio/categorias',
      headers: auth(),
      payload: { name: 'Bebidas' },
    });
    expect(r.statusCode).toBe(409);
    expect(r.json().error).toMatch(/nome/i);
  });

  it('passando do teto, 409 — e nao cria', async () => {
    prismaMock.menuCategoria.count.mockResolvedValue(12);
    const r = await app.inject({
      method: 'POST',
      url: '/api/r/cardapio/categorias',
      headers: auth(),
      payload: { name: 'Mais uma' },
    });
    expect(r.statusCode).toBe(409);
    expect(prismaMock.menuCategoria.create).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/r/cardapio/categorias/:id', () => {
  it('o where amarra a secao a cozinha logada', async () => {
    prismaMock.menuCategoria.updateMany.mockResolvedValue({ count: 1 });
    await app.inject({
      method: 'PATCH',
      url: '/api/r/cardapio/categorias/cat-1',
      headers: auth(),
      payload: { name: 'Do forno' },
    });
    const where = prismaMock.menuCategoria.updateMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ id: 'cat-1', kitchenId: COZINHA.id });
  });

  it('secao de outra cozinha devolve 404, nao 403', async () => {
    prismaMock.menuCategoria.updateMany.mockResolvedValue({ count: 0 });
    const r = await app.inject({
      method: 'PATCH',
      url: '/api/r/cardapio/categorias/cat-da-vizinha',
      headers: auth(),
      payload: { name: 'Do forno' },
    });
    expect(r.statusCode).toBe(404);
  });

  it('renomear NAO mexe nos itens', async () => {
    prismaMock.menuCategoria.updateMany.mockResolvedValue({ count: 1 });
    await app.inject({
      method: 'PATCH',
      url: '/api/r/cardapio/categorias/cat-1',
      headers: auth(),
      payload: { name: 'Do forno' },
    });
    // O item aponta pro id da secao, nao pro texto — era isso que o enum nao
    // deixava fazer.
    expect(prismaMock.menuItem.updateMany).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/r/cardapio/categorias/ordem', () => {
  const ID_A = '11111111-1111-4111-8111-111111111111';
  const ID_B = '22222222-2222-4222-8222-222222222222';

  it('grava a posicao pelo indice na lista', async () => {
    prismaMock.menuCategoria.findMany.mockResolvedValue([{ id: ID_A }, { id: ID_B }]);
    await app.inject({
      method: 'PATCH',
      url: '/api/r/cardapio/categorias/ordem',
      headers: auth(),
      payload: { ids: [ID_B, ID_A] },
    });
    const escritas = prismaMock.menuCategoria.updateMany.mock.calls.map((c) => [
      c[0].where.id,
      c[0].data.sortOrder,
    ]);
    expect(escritas).toEqual([
      [ID_B, 0],
      [ID_A, 1],
    ]);
  });

  it('cada escrita leva o kitchenId junto', async () => {
    prismaMock.menuCategoria.findMany.mockResolvedValue([{ id: ID_A }, { id: ID_B }]);
    await app.inject({
      method: 'PATCH',
      url: '/api/r/cardapio/categorias/ordem',
      headers: auth(),
      payload: { ids: [ID_B, ID_A] },
    });
    for (const chamada of prismaMock.menuCategoria.updateMany.mock.calls) {
      expect(chamada[0].where.kitchenId).toBe(COZINHA.id);
    }
  });

  it('lista incompleta e recusada', async () => {
    prismaMock.menuCategoria.findMany.mockResolvedValue([{ id: ID_A }, { id: ID_B }]);
    const r = await app.inject({
      method: 'PATCH',
      url: '/api/r/cardapio/categorias/ordem',
      headers: auth(),
      payload: { ids: [ID_A] },
    });
    // Faltando uma, ela ficaria com a posicao antiga — possivelmente repetida —
    // e o cardapio escolheria sozinho quem vem antes.
    expect(r.statusCode).toBe(400);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('secao de outra cozinha na lista e recusada', async () => {
    prismaMock.menuCategoria.findMany.mockResolvedValue([{ id: ID_A }]);
    const r = await app.inject({
      method: 'PATCH',
      url: '/api/r/cardapio/categorias/ordem',
      headers: auth(),
      payload: { ids: [ID_B] },
    });
    expect(r.statusCode).toBe(400);
  });

  it('id repetido e recusado', async () => {
    prismaMock.menuCategoria.findMany.mockResolvedValue([{ id: ID_A }, { id: ID_B }]);
    const r = await app.inject({
      method: 'PATCH',
      url: '/api/r/cardapio/categorias/ordem',
      headers: auth(),
      payload: { ids: [ID_A, ID_A] },
    });
    expect(r.statusCode).toBe(400);
  });
});

describe('DELETE /api/r/cardapio/categorias/:id', () => {
  const DESTINO = '33333333-3333-4333-8333-333333333333';

  it('secao de outra cozinha devolve 404, nao 403', async () => {
    const r = await app.inject({
      method: 'DELETE',
      url: '/api/r/cardapio/categorias/cat-da-vizinha',
      headers: auth(),
    });
    expect(r.statusCode).toBe(404);
    expect(prismaMock.menuCategoria.deleteMany).not.toHaveBeenCalled();
  });

  it('a ULTIMA secao nao sai', async () => {
    secaoDaCozinha(prismaMock, 'cat-1');
    prismaMock.menuCategoria.count.mockResolvedValue(1);
    const r = await app.inject({
      method: 'DELETE',
      url: '/api/r/cardapio/categorias/cat-1',
      headers: auth(),
    });
    // Sem nenhuma secao o cardapio nao teria onde por o proximo item, e a
    // cozinha descobriria isso no meio do servico.
    expect(r.statusCode).toBe(409);
    expect(prismaMock.menuCategoria.deleteMany).not.toHaveBeenCalled();
  });

  it('secao vazia sai direto', async () => {
    secaoDaCozinha(prismaMock, 'cat-1');
    prismaMock.menuCategoria.count.mockResolvedValue(3);
    prismaMock.menuItem.count.mockResolvedValue(0);
    const r = await app.inject({
      method: 'DELETE',
      url: '/api/r/cardapio/categorias/cat-1',
      headers: auth(),
    });
    expect(r.statusCode).toBe(200);
    expect(prismaMock.menuCategoria.deleteMany.mock.calls[0][0].where).toMatchObject({
      id: 'cat-1',
      kitchenId: COZINHA.id,
    });
  });

  it('com item dentro e sem destino, 409 — e nada e apagado', async () => {
    secaoDaCozinha(prismaMock, 'cat-1');
    prismaMock.menuCategoria.count.mockResolvedValue(3);
    prismaMock.menuItem.count.mockResolvedValue(4);
    const r = await app.inject({
      method: 'DELETE',
      url: '/api/r/cardapio/categorias/cat-1',
      headers: auth(),
    });
    expect(r.statusCode).toBe(409);
    expect(r.json().itemCount).toBe(4);
    expect(prismaMock.menuCategoria.deleteMany).not.toHaveBeenCalled();
  });

  it('a contagem de itens inclui o ARQUIVADO', async () => {
    secaoDaCozinha(prismaMock, 'cat-1');
    prismaMock.menuCategoria.count.mockResolvedValue(3);
    prismaMock.menuItem.count.mockResolvedValue(1);
    await app.inject({
      method: 'DELETE',
      url: '/api/r/cardapio/categorias/cat-1',
      headers: auth(),
    });
    // Item arquivado continua apontando pra secao: a chave estrangeira barraria
    // o DELETE mesmo sem nada visivel dentro.
    const where = prismaMock.menuItem.count.mock.calls[0][0].where;
    expect(where.archivedAt).toBeUndefined();
  });

  it('com destino, move os itens e apaga na MESMA transacao', async () => {
    secaoDaCozinha(prismaMock, 'cat-1');
    prismaMock.menuCategoria.count.mockResolvedValue(3);
    prismaMock.menuItem.count.mockResolvedValue(2);

    const r = await app.inject({
      method: 'DELETE',
      url: `/api/r/cardapio/categorias/cat-1?destino=${DESTINO}`,
      headers: auth(),
    });

    expect(r.statusCode).toBe(200);
    // Fora da transacao, um erro no apagar deixaria os pratos mudados de secao
    // sem que ninguem tivesse pedido.
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.menuItem.updateMany.mock.calls[0][0]).toMatchObject({
      where: { categoriaId: 'cat-1', kitchenId: COZINHA.id },
      data: { categoriaId: DESTINO },
    });
  });

  it('destino de OUTRA cozinha e recusado', async () => {
    // A secao a apagar e da casa; o destino nao.
    prismaMock.menuCategoria.findFirst
      .mockResolvedValueOnce({ id: 'cat-1' })
      .mockResolvedValueOnce(null);
    prismaMock.menuCategoria.count.mockResolvedValue(3);
    prismaMock.menuItem.count.mockResolvedValue(2);

    const r = await app.inject({
      method: 'DELETE',
      url: `/api/r/cardapio/categorias/cat-1?destino=${DESTINO}`,
      headers: auth(),
    });

    expect(r.statusCode).toBe(400);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('destino igual a propria secao e recusado', async () => {
    secaoDaCozinha(prismaMock, DESTINO);
    prismaMock.menuCategoria.count.mockResolvedValue(3);
    prismaMock.menuItem.count.mockResolvedValue(2);

    const r = await app.inject({
      method: 'DELETE',
      url: `/api/r/cardapio/categorias/${DESTINO}?destino=${DESTINO}`,
      headers: auth(),
    });

    // Mandar os itens pra secao que esta sendo apagada nao resolve nada.
    expect(r.statusCode).toBe(409);
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

  it('mover pra secao de OUTRA cozinha e recusado', async () => {
    const r = await app.inject({
      method: 'PATCH',
      url: '/api/r/cardapio/mi1',
      headers: auth(),
      payload: { categoriaId: '11111111-1111-4111-8111-111111111111' },
    });
    expect(r.statusCode).toBe(400);
    expect(prismaMock.menuItem.updateMany).not.toHaveBeenCalled();
  });

  it('PATCH sem tocar na secao nao vai ao banco procurar secao nenhuma', async () => {
    prismaMock.menuItem.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.menuItem.findUniqueOrThrow.mockResolvedValue(ITEM);
    await app.inject({
      method: 'PATCH',
      url: '/api/r/cardapio/mi1',
      headers: auth(),
      payload: { priceCents: 3500 },
    });
    // Uma consulta a toa em cada troca de preco — que e o gesto mais repetido
    // da tela — sai caro no meio do servico.
    expect(prismaMock.menuCategoria.findFirst).not.toHaveBeenCalled();
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
