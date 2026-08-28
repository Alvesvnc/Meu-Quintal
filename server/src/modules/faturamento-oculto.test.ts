import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { criarPrismaMock, ESPACO, CONTA, usuarioDono, type PrismaMock } from '../test/prismaMock.js';

const prismaMock: PrismaMock = criarPrismaMock();
vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }));

const { buildApp } = await import('../app.js');

/**
 * O faturamento da cozinha não é do dono — a não ser que ele cobre comissão.
 *
 * `lib/faturamento.test.ts` prova a regra. ESTE arquivo prova que ela foi
 * aplicada em TODAS as portas, e é essa a parte que costuma falhar: esconder o
 * número na tela do financeiro e deixá-lo vazar pela tela de mesas não protege
 * nada. Foram quatro portas encontradas de uma vez:
 *
 * A linha não é "dinheiro se esconde". É: **nunca se identifica quanto é de
 * cada restaurante**.
 *
 *   QUEBRA POR COZINHA — a regra vale
 *     GET /api/a/cozinhas     movimento do dia: só a própria cozinha
 *     GET /api/a/financeiro   bruto do ciclo: só com comissão, e o total do
 *                             rodapé soma só o visível (senão a subtração
 *                             entrega a oculta na mesma tela)
 *
 *   AGREGADO DO ESPAÇO — conta tudo, inclusive cozinha só-aluguel
 *     GET /api/a/overview           faturamento do dia do quintal
 *     GET /api/a/mesas              consumo por mesa
 *     GET /api/a/mesas/desempenho   quanto cada mesa rende
 *
 * O que segura o segundo grupo é a AUSÊNCIA de quebra por cozinha na resposta.
 * Por isso há testes conferindo as chaves e procurando por slug de cozinha no
 * JSON inteiro: no dia em que alguém acrescentar um `porCozinha` ali, eles
 * caem, e a regra de `lib/faturamento.ts` volta a valer naquela rota.
 */

let app: FastifyInstance;

/** Paga comissão: o dono vê, porque o bruto é a base da conta dele. */
const COM_COMISSAO = { id: 'k1', slug: 'lou-burger', name: 'Lou Burger', chargeCommission: true };
/** Âncora que paga só aluguel fixo: quanto vende é assunto dela. */
const SO_ALUGUEL = { id: 'k2', slug: 'taverna', name: 'Taverna', chargeCommission: false };

function token() {
  return app.jwt.sign({
    kind: 'dono' as const,
    sub: 'user-1',
    accountId: CONTA.id,
    accountSlug: CONTA.slug,
    email: 'marina@qro.app',
    role: 'owner',
  });
}
const auth = () => ({ authorization: `Bearer ${token()}` });

/** Item de pedido pertencente a uma cozinha. */
function item(k: { id: string; chargeCommission: boolean }, qty: number, cents: number) {
  return { qty, unitPriceCents: cents, status: 'novo', kitchen: k };
}

/** O dono opera `kitchenId`, ou nenhuma. */
function donoOperando(kitchenId: string | null) {
  return { ...usuarioDono('owner'), kitchenId };
}

