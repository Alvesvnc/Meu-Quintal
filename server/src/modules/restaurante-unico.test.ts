import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  criarPrismaMock,
  ESPACO,
  CONTA,
  usuarioDono,
  type PrismaMock,
  cozinhaLogada,
} from '../test/prismaMock.js';

const prismaMock: PrismaMock = criarPrismaMock();
vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }));

const { buildApp } = await import('../app.js');

/**
 * Restaurante único: um login toca o negócio inteiro.
 *
 * O dono e o operador da cozinha são a mesma pessoa, então o token de dono
 * também abre `/api/r/*`. A ASSIMETRIA é o ponto:
 *
 *   dono  -> cozinha   permitido, e só com vínculo confirmado no banco
 *   cozinha -> dono    NUNCA
 *
 * Descer de privilégio dentro da própria conta é seguro; subir não seria. Estes
 * testes existem para que ninguém "simplifique" isso removendo a assimetria.
 */

let app: FastifyInstance;

const COZINHA = {
  id: 'k-cantina',
  slug: 'cantina-da-rosa',
  name: 'Cantina da Rosa',
  status: 'ativa' as const,
  spaceId: ESPACO.id,
};

/** Dono de restaurante único: vinculado à cozinha. */
const donoVinculado = () => ({
  ...usuarioDono('owner'),
  kitchenId: COZINHA.id,
  email: 'rosa@cantina.com',
});

/** Dono de praça de alimentação: sem vínculo. */
const donoSemVinculo = () => ({ ...usuarioDono('owner'), kitchenId: null });

function tokenDono(comVinculo: boolean, kitchenId = COZINHA.id) {
  return app.jwt.sign({
    kind: 'dono' as const,
    sub: 'user-1',
    accountId: CONTA.id,
    accountSlug: CONTA.slug,
    email: 'rosa@cantina.com',
    role: 'owner',
    ...(comVinculo ? { kitchenId } : {}),
  });
}

function tokenCozinha() {
  return app.jwt.sign({
    kind: 'cozinha' as const,
    sub: 'ku-1',
    kitchenId: COZINHA.id,
    kitchenSlug: COZINHA.slug,
    email: 'operador@cantina.com',
    role: 'owner',
  });
}

const comAuth = (t: string) => ({ authorization: `Bearer ${t}` });

