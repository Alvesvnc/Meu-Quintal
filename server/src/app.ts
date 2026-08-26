import Fastify, { type FastifyInstance } from 'fastify';

/** Substituida no build; em dev cai no fallback. */
declare const __VERSAO__: string;
const VERSAO = typeof __VERSAO__ === 'string' ? __VERSAO__ : 'dev';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import type { Server as SocketIOServer } from 'socket.io';
import { env, corsOrigins, isDev, isProd } from './lib/env.js';
import { setupSecurity, setupProbes } from './plugins/security.js';
import { setupObservabilidade } from './plugins/observabilidade.js';
import { setupCron } from './plugins/cron.js';
import { setupAuthMesa } from './plugins/auth-mesa.js';
import { setupAuthRestaurante } from './plugins/auth-restaurante.js';
import { setupAuthDono } from './plugins/auth-dono.js';
import { setupSocket } from './plugins/socket.js';
import { quintalRoutes } from './modules/quintal.js';
import { kitchenRoutes } from './modules/kitchen.js';
import { orderRoutes } from './modules/order.js';
import { restauranteRoutes } from './modules/restaurante.js';
import { cozinhaRoutes } from './modules/cozinha.js';
import multipart from '@fastify/multipart';
import { BYTES_MAXIMOS } from './lib/imagem.js';
import { prepararArmazenamento } from './lib/armazenamento.js';
import { fotosRoutes } from './modules/fotos.js';
import { conviteRoutes } from './modules/convite.js';
import { acessoRoutes } from './modules/acesso.js';
import { adminRoutes } from './modules/admin.js';
import { alteracaoRoutes } from './modules/alteracao.js';

export interface OpcoesApp {
  /**
   * Anexar o Socket.io ao httpServer. Desligar em teste: o servidor de socket
   * segura handles abertos e a suite nao encerra sozinha.
   */
  socket?: boolean;
  /** Desligar o logger deixa a saida do teste legivel. */
  logger?: boolean;
  /**
   * Tarefas periodicas. Desligar em teste: um timer de fundo mexendo no banco
   * durante a suite produz falha que depende de quando o teste rodou.
   */
  cron?: boolean;
}

/**
 * Io de mentira pros casos em que o Socket.io nao sobe.
 *
 * Os handlers chamam `fastify.io.to(sala).emit(...)` sem perguntar se ha
 * socket. Sem este stub, testar qualquer rota que emite evento estouraria em
 * "Cannot read properties of undefined" — um erro de teste que nao diz nada
 * sobre o comportamento sendo verificado.
 */
function ioDeMentira(): SocketIOServer {
  const noop = { emit: () => true };
  return {
    to: () => noop,
    emit: () => true,
    close: async () => {},
    on: () => {},
    use: () => {},
    engine: { on: () => {} },
  } as unknown as SocketIOServer;
}

/**
 * Monta o app com tudo registrado, mas NAO escuta em porta nenhuma.
 *
 * Separado do server.ts pra que `fastify.inject()` possa exercitar as rotas de
 * verdade — com hooks de auth, rate limit e error handler no lugar — sem abrir
 * socket TCP.
 *
 * A ORDEM AQUI IMPORTA e nao e arbitraria:
 *   1. cors/sensible
 *   2. security  — helmet, rate limit e error handler antes de qualquer rota
 *   3. socket    — decora app.io, que os handlers usam
 *   4. auth      — auth-dono depende do @fastify/jwt registrado por
 *                  setupAuthRestaurante
 *   5. rotas
 */
