import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { criarPrismaMock, type PrismaMock } from '../test/prismaMock.js';

const prismaMock: PrismaMock = criarPrismaMock();
vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }));

const { buildApp } = await import('../app.js');

/**
 * Caminho FELIZ de POST /api/m/pedido.
 *
 * O arquivo order.test.ts cobre as recusas; aqui é o que acontece quando o
 * pedido é válido — que é onde o dinheiro é calculado e onde o snapshot de
 * preço e nome é gravado. Um erro aqui não derruba o serviço: ele cobra o
 * valor errado, silenciosamente.
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

const BATATA = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const SMASH = '3f2504e0-4f89-41d3-9a0c-0305e82c3302';
const MOQUECA = '3f2504e0-4f89-41d3-9a0c-0305e82c3303';

const CARDAPIO = [
  {
    id: BATATA,
    name: 'Batata-doce frita',
    priceCents: 1800,
    available: true,
    kitchenId: 'k-lou',
    kitchen: {
      id: 'k-lou',
      slug: 'lou-burger',
      name: 'Lou Burger',
      status: 'ativa',
      spaceId: 'space-1',
    },
  },
  {
    id: SMASH,
    name: 'Smash Lou',
    priceCents: 3200,
    available: true,
    kitchenId: 'k-lou',
    kitchen: {
      id: 'k-lou',
      slug: 'lou-burger',
      name: 'Lou Burger',
      status: 'ativa',
      spaceId: 'space-1',
    },
  },
  {
    id: MOQUECA,
    name: 'Moqueca de peixe',
    priceCents: 5800,
    available: true,
    kitchenId: 'k-cumbuca',
    kitchen: {
      id: 'k-cumbuca',
      slug: 'cumbuca-caicara',
      name: 'Cumbuca',
      status: 'ativa',
      spaceId: 'space-1',
    },
  },
];

const comMesa = { authorization: 'Bearer mesa-4-dev' };

/** O que a rota devolve depois do create. */
function pedidoCriado(shortId = '12345') {
  return {
    id: 'order-novo',
    shortId,
    createdAt: new Date('2026-08-24T20:00:00Z'),
  };
}

/** Argumentos com que o prisma.order.create foi chamado. */
function dadosDoCreate() {
  return prismaMock.order.create.mock.calls[0][0].data;
}

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

// ─── Cálculo do total ───────────────────────────────────────────────────────

describe('total do pedido', () => {
  it('item unico: preco x quantidade', async () => {
    prismaMock.menuItem.findMany.mockResolvedValue([CARDAPIO[0]]);
    prismaMock.order.create.mockResolvedValue(pedidoCriado());

    const r = await app.inject({
      method: 'POST',
      url: '/api/m/pedido',
      headers: comMesa,
      payload: { items: [{ menuItemId: BATATA, qty: 3 }] },
    });

    expect(r.statusCode).toBe(201);
    expect(dadosDoCreate().totalCents).toBe(1800 * 3);
  });

  it('soma varias linhas da MESMA cozinha', async () => {
    // O mock devolve exatamente os itens pedidos, como o `WHERE id IN` faria
    prismaMock.menuItem.findMany.mockResolvedValue([CARDAPIO[0], CARDAPIO[1]]);
    prismaMock.order.create.mockResolvedValue(pedidoCriado());

    await app.inject({
      method: 'POST',
      url: '/api/m/pedido',
      headers: comMesa,
      payload: {
        items: [
          { menuItemId: BATATA, qty: 2 },
          { menuItemId: SMASH, qty: 1 },
        ],
      },
    });

    expect(dadosDoCreate().totalCents).toBe(1800 * 2 + 3200);
  });

  it('total em centavos, sem ponto flutuante no meio', async () => {
    // 19,90 x 3 = 59,70. Em float, 19.90*3 daria 59.699999999999996 e o
    // arredondamento poderia comer um centavo do quintal a cada pedido.
    prismaMock.menuItem.findMany.mockResolvedValue([{ ...CARDAPIO[0], priceCents: 1990 }]);
    prismaMock.order.create.mockResolvedValue(pedidoCriado());

    await app.inject({
      method: 'POST',
      url: '/api/m/pedido',
      headers: comMesa,
      payload: { items: [{ menuItemId: BATATA, qty: 3 }] },
    });

    const total = dadosDoCreate().totalCents;
    expect(total).toBe(5970);
    expect(Number.isInteger(total)).toBe(true);
  });
});

