import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import { criarPrismaMock, CONTA, ESPACO, usuarioDono, type PrismaMock } from '../test/prismaMock.js';

const prismaMock: PrismaMock = criarPrismaMock();
vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }));

const enviados = vi.hoisted(() => ({ lista: [] as Array<{ para: string; assunto: string }> }));
vi.mock('../lib/email.js', async (original) => {
  const real = await original<typeof import('../lib/email.js')>();
  return {
    ...real,
    enviar: vi.fn(async (e: { para: string; assunto: string }) => {
      enviados.lista.push(e);
      return { enviado: true };
    }),
  };
});

const { buildApp } = await import('../app.js');

/**
 * Esqueci minha senha.
 *
 * Duas coisas se testam aqui, e a segunda é a que dá sentido à primeira:
 *
 *   1. O pedido não conta a ninguém quais e-mails têm conta.
 *   2. Trocar a senha DERRUBA as sessões abertas. Sem isso, quem troca a senha
 *      por desconfiar de invasão continuaria com o invasor dentro por até sete
 *      dias, achando que resolveu.
 */

let app: FastifyInstance;

const TOKEN = 'token-de-recuperacao-suficientemente-longo';
const HASH = crypto.createHash('sha256').update(TOKEN).digest('hex');

const DONO = {
  id: 'user-1',
  email: 'marina@meuquintal.app',
  name: 'Marina',
  accountId: CONTA.id,
  account: { name: CONTA.name, status: 'ativa' },
};

const OPERADOR = {
  id: 'ku-1',
  email: 'marcos@louburger.com',
  name: 'Marcos',
  kitchen: { name: 'Lou Burger' },
};

function link(over: Record<string, unknown> = {}) {
  return {
    id: 'at-1',
    tokenHash: HASH,
    kind: 'recuperar_senha',
    userId: DONO.id,
    kitchenUserId: null,
    user: DONO,
    kitchenUser: null,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    usedAt: null,
    ...over,
  };
}

beforeEach(async () => {
  vi.clearAllMocks();
  enviados.lista.length = 0;
  Object.assign(prismaMock, criarPrismaMock());
  prismaMock.$transaction.mockImplementation(async (arg: unknown) =>
    typeof arg === 'function' ? await (arg as (tx: unknown) => unknown)(prismaMock) : arg,
  );
  app = await buildApp({ socket: false, logger: false, cron: false });
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

// ─── Pedir ──────────────────────────────────────────────────────────────────

describe('pedir recuperacao nao conta quem tem conta', () => {
  const pedir = (url: string, email: string) =>
    app.inject({ method: 'POST', url, payload: { email } });

  it('email que EXISTE responde ok e manda o email', async () => {
    prismaMock.accountUser.findUnique.mockResolvedValue({
      id: DONO.id,
      name: DONO.name,
      account: { name: CONTA.name, status: 'ativa' },
    });

    const r = await pedir('/api/a/auth/recuperar', DONO.email);

    expect(r.statusCode).toBe(200);
    expect(enviados.lista).toHaveLength(1);
  });

  it('email que NAO existe responde EXATAMENTE igual', async () => {
    prismaMock.accountUser.findUnique.mockResolvedValue(null);

    const r = await pedir('/api/a/auth/recuperar', 'ninguem@lugar.nenhum');

    // Responder "nao encontrado" transformaria a rota num oraculo: um script
    // descobriria quais enderecos tem conta aqui, e isso e material de
    // phishing dirigido.
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ ok: true });
    expect(enviados.lista).toHaveLength(0);
  });

  it('email MALFORMADO tambem responde igual', async () => {
    const r = await pedir('/api/a/auth/recuperar', 'nao-e-email');
    // Dizer "email invalido" so pra um subconjunto ja e informacao.
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ ok: true });
  });

  it('conta cancelada nao recebe link', async () => {
    prismaMock.accountUser.findUnique.mockResolvedValue({
      id: DONO.id,
      name: DONO.name,
      account: { name: CONTA.name, status: 'cancelada' },
    });

    const r = await pedir('/api/a/auth/recuperar', DONO.email);

    expect(r.statusCode).toBe(200);
    // Devolver acesso a algo que deixou de existir.
    expect(enviados.lista).toHaveLength(0);
  });

  it('a cozinha tem a propria rota, e o link vai pro app dela', async () => {
    prismaMock.kitchenUser.findUnique.mockResolvedValue({
      id: OPERADOR.id,
      name: OPERADOR.name,
      kitchen: { name: 'Lou Burger' },
    });

    const r = await pedir('/api/r/auth/recuperar', OPERADOR.email);

    expect(r.statusCode).toBe(200);
    expect(enviados.lista[0].assunto).toContain('Lou Burger');
  });

  it('o link novo INVALIDA os anteriores', async () => {
    prismaMock.accountUser.findUnique.mockResolvedValue({
      id: DONO.id,
      name: DONO.name,
      account: { name: CONTA.name, status: 'ativa' },
    });

    await pedir('/api/a/auth/recuperar', DONO.email);

    // Pedir tres vezes deixaria tres links vivos na caixa de entrada, cada um
    // capaz de trocar a senha durante o prazo inteiro.
    const carimbo = prismaMock.accessToken.updateMany.mock.calls[0][0];
    expect(carimbo.where).toMatchObject({ userId: DONO.id, usedAt: null });
    expect(carimbo.data.usedAt).toBeInstanceOf(Date);
  });

  it('recuperacao vale 1 HORA, nao 7 dias', async () => {
    prismaMock.accountUser.findUnique.mockResolvedValue({
      id: DONO.id,
      name: DONO.name,
      account: { name: CONTA.name, status: 'ativa' },
    });

    await pedir('/api/a/auth/recuperar', DONO.email);

    const { expiresAt } = prismaMock.accessToken.create.mock.calls[0][0].data;
    const horas = (expiresAt.getTime() - Date.now()) / 3_600_000;
    // Quem pediu esta na frente do computador agora. Cada hora a mais e uma
    // hora a mais em que um email vazado vira acesso.
    expect(horas).toBeGreaterThan(0.9);
    expect(horas).toBeLessThan(1.1);
  });
});

