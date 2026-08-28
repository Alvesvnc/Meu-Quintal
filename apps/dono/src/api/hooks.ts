import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AcordoInput,
  CobrancaLinha,
  ConviteCozinhaInput,
  ConviteResponse,
  CozinhaResumo,
  DesempenhoMesasResponse,
  DonoLoginResponse,
  DonoMeResponse,
  FinanceiroResponse,
  MesaResumo,
  OverviewResponse,
  PrimeiroAcessoResponse,
  DefinirSenhaResponse,
  AssinaturaResponse,
  CheckoutResponse,
} from '@mq/shared';
import { api, setToken } from './client';
import { useAuth, useEspacoAtual } from '../stores/auth';

/**
 * Todas as leituras deste app são escopadas por quintal (`?espaco=`). O helper
 * existe para que nenhuma tela esqueça: sem o parâmetro o servidor devolve o
 * primeiro espaço da conta, e numa conta com dois quintais a tela mostraria o
 * quintal errado sem avisar ninguém.
 */
function comEspaco(espaco: string | null, extra: Record<string, string> = {}) {
  const p = new URLSearchParams(extra);
  if (espaco) p.set('espaco', espaco);
  const q = p.toString();
  return q ? `?${q}` : '';
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export function useLogin() {
  const qc = useQueryClient();
  const setMe = useAuth((s) => s.setMe);
  return useMutation({
    mutationFn: async (input: { email: string; password: string }) =>
      (await api.post<DonoLoginResponse>('/api/a/auth/login', input)).data,
    onSuccess: (data) => {
      setToken(data.token);
      setMe(data.me);
      qc.invalidateQueries();
    },
  });
}

export function useMe() {
  const setMe = useAuth((s) => s.setMe);
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const data = (await api.get<DonoMeResponse>('/api/a/auth/me')).data;
      setMe(data);
      return data;
    },
    staleTime: 5 * 60_000,
    retry: false,
  });
}

// ─── Visão geral ─────────────────────────────────────────────────────────────

export function useOverview() {
  const espaco = useEspacoAtual();
  return useQuery({
    queryKey: ['overview', espaco],
    queryFn: async () =>
      (await api.get<OverviewResponse>(`/api/a/overview${comEspaco(espaco)}`)).data,
    // Números do dia: refrescam sozinhos sem precisar de socket.
    refetchInterval: 60_000,
  });
}

// ─── Cozinhas ────────────────────────────────────────────────────────────────

export function useCozinhas() {
  const espaco = useEspacoAtual();
  return useQuery({
    queryKey: ['cozinhas', espaco],
    queryFn: async () =>
      (await api.get<CozinhaResumo[]>(`/api/a/cozinhas${comEspaco(espaco)}`)).data,
    refetchInterval: 60_000,
  });
}

export function useSalvarAcordo() {
  const qc = useQueryClient();
  const espaco = useEspacoAtual();
  return useMutation({
    mutationFn: async ({ slug, acordo }: { slug: string; acordo: AcordoInput }) =>
      (await api.patch(`/api/a/cozinhas/${slug}/acordo${comEspaco(espaco)}`, acordo)).data,
    onSuccess: () => {
      // O acordo decide o que aparece de faturamento — invalida tudo que mostra
      // dinheiro, nao so a lista de cozinhas.
      qc.invalidateQueries({ queryKey: ['cozinhas'] });
      qc.invalidateQueries({ queryKey: ['financeiro'] });
      qc.invalidateQueries({ queryKey: ['overview'] });
      qc.invalidateQueries({ queryKey: ['desempenho'] });
    },
  });
}

export function useConvidarCozinha() {
  const qc = useQueryClient();
  const espaco = useEspacoAtual();
  return useMutation({
    mutationFn: async (input: ConviteCozinhaInput) =>
      (await api.post<ConviteResponse>(`/api/a/cozinhas/convite${comEspaco(espaco)}`, input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cozinhas'] }),
  });
}

// ─── Financeiro ──────────────────────────────────────────────────────────────

export function useFinanceiro(refMonth?: string) {
  const espaco = useEspacoAtual();
  return useQuery({
    queryKey: ['financeiro', espaco, refMonth ?? 'atual'],
    queryFn: async () =>
      (
        await api.get<FinanceiroResponse>(
          `/api/a/financeiro${comEspaco(espaco, refMonth ? { refMonth } : {})}`,
        )
      ).data,
  });
}

export function useFecharCiclo() {
  const qc = useQueryClient();
  const espaco = useEspacoAtual();
  return useMutation({
    mutationFn: async (refMonth: string) =>
      (await api.post(`/api/a/financeiro/fechar${comEspaco(espaco)}`, { refMonth })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['financeiro'] }),
  });
}

export function useMarcarCobranca() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      status,
      note,
    }: {
      id: string;
      status: CobrancaLinha['status'];
      note?: string;
    }) => (await api.patch(`/api/a/cobrancas/${id}`, { status, note })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['financeiro'] }),
  });
}

