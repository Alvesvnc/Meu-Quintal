/**
 * Mocks do "quintal" inteiro — visão do dono.
 * No MVP vem de GET /api/admin/overview.
 */

export interface KitchenSummary {
  id: string;
  slug: string;
  name: string;
  category: string;
  active: boolean;
  ordersToday: number;
  grossCents: number;
  avgEtaMin: number;
  /** True se há pedidos atrasados (SLA estourado) agora */
  hasLateOrders: boolean;
}

export const QUINTAL_INFO = {
  name: 'Meu Quintal · São Sebastião',
  ownerName: 'Marina',
  tablesTotal: 16,
  tablesOccupied: 12,
  commissionPct: 15,
  payoutDay: 5,
} as const;

export const KITCHENS: KitchenSummary[] = [
  { id: 'k1', slug: 'lou-burger',      name: 'Lou Burger',      category: 'Hamburgueria', active: true,  ordersToday: 42, grossCents: 168000, avgEtaMin: 11, hasLateOrders: true  },
  { id: 'k2', slug: 'cumbuca-caicara', name: 'Cumbuca Caiçara', category: 'Frutos do mar',active: true,  ordersToday: 28, grossCents: 142000, avgEtaMin: 18, hasLateOrders: false },
  { id: 'k3', slug: 'pasteloka',       name: 'Pasteloka',       category: 'Feira',         active: true,  ordersToday: 56, grossCents:  84200, avgEtaMin:  7, hasLateOrders: false },
  { id: 'k4', slug: 'horta-do-ze',     name: 'Horta do Zé',     category: 'Vegetariano',   active: true,  ordersToday: 22, grossCents:  68400, avgEtaMin: 10, hasLateOrders: false },
  { id: 'k5', slug: 'dolce-marina',    name: 'Dolce Marina',    category: 'Doceria',       active: true,  ordersToday: 18, grossCents:  32400, avgEtaMin:  5, hasLateOrders: false },
  { id: 'k6', slug: 'taverna-do-pico', name: 'Taverna do Pico', category: 'Drinkeria',     active: false, ordersToday:  0, grossCents:      0, avgEtaMin:  0, hasLateOrders: false },
];

export interface DayPoint {
  hour: number;     // 11..23
  orders: number;
  grossCents: number;
}

/** Série do dia, 11h-23h, pra mini-bar chart do overview. */
export const TODAY_BY_HOUR: DayPoint[] = [
  { hour: 11, orders:  4, grossCents:  18000 },
  { hour: 12, orders: 22, grossCents:  88000 },
  { hour: 13, orders: 31, grossCents: 124000 },
  { hour: 14, orders: 14, grossCents:  56000 },
  { hour: 15, orders:  6, grossCents:  24000 },
  { hour: 16, orders:  4, grossCents:  16000 },
  { hour: 17, orders:  9, grossCents:  36000 },
  { hour: 18, orders: 16, grossCents:  64000 },
  { hour: 19, orders: 28, grossCents: 112000 },
  { hour: 20, orders: 22, grossCents:  88000 },
  { hour: 21, orders: 12, grossCents:  48000 },
  { hour: 22, orders:  5, grossCents:  20000 },
  { hour: 23, orders:  2, grossCents:   8000 },
];

export interface FlagItem {
  kind: 'late' | 'payout-due' | 'low-stock' | 'new-kitchen-request';
  title: string;
  detail: string;
  href?: string;
}

/** "O que exige atenção" — flagged items pro overview. */
export const FLAGS: FlagItem[] = [
  {
    kind: 'late',
    title: 'Lou Burger atrasando',
    detail: '4 pedidos acima do SLA de 12 min',
    href: '/restaurantes/lou-burger',
  },
  {
    kind: 'payout-due',
    title: 'Repasse de junho fecha em 9 dias',
    detail: 'R$ 24.180 a transferir pra 5 cozinhas',
    href: '/financeiro',
  },
  {
    kind: 'new-kitchen-request',
    title: 'Taverna do Pico esperando aprovação',
    detail: 'Solicitação enviada há 2 dias',
    href: '/restaurantes',
  },
];

/** Top items vendidos esta semana. */
export const TOP_ITEMS = [
  { rank: 1, name: 'Smash Lou',         kitchen: 'Lou Burger',      qty: 142 },
  { rank: 2, name: 'Moqueca grande',    kitchen: 'Cumbuca Caiçara', qty:  88 },
  { rank: 3, name: 'Pastel de carne',   kitchen: 'Pasteloka',       qty:  76 },
  { rank: 4, name: 'Tigela de grãos',   kitchen: 'Horta do Zé',     qty:  54 },
  { rank: 5, name: 'Brigadeiro colher', kitchen: 'Dolce Marina',    qty:  48 },
];

export function fmtBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function fmtBRLPrecise(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  });
}

export function fmtPercentDelta(n: number): string {
  const sign = n >= 0 ? '↑' : '↓';
  return `${sign} ${Math.abs(n)}%`;
}
