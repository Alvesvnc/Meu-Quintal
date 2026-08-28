import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { env } from '../lib/env.js';
import { varrerExpiradas } from '../lib/expiracao.js';
import { varrerTrialsVencidos } from '../lib/trial.js';
import { varrerCiclosParaFechar } from '../lib/fecharCiclo.js';
import { propostasExpiradas, trialsExpirados, ciclosFechados } from './observabilidade.js';

/**
 * Tarefas periódicas do processo.
 *
 * Um `setInterval` dentro do próprio servidor, não um agendador externo. Para o
 * tamanho atual do produto, um serviço de cron separado seria mais peça para
 * manter do que problema resolvido — e cada operação é idempotente, então rodar
 * em várias réplicas não duplica trabalho.
 *
 * Se um dia houver muitas réplicas e as varreduras ficarem caras,
 * `CRON_ENABLED=false` desliga em todas menos uma.
 *
 * ─── POR QUE HÁ UM AGENDADOR AQUI DENTRO ────────────────────────────────────
 *
 * São três tarefas, e todas precisam exatamente do mesmo cuidado: não deixar
 * duas rodadas se sobreporem, não derrubar o processo quando falharem, não
 * segurar o desligamento, e rodar uma vez no boot. Escrever isso três vezes é
 * como uma delas acaba sem uma das quatro coisas — provavelmente a terceira,
 * escrita com pressa num sábado.
 */

/**
 * De quanto em quanto tempo encerrar proposta de alteração vencida.
 *
 * 30s contra um prazo de 5 minutos: no pior caso a proposta é encerrada 30
 * segundos depois de vencer. Mais curto só aumentaria consulta ao banco sem
 * ninguém perceber a diferença.
 */
const INTERVALO_PROPOSTAS_MS = 30_000;

/**
 * Teste grátis vencido, e fechamento de ciclo.
 *
 * Uma hora. Um trial que acaba às 14h03 é suspenso às 15h, e o ciclo que fecha
 * dia 5 fecha em algum momento do dia 5 — em nenhum dos dois alguém percebe a
 * diferença, enquanto varrer a cada meio minuto seria consulta constante por
 * eventos que acontecem uma vez por mês.
 */
const INTERVALO_LENTO_MS = 60 * 60 * 1000;

interface Tarefa {
  nome: string;
  intervaloMs: number;
  /** Atraso da primeira execução, depois do boot. */
  primeiraEmMs: number;
  executar: () => Promise<void>;
}

export function setupCron(fastify: FastifyInstance): void {
  if (!env.CRON_ENABLED) {
    fastify.log.info('CRON_ENABLED=false — tarefas periodicas desligadas');
    return;
  }

  const tarefas: Tarefa[] = [
    {
      nome: 'propostas-vencidas',
      intervaloMs: INTERVALO_PROPOSTAS_MS,
      // Uma passada logo no boot: se o processo ficou fora do ar, há propostas
      // vencidas esperando desde antes, e o cliente está olhando um sheet de
      // algo que já expirou.
      primeiraEmMs: 2_000,
      executar: async () => {
        const { encontradas, expiradas } = await varrerExpiradas(prisma, fastify.io);
        if (expiradas > 0) {
          propostasExpiradas.inc(expiradas);
          fastify.log.info({ encontradas, expiradas }, 'propostas encerradas por prazo');
        }
      },
    },
    {
      nome: 'trial-vencido',
      intervaloMs: INTERVALO_LENTO_MS,
      primeiraEmMs: 5_000,
      executar: async () => {
        const { encontradas, suspensas } = await varrerTrialsVencidos(prisma);
        if (suspensas > 0) {
          trialsExpirados.inc(suspensas);
          // `warn` de propósito: suspender cliente é evento que alguém deveria
          // ver passar, não linha de rotina perdida no meio do log.
          fastify.log.warn({ encontradas, suspensas }, 'contas suspensas por fim do teste');
        }
      },
    },
    {
      nome: 'fechar-ciclos',
      intervaloMs: INTERVALO_LENTO_MS,
      // Depois das outras duas: nada depende disso, mas espalhar as três evita
      // três varreduras batendo no banco no mesmo segundo do boot.
      primeiraEmMs: 8_000,
      executar: async () => {
        const { fechados, velhosDemais } = await varrerCiclosParaFechar(prisma);

        if (fechados > 0) {
          ciclosFechados.inc(fechados);
          // `warn`: emitir cobrança é dinheiro mudando de mão. Merece aparecer.
          fastify.log.warn({ fechados }, 'ciclos de cobranca fechados automaticamente');
        }

        // ISTO NUNCA PODE VIRAR SILÊNCIO. São ciclos que a varredura viu, podia
        // ter fechado e NÃO fechou por serem velhos demais (ver ALCANCE_MS).
        // Sem esta linha, o dono acharia que tudo foi cobrado.
        if (velhosDemais.length > 0) {
          fastify.log.warn(
            { velhosDemais },
            'ciclos antigos NAO fechados automaticamente — precisam do botao do dono',
          );
        }
      },
    },
  ];

  const timers: NodeJS.Timeout[] = [];

  for (const tarefa of tarefas) {
    // Guarda de sobreposição POR TAREFA: se uma rodada demorar mais que o
    // intervalo (banco lento), a próxima não entra por cima. E uma tarefa lenta
    // não pode impedir as outras de rodarem — por isso o estado é local a cada
    // uma, não compartilhado.
    let rodando = false;

    const rodar = async () => {
      if (rodando) {
        fastify.log.warn({ tarefa: tarefa.nome }, 'rodada anterior ainda em andamento, pulando');
        return;
      }
      rodando = true;

      try {
        await tarefa.executar();
      } catch (err) {
        // Erro em tarefa de fundo NÃO derruba o processo. A próxima rodada
        // tenta de novo.
        fastify.log.error({ err, tarefa: tarefa.nome }, 'falha em tarefa periodica');
      } finally {
        rodando = false;
      }
    };

    const timer = setInterval(rodar, tarefa.intervaloMs);
    // `unref` pro timer não segurar o processo vivo: sem isto o encerramento
    // gracioso esperaria o intervalo terminar.
    timer.unref();
    timers.push(timer);

    // Primeira execução logo após o boot. Importa mais nas tarefas de uma hora:
    // um processo que reinicia com frequência poderia nunca chegar a completar
    // a primeira hora de vida, e a varredura nunca rodaria.
    //
    // `setTimeout` em vez de chamar direto porque o app ainda está sendo
    // montado e `fastify.io` pode não estar decorado.
    const primeira = setTimeout(() => void rodar(), tarefa.primeiraEmMs);
    primeira.unref();
    timers.push(primeira);
  }

  fastify.addHook('onClose', async () => {
    for (const t of timers) clearInterval(t);
  });

  fastify.log.info(
    { tarefas: tarefas.map((t) => `${t.nome}@${t.intervaloMs / 1000}s`) },
    'cron ativo',
  );
}