// ─── Mesas ───────────────────────────────────────────────────────────────────

export function useMesas() {
  const espaco = useEspacoAtual();
  return useQuery({
    queryKey: ['mesas', espaco],
    queryFn: async () => (await api.get<MesaResumo[]>(`/api/a/mesas${comEspaco(espaco)}`)).data,
    // Visao do salao AGORA: quem esta ocupada, quem precisa limpar.
    refetchInterval: 30_000,
  });
}

export function useMudarStatusMesa() {
  const qc = useQueryClient();
  const espaco = useEspacoAtual();
  return useMutation({
    mutationFn: async ({ numero, status }: { numero: number; status: MesaResumo['status'] }) =>
      (await api.patch(`/api/a/mesas/${numero}${comEspaco(espaco)}`, { status })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mesas'] }),
  });
}

/**
 * Ranking de desempenho das mesas no período.
 *
 * Não refetcha sozinho: varre um mês inteiro e é consulta de decisão, não de
 * operação. Deixar em polling gastaria banco para responder à mesma pergunta.
 */
export function useDesempenhoMesas(refMonth?: string) {
  const espaco = useEspacoAtual();
  return useQuery({
    queryKey: ['desempenho', espaco, refMonth ?? 'atual'],
    queryFn: async () =>
      (
        await api.get<DesempenhoMesasResponse>(
          `/api/a/mesas/desempenho${comEspaco(espaco, refMonth ? { refMonth } : {})}`,
        )
      ).data,
    staleTime: 5 * 60_000,
  });
}

// ─── Primeiro acesso (rotas públicas) ────────────────────────────────────────

export function usePrimeiroAcesso(token: string) {
  return useQuery({
    queryKey: ['primeiro-acesso', token],
    queryFn: async () => (await api.get<PrimeiroAcessoResponse>(`/api/acesso/${token}`)).data,
    enabled: token !== '',
    // Os erros aqui são definitivos — expirado, já usado, inexistente. Repetir
    // só faria a pessoa esperar para ver a mesma recusa.
    retry: false,
    staleTime: Infinity,
  });
}

/**
 * Esqueci minha senha.
 *
 * A resposta e sempre `ok`, exista o email ou nao — quem responde assim e o
 * servidor, de proposito. A tela nao tem como (nem deve) dizer mais.
 */
export function usePedirRecuperacao() {
  return useMutation({
    mutationFn: async (email: string) =>
      (await api.post('/api/a/auth/recuperar', { email })).data,
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
      // O mesmo endereco serve dono e cozinha. Neste app so chega link de
      // dono, mas o tipo e uma uniao — sem a checagem o TS nao deixa ler `me`,
      // e a checagem tambem protege de um link trocado por engano.
      if (data.app === 'dono') setMe(data.me);
      qc.invalidateQueries();
    },
  });
}

// ─── Assinatura do QRO ───────────────────────────────────────────────────────
//
// O dono pagando A NÓS. Nada a ver com /api/a/financeiro, que é o dono cobrando
// as cozinhas dele.

export function useAssinatura() {
  return useQuery({
    queryKey: ['assinatura'],
    queryFn: async () => (await api.get<AssinaturaResponse>('/api/a/assinatura')).data,
    // Curto: quem volta do provedor precisa ver o estado novo, e o webhook leva
    // alguns segundos pra chegar.
    staleTime: 10_000,
  });
}

/**
 * Abre o checkout e MANDA a pessoa pra página do provedor.
 *
 * O redirecionamento acontece aqui dentro, e não na tela, porque o link vale
 * uma hora e serve a uma sessão só: guardá-lo em estado pra usar depois faria a
 * pessoa cair num link morto.
 */
export function useAssinar() {
  return useMutation({
    mutationFn: async () =>
      (await api.post<CheckoutResponse>('/api/a/assinatura/checkout')).data,
    onSuccess: (data) => {
      window.location.href = data.link;
    },
  });
}

export function useCancelarAssinatura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.delete('/api/a/assinatura')).data,
    // O estado real vem do webhook, que chega depois. Invalidar aqui só faz a
    // tela buscar de novo — se ainda não chegou, ela continua mostrando o
    // estado anterior, que é a verdade naquele instante.
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assinatura'] }),
  });
}
