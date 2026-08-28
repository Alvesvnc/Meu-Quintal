/** Pedido — resposta de GET /api/m/pedido/:id e payload de socket. */

export type OrderItemStatus = 'novo' | 'preparando' | 'pronto' | 'retirado' | 'cancelado';

export interface OrderResponse {
  id: string;
  shortId: string;
  mesaNumero: number;
  createdAt: string; // ISO
  /** O que foi PEDIDO. Snapshot da criacao — nao muda se um item for cancelado. */
  totalCents: number;
  /**
   * O que vai CHEGAR: soma dos itens ainda ativos.
   *
   * Igual a `totalCents` enquanto nada for cancelado. Quando divergem, e este
   * o valor que a pessoa vai pagar no balcao — e o que a tela mostra.
   */
  totalAtivosCents: number;
  kitchens: OrderKitchenGroup[];
  /**
   * A cozinha propos reduzir ou cancelar algo e espera resposta. A tela
   * interrompe o que estiver fazendo pra mostrar isto.
   */
  alteracaoPendente: import('./alteracao').AlteracaoPendente | null;
}

export interface OrderKitchenGroup {
  kitchenSlug: string;
  kitchenName: string;
  slaMinutes: number;
  items: OrderLineItem[];
  /**
   * Agregado dos itens ATIVOS. So e 'cancelado' quando todos os itens estao.
   * Ver server/src/lib/orderStatus.ts.
   */
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
  /**
   * Capa do item, pronta pro `<img>` (caminho relativo a API) ou `null`.
   *
   * A tela de acompanhar mostra o pedido como uma lista de FOTOS, nao de
   * nomes: quem espera no salao reconhece o prato antes de ler. Sem este
   * campo a lista precisaria de uma query por item so pra achar a imagem.
   */
  foto: string | null;
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
  /** O que foi pedido (snapshot). */
  totalCents: number;
  /** O que vai chegar: exclui itens cancelados. */
  totalAtivosCents: number;
  kitchenSlug: string;
  kitchenName: string;
  /** Status agregado da cozinha desse pedido. */
  status: OrderItemStatus;
  itemCount: number;
  /**
   * Os itens ATIVOS do pedido, na ordem, so com o que a lista desenha.
   *
   * A tela de pedidos troca o texto "2 itens" por uma fileira de miniaturas —
   * e o nome fica de `alt`. Cancelado nao entra: nao vai chegar.
   */
  itens: OrderListItemPreview[];
  paymentRequestedAt: string | null;
  paidAt: string | null;
}

export interface OrderListItemPreview {
  id: string;
  name: string;
  qty: number;
  /** Capa do item (caminho relativo a API) ou `null` quando nao ha foto. */
  foto: string | null;
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
  /**
   * De quem é a conta. Ausente = a conta da mesa (os pedidos que ninguém
   * assinou).
   *
   * O servidor compara por igualdade exata, incluindo o nulo: quem assinou não
   * arrasta a conta da mesa, e a conta da mesa não arrasta a de quem assinou.
   */
  nomeCliente?: string;
}

export interface RequestPaymentResponse {
  ok: true;
  requested: number; // quantos pedidos marcados
}
