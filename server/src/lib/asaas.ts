import { env } from './env.js';

/**
 * Cliente HTTP do Asaas.
 *
 * **DESLIGADO POR PADRÃO.** Com `ASAAS_API_KEY` vazia nada aqui sai da máquina:
 * `pagamentoAtivo()` responde `false` e quem chama decide o que dizer. Mesma
 * escolha do Resend e do Sentry — integração pronta, custo zero até alguém
 * colar a chave.
 *
 * Esta é toda a superfície do provedor. Trocar de provedor um dia é reescrever
 * este arquivo, não caçar `fetch` espalhado pelo servidor — mesma disciplina do
 * `lib/armazenamento.ts`.
 *
 * ─── O CARTÃO NUNCA PASSA POR AQUI ──────────────────────────────────────────
 *
 * Usamos o checkout HOSPEDADO: criamos uma sessão, o pagador vai pra página do
 * Asaas e digita o cartão lá. Número de cartão não toca neste servidor, não
 * entra em log, não vira incidente. Foi por isso que o checkout hospedado ganhou
 * do transparente — o transparente é mais bonito e coloca dado de cartão no meu
 * processo.
 *
 * Pelo mesmo motivo NÃO mandamos `customerData.cpfCnpj`: é opcional, e o Asaas
 * coleta na página dele. Documento de cliente que eu não guardo é documento que
 * eu não vazo.
 */

const BASES = {
  sandbox: 'https://api-sandbox.asaas.com/v3',
  producao: 'https://api.asaas.com/v3',
} as const;

/** `true` quando há chave configurada. */
export function pagamentoAtivo(): boolean {
  return Boolean(env.ASAAS_API_KEY);
}

/** Pra tela e pro log dizerem contra qual ambiente estão falando. */
export function ambienteAsaas(): 'sandbox' | 'producao' {
  return env.ASAAS_AMBIENTE;
}

export class ErroAsaas extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** Corpo cru da resposta, pro log. NUNCA vai pra resposta HTTP. */
    readonly corpo?: unknown,
  ) {
    super(message);
    this.name = 'ErroAsaas';
  }
}

/**
 * Prazo pra desistir. Sem ele, uma instabilidade do provedor viraria requisição
 * pendurada segurando um worker — e o dono olhando pra um botão que gira.
 */
const TIMEOUT_MS = 15_000;

async function chamar<T>(caminho: string, init: RequestInit): Promise<T> {
  const chave = env.ASAAS_API_KEY;
  if (!chave) throw new ErroAsaas('ASAAS_API_KEY vazia: pagamento desligado.', 503);

  let resposta: Response;
  try {
    resposta = await fetch(`${BASES[env.ASAAS_AMBIENTE]}${caminho}`, {
      ...init,
      headers: {
        // Não é `Authorization: Bearer` — o Asaas usa header próprio.
        access_token: chave,
        'Content-Type': 'application/json',
        ...init.headers,
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    // Rede fora, DNS, timeout. A mensagem não carrega nada do request pra não
    // arrastar a chave pro log.
    throw new ErroAsaas(`Falha de rede ao falar com o Asaas: ${(err as Error).message}`, 502);
  }

  const texto = await resposta.text();
  let corpo: unknown;
  try {
    corpo = texto ? JSON.parse(texto) : null;
  } catch {
    corpo = texto;
  }

  if (!resposta.ok) {
    // O Asaas devolve { errors: [{ code, description }] }.
    const erros = (corpo as { errors?: Array<{ description?: string }> } | null)?.errors;
    const descricao = erros?.map((e) => e.description).filter(Boolean).join('; ');
    throw new ErroAsaas(descricao || `Asaas respondeu ${resposta.status}`, resposta.status, corpo);
  }

  return corpo as T;
}

// ─── Criar checkout ─────────────────────────────────────────────────────────

export interface NovoCheckout {
  /**
   * Nosso id da conta. Vai como `externalReference` e volta nos eventos de
   * assinatura — é uma das pistas que o webhook usa pra saber de quem é.
   */
  referencia: string;
  /** Aparece na página de pagamento e na fatura. */
  descricao: string;
  /** EM CENTAVOS. A conversão pra reais acontece aqui dentro, num lugar só. */
  valorCents: number;
  nome?: string;
  email?: string;
  /** Vencimento da primeira mensalidade. As seguintes o Asaas gera sozinho. */
  primeiroVencimento: Date;
  urlSucesso: string;
  urlCancelado: string;
  urlExpirado: string;
}

export interface CheckoutCriado {
  id: string;
  /** Página hospedada. É pra cá que o dono é mandado. */
  link: string;
  expiraEm: Date;
}

/** Quanto tempo o link vale. O Asaas aceita de 10 a 1440. */
const MINUTOS_PRA_EXPIRAR = 60;

/** `YYYY-MM-DD`, que é como o Asaas espera datas de vencimento. */
function dataSimples(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Abre uma sessão de checkout com assinatura mensal recorrente.
 *
 * `chargeTypes: ['RECURRENT']` é o que faz o Asaas criar uma ASSINATURA quando
 * o pagamento conclui, em vez de uma cobrança avulsa. Sem isso o cliente pagaria
 * uma vez e nunca mais — e ninguém perceberia até o mês seguinte não cair nada.
 */
export async function criarCheckout(dados: NovoCheckout): Promise<CheckoutCriado> {
  const resposta = await chamar<{ id: string; link: string }>('/checkouts', {
    method: 'POST',
    body: JSON.stringify({
      // Só estes dois. Boleto ficou de fora de propósito: não debita sozinho,
      // então todo mês o cliente precisa agir — é rotatividade autoinfligida.
      billingTypes: ['PIX', 'CREDIT_CARD'],
      chargeTypes: ['RECURRENT'],
      minutesToExpire: MINUTOS_PRA_EXPIRAR,
      externalReference: dados.referencia,
      callback: {
        successUrl: dados.urlSucesso,
        cancelUrl: dados.urlCancelado,
        expiredUrl: dados.urlExpirado,
      },
      items: [
        {
          name: dados.descricao,
          description: dados.descricao,
          quantity: 1,
          // O ASAAS FALA EM REAIS, NÓS FALAMOS EM CENTAVOS. Esta divisão é o
          // único lugar onde as duas unidades se encontram; mandar centavos
          // cru cobraria cem vezes o preço.
          value: dados.valorCents / 100,
        },
      ],
      subscription: {
        cycle: 'MONTHLY',
        nextDueDate: dataSimples(dados.primeiroVencimento),
      },
      // Só o que já temos. `cpfCnpj` fica de fora — ver o cabeçalho.
      ...(dados.nome || dados.email
        ? { customerData: { ...(dados.nome ? { name: dados.nome } : {}), ...(dados.email ? { email: dados.email } : {}) } }
        : {}),
    }),
  });

  return {
    id: resposta.id,
    link: resposta.link,
    expiraEm: new Date(Date.now() + MINUTOS_PRA_EXPIRAR * 60 * 1000),
  };
}

// ─── Cancelar assinatura ────────────────────────────────────────────────────

/**
 * Cancela a assinatura no provedor.
 *
 * Cancelar aqui NÃO tranca a conta — ver `lib/assinatura.ts`, "por que cancelar
 * não tranca a porta". Quem cancela para de ser cobrado e continua entrando pra
 * ver o que tinha e, se quiser, assinar de novo.
 */
export async function cancelarAssinatura(id: string): Promise<void> {
  await chamar(`/subscriptions/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
