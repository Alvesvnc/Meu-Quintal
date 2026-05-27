import { create } from 'zustand';
import { getItemById, type MenuItem } from '../mocks/menu';

export interface CartLine {
  menuItemId: string;
  qty: number;
  note?: string;
}

interface CartState {
  lines: CartLine[];
  activeOrderId: string | null;
  addLine: (item: MenuItem, qty?: number, note?: string) => void;
  setQty: (menuItemId: string, qty: number) => void;
  remove: (menuItemId: string) => void;
  clear: () => void;
  /** Fecha o carrinho atual, gera um orderId mock e marca como pedido ativo. */
  checkout: () => string;
  /** Marca o pedido como finalizado (após "retirado" ou avaliação enviada). */
  finishOrder: () => void;
}

export const useCart = create<CartState>((set) => ({
  lines: [],
  activeOrderId: null,
  addLine: (item, qty = 1, note) =>
    set((s) => {
      const idx = s.lines.findIndex((l) => l.menuItemId === item.id);
      if (idx >= 0) {
        const next = [...s.lines];
        next[idx] = { ...next[idx], qty: next[idx].qty + qty, note: note ?? next[idx].note };
        return { lines: next };
      }
      return { lines: [...s.lines, { menuItemId: item.id, qty, note }] };
    }),
  setQty: (menuItemId, qty) =>
    set((s) => {
      if (qty <= 0) return { lines: s.lines.filter((l) => l.menuItemId !== menuItemId) };
      return {
        lines: s.lines.map((l) => (l.menuItemId === menuItemId ? { ...l, qty } : l)),
      };
    }),
  remove: (menuItemId) =>
    set((s) => ({ lines: s.lines.filter((l) => l.menuItemId !== menuItemId) })),
  clear: () => set({ lines: [] }),
  checkout: () => {
    const id = String(2400 + Math.floor(Math.random() * 99));
    set({ lines: [], activeOrderId: id });
    return id;
  },
  finishOrder: () => set({ activeOrderId: null }),
}));

// ─── Selectors ──────────────────────────────────────────────────────────────

export const selectItemCount = (s: CartState) =>
  s.lines.reduce((acc, l) => acc + l.qty, 0);

export const selectTotalCents = (s: CartState) =>
  s.lines.reduce((acc, l) => {
    const it = getItemById(l.menuItemId);
    return acc + (it?.priceCents ?? 0) * l.qty;
  }, 0);

export interface CartGroup {
  kitchenSlug: string;
  lines: Array<{ line: CartLine; item: MenuItem }>;
  subtotalCents: number;
}

/**
 * NÃO usar como `useCart(groupByKitchen)` — cria array novo a cada chamada
 * e dispara re-render infinito. Use via useMemo sobre `lines` no componente.
 */
export function groupByKitchen(lines: CartLine[]): CartGroup[] {
  const groups = new Map<string, CartGroup>();
  for (const line of lines) {
    const item = getItemById(line.menuItemId);
    if (!item) continue;
    const g = groups.get(item.kitchenSlug) ?? {
      kitchenSlug: item.kitchenSlug,
      lines: [],
      subtotalCents: 0,
    };
    g.lines.push({ line, item });
    g.subtotalCents += item.priceCents * line.qty;
    groups.set(item.kitchenSlug, g);
  }
  return Array.from(groups.values());
}