// ─── Snapshot ───────────────────────────────────────────────────────────────

describe('snapshot de preco e nome', () => {
  it('grava o preco e o nome do momento do pedido', async () => {
    prismaMock.menuItem.findMany.mockResolvedValue([CARDAPIO[1]]);
    prismaMock.order.create.mockResolvedValue(pedidoCriado());

    await app.inject({
      method: 'POST',
      url: '/api/m/pedido',
      headers: comMesa,
      payload: { items: [{ menuItemId: SMASH, qty: 2 }] },
    });

    const linha = dadosDoCreate().items.create[0];
    // Se a cozinha subir o preço amanhã, este pedido não pode mudar de valor.
    expect(linha.unitPriceCents).toBe(3200);
    expect(linha.nameSnapshot).toBe('Smash Lou');
    expect(linha.qty).toBe(2);
    expect(linha.menuItemId).toBe(SMASH);
  });

  it('denormaliza o kitchenId na linha', async () => {
    prismaMock.menuItem.findMany.mockResolvedValue([CARDAPIO[2]]);
    prismaMock.order.create.mockResolvedValue(pedidoCriado());

    await app.inject({
      method: 'POST',
      url: '/api/m/pedido',
      headers: comMesa,
      payload: { items: [{ menuItemId: MOQUECA, qty: 1 }] },
    });

    expect(dadosDoCreate().items.create[0].kitchenId).toBe('k-cumbuca');
  });

  it('guarda a observacao, e null quando nao ha', async () => {
    prismaMock.menuItem.findMany.mockResolvedValue([CARDAPIO[0], CARDAPIO[1]]);
    prismaMock.order.create.mockResolvedValue(pedidoCriado());

    await app.inject({
      method: 'POST',
      url: '/api/m/pedido',
      headers: comMesa,
      payload: {
        items: [
          { menuItemId: BATATA, qty: 1, note: 'sem sal' },
          { menuItemId: SMASH, qty: 1 },
        ],
      },
    });

    const linhas = dadosDoCreate().items.create;
    expect(linhas[0].note).toBe('sem sal');
    expect(linhas[1].note).toBeNull();
  });
});

// ─── Escopo ─────────────────────────────────────────────────────────────────

describe('escopo do pedido', () => {
  it('amarra o pedido a mesa e ao espaco da credencial', async () => {
    prismaMock.menuItem.findMany.mockResolvedValue([CARDAPIO[0]]);
    prismaMock.order.create.mockResolvedValue(pedidoCriado());

    await app.inject({
      method: 'POST',
      url: '/api/m/pedido',
      headers: comMesa,
      payload: { items: [{ menuItemId: BATATA, qty: 1 }] },
    });

    const dados = dadosDoCreate();
    // Vem do qrToken, nunca do corpo da requisição — senão o cliente escolheria
    // em qual mesa lançar o pedido.
    expect(dados.tableId).toBe(MESA.id);
    expect(dados.spaceId).toBe(MESA.spaceId);
  });

  it('devolve id e shortId, e nada alem', async () => {
    prismaMock.menuItem.findMany.mockResolvedValue([CARDAPIO[0]]);
    prismaMock.order.create.mockResolvedValue(pedidoCriado('42424'));

    const r = await app.inject({
      method: 'POST',
      url: '/api/m/pedido',
      headers: comMesa,
      payload: { items: [{ menuItemId: BATATA, qty: 1 }] },
    });

    expect(r.json()).toEqual({ id: 'order-novo', shortId: '42424' });
  });
});

// ─── Colisão de shortId ─────────────────────────────────────────────────────

