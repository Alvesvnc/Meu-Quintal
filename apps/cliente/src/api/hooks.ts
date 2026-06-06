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
    const socket = getSocket();
    socket.emit('order:subscribe', orderId);

    const handler = (event: OrderStatusEvent) => {
      if (event.orderId === orderId) {
        qc.invalidateQueries({ queryKey: ['order', orderId] });
        qc.invalidateQueries({ queryKey: ['orders'] });
      }
    };
    socket.on('order:status', handler);

    return () => {
      socket.emit('order:unsubscribe', orderId);
      socket.off('order:status', handler);
    };
  }, [orderId, qc]);

  return query;
}
