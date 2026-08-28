import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { OrderListItem } from '@mq/shared';

/**
 * O bug: a inscrição no socket vivia dentro do `useOrder`, o hook da tela de
 * detalhe. Fora dela o cliente não estava em sala nenhuma — a cozinha
 * cancelava um item e o aviso nunca chegava.
 *
 * O que estes testes seguram:
 *
 *   1. o app assina TODOS os pedidos ativos, não só o que está na tela
 *   2. o `useOrder` NÃO assina nem desassina — se ele voltasse a desassinar,
 *      sair da tela de detalhe expulsaria a inscrição global da sala e o bug
 *      voltaria de forma intermitente
 *   3. evento de pedido que não está na tela invalida o cache mesmo assim
 *   4. reconectar reassina: o servidor só conhecia as salas da conexão antiga
 *   5. o número de salas tem teto (cada subscribe custa consulta no servidor)
 */

const fake = vi.hoisted(() => ({
  socket: null as ReturnType<typeof criarSocket> | null,
  orders: [] as Array<{ id: string }>,
}));

// Declarado depois do `vi.hoisted` de propósito: a fábrica só roda quando o
// teste chama, e aí a função já existe.
function criarSocket() {
  const ouvintes = new Map<string, Set<(payload: unknown) => void>>();
  const emitidos: Array<{ evento: string; payload: unknown }> = [];
  return {
    emitidos,
    emit(evento: string, payload: unknown) {
      emitidos.push({ evento, payload });
    },
    on(evento: string, fn: (payload: unknown) => void) {
      if (!ouvintes.has(evento)) ouvintes.set(evento, new Set());
      ouvintes.get(evento)!.add(fn);
    },
    off(evento: string, fn: (payload: unknown) => void) {
      ouvintes.get(evento)?.delete(fn);
    },
    /** Simula o servidor mandando um evento pra este socket. */
    receber(evento: string, payload: unknown) {
      ouvintes.get(evento)?.forEach((fn) => fn(payload));
    },
    /** Ids passados em `order:subscribe`, na ordem. */
    assinados() {
      return emitidos.filter((e) => e.evento === 'order:subscribe').map((e) => e.payload);
    },
    desassinados() {
      return emitidos.filter((e) => e.evento === 'order:unsubscribe').map((e) => e.payload);
    },
  };
}

vi.mock('./socket', () => ({
  getSocket: () => fake.socket,
  disconnectSocket: () => {},
}));

vi.mock('./client', () => ({
  getTableToken: () => 'token-de-mesa',
  api: {
    get: vi.fn(async (url: string) => {
      if (url === '/api/m/pedidos') return { data: { orders: fake.orders } };
      return { data: { id: url.split('/').pop() } };
    }),
    post: vi.fn(async () => ({ data: {} })),
  },
}));

const { useAssinaturaDosPedidos, useOrder } = await import('./hooks');

const pedido = (id: string) => ({ id, shortId: id.toUpperCase() }) as OrderListItem;

let qc: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  fake.socket = criarSocket();
  fake.orders = [];
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchInterval: false } },
  });
});

afterEach(() => {
  cleanup();
  qc.clear();
  vi.clearAllMocks();
});

describe('useAssinaturaDosPedidos — inscrição global', () => {
  it('assina TODOS os pedidos ativos da mesa, não só um', async () => {
    fake.orders = [pedido('a'), pedido('b'), pedido('c')];

    renderHook(() => useAssinaturaDosPedidos(), { wrapper });

    await waitFor(() => expect(fake.socket!.assinados()).toEqual(['a', 'b', 'c']));
  });

  it('invalida o cache do pedido que mudou mesmo sem a tela dele aberta', async () => {
    fake.orders = [pedido('a'), pedido('b')];
    renderHook(() => useAssinaturaDosPedidos(), { wrapper });
    await waitFor(() => expect(fake.socket!.assinados()).toHaveLength(2));

    const invalidar = vi.spyOn(qc, 'invalidateQueries');
    fake.socket!.receber('order:alteracao', { orderId: 'b' });

    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['order', 'b'] });
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['orders'] });
  });

  it('atende os três eventos que mudam um pedido', async () => {
    fake.orders = [pedido('a')];
    renderHook(() => useAssinaturaDosPedidos(), { wrapper });
    await waitFor(() => expect(fake.socket!.assinados()).toHaveLength(1));

    const invalidar = vi.spyOn(qc, 'invalidateQueries');
    for (const evento of ['order:status', 'order:alteracao', 'order:alteracao-respondida']) {
      fake.socket!.receber(evento, { orderId: 'a' });
    }

    expect(invalidar).toHaveBeenCalledTimes(6); // 3 eventos x (['order', id] + ['orders'])
  });

  it('reassina ao reconectar — as salas não sobrevivem à conexão antiga', async () => {
    fake.orders = [pedido('a'), pedido('b')];
    renderHook(() => useAssinaturaDosPedidos(), { wrapper });
    await waitFor(() => expect(fake.socket!.assinados()).toHaveLength(2));

    fake.socket!.receber('connect', undefined);

    expect(fake.socket!.assinados()).toEqual(['a', 'b', 'a', 'b']);
  });

  it('não passa do teto de salas', async () => {
    fake.orders = Array.from({ length: 30 }, (_, i) => pedido(`p${i}`));

    renderHook(() => useAssinaturaDosPedidos(), { wrapper });

    await waitFor(() => expect(fake.socket!.assinados().length).toBeGreaterThan(0));
    expect(fake.socket!.assinados()).toHaveLength(12);
  });

  it('desassina tudo ao desmontar', async () => {
    fake.orders = [pedido('a'), pedido('b')];
    const { unmount } = renderHook(() => useAssinaturaDosPedidos(), { wrapper });
    await waitFor(() => expect(fake.socket!.assinados()).toHaveLength(2));

    unmount();

    expect(fake.socket!.desassinados()).toEqual(['a', 'b']);
  });

  it('sem socket (mesa sem token) não quebra', async () => {
    fake.socket = null;
    fake.orders = [pedido('a')];

    expect(() => renderHook(() => useAssinaturaDosPedidos(), { wrapper })).not.toThrow();
  });
});

describe('useOrder — a armadilha do unsubscribe', () => {
  it('não assina nem desassina: quem cuida da sala é a inscrição global', async () => {
    fake.orders = [pedido('a')];
    renderHook(() => useAssinaturaDosPedidos(), { wrapper });
    await waitFor(() => expect(fake.socket!.assinados()).toEqual(['a']));

    // Abrir e fechar a tela de detalhe do MESMO pedido não pode mexer na sala.
    const { unmount } = renderHook(() => useOrder('a'), { wrapper });
    await waitFor(() => expect(fake.socket!.assinados()).toEqual(['a']));
    unmount();

    expect(fake.socket!.desassinados()).toEqual([]);
    expect(fake.socket!.assinados()).toEqual(['a']);
  });
});
