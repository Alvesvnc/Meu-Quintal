import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CriarAlteracaoInput,
  CriarAlteracaoResponse,
  MotivoCancelamento,
  MetricasCancelamentoResponse,
  LoginInput,
  LoginResponse,
  KitchenMeResponse,
  FilaResponse,
  OrderNewEvent,
  OrderStatusEvent,
  PaymentRequestedEvent,
  CardapioResponse,
  ItemCardapio,
  FotoDoItem,
  CriarItemCardapioInput,
  EditarItemCardapioInput,
  PerfilCozinhaResponse,
  PerfilCozinhaInput,
  HistoricoResponse,
  MetricasResponse,
  ConvitePublicoResponse,
  AceitarConviteResponse,
  PrimeiroAcessoResponse,
  DefinirSenhaResponse,
} from '@mq/shared';
import { api, setToken } from './client';
import { getSocket } from './socket';
import { useAuth } from '../stores/auth';

// ─── Auth ────────────────────────────────────────────────────────────────────

export function useLogin() {
  const qc = useQueryClient();
  const setMe = useAuth((s) => s.setMe);
  return useMutation({
    mutationFn: async (input: LoginInput) =>
      (await api.post<LoginResponse>('/api/r/auth/login', input)).data,
    onSuccess: (data) => {
      setToken(data.token);
      setMe(data.kitchen);
      qc.invalidateQueries();
    },
  });
}

export function useMe() {
  const setMe = useAuth((s) => s.setMe);
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const data = (await api.get<KitchenMeResponse>('/api/r/auth/me')).data;
      setMe(data);
      return data;
    },
    staleTime: 5 * 60_000,
    retry: false,
  });
}

// ─── Fila ────────────────────────────────────────────────────────────────────

export function useFila() {
  return useQuery({
    queryKey: ['fila'],
    queryFn: async () => (await api.get<FilaResponse>('/api/r/fila')).data,
    refetchInterval: 30_000, // polling leve — socket invalida ao mudar status
    staleTime: 10_000,
  });
}

// ─── Status mutations ───────────────────────────────────────────────────────

