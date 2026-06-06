import type { FastifyInstance } from 'fastify';
import type { KitchenMenuResponse } from '@mq/shared';
import { prisma } from '../lib/prisma.js';

/**
 * GET /api/m/k/:slug — cardapio de uma cozinha do espaco da mesa.
 * Só retorna items DISPONIVEIS (cliente nao ve esgotados).
 */
export async function kitchenRoutes(fastify: FastifyInstance) {
  fastify.get<{ Params: { slug: string } }>(
    '/api/m/k/:slug',
    async (req, reply) => {
      const mesa = req.mesa;
      if (!mesa) return reply.code(401).send({ error: 'Mesa nao identificada.' });

      const kitchen = await prisma.kitchen.findFirst({
        where: { slug: req.params.slug, spaceId: mesa.spaceId, status: 'ativa' },
        include: {
          menuItems: {
            // Inclui esgotados — front mostra com chip + disabled
            orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
          },
        },
      });

      if (!kitchen) {
        return reply.code(404).send({ error: 'Cozinha nao encontrada nesse quintal.' });
      }

      const response: KitchenMenuResponse = {
        kitchen: {
          id: kitchen.id,
          slug: kitchen.slug,
          name: kitchen.name,
          tagline: kitchen.tagline,
          photoUrl: kitchen.photoUrl,
          slaMinutes: kitchen.slaMinutes,
        },
        items: kitchen.menuItems.map((i) => ({
          id: i.id,
          kitchenSlug: kitchen.slug,
          category: i.category,
          name: i.name,
          description: i.description,
          priceCents: i.priceCents,
          photoUrl: i.photoUrl,
          available: i.available,
          badge: i.badge === 'sem_estoque' ? 'sem-estoque' : i.badge,
        })),
      };

      return response;
    },
  );
}
