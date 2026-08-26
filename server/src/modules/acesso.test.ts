import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import { criarPrismaMock, CONTA, usuarioDono, ESPACO, type PrismaMock } from '../test/prismaMock.js';

const prismaMock: PrismaMock = criarPrismaMock();
vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }));

const { buildApp } = await import('../app.js');

/**
 * Primeiro acesso: a pessoa define a própria senha.
 *
 * Existe para que a senha do dono nunca precise trafegar. Antes disto o
 * `bootstrap` gerava uma senha, imprimia no terminal e o operador ditava por
 * WhatsApp — a credencial que abre a conta inteira passeando por canal nenhum.
 */

let app: FastifyInstance;

const TOKEN = 'token-de-primeiro-acesso-suficientemente-longo';
const HASH = crypto.createHash('sha256').update(TOKEN).digest('hex');

function acesso(over: Record<string, unknown> = {}) {
  return {
    id: 'at-1',
    tokenHash: HASH,
    userId: 'user-1',
    expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    usedAt: null,
    user: {
      id: 'user-1',
      email: 'marina@meuquintal.app',
      name: 'Marina',
      accountId: CONTA.id,
      account: { name: CONTA.name, status: 'ativa' },
    },
    ...over,
  };
}

const definir = (body: Record<string, unknown> = { password: 'senha-forte-123' }) =>
  app.inject({ method: 'POST', url: `/api/acesso/${TOKEN}/senha`, payload: body });

beforeEach(async () => {
  vi.clearAllMocks();
  Object.assign(prismaMock, criarPrismaMock());
  prismaMock.accessToken.findUnique.mockResolvedValue(acesso());
  prismaMock.accessToken.updateMany.mockResolvedValue({ count: 1 });
  // montarMe, chamado depois de definir a senha
  prismaMock.accountUser.findUniqueOrThrow.mockResolvedValue({
    ...usuarioDono('owner'),
    email: 'marina@meuquintal.app',
    name: 'Marina',
    kitchenId: null,
    account: { ...CONTA, trialEndsAt: null, spaces: [{ ...ESPACO, _count: { tables: 4 } }] },
  });
  prismaMock.$transaction.mockImplementation(async (fn: unknown) =>
    typeof fn === 'function' ? await (fn as (tx: unknown) => unknown)(prismaMock) : fn,
  );
  app = await buildApp({ socket: false, logger: false, cron: false });
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

// ─── Abrir o link ───────────────────────────────────────────────────────────

describe('GET /api/acesso/:token', () => {
  it('diz DE QUEM e a conta antes de pedir senha', async () => {
    const j = (await app.inject({ method: 'GET', url: `/api/acesso/${TOKEN}` })).json();
    // Chegar numa tela de "crie sua senha" sem saber de que conta se trata e o
    // formato de todo golpe de phishing.
    expect(j.accountName).toBe(CONTA.name);
    expect(j.email).toBe('marina@meuquintal.app');
  });

  it('busca pelo HASH, nunca pelo token em texto', async () => {
    await app.inject({ method: 'GET', url: `/api/acesso/${TOKEN}` });
    const where = prismaMock.accessToken.findUnique.mock.calls[0][0].where;
    expect(where.tokenHash).toBe(HASH);
    expect(JSON.stringify(where)).not.toContain(TOKEN);
  });

  it('nao vaza id de usuario nem de conta', async () => {
    const j = (await app.inject({ method: 'GET', url: `/api/acesso/${TOKEN}` })).json();
    expect(JSON.stringify(j)).not.toContain('user-1');
    expect(JSON.stringify(j)).not.toContain(CONTA.id);
  });
});

// ─── Quem é recusado ────────────────────────────────────────────────────────

describe('links que nao servem', () => {
  it('inexistente devolve 404', async () => {
    prismaMock.accessToken.findUnique.mockResolvedValue(null);
    expect((await definir()).statusCode).toBe(404);
  });

  it('ja usado devolve 409 e manda entrar', async () => {
    prismaMock.accessToken.findUnique.mockResolvedValue(acesso({ usedAt: new Date() }));
    const r = await definir();
    expect(r.statusCode).toBe(409);
    expect(r.json().error).toMatch(/senha que voce criou/);
  });

  it('expirado devolve 410 e manda pedir outro', async () => {
    prismaMock.accessToken.findUnique.mockResolvedValue(
      acesso({ expiresAt: new Date(Date.now() - 1000) }),
    );
    const r = await definir();
    expect(r.statusCode).toBe(410);
  });

  it('conta cancelada nao define senha', async () => {
    prismaMock.accessToken.findUnique.mockResolvedValue(
      acesso({
        user: { ...acesso().user, account: { name: CONTA.name, status: 'cancelada' } },
      }),
    );
    expect((await definir()).statusCode).toBe(403);
    expect(prismaMock.accountUser.update).not.toHaveBeenCalled();
  });

  it('senha curta devolve 400 e nem consulta o token', async () => {
    const r = await definir({ password: '1234' });
    expect(r.statusCode).toBe(400);
    expect(prismaMock.accessToken.findUnique).not.toHaveBeenCalled();
  });
});

// ─── Definir a senha ────────────────────────────────────────────────────────

describe('definir senha', () => {
  it('grava o hash argon2 e ja devolve token', async () => {
    const r = await definir({ password: 'senha-forte-123' });

    expect(r.statusCode).toBe(201);
    expect(r.json().token).toBeTruthy();

    const hash = prismaMock.accountUser.update.mock.calls[0][0].data.passwordHash;
    expect(hash).toMatch(/^\$argon2/);
    expect(hash).not.toContain('senha-forte-123');
  });

  it('a senha vai pro usuario DO TOKEN', async () => {
    await definir();
    // Sem isto bastaria ter um link pra trocar a senha de outra pessoa.
    expect(prismaMock.accountUser.update.mock.calls[0][0].where.id).toBe('user-1');
  });

  it('DOIS CLIQUES nao sobrescrevem a senha recem-criada', async () => {
    prismaMock.accessToken.updateMany.mockResolvedValue({ count: 0 });

    const r = await definir();

    expect(r.statusCode).toBe(409);
    expect(prismaMock.accountUser.update).not.toHaveBeenCalled();
  });

  it('carimba o token ANTES de gravar — a condicao e a trava', async () => {
    await definir();
    const where = prismaMock.accessToken.updateMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ id: 'at-1', usedAt: null });
  });

  it('mata os outros links pendentes do mesmo usuario', async () => {
    await definir();
    // Se alguem pediu dois, o antigo nao pode continuar valendo pra trocar a
    // senha que acabou de ser definida.
    const segunda = prismaMock.accessToken.updateMany.mock.calls[1][0].where;
    expect(segunda).toMatchObject({ userId: 'user-1', usedAt: null });
  });

  it('o token devolvido e de DONO', async () => {
    const j = (await definir()).json();
    const payload = JSON.parse(Buffer.from(j.token.split('.')[1], 'base64').toString());
    expect(payload.kind).toBe('dono');
    expect(payload.sub).toBe('user-1');
  });
});
