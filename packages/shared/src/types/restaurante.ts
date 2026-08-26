/** Tipos do app restaurante (operador da cozinha). */

import type { OrderItemStatus } from './order.js';

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  kitchen: KitchenMeResponse;
}

export interface KitchenMeResponse {
  userId: string;
  email: string;
  role: string;
  kitchen: {
    id: string;
    slug: string;
    name: string;
    category: string | null;
    photoUrl: string | null;
    slaMinutes: number;
    status: 'ativa' | 'pausada' | 'rascunho';
  };
}

// ─── Fila ────────────────────────────────────────────────────────────────────

export interface FilaResponse {
  orders: FilaOrder[];
}

export interface FilaOrder {
  id: string;
  shortId: string;
  mesaNumero: number;
  createdAt: string;
  acceptedAt: string | null;
  readyAt: string | null;
  pickedAt: string | null;
  status: OrderItemStatus;
  items: FilaOrderItem[];
  /** Soma dos itens ATIVOS: item cancelado nao entra. */
  totalCents: number;
  /** SLA estourado nesse momento. */
  isLate: boolean;
  paymentRequestedAt: string | null;
  /**
   * Alteracao que ESTA COZINHA propos e ainda aguarda resposta do cliente.
   * Sem isto, depois de enviar a proposta o card voltava ao normal e o
   * operador nao via que havia algo pendente — e podia tentar propor de novo,
   * levando 409.
   */
  alteracaoAguardando: AlteracaoAguardando | null;
}

/** Proposta pendente, na visao da cozinha que a fez. */
export interface AlteracaoAguardando {
  id: string;
  createdAt: string;
  expiresAt: string;
  reason: string | null;
  linhas: Array<{
    orderItemId: string;
    name: string;
    qtyAnterior: number;
    qtyProposta: number;
  }>;
}

export interface FilaOrderItem {
  id: string;
  name: string;
  qty: number;
  note: string | null;
  unitPriceCents: number;
  /**
   * Sem este campo a cozinha via o item cancelado na lista sem nenhuma marca —
   * e prepararia comida que ninguem vai buscar.
   */
  status: OrderItemStatus;
}

// ─── Eventos Socket.io recebidos pelo restaurante ───────────────────────────

export interface OrderNewEvent {
  orderId: string;
  shortId: string;
  mesaNumero: number;
  createdAt: string;
  totalCents: number;
  itemCount: number;
  /** Slug da cozinha (filtro extra do lado do cliente). */
  kitchenSlug: string;
}

// ─── Cancelamento ────────────────────────────────────────────────────────────

export interface CancelOrderInput {
  reason?: string;
}

// ─── Cardapio ────────────────────────────────────────────────────────────────

export type CategoriaMenu = 'entradas' | 'pratos' | 'sobremesas' | 'bebidas';
export type BadgeMenu = 'novo' | 'esgotando' | 'sem-estoque';

/**
 * Item como a COZINHA ve.
 *
 * Diferente de `MenuItemPublic` (o que o cliente ve) porque aqui entra tudo:
 * item esgotado, ordenacao e os campos que so servem pra edicao.
 */
/**
 * Foto de um item, ja processada e servida pelo proprio servidor.
 *
 * `width`/`height` vem junto pro front reservar o espaco antes de a imagem
 * carregar — sem isso a lista pula quando cada foto chega.
 */
export interface FotoDoItem {
  id: string;
  /** Caminho relativo a API. Publico e imutavel. */
  url: string;
  width: number;
  height: number;
}

export interface ItemCardapio {
  id: string;
  category: CategoriaMenu;
  name: string;
  description: string | null;
  priceCents: number;
  /**
   * URL EXTERNA, colada a mao. Legado: existe pros itens cadastrados antes de
   * haver upload. Foto nova entra em `fotos`.
   */
  photoUrl: string | null;
  /** Fotos enviadas pela cozinha. A primeira e a capa. */
  fotos: FotoDoItem[];
  available: boolean;
  badge: BadgeMenu | null;
  sortOrder: number;
}

export interface CardapioResponse {
  items: ItemCardapio[];
}

// ─── Perfil ──────────────────────────────────────────────────────────────────

export interface PerfilCozinhaResponse {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  tagline: string | null;
  description: string | null;
  photoUrl: string | null;
  slaMinutes: number;
  status: 'ativa' | 'pausada' | 'rascunho';
}

// ─── Historico ───────────────────────────────────────────────────────────────

export interface HistoricoPedido {
  id: string;
  shortId: string;
  mesaNumero: number;
  /** Quando o pedido entrou. */
  createdAt: string;
  /** Quando ele saiu da fila: retirada ou cancelamento. */
  fechadoEm: string;
  status: 'retirado' | 'cancelado';
  /** So os itens DESTA cozinha. */
  itens: Array<{ qty: number; name: string; status: OrderItemStatus }>;
  /** Soma dos itens ativos desta cozinha — cancelado nao entra. */
  totalCents: number;
}

export interface HistoricoResponse {
  dias: number;
  /** Mais recente primeiro. */
  pedidos: HistoricoPedido[];
  totais: {
    entregues: number;
    cancelados: number;
    receitaCents: number;
    ticketMedioCents: number;
  };
}

// ─── Metricas de operacao ────────────────────────────────────────────────────

export interface MetricasResponse {
  dias: number;
  /** Itens mais vendidos, maior primeiro. Cancelado nao conta. */
  carroChefe: Array<{ name: string; qty: number; receitaCents: number }>;
  ticketMedioCents: number;
  pedidosCount: number;
  receitaCents: number;
  /**
   * Movimento por hora do dia (0..23), so as horas com pedido.
   * `hora` em fuso local do servidor — a cozinha pensa no relogio da parede.
   */
  porHora: Array<{ hora: number; pedidos: number; receitaCents: number }>;
}
