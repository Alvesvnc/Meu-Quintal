import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MenuItem } from '@mq/shared';

/**
 * Snapshot do item no momento da adição. Carrinho fica autossuficiente.
 */
export interface CartLine {
  menuItemId: string;
  name: string;
  priceCents: number;
  kitchenSlug: string;
  kitchenName: string;
  qty: number;
  note?: string;
  /**
   * Capa do item, no caminho RELATIVO que a API devolveu — nao a URL pronta.
   *
   * O carrinho e persistido em localStorage e pode sobreviver a uma troca de
   * `VITE_API_URL`; guardar o endereco absoluto congelaria o host antigo em
   * cada linha. Quem desenha resolve com `urlDaFoto`.
   *
   * Opcional porque carrinho salvo antes desta versao nao tem o campo — ali a
   * miniatura vira o bloco neutro, e nada quebra.
   */
  foto?: string;
}

export interface ActiveOrder {
  id: string;
  shortId: string;
  kitchenSlug: string;
  kitchenName: string;
}

interface CartState {
  lines: CartLine[];
  activeOrders: ActiveOrder[];

  /**
   * Como a pessoa quer ser chamada. `''` = não quis se identificar.
   *
   * Fica no carrinho, e não numa tela, porque é usado em DOIS momentos
   * distantes: ao enviar o pedido e ao fechar a conta. Guardado (o store é
   * persistido), a pessoa digita uma vez por visita em vez de a cada pedido.
   *
   * O nome é do APARELHO, não da mesa: é justamente isso que separa duas
   * pessoas sentadas juntas, cada uma no próprio celular.
   */
  nome: string;
  setNome: (nome: string) => void;

  addLine: (
    item: MenuItem,
    kitchen: { slug: string; name: string },
    qty?: number,
    note?: string,
  ) => void;
  setQty: (menuItemId: string, qty: number) => void;
  remove: (menuItemId: string) => void;
  clearKitchen: (kitchenSlug: string) => void;
  clearAll: () => void;
  addActiveOrder: (order: ActiveOrder) => void;
  dismissActiveOrder: (orderId: string) => void;
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      activeOrders: [],
      nome: '',

      setNome: (nome) => set({ nome: nome.slice(0, 40) }),

      addLine: (item, kitchen, qty = 1, note) =>
        set((s) => {
          const idx = s.lines.findIndex((l) => l.menuItemId === item.id);
          if (idx >= 0) {
            const next = [...s.lines];
            next[idx] = { ...next[idx], qty: next[idx].qty + qty, note: note ?? next[idx].note };
            return { lines: next };
          }
          return {
            lines: [
              ...s.lines,
              {
                menuItemId: item.id,
                name: item.name,
                priceCents: item.priceCents,
                kitchenSlug: kitchen.slug,
                kitchenName: kitchen.name,
                qty,
                note,
                foto: item.fotos[0]?.url ?? item.photoUrl ?? undefined,
              },
            ],
          };
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

      clearKitchen: (kitchenSlug) =>
        set((s) => ({ lines: s.lines.filter((l) => l.kitchenSlug !== kitchenSlug) })),

      clearAll: () => set({ lines: [] }),

      addActiveOrder: (order) =>
        set((s) => ({ activeOrders: [...s.activeOrders.filter((o) => o.id !== order.id), order] })),

      dismissActiveOrder: (orderId) =>
        set((s) => ({ activeOrders: s.activeOrders.filter((o) => o.id !== orderId) })),
    }),
    {
      name: 'mq:cart',
      partialize: (s) => ({ lines: s.lines, activeOrders: s.activeOrders }),
    },
  ),
);

// ─── Selectors / helpers ────────────────────────────────────────────────────

export const selectItemCount = (s: CartState) => s.lines.reduce((acc, l) => acc + l.qty, 0);

export const selectTotalCents = (s: CartState) =>
  s.lines.reduce((acc, l) => acc + l.priceCents * l.qty, 0);

export interface CartGroup {
  kitchenSlug: string;
  kitchenName: string;
  lines: CartLine[];
  subtotalCents: number;
}

/** Pure function — agrupar fora do store (memory: feedback-zustand-v5-derived-arrays). */
export function groupByKitchen(lines: CartLine[]): CartGroup[] {
  const groups = new Map<string, CartGroup>();
  for (const line of lines) {
    const g = groups.get(line.kitchenSlug) ?? {
      kitchenSlug: line.kitchenSlug,
      kitchenName: line.kitchenName,
      lines: [],
      subtotalCents: 0,
    };
    g.lines.push(line);
    g.subtotalCents += line.priceCents * line.qty;
    groups.set(line.kitchenSlug, g);
  }
  return Array.from(groups.values());
}
