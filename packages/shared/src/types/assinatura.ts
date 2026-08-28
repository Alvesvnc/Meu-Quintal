/** Contratos da assinatura do QRO (/api/a/assinatura). */

import type { AccountPlan } from './admin';

/**
 * QUEM COBRA QUEM — ler antes de mexer.
 *
 * Há DUAS cobranças neste sistema e elas não se encostam:
 *
 *   1. O DONO cobra as COZINHAS (aluguel/comissão). Isso é `BillingCycle` e
 *      `KitchenCharge`, vive em /api/a/financeiro, e o dinheiro nunca passa
 *      pelo app — cada cozinha acerta no balcão dela.
 *
 *   2. O QRO cobra o DONO (a mensalidade do SaaS). É isto aqui. Esse
 *      dinheiro passa por um provedor de pagamento de verdade.
 *
 * Confundir as duas seria cobrar a pessoa errada. Os nomes foram escolhidos pra
 * não colidir: lá é "cobrança/ciclo", aqui é "assinatura".
 */

/**
 * Em que pé está a assinatura da conta.
 *
 * Não é o mesmo que `AccountStatus`: aquele diz o que a conta PODE FAZER
 * (`suspensa` bloqueia escrita), este diz o que aconteceu com o PAGAMENTO. Um
 * deriva do outro — ver `server/src/lib/assinatura.ts`.
 */
export type AssinaturaStatus =
  /** Nunca assinou. É o estado de quem está em trial ou foi cadastrado na mão. */
  | 'nenhuma'
  /** Checkout criado, pagador ainda não concluiu. Expira sozinho. */
  | 'aguardando'
  /** Pagando em dia. */
  | 'ativa'
  /** Venceu e não pagou. A conta vira `suspensa` — lê, não escreve. */
  | 'atrasada'
  /** Assinatura encerrada (pelo cliente ou por nós). */
  | 'encerrada';

export interface AssinaturaResponse {
  status: AssinaturaStatus;
  plan: AccountPlan;
  /** Como o plano aparece pra quem assina. */
  planoNome: string;
  /** Mensalidade em centavos. `null` quando o preço ainda não foi configurado. */
  precoMensalCents: number | null;
  /**
   * Até quando o período pago vai. `null` quando nunca houve pagamento.
   *
   * É a data que a tela mostra como "sua próxima cobrança" — vem do provedor,
   * não de conta feita aqui, justamente pra não divergir do que foi cobrado.
   */
  proximaCobrancaEm: string | null;
  /** Fim do teste grátis, se houver. Independe da assinatura. */
  trialEndsAt: string | null;
  /**
   * `true` quando dá pra abrir um checkout agora.
   *
   * `false` quando já está ativa (não faz sentido assinar de novo) ou quando o
   * provedor está desligado — ver `pagamentoAtivo`.
   */
  podeAssinar: boolean;
  /**
   * `false` quando não há chave do provedor configurada. A tela usa pra dizer
   * "pagamento ainda não está ligado" em vez de oferecer um botão que falha.
   */
  pagamentoAtivo: boolean;
}

export interface CheckoutResponse {
  /** Pra onde redirecionar o pagador. Página do provedor, não nossa. */
  link: string;
  /** Quando este link deixa de valer. */
  expiraEm: string;
}