export async function buildApp(opcoes: OpcoesApp = {}): Promise<FastifyInstance> {
  const { socket = true, logger = true, cron = true } = opcoes;

  const app = Fastify({
    // Corpo grande so serve pra consumir memoria: o maior body legitimo e um
    // pedido de 50 linhas, que da alguns KB.
    bodyLimit: env.BODY_LIMIT,
    // X-Forwarded-For so vale se houver um proxy conhecido na frente. Confiar
    // por padrao deixaria qualquer um forjar o IP e furar o rate limit.
    trustProxy: env.TRUST_PROXY,
    logger: logger
      ? {
          level: isProd ? 'info' : 'debug',
          // Sem isto, todo request loga o Bearer do cliente em texto puro — o
          // qrToken da mesa e o JWT da cozinha iriam parar no agregador.
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'req.headers["x-api-key"]',
              'res.headers["set-cookie"]',
            ],
            censor: '[redigido]',
          },
          ...(isDev
            ? {
                transport: {
                  target: 'pino-pretty',
                  options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
                },
              }
            : {}),
        }
      : false,
  });

  await app.register(cors, { origin: corsOrigins, credentials: true });
  await app.register(sensible);

  // Upload de foto do cardapio. O limite aqui e a PRIMEIRA barreira: acima
  // dele o Fastify corta o stream sem carregar o arquivo inteiro na memoria.
  // A segunda barreira e o `processarFoto`, que so aceita o que abrir como
  // imagem de verdade — ver lib/imagem.ts.
  await app.register(multipart, {
    limits: {
      fileSize: BYTES_MAXIMOS,
      // Uma foto por requisicao: enviar varias de uma vez transformaria um
      // erro no meio da lista num estado que ninguem sabe descrever.
      files: 1,
      // Nao ha campo de texto no formulario de foto; qualquer um seria ruido.
      fields: 0,
    },
  });

  // Helmet, rate limit, load shedding e error handler. Antes das rotas.
  await setupSecurity(app);

  // x-request-id, histograma de latencia e /metrics. Antes das rotas pra que
  // os hooks peguem todas elas.
  setupObservabilidade(app);

  // Socket.io ANTES das rotas pra app.io estar disponivel nos handlers.
  // NAO usar app.register — encapsulation isola o decorator.
  if (socket) {
    setupSocket(app);
  } else {
    app.decorate('io', ioDeMentira());
  }

  // Auth de mesa: aplica a /api/m/* via preHandler global
  // (mesmo motivo — encapsulation isolaria o hook)
  setupAuthMesa(app);

  // Auth de restaurante: JWT verify exposto como app.authRestaurante
  await setupAuthRestaurante(app);

  // Auth do dono: app.authDono + app.exigePapel. DEPOIS de setupAuthRestaurante,
  // que e quem registra o @fastify/jwt que este plugin usa.
  setupAuthDono(app);

  // Rotas
  await app.register(quintalRoutes);
  await app.register(kitchenRoutes);
  await app.register(orderRoutes);
  await app.register(restauranteRoutes);
  await app.register(cozinhaRoutes);
  await app.register(fotosRoutes);
  await app.register(conviteRoutes);
  await app.register(acessoRoutes);

  // Falhar aqui, no boot, e melhor do que no primeiro upload de um cliente.
  await prepararArmazenamento();
  await app.register(adminRoutes);
  await app.register(alteracaoRoutes);

  // Probes: /health (liveness) e /ready (readiness)
  setupProbes(app);

  // Tarefas periodicas. DEPOIS do socket: a varredura emite evento em app.io.
  if (cron) setupCron(app);

  // ─── Indice da API ────────────────────────────────────────────────────────
  app.get('/', async () => ({
    name: 'Meu Quintal · server',
    // Injetada no build (esbuild `define`), a partir do package.json da raiz.
    // Chumbar aqui garante que a versao exibida em producao esteja errada.
    version: VERSAO,
    endpoints: {
      health: 'GET /health',
      ready: 'GET /ready',
      cliente: {
        quintal: 'GET /api/m/quintal',
        menu: 'GET /api/m/k/:slug',
        novoPedido: 'POST /api/m/pedido',
        pedido: 'GET /api/m/pedido/:id',
        pedidos: 'GET /api/m/pedidos',
        fecharConta: 'POST /api/m/pedidos/fechar-conta',
        responderAlteracao: 'POST /api/m/pedido/:id/alteracao/:aid/aceitar|recusar',
        auth: 'Authorization: Bearer {qrToken}',
      },
      restaurante: {
        login: 'POST /api/r/auth/login',
        me: 'GET /api/r/auth/me',
        fila: 'GET /api/r/fila',
        aceitar: 'PATCH /api/r/pedido/:id/aceitar',
        pronto: 'PATCH /api/r/pedido/:id/pronto',
        retirado: 'PATCH /api/r/pedido/:id/retirado',
        cancelar: 'PATCH /api/r/pedido/:id/cancelar',
        alteracao: 'POST /api/r/pedido/:id/alteracao',
        auth: 'Authorization: Bearer {JWT de cozinha}',
      },
      dono: {
        login: 'POST /api/a/auth/login',
        me: 'GET /api/a/auth/me',
        overview: 'GET /api/a/overview',
        cozinhas: 'GET /api/a/cozinhas',
        acordo: 'PATCH /api/a/cozinhas/:slug/acordo',
        convite: 'POST /api/a/cozinhas/convite',
        financeiro: 'GET /api/a/financeiro?refMonth=AAAA-MM',
        fecharCiclo: 'POST /api/a/financeiro/fechar',
        cobranca: 'PATCH /api/a/cobrancas/:id',
        mesas: 'GET /api/a/mesas',
        mesaStatus: 'PATCH /api/a/mesas/:numero',
        auth: 'Authorization: Bearer {JWT de dono}',
      },
      metrics: env.METRICS_TOKEN ? 'GET /metrics (Bearer METRICS_TOKEN)' : 'desabilitada',
      socket: {
        handshake: 'auth: { kind: "mesa" | "cozinha", token }',
        salas: ['order:{orderId}', 'kitchen:{kitchenId}'],
      },
      ...(isDev ? { dev: { avancarPedido: 'PATCH /api/_dev/order/:id/advance' } } : {}),
    },
  }));

  return app;
}