beforeEach(async () => {
  vi.clearAllMocks();
  Object.assign(prismaMock, criarPrismaMock());
  cozinhaLogada(prismaMock, COZINHA.id, 'ku-1');
  prismaMock.kitchen.findUnique.mockResolvedValue(COZINHA);
  prismaMock.order.findMany.mockResolvedValue([]);
  app = await buildApp({ socket: false, logger: false, cron: false });
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

// ─── O login único ──────────────────────────────────────────────────────────

describe('dono vinculado opera a cozinha', () => {
  it('token de dono COM vinculo abre a fila da cozinha', async () => {
    prismaMock.accountUser.findUnique.mockResolvedValue(donoVinculado());

    const r = await app.inject({
      method: 'GET',
      url: '/api/r/fila',
      headers: comAuth(tokenDono(true)),
    });

    // Sem isto, a pessoa precisaria de duas contas e dois apps pra tocar o
    // proprio restaurante.
    expect(r.statusCode).toBe(200);
  });

  it('o vinculo e reconferido NO BANCO, nao so no token', async () => {
    prismaMock.accountUser.findUnique.mockResolvedValue(donoVinculado());

    await app.inject({
      method: 'GET',
      url: '/api/r/fila',
      headers: comAuth(tokenDono(true)),
    });

    // O token vale 7 dias: o vinculo pode ter sido removido nesse intervalo.
    expect(prismaMock.accountUser.findUnique).toHaveBeenCalled();
  });

  it('vinculo REMOVIDO no banco derruba o token que ainda nao expirou', async () => {
    // O token ainda afirma kitchenId, mas o banco diz que nao ha mais vinculo.
    prismaMock.accountUser.findUnique.mockResolvedValue(donoSemVinculo());

    const r = await app.inject({
      method: 'GET',
      url: '/api/r/fila',
      headers: comAuth(tokenDono(true)),
    });

    expect(r.statusCode).toBe(403);
  });

  it('token afirmando OUTRA cozinha e recusado', async () => {
    // Banco diz k-cantina; o token afirma k-da-vizinha.
    prismaMock.accountUser.findUnique.mockResolvedValue(donoVinculado());

    const r = await app.inject({
      method: 'GET',
      url: '/api/r/fila',
      headers: comAuth(tokenDono(true, 'k-da-vizinha')),
    });

    expect(r.statusCode).toBe(403);
  });

  it('dono SEM vinculo (praca de alimentacao) nao abre rota de cozinha', async () => {
    prismaMock.accountUser.findUnique.mockResolvedValue(donoSemVinculo());

    const r = await app.inject({
      method: 'GET',
      url: '/api/r/fila',
      headers: comAuth(tokenDono(false)),
    });

    expect(r.statusCode).toBe(403);
  });
});

// ─── A assimetria ───────────────────────────────────────────────────────────

describe('a porta contraria NAO existe', () => {
  it('token de COZINHA continua barrado nas rotas do dono', async () => {
    const r = await app.inject({
      method: 'GET',
      url: '/api/a/overview',
      headers: comAuth(tokenCozinha()),
    });

    // Este e o ponto: dono -> cozinha e descer de privilegio dentro da propria
    // conta. Cozinha -> dono seria subir, e nao pode existir nunca.
    expect(r.statusCode).toBe(403);
  });

  it('cozinha nao vira dono nem tentando o financeiro', async () => {
    const r = await app.inject({
      method: 'GET',
      url: '/api/a/financeiro',
      headers: comAuth(tokenCozinha()),
    });
    expect(r.statusCode).toBe(403);
  });
});

// ─── O cliente ──────────────────────────────────────────────────────────────

describe('o que o cliente recebe', () => {
  const MESA = {
    id: 'table-1',
    numero: 4,
    qrToken: 'mesa-4-dev',
    isActive: true,
    spaceId: ESPACO.id,
    space: { id: ESPACO.id, slug: ESPACO.slug },
  };

  it('a resposta do quintal diz o TIPO — a tela decide o fluxo com ele', async () => {
    prismaMock.table.findUnique.mockResolvedValue(MESA);
    prismaMock.kitchen.findMany.mockResolvedValue([]);
    prismaMock.space.findUnique.mockResolvedValue({
      name: 'Cantina da Rosa',
      tipo: 'restaurante_unico',
    });

    const j = (
      await app.inject({
        method: 'GET',
        url: '/api/m/quintal',
        headers: { authorization: 'Bearer mesa-4-dev' },
      })
    ).json();

    // A tela pula a lista de cozinhas com base nisto — e nao em
    // `kitchens.length === 1`, que confundiria uma praca temporariamente com
    // uma cozinha so.
    expect(j.space.tipo).toBe('restaurante-unico');
  });

  it('praca de alimentacao continua marcada como food-court', async () => {
    prismaMock.table.findUnique.mockResolvedValue(MESA);
    prismaMock.kitchen.findMany.mockResolvedValue([]);
    prismaMock.space.findUnique.mockResolvedValue({
      name: 'Meu Quintal',
      tipo: 'food_court',
    });

    const j = (
      await app.inject({
        method: 'GET',
        url: '/api/m/quintal',
        headers: { authorization: 'Bearer mesa-4-dev' },
      })
    ).json();

    expect(j.space.tipo).toBe('food-court');
  });
});

// ─── O financeiro ───────────────────────────────────────────────────────────

describe('financeiro do restaurante unico', () => {
  it('cobranca zerada — nao se cobra comissao de si mesmo', async () => {
    prismaMock.accountUser.findUnique.mockResolvedValue(donoVinculado());
    prismaMock.space.findFirst.mockResolvedValue({ ...ESPACO, tipo: 'restaurante_unico' });
    prismaMock.account.findUnique.mockResolvedValue({ status: 'ativa' });
    prismaMock.billingCycle.findUnique.mockResolvedValue(null);
    prismaMock.kitchen.findMany.mockResolvedValue([
      {
        id: COZINHA.id,
        slug: COZINHA.slug,
        name: COZINHA.name,
        // O bootstrap cria assim no modo restaurante unico. O calculo nao
        // precisa de caso especial — ele ja produz zero.
        chargeCommission: false,
        chargeRent: false,
        commissionPct: null,
        rentCents: 0,
        orderItems: [{ qty: 3, unitPriceCents: 1800 }],
      },
    ]);

    const j = (
      await app.inject({
        method: 'GET',
        url: '/api/a/financeiro?refMonth=2026-01',
        headers: comAuth(tokenDono(true)),
      })
    ).json();

    // O bruto continua util: e quanto o restaurante VENDEU no periodo.
    expect(j.totais.grossCents).toBe(5400);
    // Mas nao ha nada a receber — o dono nao deve a si mesmo.
    expect(j.totais.aReceberCents).toBe(0);
    expect(j.linhas[0].commissionCents).toBe(0);
    expect(j.linhas[0].rentCents).toBe(0);
  });
});
