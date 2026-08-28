// PRIMEIRO import, sempre. Ele inicializa o Sentry por efeito colateral, e a
// ordem dos imports e a unica coisa que a spec garante em ESM — ver o
// comentario em instrument.ts. No-op se SENTRY_DSN estiver vazio.
import './instrument.js';

import { env } from './lib/env.js';
import { sentryAtivo, encerrarSentry } from './lib/sentry.js';
import { prisma } from './lib/prisma.js';
import { buildApp } from './app.js';

/**
 * Entrypoint do processo. A montagem do app vive em app.ts pra que os testes
 * possam usar `fastify.inject()` sem abrir porta.
 *
 * Aqui fica so o que e responsabilidade de PROCESSO: escutar, tratar sinal e
 * encerrar direito.
 */
const app = await buildApp();

// ─── Shutdown ───────────────────────────────────────────────────────────────
// O orquestrador manda SIGTERM e espera. Fechar o Fastify primeiro drena as
// conexoes em voo; so depois solta o pool do Prisma.
let encerrando = false;
const shutdown = async (signal: string) => {
  if (encerrando) return;
  encerrando = true;

  app.log.info(`Recebido ${signal}, encerrando…`);
  const prazo = setTimeout(() => {
    app.log.error('Shutdown passou de 15s, saindo a forca.');
    process.exit(1);
  }, 15_000);
  prazo.unref();

  try {
    await app.close();
    await prisma.$disconnect();
    // Depois do app fechar: o erro que derrubou o servico e justamente o que
    // nao chega ao Sentry se o processo sair antes do envio terminar.
    await encerrarSentry();
    app.log.info('Encerrado com sucesso.');
    process.exit(0);
  } catch (err) {
    app.log.error({ err }, 'falha durante o shutdown');
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (err) => {
  app.log.error({ err }, 'unhandledRejection');
  shutdown('unhandledRejection');
});

try {
  await app.listen({ port: env.PORT, host: env.HOST });
  app.log.info(`QRO · server em http://${env.HOST}:${env.PORT} (${env.NODE_ENV})`);
  app.log.info(
    sentryAtivo
      ? `Sentry ativo (traces ${env.SENTRY_TRACES_SAMPLE_RATE})`
      : 'Sentry desligado (SENTRY_DSN vazio)',
  );
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
