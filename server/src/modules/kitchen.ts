import type { FastifyInstance } from 'fastify';
import type { KitchenMenuResponse } from '@mq/shared';
import { prisma } from '../lib/prisma.js';
import { fotoDaCozinha } from '../lib/fotoDaCozinha.js';

/**
 * GET /api/m/k/:slug — cardapio de uma cozinha do espaco da mesa.
 * Só retorna items DISPONIVEIS (cliente nao ve esgotados).
 */
export async function kitchenRoutes(fastify: FastifyInstance) {
  fastify.get<{ Params: { slug: string } }>('/api/m/k/:slug', async (req, reply) => {
    const mesa = req.mesa;
    if (!mesa) return reply.code(401).send({ error: 'Mesa nao identificada.' });

    const kitchen = await prisma.kitchen.findFirst({
      where: { slug: req.params.slug, spaceId: mesa.spaceId, status: 'ativa' },
      include: {
        // As secoes do cardapio, na ordem que a COZINHA escolheu. Vem
        // inteiras, inclusive a vazia: o app pula secao sem item, e mandar so
        // as cheias faria o servidor decidir o que o cliente ve.
        menuCategorias: {
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          select: { id: true, name: true },
        },
        menuItems: {
          // Inclui esgotados — front mostra com chip + disabled.
          // ARQUIVADO nao: item excluido pela cozinha some do cardapio, mas
          // continua no banco porque os pedidos antigos apontam pra ele.
          where: { archivedAt: null },
          orderBy: [{ categoria: { sortOrder: 'asc' } }, { sortOrder: 'asc' }, { name: 'asc' }],
          include: {
            // A capa primeiro. E a unica que a lista mostra; as outras so
            // aparecem quando o cliente abre o item.
            fotos: {
              orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
              select: { id: true, storageKey: true, width: true, height: true },
            },
          },
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
        photoUrl: fotoDaCozinha(kitchen),
        slaMinutes: kitchen.slaMinutes,
      },
      categorias: kitchen.menuCategorias,
      items: kitchen.menuItems.map((i) => ({
        id: i.id,
        kitchenSlug: kitchen.slug,
        categoriaId: i.categoriaId,
        name: i.name,
        description: i.description,
        priceCents: i.priceCents,
        photoUrl: i.photoUrl,
        fotos: i.fotos.map((f) => ({
          id: f.id,
          url: `/api/fotos/${f.storageKey}`,
          width: f.width,
          height: f.height,
        })),
        available: i.available,
        badge: i.badge === 'sem_estoque' ? 'sem-estoque' : i.badge,
      })),
    };

    return response;
  });
}