function useAdvance(actionPath: 'aceitar' | 'pronto' | 'retirado') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) =>
      (await api.patch(`/api/r/pedido/${orderId}/${actionPath}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fila'] });
    },
  });
}

export const useAccept = () => useAdvance('aceitar');
export const useReady = () => useAdvance('pronto');
export const useDelivered = () => useAdvance('retirado');

/**
 * Cancelar tem assinatura propria porque exige MOTIVO — a categoria e o que
 * responde "o que mais me faz cancelar?" na tela de metricas.
 */
export function useCancel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      orderId: string;
      motivo: MotivoCancelamento;
      reason?: string;
    }) => {
      const { orderId, ...body } = input;
      return (await api.patch(`/api/r/pedido/${orderId}/cancelar`, body)).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fila'] });
      // O numero de cancelamentos mudou; a tela de metricas precisa refletir.
      qc.invalidateQueries({ queryKey: ['metricas-cancelamentos'] });
    },
  });
}

// ─── Métricas de cancelamento ───────────────────────────────────────────────

export function useMetricasCancelamento(dias = 30) {
  return useQuery({
    queryKey: ['metricas-cancelamentos', dias],
    queryFn: async () =>
      (
        await api.get<MetricasCancelamentoResponse>(
          `/api/r/metricas/cancelamentos?dias=${dias}`,
        )
      ).data,
  });
}

// ─── Propor alteração ao cliente ────────────────────────────────────────────

/**
 * A cozinha não altera o pedido direto: propõe e o cliente responde. Enquanto
 * ele não responde, a fila segue — os itens não afetados continuam sendo
 * preparados normalmente.
 */
export function usePropormAlteracao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { orderId: string } & CriarAlteracaoInput) => {
      const { orderId, ...body } = input;
      return (
        await api.post<CriarAlteracaoResponse>(`/api/r/pedido/${orderId}/alteracao`, body)
      ).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fila'] });
    },
  });
}

// ─── Real-time: subscribe na sala da cozinha logada ─────────────────────────

interface KitchenEventHandlers {
  onOrderNew?: (e: OrderNewEvent) => void;
  onOrderStatus?: (e: OrderStatusEvent) => void;
  onPaymentRequested?: (e: PaymentRequestedEvent) => void;
  /** O cliente aceitou ou recusou uma alteracao proposta. */
  onAlteracaoRespondida?: () => void;
}

export function useKitchenSocket(kitchenSlug: string | undefined, handlers: KitchenEventHandlers) {
  const qc = useQueryClient();

  /**
   * Handlers numa ref, nao nas dependencias.
   *
   * O chamador passa um objeto literal — `useKitchenSocket(slug, { onOrderNew })`
   * — que e novo a cada render. Como dependencia, ele derrubaria e refaria a
   * assinatura do socket a CADA render: o `kitchen:unsubscribe` seguido de
   * `kitchen:subscribe` abre uma janela em que um evento emitido pelo servidor
   * nao chega a ninguem. Numa cozinha, isso e um pedido que nao apita.
   *
   * A ref e atualizada a cada render, entao os callbacks chamados dentro do
   * effect sao sempre os mais recentes, sem que o effect precise rodar de novo.
   */
  const handlersRef = useRef(handlers);

  // A atualizacao vai num effect, NAO no corpo do render: escrever em ref
  // durante o render e invalido sob render concorrente, onde o React pode
  // executar e descartar um render — a escrita vazaria mesmo assim.
  // Sem array de dependencia: roda depois de todo render, mantendo a ref atual.
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (!kitchenSlug) return;
    // Sem JWT o servidor recusa o handshake — nao ha o que assinar.
    const socket = getSocket();
    if (!socket) return;
    socket.emit('kitchen:subscribe', kitchenSlug);

    const onNew = (e: OrderNewEvent) => {
      if (e.kitchenSlug !== kitchenSlug) return;
      qc.invalidateQueries({ queryKey: ['fila'] });
      handlersRef.current.onOrderNew?.(e);
    };
    const onStatus = (e: OrderStatusEvent) => {
      qc.invalidateQueries({ queryKey: ['fila'] });
      handlersRef.current.onOrderStatus?.(e);
    };
    const onPayment = (e: PaymentRequestedEvent) => {
      if (e.kitchenSlug !== kitchenSlug) return;
      handlersRef.current.onPaymentRequested?.(e);
    };

    // O cliente respondeu a proposta: ou a cozinha prepara a quantidade
    // reduzida, ou para de preparar o que foi recusado. Precisa chegar na hora.
    const onResposta = () => {
      qc.invalidateQueries({ queryKey: ['fila'] });
      handlersRef.current.onAlteracaoRespondida?.();
    };

    socket.on('order:new', onNew);
    socket.on('order:status', onStatus);
    socket.on('payment:requested', onPayment);
    socket.on('order:alteracao-respondida', onResposta);

    return () => {
      socket.emit('kitchen:unsubscribe', kitchenSlug);
      socket.off('order:new', onNew);
      socket.off('order:status', onStatus);
      socket.off('payment:requested', onPayment);
      socket.off('order:alteracao-respondida', onResposta);
    };
    // So o slug e o queryClient: com a ref, os handlers nao precisam entrar.
  }, [kitchenSlug, qc]);
}

// ─── Cardápio ────────────────────────────────────────────────────────────────

export function useCardapio() {
  return useQuery({
    queryKey: ['cardapio'],
    queryFn: async () => (await api.get<CardapioResponse>('/api/r/cardapio')).data,
    staleTime: 60_000,
  });
}

export function useCriarItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CriarItemCardapioInput) =>
      (await api.post<ItemCardapio>('/api/r/cardapio', input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cardapio'] }),
  });
}

export function useEditarItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string } & EditarItemCardapioInput) =>
      (await api.patch<ItemCardapio>(`/api/r/cardapio/${id}`, body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cardapio'] }),
  });
}

/**
 * "Excluir" do ponto de vista de quem usa; ARQUIVAR no banco.
 *
 * O item some do cardápio mas continua existindo, porque os pedidos antigos
 * apontam pra ele — apagar de verdade levaria o histórico junto.
 */
export function useExcluirItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/api/r/cardapio/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cardapio'] }),
  });
}

// ─── Perfil público ──────────────────────────────────────────────────────────

export function usePerfil() {
  return useQuery({
    queryKey: ['perfil'],
    queryFn: async () => (await api.get<PerfilCozinhaResponse>('/api/r/perfil')).data,
    staleTime: 60_000,
  });
}

export function useSalvarPerfil() {
  const qc = useQueryClient();
  const setMe = useAuth((s) => s.setMe);
  const me = useAuth((s) => s.me);
  return useMutation({
    mutationFn: async (input: PerfilCozinhaInput) =>
      (await api.patch<PerfilCozinhaResponse>('/api/r/perfil', input)).data,
    onSuccess: (perfil) => {
      qc.invalidateQueries({ queryKey: ['perfil'] });
      // O cabeçalho lê o nome do cache de auth. Sem isto ele mostraria o nome
      // antigo até o próximo /me — que só acontece ao recarregar a página.
      if (me) setMe({ ...me, kitchen: { ...me.kitchen, ...perfil } });
    },
  });
}

// ─── Histórico e métricas ────────────────────────────────────────────────────

export function useHistorico(dias = 1) {
  return useQuery({
    queryKey: ['historico', dias],
    queryFn: async () => (await api.get<HistoricoResponse>(`/api/r/historico?dias=${dias}`)).data,
    // O histórico só muda quando um pedido sai da fila, e a fila já invalida
    // isso — polling aqui seria varrer o banco à toa.
    staleTime: 30_000,
  });
}

export function useMetricas(dias = 7) {
  return useQuery({
    queryKey: ['metricas', dias],
    queryFn: async () => (await api.get<MetricasResponse>(`/api/r/metricas?dias=${dias}`)).data,
    staleTime: 5 * 60_000,
  });
}

// ─── Fotos do item ───────────────────────────────────────────────────────────

/**
 * Envia uma foto. `FormData` e **sem** `Content-Type` manual: o navegador
 * precisa gerar o boundary do multipart sozinho, e escrever o cabeçalho na mão
 * produz um corpo que o servidor não consegue separar.
 */
export function useEnviarFoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, arquivo }: { itemId: string; arquivo: File }) => {
      const form = new FormData();
      form.append('file', arquivo);
      return (await api.post<FotoDoItem>(`/api/r/cardapio/${itemId}/fotos`, form)).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cardapio'] }),
  });
}

export function useExcluirFoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, fotoId }: { itemId: string; fotoId: string }) =>
      (await api.delete(`/api/r/cardapio/${itemId}/fotos/${fotoId}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cardapio'] }),
  });
}

