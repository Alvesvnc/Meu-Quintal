import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import { criarPrismaMock, type PrismaMock, cozinhaLogada } from '../test/prismaMock.js';

const prismaMock: PrismaMock = criarPrismaMock();
vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }));

const { buildApp } = await import('../app.js');

/**
 * Aceitar o convite: a porta de entrada de uma cozinha no sistema.
 *
 * É rota PÚBLICA — quem chega nela ainda não tem conta. O que autentica é o
 * token do link, e o banco só guarda o hash dele. Por isso os testes olham
 * três coisas: quem é recusado, o que acontece quando dois cliques chegam
 * juntos, e se o que é criado respeita o que foi combinado no convite.
 */

let app: FastifyInstance;

const TOKEN = 'token-de-teste-com-tamanho-suficiente';
const HASH = crypto.createHash('sha256').update(TOKEN).digest('hex');

const CONTA = { id: 'acc-1', name: 'Quintal São Sebastião', status: 'ativa', plan: 'praca' };
const ESPACO = { id: 'space-1', name: 'Meu Quintal', slug: 'sao-sebastiao' };

function convite(over: Record<string, unknown> = {}) {
  return {
    id: 'inv-1',
    accountId: CONTA.id,
    spaceId: ESPACO.id,
    email: 'marcos@louburger.com',
    tokenHash: HASH,
    kind: 'cozinha',
    expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    acceptedAt: null,
    kitchenName: 'Lou Burger',
    chargeCommission: true,
    commissionPct: 12,
    chargeRent: true,
    rentCents: 80_000,
    account: CONTA,
    space: ESPACO,
    ...over,
  };
}

const aceitar = (body: Record<string, unknown> = { password: 'senha-forte-123' }) =>
  app.inject({ method: 'POST', url: `/api/convite/${TOKEN}/aceitar`, payload: body });

