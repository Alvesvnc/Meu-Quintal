import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { criarPrismaMock, ESPACO, CONTA, usuarioDono, type PrismaMock } from '../test/prismaMock.js';

const prismaMock: PrismaMock = criarPrismaMock();
vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }));

const { buildApp } = await import('../app.js');

let app: FastifyInstance;

/** Assina um token do jeito que o login de verdade assina. */
function tokenDono(role: 'owner' | 'admin' | 'staff' = 'owner', accountId = CONTA.id) {
  return app.jwt.sign({
    kind: 'dono' as const,
    sub: 'user-1',
    accountId,
    accountSlug: CONTA.slug,
    email: 'marina@meuquintal.app',
    role,
  });
}

function tokenCozinha() {
  return app.jwt.sign({
    kind: 'cozinha' as const,
    sub: 'kuser-1',
    kitchenId: 'kitchen-1',
    kitchenSlug: 'lou-burger',
    email: 'marcos@louburger.com',
    role: 'owner',
  });
}

const comAuth = (token: string) => ({ authorization: `Bearer ${token}` });

beforeEach(async () => {
  vi.clearAllMocks();
  const base = criarPrismaMock();
  Object.assign(prismaMock, base);
  app = await buildApp({ socket: false, logger: false, cron: false });
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

// ─── Autenticação ───────────────────────────────────────────────────────────

describe('/api/a/* — porta de entrada', () => {
  it('sem token devolve 401', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/a/overview' });
    expect(r.statusCode).toBe(401);
  });

  it('token corrompido devolve 401', async () => {
    const r = await app.inject({
      method: 'GET',
      url: '/api/a/overview',
      headers: comAuth('nao.e.um.jwt'),
    });
    expect(r.statusCode).toBe(401);
  });

  it('login com senha errada nao distingue de usuario inexistente', async () => {
    prismaMock.accountUser.findUnique.mockResolvedValue(null);
    const r = await app.inject({
      method: 'POST',
      url: '/api/a/auth/login',
      payload: { email: 'ninguem@lugar.com', password: 'senha-errada' },
    });
    expect(r.statusCode).toBe(401);
    // Mensagem generica de proposito: diferenciar entregaria uma lista de
    // emails validos pra quem estivesse sondando.
    expect(r.json().error).toBe('Email ou senha invalidos.');
  });
});

// ─── A trava que impede um app de virar o outro ─────────────────────────────

describe('tipo de token (os dois JWT usam o mesmo segredo)', () => {
  it('JWT de COZINHA nao abre rota de dono', async () => {
    const r = await app.inject({
      method: 'GET',
      url: '/api/a/overview',
      headers: comAuth(tokenCozinha()),
    });
    expect(r.statusCode).toBe(403);
    expect(r.json().error).toMatch(/painel do dono/i);
  });

  it('JWT de DONO nao abre rota de cozinha', async () => {
    const r = await app.inject({
      method: 'GET',
      url: '/api/r/fila',
      headers: comAuth(tokenDono()),
    });
    expect(r.statusCode).toBe(403);
    expect(r.json().error).toMatch(/app do restaurante/i);
  });

  it('o token de cozinha e criptograficamente valido — so o `kind` o barra', () => {
    // Se esta assercao falhar, a trava virou redundante e alguem pode remove-la
    // achando que nao faz nada. Ela e a UNICA coisa separando os dois apps.
    expect(() => app.jwt.verify(tokenCozinha())).not.toThrow();
  });
});

// ─── Papéis ─────────────────────────────────────────────────────────────────

describe('papeis dentro da mesma conta', () => {
  beforeEach(() => {
    prismaMock.space.findFirst.mockResolvedValue(ESPACO);
    prismaMock.account.findUnique.mockResolvedValue({ status: 'ativa' });
  });

  it('staff nao ve o financeiro', async () => {
    prismaMock.accountUser.findUnique.mockResolvedValue(usuarioDono('staff'));
    const r = await app.inject({
      method: 'GET',
      url: '/api/a/financeiro',
      headers: comAuth(tokenDono('staff')),
    });
    expect(r.statusCode).toBe(403);
  });

  it('staff mexe em mesa — e o trabalho dele', async () => {
    prismaMock.accountUser.findUnique.mockResolvedValue(usuarioDono('staff'));
    prismaMock.table.updateMany.mockResolvedValue({ count: 1 });
    const r = await app.inject({
      method: 'PATCH',
      url: '/api/a/mesas/4',
      headers: comAuth(tokenDono('staff')),
      payload: { status: 'precisa-limpar' },
    });
    expect(r.statusCode).toBe(200);
  });

  it('admin nao fecha ciclo — so owner', async () => {
    prismaMock.accountUser.findUnique.mockResolvedValue(usuarioDono('admin'));
    const r = await app.inject({
      method: 'POST',
      url: '/api/a/financeiro/fechar',
      headers: comAuth(tokenDono('admin')),
      payload: { refMonth: '2026-01' },
    });
    expect(r.statusCode).toBe(403);
  });

  it('o papel vem do BANCO, nao do token', async () => {
    // Token diz owner; o banco ja rebaixou pra staff. Rebaixar alguem precisa
    // valer na hora, sem esperar o token de 7 dias expirar.
    prismaMock.accountUser.findUnique.mockResolvedValue(usuarioDono('staff'));
    const r = await app.inject({
      method: 'GET',
      url: '/api/a/financeiro',
      headers: comAuth(tokenDono('owner')),
    });
    expect(r.statusCode).toBe(403);
  });
});

// ─── Isolamento: o `where` de toda query precisa carregar o accountId ───────

describe('isolamento multi-tenant', () => {
  beforeEach(() => {
    prismaMock.accountUser.findUnique.mockResolvedValue(usuarioDono('owner'));
    prismaMock.account.findUnique.mockResolvedValue({ status: 'ativa' });
  });

  it('a busca de espaco SEMPRE filtra por accountId', async () => {
    prismaMock.space.findFirst.mockResolvedValue(ESPACO);
    await app.inject({ method: 'GET', url: '/api/a/overview', headers: comAuth(tokenDono()) });

    expect(prismaMock.space.findFirst).toHaveBeenCalled();
    const where = prismaMock.space.findFirst.mock.calls[0][0].where;
    expect(where.accountId).toBe(CONTA.id);
  });

  it('pedir um espaco pelo slug tambem filtra por accountId', async () => {
    prismaMock.space.findFirst.mockResolvedValue(null);
    const r = await app.inject({
      method: 'GET',
      url: '/api/a/overview?espaco=quintal-de-outra-pessoa',
      headers: comAuth(tokenDono()),
    });

    const where = prismaMock.space.findFirst.mock.calls[0][0].where;
    expect(where.accountId).toBe(CONTA.id);
    expect(where.slug).toBe('quintal-de-outra-pessoa');
    // Espaco de outra conta simplesmente nao existe pra quem pergunta
    expect(r.statusCode).toBe(404);
  });

  it('alterar acordo usa updateMany COM spaceId, nunca update por slug', async () => {
    prismaMock.space.findFirst.mockResolvedValue(ESPACO);
    prismaMock.kitchen.updateMany.mockResolvedValue({ count: 1 });

    await app.inject({
      method: 'PATCH',
      url: '/api/a/cozinhas/lou-burger/acordo',
      headers: comAuth(tokenDono()),
      payload: { chargeCommission: true, commissionPct: 10, chargeRent: false, rentCents: 0 },
    });

    const where = prismaMock.kitchen.updateMany.mock.calls[0][0].where;
    expect(where.spaceId).toBe(ESPACO.id);
    expect(where.slug).toBe('lou-burger');
  });

  it('cozinha de outro quintal devolve 404, nao 200 silencioso', async () => {
    prismaMock.space.findFirst.mockResolvedValue(ESPACO);
    prismaMock.kitchen.updateMany.mockResolvedValue({ count: 0 });

    const r = await app.inject({
      method: 'PATCH',
      url: '/api/a/cozinhas/cozinha-alheia/acordo',
      headers: comAuth(tokenDono()),
      payload: { chargeCommission: true, commissionPct: 10, chargeRent: false, rentCents: 0 },
    });
    expect(r.statusCode).toBe(404);
  });

  it('dar baixa em cobranca faz join ate a Account', async () => {
    prismaMock.kitchenCharge.findFirst.mockResolvedValue(null);
    const r = await app.inject({
      method: 'PATCH',
      url: '/api/a/cobrancas/id-de-outro-tenant',
      headers: comAuth(tokenDono()),
      payload: { status: 'paga' },
    });

    const where = prismaMock.kitchenCharge.findFirst.mock.calls[0][0].where;
    // Sem este join, saber o id da cobranca bastaria pra baixa-la
    expect(where.cycle.space.accountId).toBe(CONTA.id);
    expect(r.statusCode).toBe(404);
  });

  it('token com accountId de outra conta e recusado', async () => {
    // O banco diz que user-1 e da acc-1; o token afirma acc-999.
    prismaMock.accountUser.findUnique.mockResolvedValue(usuarioDono('owner'));
    const r = await app.inject({
      method: 'GET',
      url: '/api/a/overview',
      headers: comAuth(tokenDono('owner', 'acc-999')),
    });
    expect(r.statusCode).toBe(401);
  });
});

// ─── Conta suspensa ─────────────────────────────────────────────────────────

describe('conta inadimplente', () => {
  beforeEach(() => {
    prismaMock.accountUser.findUnique.mockResolvedValue(usuarioDono('owner'));
    prismaMock.space.findFirst.mockResolvedValue(ESPACO);
  });

  it('suspensa continua LENDO', async () => {
    prismaMock.account.findUnique.mockResolvedValue({ status: 'suspensa' });
    const r = await app.inject({
      method: 'GET',
      url: '/api/a/overview',
      headers: comAuth(tokenDono()),
    });
    expect(r.statusCode).toBe(200);
  });

  it('suspensa nao ESCREVE — 402', async () => {
    prismaMock.account.findUnique.mockResolvedValue({ status: 'suspensa' });
    const r = await app.inject({
      method: 'PATCH',
      url: '/api/a/cozinhas/lou-burger/acordo',
      headers: comAuth(tokenDono()),
      payload: { chargeCommission: true, commissionPct: 10, chargeRent: false, rentCents: 0 },
    });
    expect(r.statusCode).toBe(402);
  });

  it('cancelada nem entra', async () => {
    prismaMock.accountUser.findUnique.mockResolvedValue({
      ...usuarioDono('owner'),
      account: { id: CONTA.id, slug: CONTA.slug, status: 'cancelada' },
    });
    const r = await app.inject({
      method: 'GET',
      url: '/api/a/overview',
      headers: comAuth(tokenDono()),
    });
    expect(r.statusCode).toBe(403);
  });
});

// ─── Validação de body ──────────────────────────────────────────────────────

describe('validacao de entrada', () => {
  beforeEach(() => {
    prismaMock.accountUser.findUnique.mockResolvedValue(usuarioDono('owner'));
    prismaMock.account.findUnique.mockResolvedValue({ status: 'ativa' });
    prismaMock.space.findFirst.mockResolvedValue(ESPACO);
  });

  it('recusa comissao acima de 100%', async () => {
    const r = await app.inject({
      method: 'PATCH',
      url: '/api/a/cozinhas/lou-burger/acordo',
      headers: comAuth(tokenDono()),
      payload: { chargeCommission: true, commissionPct: 150, chargeRent: false, rentCents: 0 },
    });
    expect(r.statusCode).toBe(400);
  });

  it('recusa aluguel ligado com valor zero', async () => {
    const r = await app.inject({
      method: 'PATCH',
      url: '/api/a/cozinhas/lou-burger/acordo',
      headers: comAuth(tokenDono()),
      payload: { chargeCommission: true, commissionPct: 10, chargeRent: true, rentCents: 0 },
    });
    expect(r.statusCode).toBe(400);
  });

  it('recusa status de mesa fora do enum', async () => {
    const r = await app.inject({
      method: 'PATCH',
      url: '/api/a/mesas/4',
      headers: comAuth(tokenDono()),
      payload: { status: 'em-chamas' },
    });
    expect(r.statusCode).toBe(400);
  });

  it('recusa refMonth mal formado', async () => {
    const r = await app.inject({
      method: 'GET',
      url: '/api/a/financeiro?refMonth=junho',
      headers: comAuth(tokenDono()),
    });
    expect(r.statusCode).toBe(400);
  });
});

// ─── Fechamento de ciclo ────────────────────────────────────────────────────

describe('fechar ciclo', () => {
  beforeEach(() => {
    prismaMock.accountUser.findUnique.mockResolvedValue(usuarioDono('owner'));
    prismaMock.account.findUnique.mockResolvedValue({ status: 'ativa' });
    prismaMock.space.findFirst.mockResolvedValue(ESPACO);
  });

  it('recusa fechar mes que ainda nao terminou', async () => {
    const agora = new Date();
    const mesCorrente = `${agora.getUTCFullYear()}-${String(agora.getUTCMonth() + 1).padStart(2, '0')}`;
    const r = await app.inject({
      method: 'POST',
      url: '/api/a/financeiro/fechar',
      headers: comAuth(tokenDono()),
      payload: { refMonth: mesCorrente },
    });
    expect(r.statusCode).toBe(409);
    expect(r.json().error).toMatch(/ainda nao terminou/i);
  });

  it('recusa fechar duas vezes', async () => {
    prismaMock.billingCycle.findUnique.mockResolvedValue({ status: 'fechado' });
    const r = await app.inject({
      method: 'POST',
      url: '/api/a/financeiro/fechar',
      headers: comAuth(tokenDono()),
      payload: { refMonth: '2026-01' },
    });
    expect(r.statusCode).toBe(409);
    expect(r.json().error).toMatch(/ja foi fechado/i);
  });
});

// ─── Dados que não podem sair na resposta ───────────────────────────────────

describe('vazamento de credencial na resposta', () => {
  it('a lista de mesas NAO devolve o qrToken', async () => {
    prismaMock.accountUser.findUnique.mockResolvedValue(usuarioDono('owner'));
    prismaMock.space.findFirst.mockResolvedValue(ESPACO);
    prismaMock.table.findMany.mockResolvedValue([
      {
        id: 't1',
        numero: 1,
        status: 'livre',
        isActive: true,
        qrToken: 'mesa-1-dev-SEGREDO',
        orders: [],
      },
    ]);

    const r = await app.inject({
      method: 'GET',
      url: '/api/a/mesas',
      headers: comAuth(tokenDono()),
    });

    expect(r.statusCode).toBe(200);
    // O qrToken E a credencial da mesa: devolve-lo aqui o colocaria em cache de
    // browser, em screenshot e no devtools de quem abrir o painel.
    expect(r.body).not.toContain('SEGREDO');
    expect(r.json()[0].qrToken).toBeUndefined();
  });
});
