import webpush, { WebPushError } from 'web-push';
import type { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';
import { env } from './env.js';
import { pushEnviados, pushRemovidos } from '../plugins/observabilidade.js';

/**
 * Web Push — o aviso que chega com o app fechado.
 *
 * **DESLIGADO POR PADRÃO.** Sem par VAPID nada sai, nenhuma requisição de rede
 * acontece e nada quebra: o aviso in-app (socket + som + vibração) continua
 * igual, e a tela do app simplesmente não oferece o botão. Mesma escolha do
 * Resend e do Sentry.
 *
 * ─── ISTO NUNCA PODE DERRUBAR UM PEDIDO ─────────────────────────────────────
 *
 * `avisarCozinha` não lança, nunca. Quando ela roda, o pedido JÁ ESTÁ NO BANCO
 * e o `order:new` JÁ FOI pelo socket — o aviso é a terceira camada, não a
 * primeira. Deixar uma falha do Google Cloud Messaging virar 500 na criação de
 * pedido trocaria um aviso perdido por uma venda perdida.
 *
 * Pelo mesmo motivo quem chama NÃO deve dar `await`: são requisições HTTP para
 * um serviço de terceiro, uma por aparelho, no caminho mais quente do sistema.
 * O jeito certo de chamar é `void avisarCozinha(...)`.
 */

let configurado = false;

/** `true` quando há par VAPID — a rota usa pra decidir o que responder. */
export function pushAtivo(): boolean {
  return Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
}

/** A chave que o navegador precisa pra se inscrever. `null` = push desligado. */
export function chavePublica(): string | null {
  return pushAtivo() ? env.VAPID_PUBLIC_KEY! : null;
}

/**
 * Configura o `web-push` na primeira necessidade, não no import.
 *
 * No import isto rodaria em todo teste e em todo script de banco, que não têm
 * VAPID nenhum e não mandam push nenhum.
 */
function garantirConfigurado(): boolean {
  if (!pushAtivo()) return false;
  if (!configurado) {
    webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);
    configurado = true;
  }
  return true;
}

/**
 * O que chega no aparelho. Vai cifrado de ponta a ponta — nem o serviço de
 * push lê — mas ainda assim é DADO DE OPERAÇÃO numa tela bloqueada, que
 * qualquer um por perto enxerga. Por isso nada de nome de cliente aqui.
 */
export interface AvisoPush {
  titulo: string;
  corpo: string;
  /**
   * Agrupa avisos no aparelho: um `tag` repetido SUBSTITUI o anterior em vez
   * de empilhar. Três pedidos em dois minutos viram três linhas na bandeja se
   * a tag for única por pedido, e uma linha só se for fixa — a escolha está em
   * quem chama.
   */
  tag: string;
  /** Rota do app aberta no clique. Relativa: o SW resolve contra a origem. */
  url: string;
}

/** Motivo do aviso, só pro rótulo da métrica. */
export type MotivoPush = 'pedido-novo' | 'fechar-conta';

/**
 * Manda o aviso pra todos os aparelhos inscritos de uma cozinha.
 *
 * Devolve quantos foram aceites. Não lança em nenhuma hipótese.
 */
export async function avisarCozinha(
  kitchenId: string,
  motivo: MotivoPush,
  aviso: AvisoPush,
): Promise<number> {
  if (!garantirConfigurado()) return 0;

  let inscricoes;
  try {
    inscricoes = await prisma.pushSubscription.findMany({
      where: { kitchenId },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    });
  } catch {
    // Banco fora do ar. Quem chamou já respondeu ao cliente; não há a quem
    // contar, e propagar daqui não salvaria nada.
    return 0;
  }

  if (inscricoes.length === 0) return 0;

  const corpo = JSON.stringify(aviso);
  const mortas: string[] = [];
  const vivas: string[] = [];

  // Em paralelo, e com `allSettled`: um aparelho que demora não pode segurar o
  // aviso dos outros, e um que falha não pode cancelar o lote.
  const resultados = await Promise.allSettled(
    inscricoes.map((i) =>
      webpush.sendNotification(
        { endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } },
        corpo,
        {
          // TTL curto: aviso de cozinha vale AGORA. Se o aparelho está
          // desligado há uma hora, entregar "pedido novo" quando ele voltar
          // manda a pessoa procurar um pedido que já saiu.
          TTL: 15 * 60,
          urgency: 'high',
        },
      ),
    ),
  );

  resultados.forEach((r, idx) => {
    if (r.status === 'fulfilled') {
      vivas.push(inscricoes[idx].id);
      return;
    }
    const erro = r.reason;
    if (erro instanceof WebPushError && ehInscricaoMorta(erro.statusCode)) {
      mortas.push(inscricoes[idx].id);
    }
    // Outros erros (500 do serviço, rede) NÃO apagam nada: seria jogar fora um
    // aparelho bom por causa de uma indisponibilidade de dez minutos.
  });

  if (vivas.length > 0) {
    pushEnviados.inc({ motivo }, vivas.length);
    // `lastOkAt` so existe se alguem escrever. Sem isto a coluna fica NULL
    // pra sempre e a pergunta que ela responde — "este aparelho ainda
    // recebe?" — nao tem resposta. Fora do await: e observabilidade, nao
    // pode atrasar nem derrubar o envio.
    void prisma.pushSubscription
      .updateMany({ where: { id: { in: vivas } }, data: { lastOkAt: new Date() } })
      .catch(() => {});
  }

  if (mortas.length > 0) {
    try {
      await prisma.pushSubscription.deleteMany({ where: { id: { in: mortas } } });
      pushRemovidos.inc(mortas.length);
    } catch {
      // Sobrou lixo no banco. Na próxima tentativa dá o mesmo erro e some.
    }
  }

  return vivas.length;
}

/**
 * Quando o serviço de push diz que esta inscrição não existe mais.
 *
 *   404 / 410 — o aparelho cancelou, desinstalou ou o navegador rotacionou a
 *               chave. É o caso comum e esperado.
 *   401 / 403 — a assinatura VAPID não confere. Na prática significa que o par
 *               de chaves do servidor mudou; as inscrições antigas nunca mais
 *               vão funcionar, então guardá-las só faria o erro se repetir a
 *               cada pedido, pra sempre.
 */
function ehInscricaoMorta(status: number): boolean {
  return status === 404 || status === 410 || status === 401 || status === 403;
}

/**
 * Apaga as inscrições de uma pessoa. Chamado na troca de senha.
 *
 * Trocar a senha derruba os JWT (ver `tokenVersion`), mas push não usa JWT: a
 * inscrição vive no serviço do navegador e não expira sozinha. Sem isto, o
 * aparelho de quem saiu da equipe continuaria recebendo os pedidos da cozinha
 * para sempre — que é exatamente o que a troca de senha existe pra impedir.
 *
 * Recebe a TRANSAÇÃO, não o `prisma` global: apagar as inscrições precisa
 * valer — ou não valer — junto com a troca da senha. Fora da transação, um
 * erro no meio deixaria a pessoa com a senha antiga e sem push.
 */
export async function apagarInscricoesDe(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<number> {
  const { count } = await tx.pushSubscription.deleteMany({ where: { userId } });
  return count;
}
