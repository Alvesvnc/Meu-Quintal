/**
 * Pedidos ao vivo — versão admin (espectador, sem ações).
 * Mostra TODOS os pedidos de TODAS as cozinhas, em tempo real.
 * No MVP vem de Socket.io "admin:orders:state" + diffs.
 */

export type LiveStatus = 'novo' | 'preparando' | 'pronto' | 'retirado';

export interface LiveOrder {
  id: string;
  mesaNumero: number;
  kitchenSlug: string;
  kitchenName: string;
  status: LiveStatus;
  createdAt: number;
  totalCents: number;
  itemCount: number;
  /** True se essa cozinha está atrasada nesse pedido. */
  isLate: boolean;
}

const minAgo = (n: number) => Date.now() - n * 60_000;

export const LIVE_ORDERS: LiveOrder[] = [
  // Lou Burger (com atraso)
  { id: '2421', mesaNumero: 12, kitchenSlug: 'lou-burger',      kitchenName: 'Lou Burger',      status: 'preparando', createdAt: minAgo(15), totalCents: 8400,  itemCount: 4, isLate: true  },
  { id: '2422', mesaNumero: 4,  kitchenSlug: 'lou-burger',      kitchenName: 'Lou Burger',      status: 'novo',       createdAt: minAgo(3),  totalCents: 3200,  itemCount: 1, isLate: false },
  { id: '2423', mesaNumero: 7,  kitchenSlug: 'lou-burger',      kitchenName: 'Lou Burger',      status: 'novo',       createdAt: minAgo(1),  totalCents: 4400,  itemCount: 2, isLate: false },
  // Cumbuca
  { id: '2418', mesaNumero: 8,  kitchenSlug: 'cumbuca-caicara', kitchenName: 'Cumbuca Caiçara', status: 'pronto',     createdAt: minAgo(22), totalCents: 7800,  itemCount: 2, isLate: false },
  { id: '2420', mesaNumero: 14, kitchenSlug: 'cumbuca-caicara', kitchenName: 'Cumbuca Caiçara', status: 'preparando', createdAt: minAgo(12), totalCents: 11600, itemCount: 3, isLate: false },
  // Pasteloka
  { id: '2419', mesaNumero: 1,  kitchenSlug: 'pasteloka',       kitchenName: 'Pasteloka',       status: 'pronto',     createdAt: minAgo(8),  totalCents: 2200,  itemCount: 2, isLate: false },
  { id: '2425', mesaNumero: 11, kitchenSlug: 'pasteloka',       kitchenName: 'Pasteloka',       status: 'preparando', createdAt: minAgo(5),  totalCents: 3600,  itemCount: 2, isLate: false },
  // Horta
  { id: '2424', mesaNumero: 9,  kitchenSlug: 'horta-do-ze',     kitchenName: 'Horta do Zé',     status: 'novo',       createdAt: minAgo(2),  totalCents: 5400,  itemCount: 2, isLate: false },
  // Dolce
  { id: '2417', mesaNumero: 8,  kitchenSlug: 'dolce-marina',    kitchenName: 'Dolce Marina',    status: 'pronto',     createdAt: minAgo(6),  totalCents: 2400,  itemCount: 1, isLate: false },
];

export const LIVE_STATUS_LABEL: Record<LiveStatus, string> = {
  novo:       'Novo',
  preparando: 'Preparando',
  pronto:     'Pronto',
  retirado:   'Retirado',
};
