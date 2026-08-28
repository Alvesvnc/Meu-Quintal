import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { criarPrismaMock, ESPACO, CONTA, usuarioDono, type PrismaMock } from '../test/prismaMock.js';

const prismaMock: PrismaMock = criarPrismaMock();
vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }));

const { buildApp } = await import('../app.js');

/**
 * O plano decide o formato — e isso tem que MORDER em algum lugar.
 *
 * O lugar e o convite de cozinha. Sem esta trava, "restaurante unico" seria um
 * rotulo: qualquer assinante do plano mais barato convidaria uma segunda
 * cozinha e viraria praca sozinho, sem pagar por isso.
 */

let app: FastifyInstance;

function auth() {
  const t = app.jwt.sign({
    kind: 'dono' as const,
    sub: 'user-1',
    accountId: CONTA.id,
    accountSlug: CONTA.slug,
    email: 'marina@qro.app',
    role: 'owner',
  });
  return { authorization: `Bearer ${t}` };
}

const convidar = () =>
  app.inject({
    method: 'POST',
    url: '/api/a/cozinhas/convite',
    headers: auth(),
    payload: {
      email: 'nova@cozinha.com',
      kitchenName: 'Cozinha Nova',
      chargeCommission: true,
      chargeRent: false,
    },
  });

beforeEach(async () => {
  vi.clearAllMocks();
  Object.assign(prismaMock, criarPrismaMock());
  prismaMock.accountUser.findUnique.mockResolvedValue({ ...usuarioDono('owner'), kitchenId: null });
  prismaMock.space.findFirst.mockResolvedValue(ESPACO);
  prismaMock.account.findUnique.mockResolvedValue({ status: 'ativa' });
  prismaMock.kitchen.count.mockResolvedValue(0);
  prismaMock.invite.count.mockResolvedValue(0);
  prismaMock.invite.create.mockResolvedValue({
    id: 'inv1',
    email: 'nova@cozinha.com',
    expiresAt: new Date('2026-09-01'),
  });
  app = await buildApp({ socket: false, logger: false, cron: false });
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

describe('plano Restaurante', () => {
  beforeEach(() => {
    prismaMock.account.findUniqueOrThrow.mockResolvedValue({ plan: 'restaurante' });
  });

  it('convida a PRIMEIRA cozinha', async () => {
    prismaMock.kitchen.count.mockResolvedValue(0);
    const r = await convidar();
    expect(r.statusCode).toBe(201);
  });

  it('RECUSA a segunda, e diz qual e o plano certo', async () => {
    prismaMock.kitchen.count.mockResolvedValue(1);
    const r = await convidar();
    // 402: e limite comercial, nao erro de permissao nem de dado.
    expect(r.statusCode).toBe(402);
    expect(r.json().error).toMatch(/Praça de alimentação/);
    expect(prismaMock.invite.create).not.toHaveBeenCalled();
  });

  it('CONVITE PENDENTE ja ocupa a vaga', async () => {
    prismaMock.kitchen.count.mockResolvedValue(0);
    prismaMock.invite.count.mockResolvedValue(1);
    const r = await convidar();
    // Sem contar o pendente, daria pra disparar cinco convites e estourar o
    // teto quando fossem aceitos.
    expect(r.statusCode).toBe(402);
  });

  it('convite EXPIRADO nao ocupa vaga', async () => {
    prismaMock.kitchen.count.mockResolvedValue(0);
    prismaMock.invite.count.mockResolvedValue(0);
    await convidar();
    const where = prismaMock.invite.count.mock.calls[0][0].where;
    expect(where.acceptedAt).toBeNull();
    expect(where.expiresAt.gt).toBeInstanceOf(Date);
  });
});

describe('plano Praca', () => {
  beforeEach(() => {
    prismaMock.account.findUniqueOrThrow.mockResolvedValue({ plan: 'praca' });
  });

  it('convida a decima cozinha sem reclamar', async () => {
    prismaMock.kitchen.count.mockResolvedValue(9);
    const r = await convidar();
    expect(r.statusCode).toBe(201);
  });
});

describe('o dono NAO converte o proprio espaco', () => {
  it('a rota de conversao nao existe mais', async () => {
    prismaMock.account.findUniqueOrThrow.mockResolvedValue({ plan: 'restaurante' });
    for (const url of ['/api/a/espaco/tipo', '/api/a/plano', '/api/a/vinculo']) {
      const r = await app.inject({
        method: 'PATCH',
        url,
        headers: auth(),
        payload: { tipo: 'food-court', plano: 'praca' },
      });
      // Converter e mudar de plano, e mudar de plano e decisao comercial —
      // nao um interruptor em "configuracoes". Se alguem recriar uma dessas
      // rotas, este teste cai.
      expect(r.statusCode).toBe(404);
    }
  });
});
