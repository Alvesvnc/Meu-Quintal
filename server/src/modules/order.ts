import type { FastifyInstance } from 'fastify';
import {
  createOrderSchema,
  type CreateOrderResponse,
  type OrderResponse,
  type OrderItemStatus,
  type OrderKitchenGroup,
  type OrderStatusEvent,
  type OrdersListResponse,
  type PaymentRequestedEvent,
  type RequestPaymentResponse,
} from '@mq/shared';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { generateShortId } from '../lib/shortId.js';

const STATUS_RANK: Record<OrderItemStatus, number> = {
  cancelado: -1,
  novo:      0,
  preparando: 1,
  pronto:     2,
  retirado:   3,
};

/** Status agregado de uma cozinha = o "mais atrasado" (menor rank) dos items. */
function aggregateStatus(statuses: OrderItemStatus[]): OrderItemStatus {
  if (statuses.length === 0) return 'novo';
  return statuses.reduce((min, s) =>
    STATUS_RANK[s] < STATUS_RANK[min] ? s : min,
  );
}

export async function orderRoutes(fastify: FastifyInstance) {
  // ─── POST /api/m/pedido ─────────────────────────────────────────────────
  fastify.post('/api/m/pedido', async (req, reply) => {
    const mesa = req.mesa;
    if (!mesa) return reply.code(401).send({ error: 'Mesa nao identificada.' });

    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Pedido invalido.',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    // Buscar todos os menuItems pra validar disponibilidade + pegar preco snapshot
    const menuItemIds = parsed.data.items.map((i) => i.menuItemId);
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: menuItemIds } },
      include: { kitchen: { select: { id: true, spaceId: true } } },
    });

    if (menuItems.length !== menuItemIds.length) {
      return reply.code(400).send({ error: 'Algum item nao existe.' });
    }

    // Todos devem estar no mesmo espaco da mesa
    if (menuItems.some((mi) => mi.kitchen.spaceId !== mesa.spaceId)) {
      return reply.code(400).send({ error: 'Item de cozinha fora do quintal da mesa.' });
    }

    // Todos disponiveis
    const unavailable = menuItems.find((mi) => !mi.available);
    if (unavailable) {
      return reply.code(409).send({
        error: 'Item esgotado.',
        itemId: unavailable.id,
        name: unavailable.name,
      });
    }

    const itemsByMenuItemId = new Map(menuItems.map((mi) => [mi.id, mi]));
    const totalCents = parsed.data.items.reduce((acc, line) => {
      const mi = itemsByMenuItemId.get(line.menuItemId)!;
      return acc + mi.priceCents * line.qty;
    }, 0);

    // Tentativa de insert com shortId — retry se colidir (raro mas possivel)
    let attempt = 0;
    let order;
    while (attempt < 5) {
      try {
        order = await prisma.order.create({
          data: {
            shortId: generateShortId(),
            spaceId: mesa.spaceId,
            tableId: mesa.tableId,
            totalCents,
            items: {
              create: parsed.data.items.map((line) => {
                const mi = itemsByMenuItemId.get(line.menuItemId)!;
                return {
                  menuItemId: mi.id,
                  kitchenId: mi.kitchenId,
                  qty: line.qty,
                  unitPriceCents: mi.priceCents,
                  nameSnapshot: mi.name,
                  note: line.note ?? null,
                };
              }),
            },
          },
        });
        break;
      } catch (e: any) {
        if (e.code === 'P2002' && e.meta?.target?.includes('shortId')) {
          attempt++;
          continue;
        }
        throw e;
      }
    }

    if (!order) {
      return reply.code(500).send({ error: 'Nao foi possivel gerar shortId unico apos 5 tentativas.' });
    }

    const response: CreateOrderResponse = {
      id: order.id,
      shortId: order.shortId,
    };
    return reply.code(201).send(response);
  });

  // ─── GET /api/m/pedidos ─ ativos da mesa (nao retirados/cancelados) ─────
  fastify.get('/api/m/pedidos', async (req, reply) => {
    const mesa = req.mesa;
    if (!mesa) return reply.code(401).send({ error: 'Mesa nao identificada.' });

    const orders = await prisma.order.findMany({
      where: {
        tableId: mesa.tableId,
        items: {
          some: { status: { in: ['novo', 'preparando', 'pronto'] } },
        },
      },
      include: {
        items: { include: { kitchen: { select: { slug: true, name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const response: OrdersListResponse = {
      orders: orders.map((o) => {
        // Cada Order tem só items de UMA cozinha (modelo novo: 1 pedido por cozinha)
        const firstKitchen = o.items[0]?.kitchen;
        const aggStatus = aggregateStatus(o.items.map((i) => i.status as OrderItemStatus));
        return {
          id: o.id,
          shortId: o.shortId,
          createdAt: o.createdAt.toISOString(),
          totalCents: o.totalCents,
          kitchenSlug: firstKitchen?.slug ?? '',
          kitchenName: firstKitchen?.name ?? '',
          status: aggStatus,
          itemCount: o.items.reduce((acc, i) => acc + i.qty, 0),
          paymentRequestedAt: o.paymentRequestedAt?.toISOString() ?? null,
          paidAt: o.paidAt?.toISOString() ?? null,
        };
      }),
    };

    return response;
  });

  // ─── POST /api/m/pedidos/fechar-conta ─ pedir cobranca pra cozinha X ─────
  const requestPaymentSchema = z.object({
    kitchenSlug: z.string().min(1),
  });

  fastify.post('/api/m/pedidos/fechar-conta', async (req, reply) => {
    const mesa = req.mesa;
    if (!mesa) return reply.code(401).send({ error: 'Mesa nao identificada.' });

    const parsed = requestPaymentSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'kitchenSlug obrigatorio.' });
    }

    // Acha todos os orders ABERTOS (com items ativos) da mesa+cozinha ainda nao solicitados
    const orders = await prisma.order.findMany({
      where: {
        tableId: mesa.tableId,
        paymentRequestedAt: null,
        paidAt: null,
        items: {
          some: {
            status: { in: ['novo', 'preparando', 'pronto', 'retirado'] },
            kitchen: { slug: parsed.data.kitchenSlug },
          },
        },
      },
      select: { id: true, totalCents: true },
    });

    if (orders.length === 0) {
      return reply.code(409).send({ error: 'Sem pedidos pra fechar nessa cozinha.' });
    }

    const now = new Date();
    const orderIds = orders.map((o) => o.id);
    const totalCents = orders.reduce((acc, o) => acc + o.totalCents, 0);

    await prisma.order.updateMany({
      where: { id: { in: orderIds } },
      data: { paymentRequestedAt: now },
    });

    // Emite evento Socket.io pra cozinha (sala "kitchen:{slug}")
    // Quando integrar app restaurante com backend, ele escuta nessa sala.
    const event: PaymentRequestedEvent = {
      spaceId: mesa.spaceId,
      tableId: mesa.tableId,
      tableNumero: mesa.tableNumero,
      kitchenSlug: parsed.data.kitchenSlug,
      orderIds,
      totalCents,
      at: now.toISOString(),
    };
    fastify.io.to(`kitchen:${parsed.data.kitchenSlug}`).emit('payment:requested', event);

    const response: RequestPaymentResponse = {
      ok: true,
      requested: orders.length,
    };
    return reply.send(response);
  });

  // ─── GET /api/m/pedido/:id ──────────────────────────────────────────────
  fastify.get<{ Params: { id: string } }>('/api/m/pedido/:id', async (req, reply) => {
    const mesa = req.mesa;
    if (!mesa) return reply.code(401).send({ error: 'Mesa nao identificada.' });

    const order = await prisma.order.findFirst({
      where: { id: req.params.id, tableId: mesa.tableId },
      include: {
        table: { select: { numero: true } },
        items: { include: { kitchen: { select: { slug: true, name: true, slaMinutes: true } } } },
      },
    });

    if (!order) return reply.code(404).send({ error: 'Pedido nao encontrado.' });

    // Agrupar items por cozinha
    const groups = new Map<string, OrderKitchenGroup>();
    for (const item of order.items) {
      const g = groups.get(item.kitchen.slug) ?? {
        kitchenSlug: item.kitchen.slug,
        kitchenName: item.kitchen.name,
        slaMinutes: item.kitchen.slaMinutes,
        items: [],
        status: 'novo' as OrderItemStatus,
        acceptedAt: null,
        readyAt: null,
        pickedAt: null,
      };
      g.items.push({
        id: item.id,
        name: item.nameSnapshot,
        qty: item.qty,
        unitPriceCents: item.unitPriceCents,
        note: item.note,
        status: item.status,
      });
      groups.set(item.kitchen.slug, g);
    }

    // Calcular status agregado por cozinha
    for (const [, g] of groups) {
      g.status = aggregateStatus(g.items.map((i) => i.status));
    }

    // Pegar timestamps agregados (do primeiro item que atingiu cada status)
    for (const [slug, g] of groups) {
      const itemsForGroup = order.items.filter((i) => i.kitchen.slug === slug);
      const earliestAt = (field: 'acceptedAt' | 'readyAt' | 'pickedAt'): string | null => {
        const stamps = itemsForGroup.map((i) => i[field]).filter(Boolean) as Date[];
        if (stamps.length === 0) return null;
        return new Date(Math.min(...stamps.map((d) => d.getTime()))).toISOString();
      };
      g.acceptedAt = earliestAt('acceptedAt');
      g.readyAt = earliestAt('readyAt');
      g.pickedAt = earliestAt('pickedAt');
    }

    const response: OrderResponse = {
      id: order.id,
      shortId: order.shortId,
      mesaNumero: order.table.numero,
      createdAt: order.createdAt.toISOString(),
      totalCents: order.totalCents,
      kitchens: Array.from(groups.values()),
    };

    return response;
  });

  // ─── DEV: PATCH /api/_dev/order/:id/advance ─────────────────────────────
  // Avanca status dos items de UMA cozinha (passa kitchenSlug no body).
  // Util pra testar real-time sem ter restaurante real.
  fastify.patch<{ Params: { id: string }; Body: { kitchenSlug: string } }>(
    '/api/_dev/order/:id/advance',
    async (req, reply) => {
      const { id } = req.params;
      const { kitchenSlug } = req.body;
      if (!kitchenSlug) return reply.code(400).send({ error: 'kitchenSlug obrigatorio.' });

      const items = await prisma.orderItem.findMany({
        where: { orderId: id, kitchen: { slug: kitchenSlug } },
      });
      if (items.length === 0) return reply.code(404).send({ error: 'Sem items dessa cozinha nesse pedido.' });

      const current = aggregateStatus(items.map((i) => i.status as OrderItemStatus));
      const next: OrderItemStatus | null =
        current === 'novo'       ? 'preparando' :
        current === 'preparando' ? 'pronto' :
        current === 'pronto'     ? 'retirado' :
        null;

      if (!next) return reply.code(400).send({ error: `Sem proximo status a partir de "${current}".` });

      const now = new Date();
      const stamp =
        next === 'preparando' ? { acceptedAt: now } :
        next === 'pronto'     ? { readyAt: now } :
        next === 'retirado'   ? { pickedAt: now } :
        {};

      await prisma.orderItem.updateMany({
        where: { orderId: id, kitchen: { slug: kitchenSlug } },
        data: { status: next, ...stamp },
      });

      const event: OrderStatusEvent = {
        orderId: id,
        kitchenSlug,
        status: next,
        at: now.toISOString(),
      };
      fastify.io.to(`order:${id}`).emit('order:status', event);

      return reply.send({ ok: true, advancedTo: next });
    },
  );
}
