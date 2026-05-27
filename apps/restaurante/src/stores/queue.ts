import { useMemo } from 'react';
import { create } from 'zustand';
import { INITIAL_QUEUE, type Order, type Status } from '../mocks/orders';

interface QueueState {
  orders: Order[];
  /** Avança o status do pedido pro próximo (novo → preparando → pronto → retirado). */
  advance: (orderId: string) => void;
  cancel: (orderId: string) => void;
  /** Mock: simula um pedido novo chegando agora. Usado em dev pra testar fluxo. */
  pushFakeNew: () => void;
}

const NEXT: Record<Status, Status | null> = {
  novo:       'preparando',
  preparando: 'pronto',
  pronto:     'retirado',
  retirado:   null,
  cancelado:  null,
};

export const useQueue = create<QueueState>((set) => ({
  orders: INITIAL_QUEUE,
  advance: (orderId) =>
    set((s) => ({
      orders: s.orders.map((o) => {
        if (o.id !== orderId) return o;
        const next = NEXT[o.status];
        if (!next) return o;
        const now = Date.now();
        const stamps =
          next === 'preparando'
            ? { acceptedAt: now }
            : next === 'pronto'
              ? { readyAt: now }
              : next === 'retirado'
                ? { pickedAt: now }
                : {};
        return { ...o, status: next, ...stamps };
      }),
    })),
  cancel: (orderId) =>
    set((s) => ({
      orders: s.orders.map((o) => (o.id === orderId ? { ...o, status: 'cancelado' as Status } : o)),
    })),
  pushFakeNew: () =>
    set((s) => {
      const id = String(2424 + s.orders.length);
      const novo: Order = {
        id,
        mesaNumero: Math.floor(1 + Math.random() * 16),
        status: 'novo',
        createdAt: Date.now(),
        totalCents: 3000 + Math.floor(Math.random() * 4000),
        lines: [
          { qty: 1, name: 'Smash Lou' },
          { qty: 1, name: 'Refrigerante lata' },
        ],
      };
      return { orders: [novo, ...s.orders] };
    }),
}));

/**
 * Hook custom — usa useMemo pra derivar filtro estável.
 * NÃO usar `useQueue((s) => s.orders.filter(...))` direto — array novo a cada
 * call dispara loop infinito em zustand v5 (Object.is na comparação).
 */
export function useOrdersByStatus(status: Status): Order[] {
  const orders = useQueue((s) => s.orders);
  return useMemo(() => orders.filter((o) => o.status === status), [orders, status]);
}

export const selectActiveCount = (s: QueueState): number =>
  s.orders.filter((o) => o.status === 'novo' || o.status === 'preparando').length;
