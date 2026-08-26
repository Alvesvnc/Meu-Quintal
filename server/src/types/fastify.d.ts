import 'fastify';
import '@fastify/jwt';
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
    // Setado pelo plugin auth-restaurante (apos verificar JWT)
    kitchen?: {
      userId: string;
      kitchenId: string;
      kitchenSlug: string;
      kitchenName: string;
      spaceId: string;
      email: string;
      role: string;
    };
    // Setado pelo plugin auth-dono (apos verificar JWT)
    conta?: {
      userId: string;
      accountId: string;
      accountSlug: string;
      email: string;
      role: 'owner' | 'admin' | 'staff';
      /**
       * Cozinha que este usuario opera, ou `null`.
       *
       * Vem do banco, nunca so do token. Alem de abrir /api/r/*, e o que deixa
       * ele ver o faturamento DA PROPRIA cozinha — ver lib/faturamento.ts.
       */
      kitchenId: string | null;
    };
  }

  interface FastifyInstance {
    io: SocketIOServer;
    authRestaurante: import('fastify').preHandlerAsyncHookHandler;
    authDono: import('fastify').preHandlerAsyncHookHandler;
    /** Exige que req.conta.role esteja na lista. Usar DEPOIS de authDono. */
    exigePapel: (
      ...papeis: Array<'owner' | 'admin' | 'staff'>
    ) => import('fastify').preHandlerAsyncHookHandler;
  }
}

/**
 * Os dois apps logados (restaurante e dono) assinam com o MESMO JWT_SECRET.
 * Sem o campo `kind` no payload, um token de cozinha seria criptograficamente
 * valido nas rotas do dono — bastaria o handler nao olhar os campos que faltam.
 * `kind` e conferido explicitamente em cada plugin de auth.
 */
declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: TokenCozinha | TokenDono;
    user: TokenCozinha | TokenDono;
  }
}

export interface TokenCozinha {
  kind: 'cozinha';
  sub: string; // KitchenUser.id
  kitchenId: string;
  kitchenSlug: string;
  email: string;
  role: string;
}

export interface TokenDono {
  kind: 'dono';
  sub: string; // AccountUser.id
  accountId: string;
  accountSlug: string;
  email: string;
  role: 'owner' | 'admin' | 'staff';
  /**
   * So no RESTAURANTE UNICO: a cozinha que este dono opera diretamente. Com
   * ele, o mesmo token abre /api/r/* — um login pra tocar o proprio negocio.
   * Sempre reconferido no banco; o vinculo pode ter sido removido.
   */
  kitchenId?: string;
}
