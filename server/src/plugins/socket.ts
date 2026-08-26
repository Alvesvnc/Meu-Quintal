import type { FastifyInstance } from 'fastify';
import { Server as SocketIOServer, type Socket } from 'socket.io';
import { corsOrigins, isProd } from '../lib/env.js';
import { prisma } from '../lib/prisma.js';
import { salaDaCozinha, salaDoPedido } from '../lib/salas.js';

/**
 * Identidade de um socket, resolvida no handshake.
 *  - mesa:    cliente com qrToken de uma mesa; so enxerga pedidos daquela mesa
 *  - cozinha: operador logado; so enxerga a sala da propria cozinha
 */
type SocketIdentity =
  | { kind: 'mesa'; tableId: string; spaceId: string }
  | { kind: 'cozinha'; kitchenId: string; kitchenSlug: string };

declare module 'socket.io' {
  interface Socket {
    identity?: SocketIdentity;
  }
}

/**
 * Plugin Socket.io. Atacha ao httpServer do Fastify.
 *
 * IMPORTANTE: chamar como `setupSocket(app)` DIRETO, NAO via `app.register()`.
 * Encapsulation isolaria o decorate('io', ...) — outras rotas nao veriam.
 *
 * Salas:
 *   - "order:{orderId}"    — cliente acompanha pedido; emite "order:status"
 *   - "kitchen:{kitchenId}" — restaurante escuta eventos da propria cozinha
 *
 * As salas usam ID, nao slug: o slug so e unico dentro de um quintal (ver
 * lib/salas.ts).
 *
 * SEGURANCA: o handshake exige credencial e toda entrada em sala e conferida
 * contra ela. Sem isso qualquer um entraria em "kitchen:{slug}" de terceiros e
 * assistiria ao movimento da cozinha em tempo real.
 */
export function setupSocket(fastify: FastifyInstance) {
  const io = new SocketIOServer(fastify.server, {
    cors: { origin: corsOrigins, methods: ['GET', 'POST'], credentials: true },
    // Conexao que nao se autentica em 10s cai sozinha
    connectTimeout: 10_000,
  });

  // ─── Handshake: resolve identidade antes de aceitar a conexao ─────────────
  io.use(async (socket, next) => {
    const { kind, token } = (socket.handshake.auth ?? {}) as {
      kind?: string;
      token?: string;
    };

    if (typeof token !== 'string' || token.length === 0) {
      return next(new Error('unauthorized: token ausente no handshake'));
    }

    try {
      if (kind === 'mesa') {
        const table = await prisma.table.findUnique({
          where: { qrToken: token },
          select: { id: true, spaceId: true, isActive: true },
        });
        if (!table || !table.isActive) {
          return next(new Error('unauthorized: mesa invalida'));
        }
        socket.identity = { kind: 'mesa', tableId: table.id, spaceId: table.spaceId };
        return next();
      }

      if (kind === 'cozinha') {
        // Mesmo segredo e mesmo formato de payload do /api/r/auth/login
        const payload = fastify.jwt.verify<{ kitchenId: string; kitchenSlug: string }>(token);
        const kitchen = await prisma.kitchen.findUnique({
          where: { id: payload.kitchenId },
          select: { id: true, slug: true, status: true },
        });
        if (!kitchen || kitchen.status !== 'ativa') {
          return next(new Error('unauthorized: cozinha invalida ou inativa'));
        }
        socket.identity = { kind: 'cozinha', kitchenId: kitchen.id, kitchenSlug: kitchen.slug };
        return next();
      }

      return next(new Error('unauthorized: kind precisa ser "mesa" ou "cozinha"'));
    } catch (err) {
      fastify.log.warn({ err, kind }, 'handshake de socket recusado');
      return next(new Error('unauthorized: credencial invalida'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const id = socket.identity;
    if (!id) return socket.disconnect(true);

    // ── Cliente acompanhando um pedido ─────────────────────────────────────
    socket.on('order:subscribe', async (orderId: unknown) => {
      if (id.kind !== 'mesa') return;
      if (typeof orderId !== 'string' || orderId.length === 0) return;

      // O pedido tem que ser DESTA mesa. Sem essa checagem, uma mesa valida
      // conseguiria espiar o pedido de qualquer outra so sabendo o id.
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { tableId: true },
      });
      if (!order || order.tableId !== id.tableId) {
        fastify.log.warn(
          { orderId, tableId: id.tableId },
          'mesa tentou assinar pedido de outra mesa',
        );
        return;
      }

      socket.join(salaDoPedido(orderId));
    });

    socket.on('order:unsubscribe', (orderId: unknown) => {
      if (typeof orderId === 'string') socket.leave(salaDoPedido(orderId));
    });

    // ── Cozinha escutando a propria sala ───────────────────────────────────
    socket.on('kitchen:subscribe', (slug: unknown) => {
      if (id.kind !== 'cozinha') return;
      if (slug !== id.kitchenSlug) {
        fastify.log.warn(
          { pedido: slug, real: id.kitchenSlug },
          'cozinha tentou assinar sala de outra cozinha',
        );
        return;
      }
      socket.join(salaDaCozinha(id.kitchenId));
    });

    socket.on('kitchen:unsubscribe', () => {
      if (id.kind === 'cozinha') socket.leave(salaDaCozinha(id.kitchenId));
    });
  });

  // Em producao nao expor detalhe de engine/versao no handshake
  if (isProd) io.engine.on('connection_error', () => {});

  fastify.decorate('io', io);

  fastify.addHook('onClose', async () => {
    await io.close();
  });
}
