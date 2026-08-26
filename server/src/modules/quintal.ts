import type { FastifyInstance } from 'fastify';
import type { QuintalResponse } from '@mq/shared';
import { prisma } from '../lib/prisma.js';

/**
 * GET /api/m/quintal — visao do cliente apos escanear QR.
 * Retorna info da mesa atual + cozinhas ativas do espaco com faixa de preco.
 */
export async function quintalRoutes(fastify: FastifyInstance) {
  fastify.get('/api/m/quintal', async (req, reply) => {
    const mesa = req.mesa;
    if (!mesa) return reply.code(401).send({ error: 'Mesa nao identificada.' });

    const kitchens = await prisma.kitchen.findMany({
      where: { spaceId: mesa.spaceId, status: 'ativa' },
      include: {
        menuItems: {
          where: { available: true, archivedAt: null },
          select: { priceCents: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const response: QuintalResponse = {
      space: {
        id: mesa.spaceId,
        slug: mesa.spaceSlug,
        name: '', // preenche abaixo
        tipo: 'food-court', // idem
      },
      table: {
        id: mesa.tableId,
        numero: mesa.tableNumero,
      },
      kitchens: kitchens.map((k) => {
        const prices = k.menuItems.map((i) => i.priceCents);
        return {
          id: k.id,
          slug: k.slug,
          name: k.name,
          category: k.category,
          tagline: k.tagline,
          photoUrl: k.photoUrl,
          slaMinutes: k.slaMinutes,
          priceMinCents: prices.length > 0 ? Math.min(...prices) : 0,
          priceMaxCents: prices.length > 0 ? Math.max(...prices) : 0,
          isOpen: true,
          closingNote: null,
        };
      }),
    };

    // Buscar nome do space (1 query a mais — em scale, dava pra cachar)
    const space = await prisma.space.findUnique({
      where: { id: mesa.spaceId },
      select: { name: true, tipo: true },
    });
    if (space) {
      response.space.name = space.name;
      response.space.tipo = space.tipo === 'restaurante_unico' ? 'restaurante-unico' : 'food-court';
    }

    return response;
  });
}
