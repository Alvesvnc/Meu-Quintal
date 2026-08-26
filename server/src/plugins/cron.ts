import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { env } from '../lib/env.js';
import { varrerExpiradas } from '../lib/expiracao.js';
import { propostasExpiradas } from './observabilidade.js';

/**
 * Tarefas periódicas do processo.
 *
 * Um `setInterval` dentro do próprio servidor, não um agendador externo. Para o
 * tamanho atual do produto, um serviço de cron separado seria mais peça para
 * manter do que problema resolvido — e a operação em si já é idempotente, então
 * rodar em várias réplicas não duplica trabalho (ver lib/expiracao.ts).
 *
 * Se um dia houver muitas réplicas e a varredura ficar cara, `CRON_ENABLED=false`
 * desliga em todas menos uma.
 */

/**
 * De quanto em quanto tempo varrer.
 *
 * 30s contra um prazo de 5 minutos: no pior caso a proposta é encerrada 30
 * segundos depois de vencer. Mais curto que isso só aumentaria consulta ao
 * banco sem ninguém perceber a diferença.
 */
const INTERVALO_MS = 30_000;

export function setupCron(fastify: FastifyInstance): void {
  if (!env.CRON_ENABLED) {
    fastify.log.info('CRON_ENABLED=false — tarefas periodicas desligadas');
    return;
  }

  let rodando = false;

  const varrer = async () => {
    // Guarda contra sobreposição: se uma rodada demorar mais que o intervalo
    // (banco lento), a próxima não entra por cima da anterior.
    if (rodando) {
      fastify.log.warn('varredura anterior ainda rodando, pulando esta rodada');
      return;
    }
    rodando = true;

    try {
      const { encontradas, expiradas } = await varrerExpiradas(prisma, fastify.io);

      if (expiradas > 0) {
        propostasExpiradas.inc(expiradas);
        fastify.log.info({ encontradas, expiradas }, 'propostas encerradas por prazo');
      }
    } catch (err) {
      // Um erro aqui NÃO pode derrubar o processo: é tarefa de fundo. A próxima
      // rodada tenta de novo em 30s.
      fastify.log.error({ err }, 'falha na varredura de propostas vencidas');
    } finally {
      rodando = false;
    }
  };

  const timer = setInterval(varrer, INTERVALO_MS);

  // `unref` para o timer não segurar o processo vivo no shutdown. Sem isto, o
  // encerramento gracioso esperaria o intervalo terminar.
  timer.unref();

  fastify.addHook('onClose', async () => {
    clearInterval(timer);
  });

  // Uma passada logo no boot: se o processo ficou fora do ar, há propostas
  // vencidas esperando desde antes. Aguardar 30s para tratá-las seria deixar o
  // cliente olhando um sheet de algo que já expirou.
  //
  // `setTimeout` curto em vez de chamar direto: o app ainda está sendo montado
  // e `fastify.io` pode não estar decorado.
  const primeira = setTimeout(() => void varrer(), 2_000);
  primeira.unref();

  fastify.log.info(`cron ativo — varredura a cada ${INTERVALO_MS / 1000}s`);
}
