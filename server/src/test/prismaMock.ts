import { vi } from 'vitest';

/**
 * Mock do Prisma pros testes de rota.
 *
 * A ideia NAO e simular o Postgres — e exercitar os guardas (auth, papel, tipo
 * de token, validacao de body) sem banco, e poder inspecionar o `where` que
 * cada rota monta. E no `where` que mora o isolamento multi-tenant: uma query
 * sem `accountId`/`spaceId` e o vazamento, e aqui da pra assertar isso.
 *
 * O que ESTE mock nao prova: que o Postgres se comporta como o esperado. Isso
 * fica com a sonda de isolamento (server/prisma/isolamento.mjs), que roda
 * contra um banco de verdade.
 */

type Fn = ReturnType<typeof vi.fn>;

export interface PrismaMock {
  account: { findUnique: Fn; findUniqueOrThrow: Fn; update: Fn };
  accountUser: { findUnique: Fn; findUniqueOrThrow: Fn; update: Fn; updateMany: Fn };
  space: { findFirst: Fn; findUnique: Fn; update: Fn };
  table: { findUnique: Fn; findMany: Fn; updateMany: Fn; groupBy: Fn };
  kitchen: {
    create: Fn;
    findFirst: Fn;
    findUnique: Fn;
    findMany: Fn;
    update: Fn;
    updateMany: Fn;
    groupBy: Fn;
    count: Fn;
  };
  kitchenUser: { findUnique: Fn; update: Fn; create: Fn };
  menuItem: {
    findMany: Fn;
    findFirst: Fn;
    create: Fn;
    update: Fn;
    updateMany: Fn;
    findUniqueOrThrow: Fn;
    /** Existe pro teste PROVAR que a exclusao de item nao apaga de verdade. */
    delete: Fn;
  };
  order: { findMany: Fn; findUnique: Fn; findFirst: Fn; updateMany: Fn; create: Fn };
  orderItem: { findMany: Fn; updateMany: Fn; update: Fn };
  orderChange: { findFirst: Fn; findUnique: Fn; create: Fn; update: Fn };
  menuItemPhoto: { count: Fn; create: Fn; findFirst: Fn; findMany: Fn; update: Fn; delete: Fn };
  invite: { create: Fn; count: Fn; findUnique: Fn; updateMany: Fn };
  billingCycle: { findUnique: Fn; upsert: Fn };
  kitchenCharge: { findFirst: Fn; update: Fn; deleteMany: Fn; createMany: Fn };
  accessToken: { findUnique: Fn; create: Fn; updateMany: Fn };
  $queryRaw: Fn;
  $transaction: Fn;
  $disconnect: Fn;
}

export function criarPrismaMock(): PrismaMock {
  const m: PrismaMock = {
    account: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ plan: 'praca' }),
      update: vi.fn(),
    },
    accountUser: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    space: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    table: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    kitchen: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      groupBy: vi.fn().mockResolvedValue([]),
      // Quantas cozinhas tem o faturamento oculto pro dono. Zero por padrao:
      // o caso comum e todo mundo pagando comissao.
      count: vi.fn().mockResolvedValue(0),
    },
    kitchenUser: { findUnique: vi.fn(), update: vi.fn().mockResolvedValue({}), create: vi.fn() },
    menuItem: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      findUniqueOrThrow: vi.fn(),
      delete: vi.fn(),
    },
    order: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      create: vi.fn(),
    },
    orderItem: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      update: vi.fn(),
    },
    orderChange: {
      // `null` por padrao = nenhuma alteracao pendente. E o estado normal de um
      // pedido, entao o teste que nao se importa com alteracao nao precisa
      // configurar nada.
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
    },
    menuItemPhoto: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
      delete: vi.fn(),
    },
    invite: {
      create: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
      findUnique: vi.fn().mockResolvedValue(null),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    billingCycle: { findUnique: vi.fn(), upsert: vi.fn() },
    kitchenCharge: {
      findFirst: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    accessToken: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    // `update` do lastLoginAt roda solto (sem await); sem isso vira
    // unhandledRejection no meio da suite.
    $transaction: vi.fn(),
    $disconnect: vi.fn(),
  };
  return m;
}

/** Espaco padrao devolvido por espacoDaConta() nos testes. */
export const ESPACO = {
  id: 'space-1',
  accountId: 'acc-1',
  slug: 'sao-sebastiao',
  name: 'Meu Quintal · São Sebastião',
  defaultCommissionPct: 15,
  closingDay: 5,
  createdAt: new Date('2026-01-01'),
};

export const CONTA = {
  id: 'acc-1',
  slug: 'quintal-sao-sebastiao',
  name: 'Quintal São Sebastião',
  status: 'ativa' as const,
  plan: 'pro' as const,
};

/** Usuario do dono, no formato que o auth-dono espera do banco. */
export function usuarioDono(role: 'owner' | 'admin' | 'staff' = 'owner') {
  return {
    id: 'user-1',
    role,
    accountId: CONTA.id,
    account: { id: CONTA.id, slug: CONTA.slug, status: CONTA.status },
  };
}