describe('shortId duplicado', () => {
  /** Erro de constraint única do Prisma. */
  const colisao = Object.assign(new Error('unique'), {
    code: 'P2002',
    meta: { target: ['shortId'] },
  });

  it('tenta de novo e segue em frente', async () => {
    prismaMock.menuItem.findMany.mockResolvedValue([CARDAPIO[0]]);
    prismaMock.order.create
      .mockRejectedValueOnce(colisao)
      .mockRejectedValueOnce(colisao)
      .mockResolvedValue(pedidoCriado('99999'));

    const r = await app.inject({
      method: 'POST',
      url: '/api/m/pedido',
      headers: comMesa,
      payload: { items: [{ menuItemId: BATATA, qty: 1 }] },
    });

    expect(r.statusCode).toBe(201);
    expect(prismaMock.order.create).toHaveBeenCalledTimes(3);
    expect(r.json().shortId).toBe('99999');
  });

  it('desiste depois de 5 tentativas em vez de girar pra sempre', async () => {
    prismaMock.menuItem.findMany.mockResolvedValue([CARDAPIO[0]]);
    prismaMock.order.create.mockRejectedValue(colisao);

    const r = await app.inject({
      method: 'POST',
      url: '/api/m/pedido',
      headers: comMesa,
      payload: { items: [{ menuItemId: BATATA, qty: 1 }] },
    });

    expect(r.statusCode).toBe(500);
    expect(prismaMock.order.create).toHaveBeenCalledTimes(5);
  });

  it('erro que NAO e colisao sobe como 500, sem retry', async () => {
    prismaMock.menuItem.findMany.mockResolvedValue([CARDAPIO[0]]);
    prismaMock.order.create.mockRejectedValue(new Error('banco caiu'));

    const r = await app.inject({
      method: 'POST',
      url: '/api/m/pedido',
      headers: comMesa,
      payload: { items: [{ menuItemId: BATATA, qty: 1 }] },
    });

    expect(r.statusCode).toBe(500);
    // Insistir num erro que não é de colisão só multiplicaria o problema
    expect(prismaMock.order.create).toHaveBeenCalledTimes(1);
    // E o detalhe do erro não pode vazar pro cliente
    expect(r.body).not.toContain('banco caiu');
    expect(r.json().requestId).toBeDefined();
  });
});

// ─── Linhas repetidas do mesmo prato ────────────────────────────────────────

describe('mesmo prato em duas linhas', () => {
  it('aceita — e pedido legitimo, e o motivo de `note` ser por linha', async () => {
    // O `WHERE id IN` devolve o item UMA vez; o pedido tem DUAS linhas.
    // Comparar contagem de resultado com contagem de linha rejeitava isso com
    // "Algum item nao existe", mensagem que nao ajuda ninguem.
    prismaMock.menuItem.findMany.mockResolvedValue([CARDAPIO[1]]);
    prismaMock.order.create.mockResolvedValue(pedidoCriado());

    const r = await app.inject({
      method: 'POST',
      url: '/api/m/pedido',
      headers: comMesa,
      payload: {
        items: [
          { menuItemId: SMASH, qty: 1, note: 'sem cebola' },
          { menuItemId: SMASH, qty: 1 },
        ],
      },
    });

    expect(r.statusCode).toBe(201);

    const dados = dadosDoCreate();
    // Duas linhas separadas, cada uma com a propria nota
    expect(dados.items.create).toHaveLength(2);
    expect(dados.items.create[0].note).toBe('sem cebola');
    expect(dados.items.create[1].note).toBeNull();
    // E o total conta as duas
    expect(dados.totalCents).toBe(3200 * 2);
  });

  it('continua recusando item que realmente nao existe', async () => {
    // Pediu dois ids distintos, o banco so conhece um
    prismaMock.menuItem.findMany.mockResolvedValue([CARDAPIO[0]]);

    const r = await app.inject({
      method: 'POST',
      url: '/api/m/pedido',
      headers: comMesa,
      payload: {
        items: [
          { menuItemId: BATATA, qty: 1 },
          { menuItemId: MOQUECA, qty: 1 },
        ],
      },
    });

    expect(r.statusCode).toBe(400);
    expect(r.json().error).toMatch(/nao existe/i);
    expect(prismaMock.order.create).not.toHaveBeenCalled();
  });
});

// ─── Cozinha pausada ────────────────────────────────────────────────────────

/**
 * UM PEDIDO, UMA COZINHA.
 *
 * Este arquivo AFIRMAVA o contrario: havia um caso chamado "soma linhas de
 * cozinhas diferentes" que montava um pedido misto e conferia o total. Ele
 * passava, e era justamente a bomba — o resto do sistema nao aguenta pedido
 * misto:
 *
 *   GET /api/m/pedidos rotula o pedido inteiro com `items[0].kitchen`, entao
 *   o cliente veria a cozinha errada;
 *
 *   `Order.totalCents` e um numero so e fechar conta e por cozinha, entao o
 *   valor exibido nao bateria com o que se paga em cada balcao.
 *
 * O app nunca criou pedido assim (o carrinho manda um POST por cozinha), mas o
 * contrato aceitava. Quem chamasse a API direto derrubava a suposicao sem erro
 * nenhum — so telas mentindo.
 */
