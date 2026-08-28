import type { PrismaClient } from '@prisma/client';
import { env } from './env.js';

/**
 * Suspensão das contas cujo teste grátis acabou sem virar assinatura.
 *
 * ─── O BURACO QUE ISTO FECHA ────────────────────────────────────────────────
 *
 * `Account.trialEndsAt` era ESCRITO pelo bootstrap e EXIBIDO na tela
 * — e mais nada no sistema olhava pra ele. Passado o prazo, a conta continuava
 * funcionando igual, pra sempre. Enquanto não havia cobrança isso era
 * inofensivo; com cobrança, virou o caminho mais curto pra usar de graça:
 * bastava nunca clicar em "Assinar".
 *
 * ─── SUSPENDER, NÃO CANCELAR ────────────────────────────────────────────────
 *
 * A conta vai pra `suspensa`: a pessoa entra, vê tudo o que montou, e não
 * consegue alterar nada até assinar. `cancelada` bloquearia o LOGIN, e trancar
 * do lado de fora quem acabou de terminar o teste é a melhor forma de nunca
 * receber daquele cliente. Mesma regra do webhook — ver `lib/assinatura.ts`,
 * "por que cancelar não tranca a porta".
 *
 * ─── SEGURANÇA COM VÁRIAS RÉPLICAS ──────────────────────────────────────────
 *
 * Rodar em toda réplica é o esperado. O `updateMany` condicional (`status:
 * 'ativa'` no where) é a trava: quem chega primeiro leva `count: 1`, quem chega
 * depois leva `count: 0` e nada acontece duas vezes. Não há lock distribuído
 * nem necessidade dele — mesma disciplina do `lib/expiracao.ts`.
 */

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Até quando vai o teste de uma conta NOVA.
 *
 * ─── É AQUI QUE O TESTE LIGA E DESLIGA ──────────────────────────────────────
 *
 * `TRIAL_DIAS=0` desliga: a conta nasce com o teste já vencido e a primeira
 * varredura a suspende. A pessoa entra, vê tudo, e não altera nada até assinar
 * — que é o modelo "paga pra começar".
 *
 * `TRIAL_DIAS=7` (padrão) dá uma semana. Uma semana cobre um ciclo completo de
 * restaurante, com fim de semana dentro, que é quando o salão enche e o sistema
 * mostra pra que serve.
 *
 * ─── QUANDO O PAINEL EXISTIR ────────────────────────────────────────────────
 *
 * É ESTA função que passa a ler do banco em vez do env, e mais nada muda: o
 * bootstrap chama `fimDoTrial()` sem argumento e não sabe de onde veio o
 * número. Mesma disciplina do `lib/armazenamento.ts` — trocar a origem é
 * reescrever um lugar, não caçar a regra espalhada.
 *
 * O parâmetro `dias` existe pra isso e pra teste; ninguém em produção passa.
 *
 * ─── E O `null` NA COLUNA? ──────────────────────────────────────────────────
 *
 * `Account.trialEndsAt` aceita NULL, e NULL quer dizer OUTRA coisa: "esta conta
 * nunca é suspensa por teste" — cortesia, sócio, conta interna. É decisão por
 * conta, não configuração global, e por isso não sai daqui. A varredura ignora
 * NULL de propósito (ver o filtro abaixo).
 */
export function fimDoTrial(agora: Date = new Date(), dias: number = env.TRIAL_DIAS): Date {
  return new Date(agora.getTime() + dias * DIA_MS);
}

/** `false` quando `TRIAL_DIAS=0`. Serve pro bootstrap dizer o que fez. */
export function trialLigado(dias: number = env.TRIAL_DIAS): boolean {
  return dias > 0;
}

export interface ResultadoDoTrial {
  /** Quantas contas se qualificaram na leitura. */
  encontradas: number;
  /** Quantas foram de fato suspensas (0 quando outra réplica chegou antes). */
  suspensas: number;
}

/**
 * Teto por rodada.
 *
 * Se algo represar — processo fora do ar por dias, ou uma leva grande de
 * trials vencendo junto — a volta não tenta tratar tudo de uma vez e travar o
 * event loop. O que sobrar é pego na rodada seguinte.
 */
const POR_RODADA = 200;

/**
 * Varre e suspende as contas com teste vencido e sem assinatura em dia.
 *
 * Separada do agendador pra poder ser chamada em teste e, se preciso, à mão.
 */
export async function varrerTrialsVencidos(
  prisma: PrismaClient,
  agora: Date = new Date(),
): Promise<ResultadoDoTrial> {
  const vencidas = await prisma.account.findMany({
    where: {
      // Só quem está liberada. Conta já `suspensa` não precisa ser suspensa de
      // novo, e `cancelada` NUNCA pode ser tocada por tarefa automática —
      // cancelar é decisão humana deliberada.
      status: 'ativa',

      // `not: null` É OBRIGATÓRIO, e é o detalhe que mais fácil se perde.
      //
      // `trialEndsAt` é nullable, e null significa "esta conta não tem teste"
      // — é o caso de quem foi cadastrado direto como cliente pagante. Sem esta
      // condição, o Postgres compara NULL < agora, o resultado é NULL, a linha
      // não casa... hoje. Mas basta alguém trocar o operador ou montar o filtro
      // de outro jeito pra "sem trial" virar "trial vencido em 1970" e suspender
      // justamente quem paga. Deixar explícito custa uma linha.
      trialEndsAt: { not: null, lt: agora },

      // E não pode ter assinatura em dia. Quem assinou não está mais em teste,
      // mesmo que a data do teste já tenha passado.
      OR: [
        // Nunca abriu checkout nenhum.
        { assinatura: { is: null } },
        // Abriu, mas não está pagando: `aguardando` (não concluiu),
        // `atrasada` ou `encerrada`. Todos são "não pagou".
        { assinatura: { status: { not: 'ativa' } } },
      ],
    },
    select: { id: true, slug: true, trialEndsAt: true },
    take: POR_RODADA,
  });

  let suspensas = 0;

  for (const conta of vencidas) {
    // A CONDIÇÃO É A TRAVA. Entre a leitura acima e esta escrita, o webhook do
    // provedor pode ter confirmado um pagamento e reativado a conta — suspender
    // por cima disso cortaria justamente quem acabou de pagar.
    const { count } = await prisma.account.updateMany({
      where: { id: conta.id, status: 'ativa' },
      data: { status: 'suspensa' },
    });
    if (count > 0) suspensas++;
  }

  return { encontradas: vencidas.length, suspensas };
}
