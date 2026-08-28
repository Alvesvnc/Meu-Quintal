/**
 * Alteração proposta pela cozinha e respondida pelo cliente.
 *
 * A cozinha não muda o pedido direto: ela propõe reduzir quantidade ou cancelar
 * item, e o cliente aceita ou recusa. Sem resposta no prazo, vale como recusa.
 */

export type ChangeStatus = 'pendente' | 'aceita' | 'recusada' | 'expirada';

export interface AlteracaoLinha {
  orderItemId: string;
  /** Nome no momento do pedido — a tela mostra sem precisar de outra query. */
  name: string;
  qtyAnterior: number;
  /** 0 = a cozinha quer cancelar este item. */
  qtyProposta: number;
  unitPriceCents: number;
}

export interface AlteracaoPendente {
  id: string;
  kitchenSlug: string;
  kitchenName: string;
  /** O que a cozinha escreveu: "acabou o pão", "só tenho 1 porção". */
  reason: string | null;
  createdAt: string;
  /** Sem resposta até aqui, o item é cancelado por inteiro. */
  expiresAt: string;
  linhas: AlteracaoLinha[];
  /**
   * Quanto o total cai se o cliente aceitar, em centavos (negativo).
   * Decidir sem saber o impacto no valor não é decidir.
   */
  deltaCents: number;
}

/** Resposta de POST /api/r/pedido/:id/alteracao */
export interface CriarAlteracaoResponse {
  id: string;
  expiresAt: string;
}

/** Evento Socket.io `order:alteracao` — cozinha propôs algo. */
export interface OrderAlteracaoEvent {
  orderId: string;
  alteracao: AlteracaoPendente;
}

/** Evento Socket.io `order:alteracao-respondida` — cliente decidiu. */
export interface OrderAlteracaoRespondidaEvent {
  orderId: string;
  alteracaoId: string;
  kitchenSlug: string;
  resposta: Exclude<ChangeStatus, 'pendente'>;
  at: string;
}
