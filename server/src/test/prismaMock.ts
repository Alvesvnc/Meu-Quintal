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
  account: { findUnique: Fn; findUniqueOrThrow: Fn; update: Fn; updateMany: Fn };
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
  kitchenUser: { findUnique: Fn; findUniqueOrThrow: Fn; update: Fn; create: Fn };
  menuItem: {
    findMany: Fn;
    findFirst: Fn;
    create: Fn;
    update: Fn;
    updateMany: Fn;
    count: Fn;
    findUniqueOrThrow: Fn;
    /** Existe pro teste PROVAR que a exclusao de item nao apaga de verdade. */
    delete: Fn;
  };
  /** As secoes do cardapio, escritas pela propria cozinha. */
  menuCategoria: {
    findMany: Fn;
    findFirst: Fn;
    create: Fn;
    updateMany: Fn;
    deleteMany: Fn;
    count: Fn;
  };
  order: { findMany: Fn; findUnique: Fn; findFirst: Fn; updateMany: Fn; create: Fn };
  orderItem: { findMany: Fn; updateMany: Fn; update: Fn };
  orderChange: { findFirst: Fn; findUnique: Fn; create: Fn; update: Fn };
  orderChangeItem: { findMany: Fn };
  menuItemPhoto: { count: Fn; create: Fn; findFirst: Fn; findMany: Fn; update: Fn; delete: Fn };
  invite: { create: Fn; count: Fn; findUnique: Fn; updateMany: Fn };
  billingCycle: { findUnique: Fn; upsert: Fn };
  kitchenCharge: { findFirst: Fn; update: Fn; deleteMany: Fn; createMany: Fn };
  accessToken: { findUnique: Fn; create: Fn; updateMany: Fn };
  assinatura: { findUnique: Fn; findFirst: Fn; upsert: Fn; update: Fn };
  eventoDeCobranca: { create: Fn };
  pushSubscription: { findMany: Fn; count: Fn; upsert: Fn; deleteMany: Fn };
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
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
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
    kitchenUser: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      create: vi.fn(),
    },
    menuItem: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      count: vi.fn().mockResolvedValue(0),
      findUniqueOrThrow: vi.fn(),
      delete: vi.fn(),
    },
    menuCategoria: {
      findMany: vi.fn().mockResolvedValue([]),
      // `null` = a secao nao e da cozinha logada. Recusar por padrao poe o
      // teste do caminho feliz na obrigacao de dizer que ela existe — e assim
      // o teste do ISOLAMENTO e o que nao precisa configurar nada.
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      // Duas: o suficiente pra que apagar uma nao esbarre na regra da ultima.
      count: vi.fn().mockResolvedValue(2),
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
    // Vazio por padrao = nenhuma reducao aceita no periodo. E o estado da
    // cozinha que nunca precisou mexer num pedido, entao o teste que nao fala
    // de alteracao nao precisa configurar nada.
    orderChangeItem: { findMany: vi.fn().mockResolvedValue([]) },
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
    // `null` por padrao = conta que nunca assinou. E o estado de quem esta em
    // trial ou foi cadastrado na mao, entao o teste que nao fala de cobranca
    // nao precisa configurar nada.
    assinatura: {
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    eventoDeCobranca: { create: vi.fn() },
    /**
     * Nenhum aparelho inscrito, que e o estado de qualquer cozinha que ainda
     * nao ligou o aviso — a maioria. Com a lista vazia, `avisarCozinha` sai
     * antes de tocar em rede, entao teste de pedido nao precisa saber que push
     * existe.
     *
     * O `deleteMany` NAO e decorativo: ele roda dentro da transacao de troca de
     * senha (apagar push de quem foi expulso). Sem ele aqui, os quatro testes
     * de definir senha respondem 500.
     */
    pushSubscription: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      upsert: vi.fn(),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
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
    // Zero = nunca trocou a senha. O auth compara com o `v` do token, e token
    // de teste tambem sai sem `v` (tratado como 0) — os dois batem.
    tokenVersion: 0,
    account: { id: CONTA.id, slug: CONTA.slug, status: CONTA.status },
  };
}

/**
 * Deixa o auth de cozinha passar.
 *
 * Desde que trocar a senha passou a expulsar sessao, `auth-restaurante` rele o
 * KitchenUser a cada request: confere que ele existe, que ainda pertence
 * aquela cozinha, e que a versao do token bate. Sem isto no mock, toda rota de
 * cozinha responde 401.
 *
 * Teste que queira o contrario — funcionario removido, ou sessao derrubada por
 * troca de senha — sobrescreve com `mockResolvedValue(null)` ou com uma versao
 * diferente.
 */
export function cozinhaLogada(m: PrismaMock, kitchenId: string, userId: string) {
  m.kitchenUser.findUnique.mockResolvedValue({ id: userId, kitchenId, tokenVersion: 0 });
}

/**
 * Deixa a checagem de dono da SECAO passar.
 *
 * Toda rota que recebe um `categoriaId` (criar item, mover item, apagar secao)
 * confere antes se a secao e da cozinha logada — o id vem do corpo do pedido, e
 * sem a conferencia bastaria conhecer um pra pendurar prato no cardapio da
 * vizinha. Por padrao o mock RECUSA; quem testa o caminho feliz chama isto.
 */
export function secaoDaCozinha(m: PrismaMock, categoriaId = 'cat-1') {
  m.menuCategoria.findFirst.mockResolvedValue({ id: categoriaId });
}