describe('um pedido, uma cozinha', () => {
  it('recusa pedido com itens de cozinhas diferentes', async () => {
    // Exatamente os dois pedidos, como o `WHERE id IN` faria. Devolver o
    // cardapio inteiro faria a rota recusar por "item nao existe" ANTES de
    // chegar na regra de cozinha — e o teste passaria pelo motivo errado.
    prismaMock.menuItem.findMany.mockResolvedValue([CARDAPIO[0], CARDAPIO[2]]);
    prismaMock.order.create.mockResolvedValue(pedidoCriado());

    const r = await app.inject({
      method: 'POST',
      url: '/api/m/pedido',
      headers: comMesa,
      payload: {
        items: [
          { menuItemId: BATATA, qty: 1 }, // Lou Burger
          { menuItemId: MOQUECA, qty: 1 }, // Cumbuca
        ],
      },
    });

    expect(r.statusCode).toBe(400);
    // Nada e gravado: nao existe meio pedido.
    expect(prismaMock.order.create).not.toHaveBeenCalled();
  });

  it('a mensagem diz o que fazer, nao so que deu errado', async () => {
    prismaMock.menuItem.findMany.mockResolvedValue([CARDAPIO[0], CARDAPIO[2]]);

    const r = await app.inject({
      method: 'POST',
      url: '/api/m/pedido',
      headers: comMesa,
      payload: {
        items: [
          { menuItemId: BATATA, qty: 1 },
          { menuItemId: MOQUECA, qty: 1 },
        ],
      },
    });

    // "Mande um pedido por cozinha" e a saida; sem ela, quem integra pela API
    // fica adivinhando o que o servidor quer.
    expect(r.json().error).toContain('uma cozinha');
  });

  it('continua aceitando varias linhas da mesma cozinha', async () => {
    prismaMock.menuItem.findMany.mockResolvedValue([CARDAPIO[0], CARDAPIO[1]]);
    prismaMock.order.create.mockResolvedValue(pedidoCriado());

    const r = await app.inject({
      method: 'POST',
      url: '/api/m/pedido',
      headers: comMesa,
      payload: {
        items: [
          { menuItemId: BATATA, qty: 1 },
          { menuItemId: SMASH, qty: 1 },
        ],
      },
    });

    expect(r.statusCode).toBe(201);
  });
});

describe('cozinha que parou de receber', () => {
  it('pedido pra cozinha PAUSADA e recusado', async () => {
    prismaMock.menuItem.findMany.mockResolvedValue([
      {
        id: BATATA,
        name: 'Smash Lou',
        priceCents: 3200,
        available: true,
        kitchen: {
          id: 'k-lou',
          slug: 'lou-burger',
          name: 'Lou Burger',
          status: 'pausada',
          spaceId: 'space-1',
        },
      },
    ]);

    const r = await app.inject({
      method: 'POST',
      url: '/api/m/pedido',
      headers: comMesa,
      payload: { items: [{ menuItemId: BATATA, qty: 1 }] },
    });

    // O cardapio e o quintal ja filtram por `ativa`, mas quem esta com a pagina
    // aberta desde antes da pausa nao viu a mudanca. Sem esta trava o pedido
    // entraria numa cozinha que acabou de dizer que nao da conta.
    expect(r.statusCode).toBe(409);
    expect(r.json().error).toMatch(/nao esta recebendo/);
    expect(prismaMock.order.create).not.toHaveBeenCalled();
  });

  it('a mensagem diz QUAL cozinha parou', async () => {
    prismaMock.menuItem.findMany.mockResolvedValue([
      {
        id: BATATA,
        name: 'Moqueca',
        priceCents: 5000,
        available: true,
        kitchen: {
          id: 'k-cumbuca',
          slug: 'cumbuca-caicara',
          name: 'Cumbuca Caiçara',
          status: 'pausada',
          spaceId: 'space-1',
        },
      },
    ]);

    const j = (
      await app.inject({
        method: 'POST',
        url: '/api/m/pedido',
        headers: comMesa,
        payload: { items: [{ menuItemId: BATATA, qty: 1 }] },
      })
    ).json();

    // Num carrinho com varias cozinhas, "uma cozinha parou" nao ajuda o cliente
    // a saber o que tirar.
    expect(j.error).toContain('Cumbuca Caiçara');
    expect(j.kitchenSlug).toBe('cumbuca-caicara');
  });
});