// ─── Trocar a senha derruba sessão ──────────────────────────────────────────

describe('trocar a senha expulsa quem estava dentro', () => {
  beforeEach(() => {
    prismaMock.accessToken.findUnique.mockResolvedValue(link());
    prismaMock.accessToken.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.accountUser.findUniqueOrThrow.mockResolvedValue({
      ...usuarioDono('owner'),
      email: DONO.email,
      name: DONO.name,
      kitchenId: null,
      tokenVersion: 1,
      account: { ...CONTA, trialEndsAt: null, spaces: [{ ...ESPACO, _count: { tables: 4 } }] },
    });
  });

  const definir = () =>
    app.inject({
      method: 'POST',
      url: `/api/acesso/${TOKEN}/senha`,
      payload: { password: 'senha-nova-forte-1' },
    });

  it('a versao do token SOBE junto com a senha', async () => {
    await definir();

    const data = prismaMock.accountUser.update.mock.calls[0][0].data;
    expect(data.passwordHash).toMatch(/^\$argon2/);
    // O incremento e o que derruba todo JWT emitido antes.
    expect(data.tokenVersion).toEqual({ increment: 1 });
  });

  it('o token devolvido ja vem com a versao NOVA', async () => {
    const j = (await definir()).json();
    const payload = JSON.parse(Buffer.from(j.token.split('.')[1], 'base64').toString());
    // Senao a pessoa trocaria a senha e seria deslogada no request seguinte.
    expect(payload.v).toBe(1);
    expect(j.app).toBe('dono');
  });

  it('JWT com versao ANTIGA passa a ser recusado', async () => {
    prismaMock.accountUser.findUnique.mockResolvedValue({
      ...usuarioDono('owner'),
      tokenVersion: 3,
    });

    const tokenVelho = app.jwt.sign({
      kind: 'dono' as const,
      sub: 'user-1',
      accountId: CONTA.id,
      accountSlug: CONTA.slug,
      email: DONO.email,
      role: 'owner',
      v: 2,
    });

    const r = await app.inject({
      method: 'GET',
      url: '/api/a/overview',
      headers: { authorization: `Bearer ${tokenVelho}` },
    });

    expect(r.statusCode).toBe(401);
    expect(r.json().error).toMatch(/sessao expirou/i);
  });

  it('JWT com a versao certa continua entrando', async () => {
    prismaMock.accountUser.findUnique.mockResolvedValue({
      ...usuarioDono('owner'),
      tokenVersion: 3,
    });
    prismaMock.space.findFirst.mockResolvedValue(ESPACO);
    prismaMock.account.findUnique.mockResolvedValue({ status: 'ativa' });

    const token = app.jwt.sign({
      kind: 'dono' as const,
      sub: 'user-1',
      accountId: CONTA.id,
      accountSlug: CONTA.slug,
      email: DONO.email,
      role: 'owner',
      v: 3,
    });

    const r = await app.inject({
      method: 'GET',
      url: '/api/a/overview',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(r.statusCode).toBe(200);
  });
});

// ─── O operador de cozinha ──────────────────────────────────────────────────

describe('a cozinha tambem e expulsa', () => {
  const COZINHA = { id: 'k1', slug: 'lou-burger', name: 'Lou Burger', status: 'ativa' };

  function tokenCozinha(v: number) {
    return app.jwt.sign({
      kind: 'cozinha' as const,
      sub: 'ku-1',
      kitchenId: COZINHA.id,
      kitchenSlug: COZINHA.slug,
      email: OPERADOR.email,
      role: 'owner',
      v,
    });
  }

  beforeEach(() => {
    prismaMock.kitchen.findUnique.mockResolvedValue({ ...COZINHA, spaceId: 'space-1' });
    prismaMock.order.findMany.mockResolvedValue([]);
  });

  it('versao antiga e recusada', async () => {
    prismaMock.kitchenUser.findUnique.mockResolvedValue({
      id: 'ku-1',
      kitchenId: COZINHA.id,
      tokenVersion: 5,
    });

    const r = await app.inject({
      method: 'GET',
      url: '/api/r/fila',
      headers: { authorization: `Bearer ${tokenCozinha(4)}` },
    });

    expect(r.statusCode).toBe(401);
  });

  it('FUNCIONARIO REMOVIDO perde o acesso na hora', async () => {
    prismaMock.kitchenUser.findUnique.mockResolvedValue(null);

    const r = await app.inject({
      method: 'GET',
      url: '/api/r/fila',
      headers: { authorization: `Bearer ${tokenCozinha(0)}` },
    });

    // Antes disto o auth so reconferia a COZINHA, nunca a pessoa: apagar o
    // usuario nao revogava nada, e o token dele seguia valendo por ate 7 dias.
    expect(r.statusCode).toBe(401);
  });

  it('operador MOVIDO pra outra cozinha nao entra na antiga', async () => {
    prismaMock.kitchenUser.findUnique.mockResolvedValue({
      id: 'ku-1',
      kitchenId: 'k-outra',
      tokenVersion: 0,
    });

    const r = await app.inject({
      method: 'GET',
      url: '/api/r/fila',
      headers: { authorization: `Bearer ${tokenCozinha(0)}` },
    });

    expect(r.statusCode).toBe(401);
  });

  it('tudo batendo, entra normalmente', async () => {
    prismaMock.kitchenUser.findUnique.mockResolvedValue({
      id: 'ku-1',
      kitchenId: COZINHA.id,
      tokenVersion: 2,
    });

    const r = await app.inject({
      method: 'GET',
      url: '/api/r/fila',
      headers: { authorization: `Bearer ${tokenCozinha(2)}` },
    });

    expect(r.statusCode).toBe(200);
  });
});

// ─── O link de cozinha ──────────────────────────────────────────────────────

describe('link de recuperacao de uma COZINHA', () => {
  beforeEach(() => {
    prismaMock.accessToken.findUnique.mockResolvedValue(
      link({ userId: null, user: null, kitchenUserId: OPERADOR.id, kitchenUser: OPERADOR }),
    );
    prismaMock.accessToken.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.kitchenUser.findUniqueOrThrow.mockResolvedValue({
      id: OPERADOR.id,
      email: OPERADOR.email,
      role: 'owner',
      tokenVersion: 1,
      kitchen: { id: 'k1', slug: 'lou-burger', name: 'Lou Burger', status: 'ativa' },
    });
  });

  it('a tela mostra o nome da COZINHA, nao de uma conta', async () => {
    const j = (await app.inject({ method: 'GET', url: `/api/acesso/${TOKEN}` })).json();
    expect(j.accountName).toBe('Lou Burger');
    expect(j.tipo).toBe('recuperar-senha');
  });

  it('define a senha do operador e devolve token de COZINHA', async () => {
    const r = await app.inject({
      method: 'POST',
      url: `/api/acesso/${TOKEN}/senha`,
      payload: { password: 'senha-nova-forte-1' },
    });

    expect(r.statusCode).toBe(201);
    expect(r.json().app).toBe('cozinha');

    const data = prismaMock.kitchenUser.update.mock.calls[0][0].data;
    expect(data.tokenVersion).toEqual({ increment: 1 });
    // Nao pode ter tocado no dono.
    expect(prismaMock.accountUser.update).not.toHaveBeenCalled();
  });
});