beforeEach(async () => {
  vi.clearAllMocks();
  Object.assign(prismaMock, criarPrismaMock());
  cozinhaLogada(prismaMock, 'k-novo', 'ku-novo');
  prismaMock.invite.findUnique.mockResolvedValue(convite());
  prismaMock.kitchenUser.findUnique.mockResolvedValue(null);
  prismaMock.kitchen.count.mockResolvedValue(0);
  prismaMock.kitchen.findMany.mockResolvedValue([]);
  prismaMock.invite.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.kitchen.create.mockResolvedValue({
    id: 'k-novo',
    slug: 'lou-burger',
    name: 'Lou Burger',
    status: 'pausada',
  });
  prismaMock.kitchenUser.create.mockResolvedValue({
    id: 'ku-novo',
    email: 'marcos@louburger.com',
    role: 'owner',
  });
  // O $transaction recebe um callback aqui; executa com o proprio mock.
  prismaMock.$transaction.mockImplementation(async (fn: unknown) =>
    typeof fn === 'function' ? await (fn as (tx: unknown) => unknown)(prismaMock) : fn,
  );
  app = await buildApp({ socket: false, logger: false, cron: false });
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

// ─── Ler o convite antes de aceitar ─────────────────────────────────────────

describe('GET /api/convite/:token', () => {
  it('mostra o acordo ANTES de pedir senha', async () => {
    const j = (await app.inject({ method: 'GET', url: `/api/convite/${TOKEN}` })).json();
    // Aceitar comissao e aluguel sem ler seria assinar em branco, e o convite e
    // o unico momento em que esses termos passam pela frente do responsavel.
    expect(j.acordo).toEqual({
      chargeCommission: true,
      commissionPct: 12,
      chargeRent: true,
      rentCents: 80_000,
    });
    expect(j.kitchenName).toBe('Lou Burger');
    expect(j.spaceName).toBe('Meu Quintal');
  });

  it('busca pelo HASH, nunca pelo token em texto', async () => {
    await app.inject({ method: 'GET', url: `/api/convite/${TOKEN}` });
    const where = prismaMock.invite.findUnique.mock.calls[0][0].where;
    // Vazamento de banco nao pode virar convite aceitavel.
    expect(where.tokenHash).toBe(HASH);
    expect(JSON.stringify(where)).not.toContain(TOKEN);
  });

  it('nao vaza id de conta nem de espaco', async () => {
    const j = (await app.inject({ method: 'GET', url: `/api/convite/${TOKEN}` })).json();
    // Rota publica: devolve o que a pessoa precisa ler, nao a estrutura interna.
    expect(JSON.stringify(j)).not.toContain('acc-1');
    expect(JSON.stringify(j)).not.toContain('space-1');
  });
});

// ─── Quem é recusado ────────────────────────────────────────────────────────

describe('convites que nao servem', () => {
  it('inexistente devolve 404', async () => {
    prismaMock.invite.findUnique.mockResolvedValue(null);
    expect((await aceitar()).statusCode).toBe(404);
  });

  it('ja aceito devolve 409, e manda entrar', async () => {
    prismaMock.invite.findUnique.mockResolvedValue(convite({ acceptedAt: new Date() }));
    const r = await aceitar();
    expect(r.statusCode).toBe(409);
    // Distinguir de expirado e proposital: sao saidas diferentes — uma pede
    // convite novo, a outra pede login.
    expect(r.json().error).toMatch(/entrar com sua senha/);
  });

  it('expirado devolve 410, e manda pedir outro', async () => {
    prismaMock.invite.findUnique.mockResolvedValue(
      convite({ expiresAt: new Date(Date.now() - 1000) }),
    );
    const r = await aceitar();
    expect(r.statusCode).toBe(410);
    expect(r.json().error).toMatch(/Peca um novo/);
  });

  it('conta cancelada nao gera cozinha', async () => {
    prismaMock.invite.findUnique.mockResolvedValue(
      convite({ account: { ...CONTA, status: 'cancelada' } }),
    );
    expect((await aceitar()).statusCode).toBe(409);
    expect(prismaMock.kitchen.create).not.toHaveBeenCalled();
  });

  it('email que ja tem acesso devolve 409', async () => {
    prismaMock.kitchenUser.findUnique.mockResolvedValue({ id: 'ku-antigo' });
    const r = await aceitar();
    // KitchenUser.email e unico no sistema: e assim que o login descobre a que
    // cozinha a pessoa pertence, sem pedir o quintal no formulario.
    expect(r.statusCode).toBe(409);
    expect(prismaMock.kitchen.create).not.toHaveBeenCalled();
  });

  it('senha curta devolve 400 e nem consulta o convite', async () => {
    const r = await aceitar({ password: '1234' });
    expect(r.statusCode).toBe(400);
    expect(prismaMock.invite.findUnique).not.toHaveBeenCalled();
  });

  it('o teto do plano e reconferido no ACEITE', async () => {
    prismaMock.invite.findUnique.mockResolvedValue(
      convite({ account: { ...CONTA, plan: 'restaurante' } }),
    );
    prismaMock.kitchen.count.mockResolvedValue(1);

    const r = await aceitar();

    // O convite vale 7 dias, e o quintal pode ter enchido nesse intervalo.
    // Conferir so na criacao deixaria dois convites virarem duas cozinhas.
    expect(r.statusCode).toBe(409);
    expect(prismaMock.kitchen.create).not.toHaveBeenCalled();
  });
});

// ─── O aceite ───────────────────────────────────────────────────────────────

describe('aceitar', () => {
  it('cria cozinha e acesso, e ja devolve token', async () => {
    const r = await aceitar({ password: 'senha-forte-123', name: 'Marcos' });
    expect(r.statusCode).toBe(201);
    expect(r.json().token).toBeTruthy();
    expect(r.json().kitchen.slug).toBe('lou-burger');
  });

  it('a cozinha nasce PAUSADA', async () => {
    await aceitar();
    // O cliente nao pode ver uma cozinha sem cardapio. Quem publica e o
    // responsavel, depois de cadastrar os pratos.
    expect(prismaMock.kitchen.create.mock.calls[0][0].data.status).toBe('pausada');
  });

  it('copia os termos DO CONVITE, nao os padroes do quintal', async () => {
    await aceitar();
    const data = prismaMock.kitchen.create.mock.calls[0][0].data;
    // O acordo foi negociado antes e a pessoa acabou de le-lo na tela.
    expect(data.chargeCommission).toBe(true);
    expect(data.commissionPct).toBe(12);
    expect(data.chargeRent).toBe(true);
    expect(data.rentCents).toBe(80_000);
  });

  it('a senha e gravada como HASH argon2', async () => {
    await aceitar({ password: 'senha-forte-123' });
    const hash = prismaMock.kitchenUser.create.mock.calls[0][0].data.passwordHash;
    expect(hash).toMatch(/^\$argon2/);
    expect(hash).not.toContain('senha-forte-123');
  });

  it('o email vem DO CONVITE, nunca do body', async () => {
    await aceitar({ password: 'senha-forte-123', email: 'invasor@outro.com' });
    // Aceitar email do body deixaria quem tem o link criar acesso pra outro
    // endereco.
    expect(prismaMock.kitchenUser.create.mock.calls[0][0].data.email).toBe('marcos@louburger.com');
  });

  it('slug em uso ganha sufixo', async () => {
    prismaMock.kitchen.findMany.mockResolvedValue([{ slug: 'lou-burger' }]);
    await aceitar();
    // Kitchen.slug e unico POR ESPACO: duas homonimas no mesmo quintal nao
    // podem colidir.
    expect(prismaMock.kitchen.create.mock.calls[0][0].data.slug).toBe('lou-burger-2');
  });

  it('DOIS CLIQUES nao criam duas cozinhas', async () => {
    // O segundo chega quando o convite ja foi carimbado: o updateMany
    // condicional devolve count 0 e ele desiste.
    prismaMock.invite.updateMany.mockResolvedValue({ count: 0 });

    const r = await aceitar();

    expect(r.statusCode).toBe(409);
    expect(prismaMock.kitchen.create).not.toHaveBeenCalled();
  });

  it('carimba o convite ANTES de criar — a condicao e a trava', async () => {
    await aceitar();
    const where = prismaMock.invite.updateMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ id: 'inv-1', acceptedAt: null });
  });
});
