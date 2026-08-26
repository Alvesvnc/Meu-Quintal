import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import underPressure from '@fastify/under-pressure';
import { env, isProd } from '../lib/env.js';
import { prisma } from '../lib/prisma.js';
import { capturarErro } from '../lib/sentry.js';

/**
 * Helmet, rate limit, probes e error handler.
 *
 * Estes tres plugins sao embrulhados com `fastify-plugin` pelos proprios
 * autores, entao `app.register` aqui NAO cria escopo isolado — eles valem pro
 * app inteiro. E o oposto de auth-mesa/socket, que sao funcoes nossas e por
 * isso precisam ser chamadas direto.
 */
export async function setupSecurity(fastify: FastifyInstance) {
  // ─── Headers ────────────────────────────────────────────────────────────
  await fastify.register(helmet, {
    // A API so devolve JSON; CSP de documento nao se aplica e so atrapalharia
    // o Swagger/preview caso um dia sejam servidos daqui.
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hsts: isProd ? { maxAge: 15552000, includeSubDomains: true } : false,
  });

  // ─── Rate limit global por IP ───────────────────────────────────────────
  await fastify.register(rateLimit, {
    global: true,
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW,
    // Probes de orquestrador nao podem ser limitadas — senao o health check
    // falha justamente quando o servico esta sob carga.
    allowList: (req) => req.url === '/health' || req.url === '/ready',
    // Precisa devolver um Error COM statusCode — o plugin faz `throw` do que
    // sair daqui e o error handler le `error.statusCode`. Objeto simples vira
    // 500, escondendo o rate limit do cliente e das metricas.
    errorResponseBuilder: (_req, ctx) => {
      const err = new Error(
        `Muitas requisicoes. Tente de novo em ${Math.ceil(ctx.ttl / 1000)}s.`,
      ) as Error & { statusCode: number };
      err.statusCode = ctx.statusCode ?? 429;
      return err;
    },
  });

  // ─── Load shedding ──────────────────────────────────────────────────────
  // Só pressao de processo: event loop travado ou heap estourando. De propósito
  // SEM `healthCheck` de banco — o under-pressure derruba TODAS as rotas quando
  // o healthCheck falha, inclusive /health. Amarrar o banco aqui faria o
  // orquestrador matar o container a cada indisponibilidade do Postgres, quando
  // o correto e apenas parar de rotear trafego (papel do /ready abaixo).
  await fastify.register(underPressure, {
    maxEventLoopDelay: 1_000,
    maxHeapUsedBytes: 0, // 0 = desligado; o runtime cuida disso
    message: 'Servico sob carga. Tente de novo em instantes.',
    retryAfter: 15,
  });

  // ─── Error handler ──────────────────────────────────────────────────────
  fastify.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    // Rede de seguranca: se um plugin marcar o status no reply e lancar algo
    // sem `statusCode`, respeitar o reply evita transformar um 4xx legitimo em
    // 500 — o cliente perderia a diferenca entre "diminua o ritmo" e "quebrou".
    const status =
      error.statusCode ?? (reply.statusCode >= 400 ? reply.statusCode : 500);

    if (status !== 500) {
      if (status >= 500) request.log.warn({ err: error, url: request.url }, 'resposta 5xx');
      return reply.code(status).send({ error: error.message });
    }

    // 500 e o caso desconhecido: loga tudo do lado de ca, devolve o minimo do
    // lado de la. Erro de driver costuma carregar host, query e ate credencial.
    request.log.error({ err: error, url: request.url }, 'erro nao tratado');

    // So o 5xx DESCONHECIDO vai pro Sentry. 4xx e 503 de load shedding sairam
    // no ramo acima — mandar erro esperado torraria a cota do plano free
    // justamente durante o incidente, que e quando ela mais importa.
    capturarErro(error, {
      requestId: String(request.id),
      metodo: request.method,
      rota: request.routeOptions?.url ?? request.url,
      // De qual cliente do SaaS era a requisicao. Sem isso, num sistema
      // multi-tenant, o erro nao tem dono.
      accountId: request.conta?.accountId,
      kitchenId: request.kitchen?.kitchenId,
      spaceId: request.mesa?.spaceId ?? request.kitchen?.spaceId,
    });

    return reply.code(500).send({
      error: 'Erro interno.',
      // requestId deixa o suporte cruzar a queixa do usuario com o log
      requestId: request.id,
    });
  });

  fastify.setNotFoundHandler(
    // A propria 404 precisa de teto, senao vira canal de varredura de rotas
    { preHandler: fastify.rateLimit({ max: 60, timeWindow: '1 minute' }) },
    (request, reply) => {
      reply.code(404).send({ error: `Rota nao encontrada: ${request.method} ${request.url}` });
    },
  );
}

/**
 * Probes. Registradas fora do setupSecurity pra ficar obvio que sao rotas, nao
 * configuracao — e pra ordem de registro nao esconder o /ready atras do
 * rate limit.
 *
 *  /health — liveness. Nao toca no banco. Se respondeu, o processo esta vivo e
 *            o orquestrador NAO deve reiniciar o container.
 *  /ready  — readiness. Consulta o banco. Se falhar, o load balancer tira esta
 *            instancia da rotacao ate voltar, sem matar o processo.
 */
export function setupProbes(fastify: FastifyInstance) {
  fastify.get('/health', { logLevel: 'warn' }, async () => ({
    ok: true,
    t: new Date().toISOString(),
  }));

  fastify.get('/ready', { logLevel: 'warn' }, async (_req, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { ok: true, db: 'up' };
    } catch (err) {
      fastify.log.error({ err }, 'readiness: banco inacessivel');
      return reply.code(503).send({ ok: false, db: 'down' });
    }
  });
}
