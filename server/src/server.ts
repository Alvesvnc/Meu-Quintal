import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { env, corsOrigins } from './lib/env.js';
import { prisma } from './lib/prisma.js';
import { setupAuthMesa } from './plugins/auth-mesa.js';
import { setupSocket } from './plugins/socket.js';
import { quintalRoutes } from './modules/quintal.js';
import { kitchenRoutes } from './modules/kitchen.js';
import { orderRoutes } from './modules/order.js';

const app = Fastify({
  logger: env.NODE_ENV === 'development'
    ? { transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } } }
    : true,
});

await app.register(cors, { origin: corsOrigins, credentials: true });
await app.register(sensible);

// Socket.io ANTES das rotas pra app.io estar disponivel nos handlers
// NAO usar app.register — encapsulation isola o decorator
setupSocket(app);

// Auth de mesa: aplica a /api/m/* via preHandler global
// (mesmo motivo — encapsulation isolaria o hook)
setupAuthMesa(app);

// Routes
await app.register(quintalRoutes);
await app.register(kitchenRoutes);
await app.register(orderRoutes);

// Healthcheck + info
app.get('/health', async () => ({ ok: true, t: new Date().toISOString() }));
app.get('/', async () => ({
  name: 'Meu Quintal · server',
  version: '0.0.1',
  endpoints: {
    health: 'GET /health',
    cliente: {
      quintal: 'GET /api/m/quintal',
      menu: 'GET /api/m/k/:slug',
      novoPedido: 'POST /api/m/pedido',
      pedido: 'GET /api/m/pedido/:id',
    },
    dev: {
      avancarPedido: 'PATCH /api/_dev/order/:id/advance',
    },
    auth: 'Authorization: Bearer {qrToken}',
  },
}));

// Graceful shutdown
const shutdown = async (signal: string) => {
  app.log.info(`Recebido ${signal}, encerrando…`);
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

try {
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  app.log.info(`Meu Quintal · server escutando em http://localhost:${env.PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
