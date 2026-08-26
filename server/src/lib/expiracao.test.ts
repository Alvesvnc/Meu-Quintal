import { describe, it, expect, beforeEach, vi } from 'vitest';
import { varrerExpiradas } from './expiracao.js';

/**
 * A varredura que encerra propostas vencidas.
 *
 * O ponto mais delicado é a segurança com várias instâncias: o mesmo cron roda
 * em toda réplica, e o que impede trabalho duplicado é o `updateMany`
 * condicional. Estes testes verificam que quem perde a corrida não mexe nos
 * itens.
 */

const AGORA = new Date('2026-08-25T12:00:00Z');

/** Mock mínimo do Prisma, só com o que a varredura usa. */
function criarPrisma(vencidas: unknown[], countDoUpdate = 1) {
  const updateManyChange = vi.fn().mockResolvedValue({ count: countDoUpdate });
  const updateItem = vi.fn().mockResolvedValue({});

  const tx = {
    orderChange: { updateMany: updateManyChange },
    orderItem: { update: updateItem },
  };

  return {
    prisma: {
      orderChange: { findMany: vi.fn().mockResolvedValue(vencidas) },
      // A transação recebe um callback; executamos com o tx falso.
      $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    },
    updateManyChange,
    updateItem,
  };
}

function criarIo() {
  const emit = vi.fn();
  return {
    io: { to: vi.fn().mockReturnValue({ emit }) },
    emit,
  };
}

