import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Registry, collectDefaultMetrics, Counter, Histogram } from 'prom-client';
import { env } from '../lib/env.js';

/**
 * Observabilidade sem fornecedor.
 *
 * Duas peças, nenhuma delas depende de conta em serviço externo:
 *
 *   1. `x-request-id` na resposta — o error handler ja devolve o requestId no
 *      corpo do 500, mas so no 500. Com o header, QUALQUER resposta pode ser
 *      cruzada com o log. E o que transforma "deu erro ontem" numa busca de
 *      uma linha.
 *
 *   2. `/metrics` no formato Prometheus — latencia, status, e contadores de
 *      negocio (pedido criado, login falhado). Qualquer coisa que leia
 *      Prometheus (Grafana, Datadog, Grafana Cloud free) consome isso.
 *
 * Se um dia entrar Sentry/OpenTelemetry, nada aqui e jogado fora: erro e
 * metrica sao perguntas diferentes.
 */

export const registro = new Registry();

// CPU, memoria, event loop, GC. Sao as metricas que respondem "o container
// esta sofrendo?" antes de o usuario reclamar.
collectDefaultMetrics({ register: registro, prefix: 'mq_' });

const duracaoRequisicao = new Histogram({
  name: 'mq_http_request_duration_seconds',
  help: 'Duracao das requisicoes HTTP em segundos',
  // `route` e o padrao do Fastify (/api/m/pedido/:id), nao a URL concreta —
  // usar a URL criaria uma serie nova por pedido e explodiria a cardinalidade.
  labelNames: ['method', 'route', 'status'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [registro],
});

/** Pedidos criados com sucesso. Metrica de negocio, nao de infra. */
export const pedidosCriados = new Counter({
  name: 'mq_pedidos_criados_total',
  help: 'Pedidos criados com sucesso',
  labelNames: ['space'],
  registers: [registro],
});

/** Logins recusados. Um pico aqui e sinal de ataque ou de tela quebrada. */
export const loginsFalhados = new Counter({
  name: 'mq_logins_falhados_total',
  help: 'Tentativas de login recusadas',
  labelNames: ['app'],
  registers: [registro],
});

/**
 * Propostas encerradas por prazo, sem o cliente responder.
 * Um numero alto aqui diz que o aviso nao esta chegando — ou que o prazo de 5
 * minutos e curto demais pra realidade do salao.
 */
export const propostasExpiradas = new Counter({
  name: 'mq_propostas_expiradas_total',
  help: 'Alteracoes encerradas por falta de resposta do cliente',
  registers: [registro],
});

/**
 * Contas suspensas por teste vencido sem virar assinatura.
 *
 * Numero alto e sinal comercial, nao tecnico: ou o teste e curto demais, ou o
 * produto nao convenceu, ou o caminho ate o botao de assinar esta escondido.
 */
export const trialsExpirados = new Counter({
  name: 'mq_trials_expirados_total',
  help: 'Contas suspensas por fim do periodo de teste',
  registers: [registro],
});

/** Ciclos de cobranca fechados. */
export const ciclosFechados = new Counter({
  name: 'mq_ciclos_fechados_total',
  help: 'Ciclos de cobranca fechados',
  registers: [registro],
});

/**
 * Avisos de push aceitos pelo servico do navegador.
 *
 * ACEITO NAO E LIDO: o servico so confirma que recebeu pra entregar. Se o
 * aparelho esta desligado ha dois dias, isto conta 1 e ninguem viu nada.
 */
export const pushEnviados = new Counter({
  name: 'mq_push_enviados_total',
  help: 'Avisos de push aceitos pelo servico de push',
  labelNames: ['motivo'],
  registers: [registro],
});

/**
 * Inscricoes apagadas por terem morrido do outro lado.
 *
 * Um pouco disso e normal e saudavel: aparelho trocado, app desinstalado,
 * permissao revogada. Um PICO logo depois de um deploy e outra coisa — e o
 * sintoma de chave VAPID trocada, que invalida todo mundo de uma vez.
 */
export const pushRemovidos = new Counter({
  name: 'mq_push_removidos_total',
  help: 'Inscricoes de push apagadas por terem expirado',
  registers: [registro],
});

export function setupObservabilidade(fastify: FastifyInstance) {
  // ─── x-request-id em toda resposta ────────────────────────────────────────
  fastify.addHook('onRequest', async (req: FastifyRequest, reply: FastifyReply) => {
    // Se um proxy ja mandou um id, respeitar: e o que costura o rastro entre
    // servicos. Senao, usa o do Fastify.
    const daBorda = req.headers['x-request-id'];
    const id = typeof daBorda === 'string' && daBorda.length <= 200 ? daBorda : req.id;
    reply.header('x-request-id', id);
  });

  // ─── Histograma de latencia ───────────────────────────────────────────────
  fastify.addHook('onResponse', async (req, reply) => {
    // routeOptions.url e o template; cai pra 'desconhecida' em 404, que e o
    // caso onde a URL e arbitraria e nao pode virar label.
    const rota = req.routeOptions?.url ?? 'desconhecida';
    duracaoRequisicao
      .labels(req.method, rota, String(reply.statusCode))
      // elapsedTime vem em ms; Prometheus espera segundos por convencao
      .observe(reply.elapsedTime / 1000);
  });

  // ─── GET /metrics ─────────────────────────────────────────────────────────
  // DESLIGADA por padrao. /metrics expoe rotas, volumes e uso de memoria — e
  // reconhecimento pronto pra quem estiver sondando. So liga com METRICS_TOKEN
  // definido, e exige esse token.
  if (!env.METRICS_TOKEN) {
    fastify.log.info('METRICS_TOKEN nao definido — /metrics desabilitada');
    return;
  }

  fastify.get(
    '/metrics',
    {
      logLevel: 'warn',
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const auth = req.headers.authorization;
      const token = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : null;

      // 404 e nao 401 de proposito: pra quem nao tem o token, a rota nao
      // existe. Um 401 confirmaria que ha metricas ali pra tentar arrombar.
      if (!token || !comparacaoSegura(token, env.METRICS_TOKEN!)) {
        return reply.code(404).send({ error: 'Rota nao encontrada: GET /metrics' });
      }

      reply.header('Content-Type', registro.contentType);
      return registro.metrics();
    },
  );
}

/**
 * Comparacao de tamanho constante.
 *
 * `a === b` sai no primeiro byte diferente, e a diferenca de tempo entre
 * "errou no 1o caractere" e "errou no 30o" e mensuravel pela rede — da pra
 * descobrir o token um caractere por vez.
 */
function comparacaoSegura(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diferenca = 0;
  for (let i = 0; i < a.length; i++) {
    diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diferenca === 0;
}
