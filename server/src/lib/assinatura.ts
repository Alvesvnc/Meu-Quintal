import type { AccountStatus } from '@prisma/client';
import type { AssinaturaStatus } from '@mq/shared';

/**
 * As regras da assinatura, num lugar só.
 *
 * Aqui não há I/O, não há Prisma e não há `fetch`: só "este evento significa o
 * quê" e "este estado deixa a conta como". É de propósito — é o tipo de regra
 * que, espalhada por rota, diverge sem ninguém notar. O precedente que doeu foi
 * o `aggregateStatus` duplicado, que passou a responder duas coisas diferentes
 * para a mesma pergunta; a lição virou `lib/orderStatus.ts`, `lib/faturamento.ts`
 * e este arquivo.
 *
 * Quem faz o I/O é `modules/webhook-asaas.ts`.
 */

// ─── O que um evento do provedor provoca ────────────────────────────────────

export type Efeito =
  /** Dinheiro entrou. */
  | { tipo: 'ativar' }
  /** Venceu, voltou ou foi contestado. */
  | { tipo: 'atrasar' }
  /** A assinatura acabou. */
  | { tipo: 'encerrar' }
  /** O checkout aberto morreu sem virar pagamento. */
  | { tipo: 'desistir' }
  /** Nada a fazer. O motivo é gravado — evento ignorado em silêncio vira dúvida. */
  | { tipo: 'ignorar'; motivo: string };

/**
 * Traduz o evento do Asaas.
 *
 * ─── EVENTO DESCONHECIDO NÃO É ERRO ─────────────────────────────────────────
 *
 * Cai em `ignorar`, e é assim que tem que ser: o Asaas adiciona evento novo sem
 * avisar, e a fila dele PARA depois de 15 falhas seguidas — com os eventos
 * empilhando e sumindo em 14 dias. Um `throw` aqui num evento que eu nunca vi
 * derrubaria a cobrança inteira, em silêncio, por causa de algo que não me diz
 * respeito.
 */
export function efeitoDoEvento(evento: string): Efeito {
  switch (evento) {
    // ── Entrou dinheiro ─────────────────────────────────────────────────────
    // CONFIRMED = aprovado (cartão autorizado); RECEIVED = compensado na conta.
    // Os dois ativam: segurar o acesso até o dinheiro compensar puniria quem
    // pagou certo, e cartão leva dias pra liquidar.
    case 'PAYMENT_CONFIRMED':
    case 'PAYMENT_RECEIVED':
    case 'CHECKOUT_PAID':
      return { tipo: 'ativar' };

    // ── Deixou de entrar ────────────────────────────────────────────────────
    case 'PAYMENT_OVERDUE':
    case 'PAYMENT_REFUNDED':
    case 'PAYMENT_REVERSED':
    case 'PAYMENT_CHARGEBACK_REQUESTED':
      return { tipo: 'atrasar' };

    // ── Acabou ──────────────────────────────────────────────────────────────
    case 'SUBSCRIPTION_DELETED':
    case 'SUBSCRIPTION_INACTIVATED':
      return { tipo: 'encerrar' };

    // ── O link de pagamento morreu sem virar nada ───────────────────────────
    case 'CHECKOUT_EXPIRED':
    case 'CHECKOUT_CANCELED':
      return { tipo: 'desistir' };

    // ── Conhecidos que NÃO mudam nada ───────────────────────────────────────
    //
    // PAYMENT_CREATED é o mais perigoso da lista. Ele dispara quando o Asaas
    // GERA a mensalidade do mês seguinte — antes de qualquer vencimento. Tratar
    // como "não pago" suspenderia todo cliente adimplente no dia em que a
    // próxima fatura nasce, que é o pior falso positivo possível.
    case 'PAYMENT_CREATED':
      return { tipo: 'ignorar', motivo: 'cobranca gerada, ainda nao vencida' };
    case 'PAYMENT_UPDATED':
      return { tipo: 'ignorar', motivo: 'cobranca alterada, sem efeito no acesso' };
    case 'PAYMENT_DELETED':
      return {
        tipo: 'ignorar',
        motivo: 'cobranca removida; quem encerra e o evento de assinatura',
      };
    case 'PAYMENT_PARTIALLY_REFUNDED':
      // Estorno parcial não diz se a assinatura segue. Registra e deixa pra
      // decisão humana em vez de chutar entre cortar acesso e ignorar.
      return { tipo: 'ignorar', motivo: 'estorno parcial: exige conferencia manual' };
    case 'PAYMENT_CHARGEBACK_DISPUTE':
    case 'PAYMENT_AWAITING_CHARGEBACK_REVERSAL':
      return {
        tipo: 'ignorar',
        motivo: 'disputa em andamento; o acesso ja caiu no CHARGEBACK_REQUESTED',
      };
    case 'CHECKOUT_CREATED':
      return { tipo: 'ignorar', motivo: 'checkout criado por nos mesmos' };
    case 'SUBSCRIPTION_CREATED':
    case 'SUBSCRIPTION_UPDATED':
      // Não ativa: assinatura criada ainda não é assinatura paga. O que ativa é
      // o pagamento. Mas o webhook aproveita este evento pra guardar os ids do
      // provedor — ver `modules/webhook-asaas.ts`.
      return { tipo: 'ignorar', motivo: 'assinatura registrada; quem ativa e o pagamento' };

    default:
      return { tipo: 'ignorar', motivo: `evento desconhecido: ${evento}` };
  }
}

