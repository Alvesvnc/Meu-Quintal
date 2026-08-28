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
  OrderAlteracaoEvent,
  OrderAlteracaoRespondidaEvent,
  RequestPaymentInput,
  RequestPaymentResponse,
} from '@mq/shared';
import { api, getTableToken } from './client';
import { getSocket } from './socket';
import { useCart } from '../stores/cart';

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
    // O NOME ENTRA AQUI, e nao na tela.
    //
    // Ele e preciso em dois lugares distantes — criar pedido e fechar conta — e
    // toda tela que chamasse esses hooks teria que lembrar de passa-lo. A
    // primeira que esquecesse criaria um pedido orfao, que depois nao fecharia
    // junto com os outros da pessoa e ninguem entenderia por que.
    //
    // `getState()` em vez de hook: ler aqui dentro nao assina o componente a
    // mudancas do nome, que nao precisam causar render.
    mutationFn: async (input: CreateOrderInput) =>
      (
        await api.post<CreateOrderResponse>('/api/m/pedido', {
          ...input,
          nomeCliente: useCart.getState().nome.trim() || undefined,
        })
      ).data,
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
      (await api.post(`/api/m/pedido/${orderId}/alteracao/${input.alteracaoId}/${input.resposta}`))
        .data,
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
    // Mesma razao do createOrder: fechar a conta com o nome e o que impede
    // levar junto o pedido de quem divide a mesa.
    mutationFn: async (input: RequestPaymentInput) =>
      (
        await api.post<RequestPaymentResponse>('/api/m/pedidos/fechar-conta', {
          ...input,
          nomeCliente: useCart.getState().nome.trim() || undefined,
        })
      ).data,
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
    // Sem token a API responde 401. O App chama este hook antes de saber se ja
    // existe mesa, e a tela de entrada (/m/:token) ainda nao tem nenhuma.
    enabled: !!getTableToken(),
    staleTime: 15_000,
    refetchInterval: 30_000, // polling leve — socket invalida ao mudar status
  });
}

// ─── Tempo real dos pedidos ativos ──────────────────────────────────────────

/**
 * Teto de salas assinadas de uma vez.
 *
 * Cada `order:subscribe` custa uma consulta ao banco no servidor, que confere
 * se o pedido é mesmo desta mesa. Uma mesa tem poucos pedidos abertos, mas o
 * número vem da API: sem teto, uma lista inesperadamente longa viraria uma
 * rajada de consultas toda vez que a lista mudasse.
 */
const MAX_SALAS = 12;

type EventoDePedido = OrderStatusEvent | OrderAlteracaoEvent | OrderAlteracaoRespondidaEvent;

/**
 * Assina TODOS os pedidos ativos da mesa enquanto o app estiver aberto.
 *
 * A inscrição morava dentro do `useOrder`, que só roda na tela de detalhe:
 * fora dela o cliente não estava em sala nenhuma, então a cozinha cancelava um
 * item e ele só descobria ao abrir o pedido. Chamado no nível do App, o aviso
 * chega também no cardápio, no carrinho e na lista.
 *
 * É a ÚNICA inscrição do app. O `useOrder` deixou de assinar de propósito: se
 * as duas coexistissem, o `order:unsubscribe` da limpeza da tela de detalhe
 * tiraria esta daqui da sala ao sair — e o bug voltaria, intermitente.
 */
export function useAssinaturaDosPedidos() {
  const qc = useQueryClient();
  const { data } = useOrders();

  // Chave de texto em vez do array: o refetch de 30s devolve objetos novos e o
  // efeito reassinaria tudo a cada volta do polling.
  const chave = (data?.orders ?? [])
    .slice(0, MAX_SALAS)
    .map((o) => o.id)
    .join(',');

  useEffect(() => {
    // Sem token de mesa o servidor recusa o handshake — nao ha o que assinar.
    const socket = getSocket();
    if (!socket) return;

    const ids = chave ? chave.split(',') : [];
    if (ids.length === 0) return;

    const assinar = () => ids.forEach((id) => socket.emit('order:subscribe', id));
    assinar();

    // O socket.io reconecta sozinho, mas as salas não voltam junto: quem as
    // guardava era a conexão anterior. Sem reassinar, uma queda de rede deixa
    // o app mudo até o próximo polling — e o bug reaparece só às vezes.
    socket.on('connect', assinar);

    const aoMudar = (evento: EventoDePedido) => {
      qc.invalidateQueries({ queryKey: ['order', evento.orderId] });
      qc.invalidateQueries({ queryKey: ['orders'] });
    };
    socket.on('order:status', aoMudar);
    socket.on('order:alteracao', aoMudar);
    socket.on('order:alteracao-respondida', aoMudar);

    return () => {
      ids.forEach((id) => socket.emit('order:unsubscribe', id));
      socket.off('connect', assinar);
      socket.off('order:status', aoMudar);
      socket.off('order:alteracao', aoMudar);
      socket.off('order:alteracao-respondida', aoMudar);
    };
  }, [chave, qc]);
}

// ─── Acompanhar pedido ──────────────────────────────────────────────────────

/**
 * Só a query — o tempo real vem do `useAssinaturaDosPedidos`, no App, que já
 * invalida `['order', id]` quando o pedido muda. Assinar de novo aqui seria
 * pior que redundante: o `unsubscribe` da limpeza expulsaria a inscrição
 * global da sala ao sair desta tela.
 */
export function useOrder(orderId: string | undefined) {
  return useQuery({
    queryKey: ['order', orderId],
    queryFn: async () => (await api.get<OrderResponse>(`/api/m/pedido/${orderId}`)).data,
    enabled: !!orderId,
    refetchOnWindowFocus: true,
  });
}
