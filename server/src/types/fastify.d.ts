import 'fastify';
import type { Server as SocketIOServer } from 'socket.io';

declare module 'fastify' {
  interface FastifyRequest {
    // Setado pelo plugin auth-mesa
    mesa?: {
      tableId: string;
      tableNumero: number;
      spaceId: string;
      spaceSlug: string;
    };
  }

  interface FastifyInstance {
    io: SocketIOServer;
  }
}