beforeEach(async () => {
  vi.clearAllMocks();
  Object.assign(prismaMock, criarPrismaMock());
  prismaMock.accountUser.findUnique.mockResolvedValue(donoOperando(null));
  prismaMock.space.findFirst.mockResolvedValue(ESPACO);
  prismaMock.account.findUnique.mockResolvedValue({ status: 'ativa' });
  app = await buildApp({ socket: false, logger: false, cron: false });
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

// ─── A lista de cozinhas ────────────────────────────────────────────────────

describe('GET /api/a/cozinhas — e configuracao, nao acompanhamento', () => {
  function duasCozinhas() {
    prismaMock.kitchen.findMany.mockResolvedValue([
      { ...COM_COMISSAO, category: null, status: 'ativa', slaMinutes: 12, commissionPct: null,
        chargeRent: false, rentCents: 0,
        orderItems: [{ qty: 2, unitPriceCents: 3000, orderId: 'o1' }] },
      { ...SO_ALUGUEL, category: null, status: 'ativa', slaMinutes: 12, commissionPct: null,
        chargeRent: true, rentCents: 300_000,
        orderItems: [{ qty: 5, unitPriceCents: 4000, orderId: 'o2' }] },
    ]);
  }

  const lista = async () =>
    (await app.inject({ method: 'GET', url: '/api/a/cozinhas', headers: auth() })).json();

  it('nem com comissao o dono ve o movimento DO DIA', async () => {
    duasCozinhas();
    const j = await lista();
    // Comissao da acesso ao bruto do CICLO, que e a base da conta — e isso
    // segue no /financeiro. Como a cozinha foi no almoco de hoje nao e base de
    // nada, entao nao e do dono.
    expect(j.find((k: { slug: string }) => k.slug === 'lou-burger').grossTodayCents).toBeNull();
  });

  it('a contagem de pedidos tambem e da cozinha', async () => {
    duasCozinhas();
    const j = await lista();
    // Quantas comandas ela tirou hoje nao muda em nada o que ela deve.
    expect(j.find((k: { slug: string }) => k.slug === 'lou-burger').ordersToday).toBeNull();
    expect(j.find((k: { slug: string }) => k.slug === 'taverna').ordersToday).toBeNull();
  });

  it('a PROPRIA cozinha aparece inteira', async () => {
    // Restaurante unico, ou dono de praca que tambem toca uma casinha: o caixa
    // e dele.
    prismaMock.accountUser.findUnique.mockResolvedValue(donoOperando('k1'));
    duasCozinhas();
    const j = await lista();
    const minha = j.find((k: { slug: string }) => k.slug === 'lou-burger');
    expect(minha.grossTodayCents).toBe(6000);
    expect(minha.ordersToday).toBe(1);
  });

  it('operar uma casinha nao abre o dia da vizinha', async () => {
    prismaMock.accountUser.findUnique.mockResolvedValue(donoOperando('k1'));
    duasCozinhas();
    const j = await lista();
    const vizinha = j.find((k: { slug: string }) => k.slug === 'taverna');
    expect(vizinha.grossTodayCents).toBeNull();
    expect(vizinha.ordersToday).toBeNull();
  });

  it('o ACORDO continua inteiro — e o que essa tela existe pra mostrar', async () => {
    duasCozinhas();
    const j = await lista();
    const taverna = j.find((k: { slug: string }) => k.slug === 'taverna');
    // Some-la ou esconder os termos seria pior que mostrar o movimento: o dono
    // precisa saber que a cozinha existe, esta ativa e quanto ela deve.
    expect(taverna).toBeDefined();
    expect(taverna.status).toBe('ativa');
    expect(taverna.acordo.chargeRent).toBe(true);
    expect(taverna.acordo.rentCents).toBe(300_000);
  });
});

// ─── O rodapé do financeiro ─────────────────────────────────────────────────

describe('GET /api/a/financeiro', () => {
  function comAncora() {
    prismaMock.billingCycle.findUnique.mockResolvedValue(null);
    prismaMock.kitchen.findMany.mockResolvedValue([
      { ...COM_COMISSAO, commissionPct: null, chargeRent: false, rentCents: 0,
        orderItems: [{ qty: 2, unitPriceCents: 3000 }] },
      { ...SO_ALUGUEL, commissionPct: null, chargeRent: true, rentCents: 300_000,
        orderItems: [{ qty: 5, unitPriceCents: 4000 }] },
    ]);
  }

  it('o total NAO entrega a oculta por subtracao', async () => {
    comAncora();
    const j = (
      await app.inject({ method: 'GET', url: '/api/a/financeiro?refMonth=2026-01', headers: auth() })
    ).json();

    // A Taverna vendeu 20.000. Se o rodape somasse 26.000, bastaria subtrair a
    // unica linha visivel (6.000) pra chegar nela. O rodape para em 6.000.
    expect(j.totais.grossCents).toBe(6000);
    expect(j.totais.grossParcial).toBe(true);
    expect(j.totais.cozinhasOcultas).toBe(1);
  });

  it('o que a cozinha DEVE continua somando — isso e dinheiro do dono', async () => {
    comAncora();
    const j = (
      await app.inject({ method: 'GET', url: '/api/a/financeiro?refMonth=2026-01', headers: auth() })
    ).json();

    // Esconder o bruto nao pode esconder a cobranca: o aluguel da Taverna e
    // exatamente o que o dono tem a receber dela.
    expect(j.totais.rentCents).toBe(300_000);
    expect(j.totais.aReceberCents).toBe(300_000 + 900);
  });

  it('todo mundo visivel: o total volta a ser o do espaco', async () => {
    prismaMock.billingCycle.findUnique.mockResolvedValue(null);
    prismaMock.kitchen.findMany.mockResolvedValue([
      { ...COM_COMISSAO, commissionPct: null, chargeRent: false, rentCents: 0,
        orderItems: [{ qty: 2, unitPriceCents: 3000 }] },
    ]);

    const j = (
      await app.inject({ method: 'GET', url: '/api/a/financeiro?refMonth=2026-01', headers: auth() })
    ).json();

    expect(j.totais.grossParcial).toBe(false);
    expect(j.totais.cozinhasOcultas).toBe(0);
  });
});

// ─── O histórico congelado ──────────────────────────────────────────────────

describe('ciclo fechado usa o acordo DA EPOCA', () => {
  it('mes fechado sob aluguel fixo segue oculto mesmo com comissao ligada hoje', async () => {
    // A cozinha HOJE paga comissao...
    prismaMock.kitchen.findMany.mockResolvedValue([]);
    // ...mas quando o ciclo fechou, nao pagava.
    prismaMock.billingCycle.findUnique.mockResolvedValue({
      status: 'fechado',
      charges: [
        {
          kitchenId: 'k2',
          grossCents: 20_000,
          chargeCommission: false,
          commissionPct: 0,
          commissionCents: 0,
          rentCents: 300_000,
          totalDueCents: 300_000,
          status: 'fechada',
          paidAt: null,
          kitchen: { slug: 'taverna', name: 'Taverna' },
        },
      ],
    });

    const j = (
      await app.inject({ method: 'GET', url: '/api/a/financeiro?refMonth=2026-01', headers: auth() })
    ).json();

    // Fecha o buraco do "liga a comissao, olha o historico, desliga de novo".
    // Aquele mes foi vendido sob um acordo que nao dava esse acesso.
    expect(j.linhas[0].grossCents).toBeNull();
    expect(j.totais.grossCents).toBe(0);
  });

  it('mes fechado COM comissao continua auditavel', async () => {
    prismaMock.kitchen.findMany.mockResolvedValue([]);
    prismaMock.billingCycle.findUnique.mockResolvedValue({
      status: 'fechado',
      charges: [
        {
          kitchenId: 'k1',
          grossCents: 100_000,
          chargeCommission: true,
          commissionPct: 15,
          commissionCents: 15_000,
          rentCents: 0,
          totalDueCents: 15_000,
          status: 'fechada',
          paidAt: null,
          kitchen: { slug: 'lou-burger', name: 'Lou Burger' },
        },
      ],
    });

    const j = (
      await app.inject({ method: 'GET', url: '/api/a/financeiro?refMonth=2026-01', headers: auth() })
    ).json();

    // Sem o bruto, a cozinha nao teria como conferir se os 15% batem.
    expect(j.linhas[0].grossCents).toBe(100_000);
  });
});

// ─── As portas dos fundos ───────────────────────────────────────────────────

describe('agregado do espaco conta TODAS as cozinhas', () => {
  it('o faturamento do dia soma inclusive a cozinha so-aluguel', async () => {
    prismaMock.order.findMany.mockResolvedValue([
      { items: [item(COM_COMISSAO, 2, 3000)] },
      { items: [item(SO_ALUGUEL, 5, 4000)] },
    ]);

    const j = (await app.inject({ method: 'GET', url: '/api/a/overview', headers: auth() })).json();

    // 26.000, o total do quintal. Este numero e do ESPACO — o dono precisa dele
    // pra tocar o lugar, e a resposta nao quebra por cozinha, entao nao ha
    // restaurante identificado aqui.
    expect(j.hoje.grossCents).toBe(26_000);
  });

  it('o overview NAO devolve nada por cozinha — e o que segura a regra', async () => {
    prismaMock.order.findMany.mockResolvedValue([{ items: [item(SO_ALUGUEL, 5, 4000)] }]);

    const j = (await app.inject({ method: 'GET', url: '/api/a/overview', headers: auth() })).json();

    // O total so pode ser cheio ENQUANTO nao houver quebra por cozinha. No dia
    // em que alguem acrescentar um `porCozinha` aqui, este teste cai — e a
    // regra de /faturamento.ts passa a valer nesta rota tambem.
    expect(Object.keys(j)).toEqual(['space', 'hoje', 'mesas', 'cozinhas']);
    expect(Object.keys(j.cozinhas)).toEqual(['total', 'ativas', 'pausadas']);
    expect(JSON.stringify(j)).not.toContain('lou-burger');
    expect(JSON.stringify(j)).not.toContain('taverna');
  });

  it('o consumo da mesa conta todas as cozinhas', async () => {
    prismaMock.table.findMany.mockResolvedValue([
      {
        id: 't1', numero: 4, status: 'ocupada', isActive: true, qrToken: 'segredo',
        orders: [{ items: [item(COM_COMISSAO, 2, 3000), item(SO_ALUGUEL, 5, 4000)] }],
      },
    ]);

    const j = (await app.inject({ method: 'GET', url: '/api/a/mesas', headers: auth() })).json();

    // Filtrar por acordo faria a mesa boa da cozinha so-aluguel parecer fraca,
    // e o dono mudaria o salao de lugar por causa disso.
    expect(j[0].grossTodayCents).toBe(26_000);
  });

  it('a lista de mesas nao diz de que cozinha veio o consumo', async () => {
    prismaMock.table.findMany.mockResolvedValue([
      {
        id: 't1', numero: 4, status: 'ocupada', isActive: true, qrToken: 'segredo',
        orders: [{ items: [item(SO_ALUGUEL, 5, 4000)] }],
      },
    ]);

    const j = (await app.inject({ method: 'GET', url: '/api/a/mesas', headers: auth() })).json();

    expect(Object.keys(j[0])).toEqual([
      'id', 'numero', 'status', 'isActive', 'ordersToday', 'grossTodayCents',
    ]);
    expect(JSON.stringify(j)).not.toContain('taverna');
  });

  it('o ranking de mesas conta todas as cozinhas', async () => {
    const CRIADA_ANTES = new Date('2026-01-01T00:00:00Z');
    prismaMock.table.findMany.mockResolvedValue([
      {
        id: 't1', numero: 1, isActive: true, createdAt: CRIADA_ANTES,
        orders: [{ createdAt: new Date('2026-01-15T20:00:00Z'), items: [item(COM_COMISSAO, 2, 3000)] }],
      },
      {
        id: 't2', numero: 2, isActive: true, createdAt: CRIADA_ANTES,
        orders: [{ createdAt: new Date('2026-01-15T20:00:00Z'), items: [item(SO_ALUGUEL, 10, 5000)] }],
      },
    ]);

    const j = (
      await app.inject({
        method: 'GET',
        url: '/api/a/mesas/desempenho?refMonth=2026-01',
        headers: auth(),
      })
    ).json();

    // A mesa 2 lidera com 50.000. Escondendo isso, o dono acharia que a melhor
    // mesa do salao e a pior.
    expect(j.mesas[0].numero).toBe(2);
    expect(j.mesas[0].grossCents).toBe(50_000);
  });

  it('o ranking nao nomeia cozinha nenhuma', async () => {
    prismaMock.table.findMany.mockResolvedValue([
      {
        id: 't2', numero: 2, isActive: true, createdAt: new Date('2026-01-01T00:00:00Z'),
        orders: [{ createdAt: new Date('2026-01-15T20:00:00Z'), items: [item(SO_ALUGUEL, 10, 5000)] }],
      },
    ]);

    const j = (
      await app.inject({
        method: 'GET',
        url: '/api/a/mesas/desempenho?refMonth=2026-01',
        headers: auth(),
      })
    ).json();

    expect(Object.keys(j)).toEqual(['refMonth', 'startsAt', 'endsAt', 'media', 'mesas']);
    expect(JSON.stringify(j)).not.toContain('taverna');
    expect(JSON.stringify(j)).not.toContain('k2');
  });

  it('staff nao ve o ranking — e decisao, nao operacao de salao', async () => {
    prismaMock.accountUser.findUnique.mockResolvedValue({
      ...usuarioDono('staff'),
      kitchenId: null,
    });

    const r = await app.inject({
      method: 'GET',
      url: '/api/a/mesas/desempenho?refMonth=2026-01',
      headers: auth(),
    });

    expect(r.statusCode).toBe(403);
  });

  it('refMonth invalido devolve 400, nao um mes aleatorio', async () => {
    const r = await app.inject({
      method: 'GET',
      url: '/api/a/mesas/desempenho?refMonth=agosto',
      headers: auth(),
    });
    expect(r.statusCode).toBe(400);
  });
});

// ─── A exceção: a própria cozinha ───────────────────────────────────────────

describe('o dono ve o caixa da PROPRIA cozinha', () => {
  it('restaurante unico: comissao desligada e mesmo assim visivel', async () => {
    // O bootstrap cria assim de proposito — nao se cobra comissao de si mesmo.
    prismaMock.accountUser.findUnique.mockResolvedValue(donoOperando('k2'));
    prismaMock.billingCycle.findUnique.mockResolvedValue(null);
    prismaMock.kitchen.findMany.mockResolvedValue([
      { ...SO_ALUGUEL, chargeRent: false, rentCents: 0, commissionPct: null,
        orderItems: [{ qty: 5, unitPriceCents: 4000 }] },
    ]);

    const j = (
      await app.inject({ method: 'GET', url: '/api/a/financeiro?refMonth=2026-01', headers: auth() })
    ).json();

    // Esconder do dono o proprio caixa seria absurdo.
    expect(j.linhas[0].grossCents).toBe(20_000);
    expect(j.totais.grossParcial).toBe(false);
  });

  it('operar uma casinha NAO abre a do vizinho', async () => {
    prismaMock.accountUser.findUnique.mockResolvedValue(donoOperando('k1'));
    prismaMock.billingCycle.findUnique.mockResolvedValue(null);
    prismaMock.kitchen.findMany.mockResolvedValue([
      { ...COM_COMISSAO, commissionPct: null, chargeRent: false, rentCents: 0,
        orderItems: [{ qty: 2, unitPriceCents: 3000 }] },
      { ...SO_ALUGUEL, commissionPct: null, chargeRent: true, rentCents: 300_000,
        orderItems: [{ qty: 5, unitPriceCents: 4000 }] },
    ]);

    const j = (
      await app.inject({ method: 'GET', url: '/api/a/financeiro?refMonth=2026-01', headers: auth() })
    ).json();

    const taverna = j.linhas.find((l: { kitchenSlug: string }) => l.kitchenSlug === 'taverna');
    expect(taverna.grossCents).toBeNull();
  });
});

// ─── O dono nao ve pedido ───────────────────────────────────────────────────

describe('nenhuma rota do dono diz O QUE foi pedido', () => {
  /**
   * O que cada mesa pediu, de quem e quando, e operacao do restaurante. O dono
   * aluga o ponto — nao acompanha o balcao dos inquilinos.
   *
   * Os mocks abaixo devolvem os campos PROIBIDOS de proposito. Como o `select`
   * das rotas nao os pede, o Prisma de verdade nunca os traria; mas uma rota
   * que espalhe o objeto (`...item`) passaria a vazar sem que nada avisasse.
   * E isto que estes testes pegam.
   */
  const PROIBIDOS = ['nameSnapshot', 'shortId', 'Smash Lou', 'lou-burger', 'taverna'];

  function itemFalante(kitchen: { id: string; chargeCommission: boolean }) {
    return {
      qty: 2,
      unitPriceCents: 3000,
      status: 'novo',
      kitchen,
      // Nada disto pode chegar na resposta.
      nameSnapshot: 'Smash Lou',
      note: 'sem cebola',
      menuItemId: 'mi-secreto',
    };
  }

  function pedidoFalante(itens: Array<ReturnType<typeof itemFalante>>) {
    return {
      id: 'o1',
      shortId: '4821',
      createdAt: new Date('2026-01-15T20:00:00Z'),
      table: { numero: 4 },
      items: itens,
    };
  }

  function semVazamento(j: unknown) {
    const texto = JSON.stringify(j);
    return PROIBIDOS.filter((p) => texto.includes(p));
  }

  it('/api/a/overview nao vaza nome de prato nem numero de pedido', async () => {
    prismaMock.order.findMany.mockResolvedValue([
      pedidoFalante([itemFalante(COM_COMISSAO), itemFalante(SO_ALUGUEL)]),
    ]);

    const j = (await app.inject({ method: 'GET', url: '/api/a/overview', headers: auth() })).json();
    expect(semVazamento(j)).toEqual([]);
    // Contagem PODE: nao diz o que foi pedido nem de quem.
    expect(j.hoje.ordersCount).toBe(1);
  });

  it('/api/a/mesas nao vaza o conteudo do pedido', async () => {
    prismaMock.table.findMany.mockResolvedValue([
      {
        id: 't1', numero: 4, status: 'ocupada', isActive: true, qrToken: 'segredo',
        orders: [pedidoFalante([itemFalante(COM_COMISSAO)])],
      },
    ]);

    const j = (await app.inject({ method: 'GET', url: '/api/a/mesas', headers: auth() })).json();
    expect(semVazamento(j)).toEqual([]);
    expect(j[0].ordersToday).toBe(1);
  });

  it('/api/a/mesas/desempenho nao vaza o conteudo do pedido', async () => {
    prismaMock.table.findMany.mockResolvedValue([
      {
        id: 't1', numero: 1, isActive: true, createdAt: new Date('2026-01-01T00:00:00Z'),
        orders: [pedidoFalante([itemFalante(SO_ALUGUEL)])],
      },
    ]);

    const j = (
      await app.inject({
        method: 'GET',
        url: '/api/a/mesas/desempenho?refMonth=2026-01',
        headers: auth(),
      })
    ).json();
    expect(semVazamento(j)).toEqual([]);
    expect(j.mesas[0].pedidos).toBe(1);
  });

  it('/api/a/financeiro nao vaza o conteudo do pedido', async () => {
    prismaMock.billingCycle.findUnique.mockResolvedValue(null);
    prismaMock.kitchen.findMany.mockResolvedValue([
      {
        ...COM_COMISSAO,
        commissionPct: null, chargeRent: false, rentCents: 0,
        orderItems: [itemFalante(COM_COMISSAO)],
      },
    ]);

    const j = (
      await app.inject({ method: 'GET', url: '/api/a/financeiro?refMonth=2026-01', headers: auth() })
    ).json();
    // `lou-burger` aparece aqui de proposito: o financeiro QUEBRA por cozinha,
    // e o dono precisa saber de quem e a cobranca. O que nao pode e o prato.
    expect(JSON.stringify(j)).not.toContain('Smash Lou');
    expect(JSON.stringify(j)).not.toContain('nameSnapshot');
  });

  it('nao existe rota de fila pro dono', async () => {
    for (const url of ['/api/a/pedidos', '/api/a/fila', '/api/a/pedidos/ao-vivo']) {
      const r = await app.inject({ method: 'GET', url, headers: auth() });
      // 404 de rota inexistente. Se um dia alguem criar uma delas, este teste
      // cai — e a conversa volta pra secao 1.7 de pendencias.txt.
      expect(r.statusCode).toBe(404);
    }
  });
});