const proposta = (over: Record<string, unknown> = {}) => ({
  id: 'a1',
  orderId: 'o1',
  kitchenId: 'k1',
  items: [{ orderItemId: 'i1', qtyAnterior: 3, qtyProposta: 1 }],
  kitchen: { id: 'k1', slug: 'lou-burger' },
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('busca das vencidas', () => {
  it('so pega pendentes com prazo ja vencido', async () => {
    const { prisma } = criarPrisma([]);
    await varrerExpiradas(prisma as any, null, AGORA);

    const where = prisma.orderChange.findMany.mock.calls[0][0].where;
    expect(where.status).toBe('pendente');
    // `lte` e nao `lt`: o instante exato do prazo ja conta como vencido.
    expect(where.expiresAt.lte).toBe(AGORA);
  });

  it('limita quantas processa por rodada', async () => {
    const { prisma } = criarPrisma([]);
    await varrerExpiradas(prisma as any, null, AGORA);

    // Sem teto, uma volta depois de horas fora do ar tentaria processar tudo
    // de uma vez e travaria o event loop.
    expect(prisma.orderChange.findMany.mock.calls[0][0].take).toBeGreaterThan(0);
  });

  it('nada vencido nao faz nada', async () => {
    const { prisma, updateManyChange } = criarPrisma([]);
    const r = await varrerExpiradas(prisma as any, null, AGORA);

    expect(r).toEqual({ encontradas: 0, expiradas: 0 });
    expect(updateManyChange).not.toHaveBeenCalled();
  });
});

describe('aplicacao', () => {
  it('marca como expirada e cancela o item', async () => {
    const { prisma, updateManyChange, updateItem } = criarPrisma([proposta()]);
    const r = await varrerExpiradas(prisma as any, null, AGORA);

    expect(r).toEqual({ encontradas: 1, expiradas: 1 });
    expect(updateManyChange.mock.calls[0][0].data.status).toBe('expirada');

    // Expirar vale o mesmo que recusar: o item e cancelado por inteiro, nao
    // reduzido pra quantidade proposta.
    expect(updateItem.mock.calls[0][0].data.status).toBe('cancelado');
    expect(updateItem.mock.calls[0][0].data.qty).toBeUndefined();
  });

  it('processa varias propostas na mesma rodada', async () => {
    const { prisma } = criarPrisma([
      proposta({ id: 'a1', orderId: 'o1' }),
      proposta({ id: 'a2', orderId: 'o2' }),
    ]);
    const r = await varrerExpiradas(prisma as any, null, AGORA);

    expect(r.expiradas).toBe(2);
  });

  it('cancela TODOS os itens da proposta', async () => {
    const { prisma, updateItem } = criarPrisma([
      proposta({
        items: [
          { orderItemId: 'i1', qtyAnterior: 3, qtyProposta: 1 },
          { orderItemId: 'i2', qtyAnterior: 1, qtyProposta: 0 },
        ],
      }),
    ]);
    await varrerExpiradas(prisma as any, null, AGORA);

    expect(updateItem).toHaveBeenCalledTimes(2);
    expect(updateItem.mock.calls.every((c) => c[0].data.status === 'cancelado')).toBe(true);
  });
});

// ─── A trava contra instâncias duplicadas ───────────────────────────────────

describe('varias instancias rodando o mesmo cron', () => {
  it('o update e CONDICIONAL ao status pendente', async () => {
    const { prisma, updateManyChange } = criarPrisma([proposta()]);
    await varrerExpiradas(prisma as any, null, AGORA);

    // E esta condicao que faz a segunda instancia perder a corrida em vez de
    // aplicar tudo de novo. Sem ela, seria preciso lock distribuido.
    const where = updateManyChange.mock.calls[0][0].where;
    expect(where.status).toBe('pendente');
    expect(where.id).toBe('a1');
  });

  it('quem perde a corrida NAO toca nos itens', async () => {
    // count 0 = outra instancia (ou uma resposta do cliente no mesmo instante)
    // ja resolveu esta proposta.
    const { prisma, updateItem } = criarPrisma([proposta()], 0);
    const r = await varrerExpiradas(prisma as any, null, AGORA);

    expect(updateItem).not.toHaveBeenCalled();
    // Encontrou, mas nao contabiliza como expirada por ela
    expect(r).toEqual({ encontradas: 1, expiradas: 0 });
  });

  it('quem perde a corrida NAO emite evento', async () => {
    const { prisma } = criarPrisma([proposta()], 0);
    const { io, emit } = criarIo();
    await varrerExpiradas(prisma as any, io as any, AGORA);

    // Duas instancias emitindo fariam a tela do cliente piscar duas vezes.
    expect(emit).not.toHaveBeenCalled();
  });
});

// ─── Robustez ───────────────────────────────────────────────────────────────

describe('uma proposta com erro nao derruba a rodada', () => {
  it('segue para as proximas', async () => {
    const { prisma } = criarPrisma([
      proposta({ id: 'a1' }),
      proposta({ id: 'a2' }),
      proposta({ id: 'a3' }),
    ]);

    // A segunda estoura
    let chamada = 0;
    prisma.$transaction = vi.fn(async (fn: (t: unknown) => unknown) => {
      chamada++;
      if (chamada === 2) throw new Error('deadlock');
      return fn({
        orderChange: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
        orderItem: { update: vi.fn().mockResolvedValue({}) },
      });
    });

    const r = await varrerExpiradas(prisma as any, null, AGORA);

    // Uma falha e uma proposta que fica pendente pra proxima rodada, nao a
    // rodada inteira perdida.
    expect(r.encontradas).toBe(3);
    expect(r.expiradas).toBe(2);
  });
});

// ─── Avisos ─────────────────────────────────────────────────────────────────

describe('avisa as duas telas', () => {
  it('emite pro pedido E pra cozinha', async () => {
    const { prisma } = criarPrisma([proposta()]);
    const { io, emit } = criarIo();
    await varrerExpiradas(prisma as any, io as any, AGORA);

    const salas = io.to.mock.calls.map((c) => c[0]);
    // O cliente para de ver o sheet; a cozinha para de esperar resposta.
    expect(salas).toContain('order:o1');
    expect(salas).toContain('kitchen:k1');

    expect(emit.mock.calls[0][0]).toBe('order:alteracao-respondida');
    expect(emit.mock.calls[0][1].resposta).toBe('expirada');
  });

  it('funciona sem io — a varredura nao depende de socket', async () => {
    const { prisma, updateItem } = criarPrisma([proposta()]);
    await expect(varrerExpiradas(prisma as any, null, AGORA)).resolves.toBeDefined();
    expect(updateItem).toHaveBeenCalled();
  });
});
