import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';

/**
 * Hook pra rotas /api/m/* — valida Authorization: Bearer {qrToken}.
 * Lookup direto na tabela `tables`. Se ativo, anexa contexto em request.mesa.
 *
 * IMPORTANTE: chamar como `setupAuthMesa(app)` DIRETO, NAO via `app.register()`.
 * Register cria encapsulation scope — o hook nao veria rotas registradas em
 * outros register calls. Funcao normal registra no scope global.
 */
export function setupAuthMesa(fastify: FastifyInstance) {
  // Fastify 5: decorate explicitamente p/ atribuicao no hook persistir no handler
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fastify.decorateRequest('mesa', null as any);

  fastify.addHook('preHandler', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.url.startsWith('/api/m/')) return;

    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Token de mesa ausente.' });
    }

    const qrToken = auth.slice('Bearer '.length).trim();
    if (!qrToken) {
      return reply.code(401).send({ error: 'Token de mesa vazio.' });
    }

    const table = await prisma.table.findUnique({
      where: { qrToken },
      include: { space: { select: { id: true, slug: true } } },
    });

    if (!table || !table.isActive) {
      return reply.code(401).send({ error: 'Mesa nao encontrada ou desativada.' });
    }

    req.mesa = {
      tableId: table.id,
      tableNumero: table.numero,
      spaceId: table.spaceId,
      spaceSlug: table.space.slug,
    };
  });
}
