import type { FastifyInstance } from 'fastify';
import { Server as SocketIOServer } from 'socket.io';
import { corsOrigins } from '../lib/env.js';

/**
 * Plugin Socket.io. Atacha ao httpServer do Fastify.
 *
 * IMPORTANTE: chamar como `setupSocket(app)` DIRETO, NAO via `app.register()`.
 * Encapsulation isolaria o decorate('io', ...) — outras rotas nao veriam.
 *
 * Salas:
 *   - "order:{orderId}" — cliente acompanha pedido; server emite "order:status"
 *   - "kitchen:{slug}" — restaurante escuta eventos da cozinha (payment:requested)
 */
export function setupSocket(fastify: FastifyInstance) {
  const io = new SocketIOServer(fastify.server, {
    cors: {
      origin: corsOrigins,
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    socket.on('order:subscribe', (orderId: string) => {
      if (typeof orderId === 'string' && orderId.length > 0) {
        socket.join(`order:${orderId}`);
      }
    });

    socket.on('order:unsubscribe', (orderId: string) => {
      socket.leave(`order:${orderId}`);
    });

    socket.on('kitchen:subscribe', (slug: string) => {
      if (typeof slug === 'string' && slug.length > 0) {
        socket.join(`kitchen:${slug}`);
      }
    });

    socket.on('kitchen:unsubscribe', (slug: string) => {
      socket.leave(`kitchen:${slug}`);
    });
  });

  fastify.decorate('io', io);

  fastify.addHook('onClose', async () => {
    await io.close();
  });
}
