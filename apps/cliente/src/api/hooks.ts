import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  QuintalResponse,
  KitchenMenuResponse,
  OrderResponse,
  OrdersListResponse,
  CreateOrderInput,
  CreateOrderResponse,
  OrderStatusEvent,
  RequestPaymentInput,
  RequestPaymentResponse,
} from '@mq/shared';
import { api } from './client';
import { getSocket } from './socket';

// ─── Quintal (lista de cozinhas pós-QR) ─────────────────────────────────────
export function useQuintal() {
  return useQuery({
    queryKey: ['quintal'],
    queryFn: async () => (await api.get<QuintalResponse>('/api/m/quintal')).data,
    staleTime: 60_000,
    retry: 1,
  });
}

// ─── Cardápio de uma cozinha ────────────────────────────────────────────────
export function useKitchenMenu(slug: string | undefined) {
  return useQuery({
    queryKey: ['kitchen', slug],
    queryFn: async () => (await api.get<KitchenMenuResponse>(`/api/m/k/${slug}`)).data,
    enabled: !!slug,
    staleTime: 60_000,
  });
}

// ─── Criar pedido ───────────────────────────────────────────────────────────
export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateOrderInput) =>
      (await api.post<CreateOrderResponse>('/api/m/pedido', input)).data,
    onSuccess: () => {
      // Invalida lista de pedidos ativos pra refetch quando criar novo
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

// ─── Responder alteração proposta pela cozinha ──────────────────────────────

export function useResponderAlteracao(orderId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { alteracaoId: string; resposta: 'aceitar' | 'recusar' }) =>
      (
        await api.post(`/api/m/pedido/${orderId}/alteracao/${input.alteracaoId}/${input.resposta}`)
      ).data,
    onSuccess: () => {
      // O pedido inteiro muda: quantidade, status do item e valor a pagar.
      qc.invalidateQueries({ queryKey: ['order', orderId] });
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

// ─── Fechar conta (pedir cobrança pra uma cozinha) ──────────────────────────
export function useRequestPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RequestPaymentInput) =>
      (await api.post<RequestPaymentResponse>('/api/m/pedidos/fechar-conta', input)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

// ─── Pedidos ativos da mesa ─────────────────────────────────────────────────
export function useOrders() {
  return useQuery({
    queryKey: ['orders'],
    queryFn: async () => (await api.get<OrdersListResponse>('/api/m/pedidos')).data,
    staleTime: 15_000,
    refetchInterval: 30_000, // polling leve — socket invalida ao mudar status
  });
}

// ─── Acompanhar pedido (com Socket.io pra real-time) ────────────────────────
export function useOrder(orderId: string | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['order', orderId],
    queryFn: async () => (await api.get<OrderResponse>(`/api/m/pedido/${orderId}`)).data,
    enabled: !!orderId,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!orderId) return;
    // Sem token de mesa o servidor recusa o handshake — nao ha o que assinar.
    const socket = getSocket();
    if (!socket) return;
    socket.emit('order:subscribe', orderId);

    const handler = (event: OrderStatusEvent) => {
      if (event.orderId === orderId) {
        qc.invalidateQueries({ queryKey: ['order', orderId] });
        qc.invalidateQueries({ queryKey: ['orders'] });
      }
    };
    socket.on('order:status', handler);

    // A cozinha propos reduzir ou cancelar algo. Refetch imediato: a proposta
    // expira em 5 minutos e o cliente precisa ver na hora, nao no proximo poll.
    const onAlteracao = (event: { orderId: string }) => {
      if (event.orderId !== orderId) return;
      qc.invalidateQueries({ queryKey: ['order', orderId] });
    };
    socket.on('order:alteracao', onAlteracao);
    socket.on('order:alteracao-respondida', onAlteracao);

    return () => {
      socket.emit('order:unsubscribe', orderId);
      socket.off('order:status', handler);
      socket.off('order:alteracao', onAlteracao);
      socket.off('order:alteracao-respondida', onAlteracao);
    };
  }, [orderId, qc]);

  return query;
}