export function useDefinirCapa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, fotoId }: { itemId: string; fotoId: string }) =>
      (await api.patch(`/api/r/cardapio/${itemId}/fotos/${fotoId}/capa`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cardapio'] }),
  });
}

// ─── Convite (rotas públicas) ────────────────────────────────────────────────

/**
 * O convite, antes de aceitar.
 *
 * `retry: false` porque os erros aqui são definitivos — expirado, já aceito,
 * inexistente. Repetir só faria a pessoa esperar para ver a mesma recusa.
 */
export function useConvite(token: string) {
  return useQuery({
    queryKey: ['convite', token],
    queryFn: async () => (await api.get<ConvitePublicoResponse>(`/api/convite/${token}`)).data,
    enabled: token !== '',
    retry: false,
    staleTime: Infinity,
  });
}

export function useAceitarConvite() {
  const qc = useQueryClient();
  const setMe = useAuth((s) => s.setMe);
  return useMutation({
    mutationFn: async ({ token, ...body }: { token: string; password: string; name?: string }) =>
      (await api.post<AceitarConviteResponse>(`/api/convite/${token}/aceitar`, body)).data,
    onSuccess: (data) => {
      // Já entra logado: a pessoa acabou de escolher a senha, mandá-la pro
      // login seria pedir de novo o que ela digitou há dois segundos.
      setToken(data.token);
      setMe(null);
      qc.invalidateQueries();
    },
  });
}

// ─── Esqueci minha senha ─────────────────────────────────────────────────────

export function usePedirRecuperacao() {
  return useMutation({
    mutationFn: async (email: string) => (await api.post('/api/r/auth/recuperar', { email })).data,
  });
}

export function useAcesso(token: string) {
  return useQuery({
    queryKey: ['acesso', token],
    queryFn: async () => (await api.get<PrimeiroAcessoResponse>(`/api/acesso/${token}`)).data,
    enabled: token !== '',
    // Os erros aqui são definitivos — expirado, já usado, inexistente.
    retry: false,
    staleTime: Infinity,
  });
}

export function useDefinirSenha() {
  const qc = useQueryClient();
  const setMe = useAuth((s) => s.setMe);
  return useMutation({
    mutationFn: async ({ token, password }: { token: string; password: string }) =>
      (await api.post<DefinirSenhaResponse>(`/api/acesso/${token}/senha`, { password })).data,
    onSuccess: (data) => {
      setToken(data.token);
      // O /me completo vem no próximo carregamento; aqui só limpa o cache
      // antigo pra não mostrar a cozinha de quem estava logado antes.
      setMe(null);
      if (data.app === 'cozinha') qc.invalidateQueries();
    },
  });
}