// ─── A máquina de estados ───────────────────────────────────────────────────

/**
 * Aplica o efeito ao estado atual.
 *
 * Pura, e por isso testável linha a linha. As condicionais aqui não são
 * preciosismo: cada uma existe por um jeito concreto de dar errado.
 */
export function aplicarEfeito(atual: AssinaturaStatus, efeito: Efeito): AssinaturaStatus {
  switch (efeito.tipo) {
    case 'ativar':
      return 'ativa';

    case 'atrasar':
      // `encerrada` não volta pra `atrasada`. Cobrança velha de assinatura já
      // encerrada ainda gera OVERDUE, e ressuscitar o estado faria a tela
      // oferecer "regularize" pra quem já saiu.
      return atual === 'encerrada' ? 'encerrada' : 'atrasada';

    case 'encerrar':
      return 'encerrada';

    case 'desistir':
      // SÓ desfaz uma espera. Se estava `atrasada` e abriu um checkout que
      // expirou, continua `atrasada` — deixar cair pra `nenhuma` apagaria a
      // inadimplência e devolveria acesso a quem não pagou.
      return atual === 'aguardando' ? 'nenhuma' : atual;

    case 'ignorar':
      return atual;
  }
}

/**
 * Abrir um checkout.
 *
 * Só marca espera quem não tinha nada. Quem está `atrasada` ou `encerrada`
 * continua aparecendo assim enquanto o pagamento não confirma: o estado precisa
 * refletir o que está pago, não o que foi tentado.
 */
export function aoAbrirCheckout(atual: AssinaturaStatus): AssinaturaStatus {
  return atual === 'nenhuma' ? 'aguardando' : atual;
}

// ─── Como isso mexe no acesso ───────────────────────────────────────────────

/**
 * Em que estado a CONTA fica, dado o estado da assinatura.
 *
 * `null` = não mexer. É o caso de quem nunca assinou: conta em trial e conta
 * criada na mão vivem `ativa`, e derrubá-las por não ter assinatura seria
 * cortar justamente quem ainda está sendo conquistado.
 *
 * ─── POR QUE CANCELAR NÃO TRANCA A PORTA ────────────────────────────────────
 *
 * `encerrada` vira `suspensa`, NUNCA `cancelada`. A diferença não é cosmética:
 * `cancelada` faz o `auth-dono` responder 403 no login. Quem cancelasse a
 * assinatura ficaria trancado do lado de fora — sem ver o que tinha e, pior,
 * sem conseguir assinar de novo. Seria uma armadilha que transforma "quero
 * pausar" em "perdi tudo", e some com o cliente que talvez voltasse.
 *
 * `suspensa` faz o certo: entra, lê, não escreve, e tem um botão pra voltar.
 * `cancelada` fica para decisão deliberada nossa, nunca para um webhook.
 */
export function contaDeveVirar(status: AssinaturaStatus): AccountStatus | null {
  switch (status) {
    case 'ativa':
      return 'ativa';
    case 'atrasada':
    case 'encerrada':
      return 'suspensa';
    case 'nenhuma':
    case 'aguardando':
      return null;
  }
}
