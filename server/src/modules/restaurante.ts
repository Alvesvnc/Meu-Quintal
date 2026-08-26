import type { FastifyInstance } from 'fastify';
import {
  loginSchema,
  cancelOrderSchema,
  type LoginResponse,
  type KitchenMeResponse,
  type FilaResponse,
  type FilaOrder,
  type OrderItemStatus,
  type OrderStatusEvent,
} from '@mq/shared';
import { prisma } from '../lib/prisma.js';
import { senhaConfere } from '../lib/senha.js';
import { salaDoPedido } from '../lib/salas.js';
// Implementacao UNICA do agregado. Havia uma copia local aqui, com semantica
// diferente da usada nas rotas do cliente — ver o comentario em orderStatus.ts.
import { aggregateStatus, totalAtivoCents } from '../lib/orderStatus.js';
import type { MotivoCancelamento, MetricasCancelamentoResponse } from '@mq/shared';
import { motivoParaPrisma, motivoParaAPI } from '../lib/motivo.js';
import { loginsFalhados } from '../plugins/observabilidade.js';

/**
 * Rotas do app restaurante. Todas sob /api/r/*.
 * /api/r/auth/* sao publicas; o restante exige preHandler authRestaurante.
 */
export async function restauranteRoutes(fastify: FastifyInstance) {
  // ─── POST /api/r/auth/login ─────────────────────────────────────────────
  // Teto proprio, bem abaixo do global: login e o alvo obvio de forca bruta e
  // cada tentativa custa um argon2.verify (caro de proposito). 10/min por IP
  // permite errar a senha algumas vezes e trava script.
  fastify.post(
    '/api/r/auth/login',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Email ou senha invalidos.' });
      }
      const { email, password } = parsed.data;

      const user = await prisma.kitchenUser.findUnique({
        where: { email: email.toLowerCase().trim() },
        include: {
          kitchen: {
            select: {
              id: true, slug: true, name: true, category: true,
              photoUrl: true, slaMinutes: true, status: true, spaceId: true,
            },
          },
        },
      });

      if (!user) {
        loginsFalhados.inc({ app: 'restaurante' });
        return reply.code(401).send({ error: 'Email ou senha invalidos.' });
      }

      const ok = await senhaConfere(user.passwordHash, password);
      if (!ok) {
        loginsFalhados.inc({ app: 'restaurante' });
        return reply.code(401).send({ error: 'Email ou senha invalidos.' });
      }

      // Cozinha pausada ENTRA normalmente: pausar e dizer "nao me mande
      // pedido agora", nao "me tranque pra fora". Sem isto, quem pausasse nao
      // conseguiria nem despausar.

      // Atualiza lastLoginAt em background (nao bloqueia resposta)
      prisma.kitchenUser.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      }).catch((err) => fastify.log.warn({ err }, 'falha ao atualizar lastLoginAt'));

      // `kind` distingue este token do JWT do app do dono, que usa o MESMO
      // segredo. Sem ele, um token de cozinha seria criptograficamente valido
      // nas rotas /api/a/* — ver plugins/auth-dono.ts.
      const token = fastify.jwt.sign({
        kind: 'cozinha' as const,
        sub: user.id,
        kitchenId: user.kitchenId,
        kitchenSlug: user.kitchen.slug,
        email: user.email,
        role: user.role,
        // Ver o mesmo campo no login do dono.
        v: user.tokenVersion,
      });

      const response: LoginResponse = {
        token,
        kitchen: {
          userId: user.id,
          email: user.email,
          role: user.role,
          kitchen: {
            id: user.kitchen.id,
            slug: user.kitchen.slug,
            name: user.kitchen.name,
            category: user.kitchen.category,
            photoUrl: user.kitchen.photoUrl,
            slaMinutes: user.kitchen.slaMinutes,
            status: user.kitchen.status,
          },
        },
      };
      return reply.send(response);
    },
  );

  // ─── GET /api/r/auth/me ─────────────────────────────────────────────────
  fastify.get(
    '/api/r/auth/me',
    { preHandler: fastify.authRestaurante },
    async (req, reply) => {
      const ctx = req.kitchen!;
      const kitchen = await prisma.kitchen.findUnique({
        where: { id: ctx.kitchenId },
        select: {
          id: true, slug: true, name: true, category: true,
          photoUrl: true, slaMinutes: true, status: true,
        },
      });
      if (!kitchen) return reply.code(404).send({ error: 'Cozinha nao encontrada.' });

      const response: KitchenMeResponse = {
        userId: ctx.userId,
        email: ctx.email,
        role: ctx.role,
        kitchen,
      };
      return reply.send(response);
    },
  );

  // ─── GET /api/r/fila ─────────────────────────────────────────────────────
  fastify.get(
    '/api/r/fila',
    { preHandler: fastify.authRestaurante },
    async (req) => {
      const ctx = req.kitchen!;

      // Pega orders que tem AO MENOS UM item dessa cozinha em status ativo
      const orders = await prisma.order.findMany({
        where: {
          spaceId: ctx.spaceId,
          items: {
            some: {
              kitchenId: ctx.kitchenId,
              status: { in: ['novo', 'preparando', 'pronto'] },
            },
          },
        },
        include: {
          table: { select: { numero: true } },
          items: {
            where: { kitchenId: ctx.kitchenId },
            select: {
              id: true, qty: true, note: true, unitPriceCents: true,
              nameSnapshot: true, status: true, createdAt: true,
              acceptedAt: true, readyAt: true, pickedAt: true,
            },
          },
          // Proposta DESTA cozinha ainda aguardando resposta. O filtro por
          // expiresAt evita mostrar como pendente algo que ja venceu e que o
          // cron ainda nao varreu (ate 30s de janela).
          changes: {
            where: {
              kitchenId: ctx.kitchenId,
              status: 'pendente',
              expiresAt: { gt: new Date() },
            },
            include: { items: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      // SLA da cozinha pra calcular atraso
      const k = await prisma.kitchen.findUnique({
        where: { id: ctx.kitchenId },
        select: { slaMinutes: true },
      });
      const slaMinutes = k?.slaMinutes ?? 15;

      const now = Date.now();

      const response: FilaResponse = {
        orders: orders.map((o): FilaOrder => {
          const aggStatus = aggregateStatus(
            o.items.map((i) => i.status as OrderItemStatus),
          );
          // Mesma regra do lado do cliente: item cancelado nao entra no total.
          const totalCents = totalAtivoCents(
            o.items.map((i) => ({
              qty: i.qty,
              unitPriceCents: i.unitPriceCents,
              status: i.status as OrderItemStatus,
            })),
          );
          const startedAt = (() => {
            const accepted = o.items.find((i) => i.acceptedAt)?.acceptedAt;
            return accepted?.getTime() ?? o.createdAt.getTime();
          })();
          const elapsedMin = Math.floor((now - startedAt) / 60_000);
          const isLate = aggStatus !== 'novo' && elapsedMin > slaMinutes;

          return {
            id: o.id,
            shortId: o.shortId,
            mesaNumero: o.table.numero,
            createdAt: o.createdAt.toISOString(),
            acceptedAt: firstDateIso(o.items.map((i) => i.acceptedAt)),
            readyAt: firstDateIso(o.items.map((i) => i.readyAt)),
            pickedAt: firstDateIso(o.items.map((i) => i.pickedAt)),
            status: aggStatus,
            items: o.items.map((i) => ({
              id: i.id,
              name: i.nameSnapshot,
              qty: i.qty,
              note: i.note,
              unitPriceCents: i.unitPriceCents,
              // Sem o status, o item cancelado aparece igual a um ativo e a
              // cozinha prepara comida que ninguem vai buscar.
              status: i.status as OrderItemStatus,
            })),
            totalCents,
            isLate,
            paymentRequestedAt: o.paymentRequestedAt?.toISOString() ?? null,
            alteracaoAguardando: (() => {
              const pendente = o.changes[0];
              if (!pendente) return null;
              const porId = new Map(o.items.map((i) => [i.id, i]));
              return {
                id: pendente.id,
                createdAt: pendente.createdAt.toISOString(),
                expiresAt: pendente.expiresAt.toISOString(),
                reason: pendente.reason,
                linhas: pendente.items.map((l) => ({
                  orderItemId: l.orderItemId,
                  name: porId.get(l.orderItemId)?.nameSnapshot ?? 'item',
                  qtyAnterior: l.qtyAnterior,
                  qtyProposta: l.qtyProposta,
                })),
              };
            })(),
          };
        }),
      };
      return response;
    },
  );

  // ─── GET /api/r/metricas/cancelamentos ──────────────────────────────────
  // Por que a cozinha cancela. Antes disto o motivo era validado e descartado,
  // entao a pergunta "o que mais me faz cancelar?" nao tinha resposta.
  fastify.get<{ Querystring: { dias?: string } }>(
    '/api/r/metricas/cancelamentos',
    { preHandler: fastify.authRestaurante },
    async (req, reply) => {
      const ctx = req.kitchen!;

      const dias = Number(req.query.dias ?? 30);
      if (!Number.isInteger(dias) || dias < 1 || dias > 365) {
        return reply.code(400).send({ error: 'dias deve estar entre 1 e 365.' });
      }

      const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

      const cancelados = await prisma.orderItem.findMany({
        // O filtro por kitchenId e o de sempre: uma cozinha nao ve o numero da
        // vizinha. `canceledAt` (e nao createdAt) porque a pergunta e sobre
        // QUANDO foi cancelado, nao quando foi pedido.
        where: {
          kitchenId: ctx.kitchenId,
          status: 'cancelado',
          canceledAt: { gte: desde },
        },
        select: {
          qty: true,
          unitPriceCents: true,
          nameSnapshot: true,
          cancelMotivo: true,
        },
      });

      const porMotivo = new Map<MotivoCancelamento, { itens: number; perdaCents: number }>();
      const porItem = new Map<string, { itens: number; perdaCents: number }>();
      let totalItens = 0;
      let perdaTotalCents = 0;

      for (const item of cancelados) {
        // Cancelamento anterior a esta funcionalidade nao tem motivo gravado.
        const motivo = item.cancelMotivo ? motivoParaAPI(item.cancelMotivo) : 'outro';
        const perda = item.qty * item.unitPriceCents;

        const m = porMotivo.get(motivo) ?? { itens: 0, perdaCents: 0 };
        m.itens += item.qty;
        m.perdaCents += perda;
        porMotivo.set(motivo, m);

        const i = porItem.get(item.nameSnapshot) ?? { itens: 0, perdaCents: 0 };
        i.itens += item.qty;
        i.perdaCents += perda;
        porItem.set(item.nameSnapshot, i);

        totalItens += item.qty;
        perdaTotalCents += perda;
      }

      const response: MetricasCancelamentoResponse = {
        dias,
        desde: desde.toISOString(),
        totalItens,
        perdaTotalCents,
        porMotivo: [...porMotivo.entries()]
          .map(([motivo, v]) => ({ motivo, ...v }))
          .sort((a, b) => b.itens - a.itens),
        // Top 5: a lista inteira viraria parede de texto e a resposta e "onde
        // olhar primeiro", nao um relatorio.
        itensMaisCancelados: [...porItem.entries()]
          .map(([name, v]) => ({ name, ...v }))
          .sort((a, b) => b.itens - a.itens)
          .slice(0, 5),
      };

      return response;
    },
  );

  // ─── PATCH /api/r/pedido/:id/aceitar ─ novo -> preparando ────────────────
  fastify.patch<{ Params: { id: string } }>(
    '/api/r/pedido/:id/aceitar',
    { preHandler: fastify.authRestaurante },
    async (req, reply) => advanceKitchenItems(fastify, req.kitchen!, req.params.id, 'preparando', reply),
  );

  // ─── PATCH /api/r/pedido/:id/pronto ─ preparando -> pronto ───────────────
  fastify.patch<{ Params: { id: string } }>(
    '/api/r/pedido/:id/pronto',
    { preHandler: fastify.authRestaurante },
    async (req, reply) => advanceKitchenItems(fastify, req.kitchen!, req.params.id, 'pronto', reply),
  );

  // ─── PATCH /api/r/pedido/:id/retirado ─ pronto -> retirado ───────────────
  fastify.patch<{ Params: { id: string } }>(
    '/api/r/pedido/:id/retirado',
    { preHandler: fastify.authRestaurante },
    async (req, reply) => advanceKitchenItems(fastify, req.kitchen!, req.params.id, 'retirado', reply),
  );

  // ─── PATCH /api/r/pedido/:id/cancelar ─ qualquer ativo -> cancelado ─────
  fastify.patch<{ Params: { id: string } }>(
    '/api/r/pedido/:id/cancelar',
    { preHandler: fastify.authRestaurante },
    async (req, reply) => {
      const parsed = cancelOrderSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'Motivo invalido.',
          details: parsed.error.flatten().fieldErrors,
        });
      }
      return advanceKitchenItems(fastify, req.kitchen!, req.params.id, 'cancelado', reply, {
        motivo: parsed.data.motivo,
        reason: parsed.data.reason,
      });
    },
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function firstDateIso(dates: Array<Date | null>): string | null {
  const d = dates.find((x): x is Date => x != null);
  return d?.toISOString() ?? null;
}

async function advanceKitchenItems(
  fastify: FastifyInstance,
  ctx: NonNullable<import('fastify').FastifyRequest['kitchen']>,
  orderId: string,
  to: OrderItemStatus,
  reply: import('fastify').FastifyReply,
  /** So faz sentido quando `to` e 'cancelado'. Ver types/cancelamento.ts. */
  cancelamento?: { motivo: MotivoCancelamento; reason?: string },
) {
  // Pega items DESSA cozinha desse pedido
  const items = await prisma.orderItem.findMany({
    where: { orderId, kitchenId: ctx.kitchenId },
    select: { id: true, status: true },
  });

  if (items.length === 0) {
    return reply.code(404).send({ error: 'Pedido nao encontrado ou nao pertence a essa cozinha.' });
  }

  const now = new Date();
  const stamps: Record<string, Date | undefined> = (() => {
    switch (to) {
      case 'preparando': return { acceptedAt: now };
      case 'pronto':     return { readyAt: now };
      case 'retirado':   return { pickedAt: now };
      case 'cancelado':  return { canceledAt: now };
      default:           return {};
    }
  })();

  // O motivo e gravado NO ITEM: e por item que a metrica agrega. Antes disto o
  // `reason` era validado e jogado fora — a cozinha escrevia achando que
  // servia pra alguma coisa.
  const dadosDoCancelamento =
    to === 'cancelado' && cancelamento
      ? {
          cancelMotivo: motivoParaPrisma(cancelamento.motivo),
          cancelReason: cancelamento.reason ?? null,
        }
      : {};

  // Pra retirado: tambem marca pago no Order se cliente ja tinha pedido cobranca
  await prisma.$transaction([
    prisma.orderItem.updateMany({
      where: {
        id: { in: items.map((i) => i.id) },
        status: { notIn: ['cancelado', 'retirado'] },
      },
      data: { status: to, ...stamps, ...dadosDoCancelamento },
    }),
    ...(to === 'retirado'
      ? [
          prisma.order.updateMany({
            where: { id: orderId, paymentRequestedAt: { not: null }, paidAt: null },
            data: { paidAt: now },
          }),
        ]
      : []),
  ]);

  // Emit Socket.io order:status na sala order:{id}
  const event: OrderStatusEvent = {
    orderId,
    kitchenSlug: ctx.kitchenSlug,
    status: to,
    at: now.toISOString(),
  };
  fastify.io.to(salaDoPedido(orderId)).emit('order:status', event);

  return reply.send({ ok: true, status: to, count: items.length });
}
