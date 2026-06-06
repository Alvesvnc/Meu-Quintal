/** Pedido — resposta de GET /api/m/pedido/:id e payload de socket. */

export type OrderItemStatus = 'novo' | 'preparando' | 'pronto' | 'retirado' | 'cancelado';

export interface OrderResponse {
  id: string;
  shortId: string;
  mesaNumero: number;
  createdAt: string; // ISO
  totalCents: number;
  kitchens: OrderKitchenGroup[];
}

export interface OrderKitchenGroup {
  kitchenSlug: string;
  kitchenName: string;
  slaMinutes: number;
  items: OrderLineItem[];
  status: OrderItemStatus;
  acceptedAt: string | null;
  readyAt: string | null;
  pickedAt: string | null;
}

export interface OrderLineItem {
  id: string;
  name: string;
  qty: number;
  unitPriceCents: number;
  note: string | null;
  status: OrderItemStatus;
}

export interface OrderStatusEvent {
  orderId: string;
  kitchenSlug: string;
  status: OrderItemStatus;
  at: string;
}

/** Resposta de GET /api/m/pedidos — pedidos ativos da mesa (não retirados/cancelados). */
export interface OrdersListResponse {
  orders: OrderListItem[];
}

export interface OrderListItem {
  id: string;
  shortId: string;
  createdAt: string;
  totalCents: number;
  kitchenSlug: string;
  kitchenName: string;
  /** Status agregado da cozinha desse pedido. */
  status: OrderItemStatus;
  itemCount: number;
  paymentRequestedAt: string | null;
  paidAt: string | null;
}

/** Evento Socket.io `payment:requested` — emitido quando cliente fecha conta. */
export interface PaymentRequestedEvent {
  spaceId: string;
  tableId: string;
  tableNumero: number;
  kitchenSlug: string;
  orderIds: string[];
  totalCents: number;
  at: string;
}

/** Body de POST /api/m/pedidos/fechar-conta */
export interface RequestPaymentInput {
  kitchenSlug: string;
}

export interface RequestPaymentResponse {
  ok: true;
  requested: number; // quantos pedidos marcados
}
