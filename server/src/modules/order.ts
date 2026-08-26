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
import { env } from '../lib/env.js';
import { generateShortId } from '../lib/shortId.js';
import { aggregateStatus, nextStatus, totalAtivoCents } from '../lib/orderStatus.js';
import { salaDaCozinha, salaDoPedido } from '../lib/salas.js';
import { alteracaoPendenteDoPedido } from './alteracao.js';
import { pedidosCriados } from '../plugins/observabilidade.js';

/**
 * O erro de constraint unica do Prisma quando dois pedidos sorteiam o mesmo
 * shortId. P2002 e o codigo de "unique constraint failed".
 *
 * Guarda tipada em vez de `catch (e: any)`: so a colisao de shortId pode ser
 * reprocessada. Qualquer outro erro — banco fora, deadlock, item que sumiu no
 * meio — precisa subir. Insistir neles multiplicaria o problema em vez de
 * resolver.
 */
function ehColisaoDeShortId(erro: unknown): boolean {
  if (typeof erro !== 'object' || erro === null) return false;
  const e = erro as { code?: unknown; meta?: { target?: unknown } };
  if (e.code !== 'P2002') return false;
  const alvo = e.meta?.target;
  return Array.isArray(alvo) && alvo.includes('shortId');
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
      // `archivedAt: null`: item excluido pela cozinha nao pode ser pedido nem
      // por quem estava com o cardapio velho aberto. O arquivamento tambem
      // marca `available: false`, entao ha duas travas — mas depender so da
      // segunda deixaria o item pedivel se alguem religasse a disponibilidade.
      where: { id: { in: menuItemIds }, archivedAt: null },
      include: { kitchen: { select: { id: true, slug: true, name: true, status: true, spaceId: true } } },
    });

    // Comparar com os ids DISTINTOS, nao com o numero de linhas.
    //
    // O `WHERE id IN (...)` devolve cada item uma vez so. Duas linhas do mesmo
    // prato — "1 smash sem cebola" + "1 smash normal", que e pedido legitimo e
    // o motivo de `note` existir por linha — dariam 2 ids contra 1 resultado, e
    // o cliente levaria um "Algum item nao existe" sem entender o porque.
    //
    // O resto da rota ja lida com linhas repetidas: o total soma por linha e
    // cada linha vira um OrderItem com a propria nota e quantidade.
    const idsDistintos = new Set(menuItemIds);
    if (menuItems.length !== idsDistintos.size) {
      return reply.code(400).send({ error: 'Algum item nao existe.' });
    }

    // Todos devem estar no mesmo espaco da mesa
    if (menuItems.some((mi) => mi.kitchen.spaceId !== mesa.spaceId)) {
      return reply.code(400).send({ error: 'Item de cozinha fora do quintal da mesa.' });
    }

    // ─── A cozinha esta recebendo? ────────────────────────────────────────
    //
    // E ISTO que "pausada" significa: parou de receber pedido. O cardapio e o
    // quintal ja filtram por `ativa`, mas quem esta com a pagina aberta desde
    // antes da pausa nao viu a mudanca — e sem esta trava o pedido entraria
    // numa cozinha que acabou de dizer que nao da conta.
    const pausada = menuItems.find((mi) => mi.kitchen.status !== 'ativa');
    if (pausada) {
      return reply.code(409).send({
        error: `${pausada.kitchen.name} nao esta recebendo pedidos agora.`,
        kitchenSlug: pausada.kitchen.slug,
      });
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
      } catch (e) {
        if (ehColisaoDeShortId(e)) {
          attempt++;
          continue;
        }
        throw e;
      }
    }

    if (!order) {
      return reply.code(500).send({ error: 'Nao foi possivel gerar shortId unico apos 5 tentativas.' });
    }

    // Emit Socket.io order:new agrupado por cozinha
    // (cliente pode mandar items de N cozinhas — cada cozinha recebe SEU subset)
    const byKitchen = new Map<string, { slug: string; count: number; total: number }>();
    for (const line of parsed.data.items) {
      const mi = itemsByMenuItemId.get(line.menuItemId)!;
      const g = byKitchen.get(mi.kitchenId) ?? {
        slug: mi.kitchen.slug,
        count: 0,
        total: 0,
      };
      g.count += line.qty;
      g.total += mi.priceCents * line.qty;
      byKitchen.set(mi.kitchenId, g);
    }
    for (const [kitchenId, g] of byKitchen) {
      fastify.io.to(salaDaCozinha(kitchenId)).emit('order:new', {
        orderId: order.id,
        shortId: order.shortId,
        mesaNumero: mesa.tableNumero,
        createdAt: order.createdAt.toISOString(),
        totalCents: g.total,
        itemCount: g.count,
        kitchenSlug: g.slug,
      });
    }

    pedidosCriados.inc({ space: mesa.spaceSlug });

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
          totalAtivosCents: totalAtivoCents(
            o.items.map((i) => ({
              qty: i.qty,
              unitPriceCents: i.unitPriceCents,
              status: i.status as OrderItemStatus,
            })),
          ),
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
      select: {
        id: true,
        totalCents: true,
        // Precisa dos ITENS, nao so do total do pedido: e a partir deles que
        // sai o valor real a cobrar.
        items: {
          where: { kitchen: { slug: parsed.data.kitchenSlug } },
          select: { qty: true, unitPriceCents: true, status: true },
        },
      },
    });

    if (orders.length === 0) {
      return reply.code(409).send({ error: 'Sem pedidos pra fechar nessa cozinha.' });
    }

    const now = new Date();
    const orderIds = orders.map((o) => o.id);

    // O QUE A COZINHA VAI COBRAR. Antes somava `o.totalCents`, que e o snapshot
    // do que foi PEDIDO e nao muda quando um item e cancelado ou tem a
    // quantidade reduzida. Resultado: o cliente reduzia de 3 pra 1, aceitava, e
    // a cozinha era avisada pra cobrar os 3 — no momento do pagamento, que e
    // onde o erro custa mais caro.
    //
    // Filtra pelos itens DESTA cozinha: "fechar conta dessa cozinha" e o que se
    // deve a ela, nao ao pedido inteiro.
    const totalCents = orders.reduce(
      (acc, o) =>
        acc +
        totalAtivoCents(
          o.items.map((i) => ({
            qty: i.qty,
            unitPriceCents: i.unitPriceCents,
            status: i.status as OrderItemStatus,
          })),
        ),
      0,
    );

    await prisma.order.updateMany({
      where: { id: { in: orderIds } },
      data: { paymentRequestedAt: now },
    });

    // Sala enderecada pelo ID da cozinha. O slug so e unico dentro do quintal,
    // entao resolvemos o id JA filtrando por spaceId da mesa — assim nao ha
    // como acertar a cozinha de outro cliente do SaaS.
    const cozinha = await prisma.kitchen.findFirst({
      where: { slug: parsed.data.kitchenSlug, spaceId: mesa.spaceId },
      select: { id: true },
    });
    if (!cozinha) {
      return reply.code(404).send({ error: 'Cozinha nao encontrada nesse quintal.' });
    }

    const event: PaymentRequestedEvent = {
      spaceId: mesa.spaceId,
      tableId: mesa.tableId,
      tableNumero: mesa.tableNumero,
      kitchenSlug: parsed.data.kitchenSlug,
      orderIds,
      totalCents,
      at: now.toISOString(),
    };
    fastify.io.to(salaDaCozinha(cozinha.id)).emit('payment:requested', event);

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
      // O snapshot do que foi pedido continua intacto...
      totalCents: order.totalCents,
      // ...e este e o que a pessoa vai pagar. Divergem quando ha cancelamento.
      totalAtivosCents: totalAtivoCents(
        order.items.map((i) => ({
          qty: i.qty,
          unitPriceCents: i.unitPriceCents,
          status: i.status as OrderItemStatus,
        })),
      ),
      kitchens: Array.from(groups.values()),
      alteracaoPendente: await alteracaoPendenteDoPedido(order.id),
    };

    return response;
  });

  // ─── DEV: PATCH /api/_dev/order/:id/advance ─────────────────────────────
  // Avanca status dos items de UMA cozinha (passa kitchenSlug no body).
  // Util pra testar real-time sem ter restaurante real.
  //
  // NAO REGISTRAR FORA DE DESENVOLVIMENTO: a rota nao tem auth nenhuma, entao
  // em producao qualquer um com o id do pedido mexeria no status dele.
  if (env.NODE_ENV !== 'development') return;

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
      const next = nextStatus(current);

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
      fastify.io.to(salaDoPedido(id)).emit('order:status', event);

      return reply.send({ ok: true, advancedTo: next });
    },
  );
}
