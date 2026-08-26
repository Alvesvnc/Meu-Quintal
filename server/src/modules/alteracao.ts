import type { FastifyInstance } from 'fastify';
import {
  criarAlteracaoSchema,
  type AlteracaoPendente,
  type CriarAlteracaoResponse,
  type OrderAlteracaoEvent,
  type OrderAlteracaoRespondidaEvent,
  type OrderItemStatus,
} from '@mq/shared';
import { prisma } from '../lib/prisma.js';
import { motivoParaPrisma } from '../lib/motivo.js';
import type { MotivoCancelamento as MotivoDoPrisma } from '@prisma/client';
import { salaDaCozinha, salaDoPedido } from '../lib/salas.js';
import {
  validarProposta,
  efeitosDaResposta,
  deltaDaProposta,
  expirou,
  PRAZO_DE_RESPOSTA_MS,
  EFEITO_DA_EXPIRACAO,
  type LinhaProposta,
} from '../lib/alteracao.js';

/**
 * Alteração de pedido: a cozinha propõe, o cliente responde.
 *
 * Fluxo:
 *   1. POST /api/r/pedido/:id/alteracao          (cozinha propõe)
 *   2. o cliente recebe `order:alteracao` pelo socket e vê na tela
 *   3. POST /api/m/pedido/:id/alteracao/:aid/aceitar | /recusar
 *   4. sem resposta no prazo, expira e vale como recusa
 *
 * A cozinha NÃO fica travada esperando: os itens não afetados seguem sendo
 * preparados normalmente. Comida não espera notificação ser lida.
 */

/** Expiração é avaliada na leitura, não por cron — ver comentário em `expirarSePreciso`. */
async function expirarSePreciso(alteracaoId: string, expiresAt: Date): Promise<boolean> {
  if (!expirou(expiresAt)) return false;

  const alteracao = await prisma.orderChange.findUnique({
    where: { id: alteracaoId },
    include: { items: true },
  });
  if (!alteracao || alteracao.status !== 'pendente') return true;

  await aplicarResposta(
    alteracao.id,
    alteracao.items,
    EFEITO_DA_EXPIRACAO,
    'expirada',
    alteracao.motivo,
    alteracao.reason,
  );
  return true;
}

/** Grava a resposta e aplica os efeitos nos itens, tudo numa transação. */
async function aplicarResposta(
  alteracaoId: string,
  linhas: Array<{ orderItemId: string; qtyAnterior: number; qtyProposta: number }>,
  efeito: 'aceita' | 'recusada',
  statusFinal: 'aceita' | 'recusada' | 'expirada',
  /** Motivo da proposta — vira o motivo do cancelamento quando o item cai. */
  motivo?: MotivoDoPrisma,
  reason?: string | null,
): Promise<void> {
  const efeitos = efeitosDaResposta(linhas as LinhaProposta[], efeito);
  const agora = new Date();

  // Transação: uma alteração marcada como respondida sem os itens atualizados
  // deixaria o cliente pagando por algo que ele recusou.
  await prisma.$transaction([
    prisma.orderChange.update({
      where: { id: alteracaoId },
      data: { status: statusFinal, respondedAt: agora },
    }),
    ...efeitos.map((e) =>
      prisma.orderItem.update({
        where: { id: e.orderItemId },
        data: {
          ...(e.novaQty !== null ? { qty: e.novaQty } : {}),
          ...(e.novoStatus !== null ? { status: e.novoStatus } : {}),
          // Item que cai por recusa ou expiracao herda o motivo da PROPOSTA:
          // a causa e a mesma que levou a cozinha a propor. Sem isto, metade
          // dos cancelamentos ficaria sem categoria.
          ...(e.novoStatus === 'cancelado'
            ? {
                canceledAt: agora,
                ...(motivo ? { cancelMotivo: motivo } : {}),
                ...(reason !== undefined ? { cancelReason: reason } : {}),
              }
            : {}),
        },
      }),
    ),
  ]);
}

/** Monta o payload que a tela do cliente consome. */
function montarPendente(
  alteracao: {
    id: string;
    reason: string | null;
    createdAt: Date;
    expiresAt: Date;
    kitchen: { slug: string; name: string };
    items: Array<{ orderItemId: string; qtyAnterior: number; qtyProposta: number }>;
  },
  itensDoPedido: Array<{
    id: string;
    qty: number;
    unitPriceCents: number;
    nameSnapshot: string;
    status: OrderItemStatus;
  }>,
): AlteracaoPendente {
  const porId = new Map(itensDoPedido.map((i) => [i.id, i]));

  return {
    id: alteracao.id,
    kitchenSlug: alteracao.kitchen.slug,
    kitchenName: alteracao.kitchen.name,
    reason: alteracao.reason,
    createdAt: alteracao.createdAt.toISOString(),
    expiresAt: alteracao.expiresAt.toISOString(),
    linhas: alteracao.items.map((l) => ({
      orderItemId: l.orderItemId,
      name: porId.get(l.orderItemId)?.nameSnapshot ?? 'item',
      qtyAnterior: l.qtyAnterior,
      qtyProposta: l.qtyProposta,
      unitPriceCents: porId.get(l.orderItemId)?.unitPriceCents ?? 0,
    })),
    deltaCents: deltaDaProposta(
      alteracao.items.map((l) => ({
        orderItemId: l.orderItemId,
        qtyAnterior: l.qtyAnterior,
        qtyProposta: l.qtyProposta,
      })),
      itensDoPedido,
    ),
  };
}

/**
 * Alteração pendente de um pedido, já resolvendo expiração.
 * Usada pela rota que o cliente lê.
 */
export async function alteracaoPendenteDoPedido(
  orderId: string,
): Promise<AlteracaoPendente | null> {
  const alteracao = await prisma.orderChange.findFirst({
    where: { orderId, status: 'pendente' },
    include: { items: true, kitchen: { select: { slug: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  if (!alteracao) return null;

  if (await expirarSePreciso(alteracao.id, alteracao.expiresAt)) return null;

  const itens = await prisma.orderItem.findMany({
    where: { orderId },
    select: { id: true, qty: true, unitPriceCents: true, nameSnapshot: true, status: true },
  });

  return montarPendente(
    alteracao,
    itens.map((i) => ({ ...i, status: i.status as OrderItemStatus })),
  );
}

export async function alteracaoRoutes(fastify: FastifyInstance) {
  // ─── POST /api/r/pedido/:id/alteracao ─ a cozinha propõe ─────────────────
  fastify.post<{ Params: { id: string } }>(
    '/api/r/pedido/:id/alteracao',
    { preHandler: fastify.authRestaurante },
    async (req, reply) => {
      const ctx = req.kitchen!;

      const parsed = criarAlteracaoSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: 'Alteracao invalida.', details: parsed.error.flatten().fieldErrors });
      }

      // FILTRO POR kitchenId: é o que impede uma cozinha de mexer no item da
      // vizinha dentro do mesmo pedido. A validação abaixo trata qualquer id
      // fora desta lista como inexistente.
      const itensDaCozinha = await prisma.orderItem.findMany({
        where: { orderId: req.params.id, kitchenId: ctx.kitchenId },
        select: { id: true, qty: true, unitPriceCents: true, nameSnapshot: true, status: true },
      });

      if (itensDaCozinha.length === 0) {
        return reply
          .code(404)
          .send({ error: 'Pedido nao encontrado ou nao pertence a essa cozinha.' });
      }

      // Uma proposta pendente por vez: duas abertas fariam o cliente responder
      // a uma enquanto a outra altera os mesmos itens por baixo.
      const jaPendente = await prisma.orderChange.findFirst({
        where: { orderId: req.params.id, kitchenId: ctx.kitchenId, status: 'pendente' },
        select: { id: true, expiresAt: true },
      });
      if (jaPendente && !(await expirarSePreciso(jaPendente.id, jaPendente.expiresAt))) {
        return reply.code(409).send({
          error: 'Ja existe uma alteracao aguardando resposta do cliente.',
          alteracaoId: jaPendente.id,
        });
      }

      const itens = itensDaCozinha.map((i) => ({
        ...i,
        status: i.status as OrderItemStatus,
      }));

      const linhas: LinhaProposta[] = parsed.data.itens.map((l) => ({
        orderItemId: l.orderItemId,
        qtyAnterior: itens.find((i) => i.id === l.orderItemId)?.qty ?? 0,
        qtyProposta: l.qtyProposta,
      }));

      const erros = validarProposta(linhas, itens);
      if (erros.length > 0) {
        return reply.code(400).send({ error: 'Alteracao invalida.', motivos: erros });
      }

      const expiresAt = new Date(Date.now() + PRAZO_DE_RESPOSTA_MS);

      const alteracao = await prisma.orderChange.create({
        data: {
          orderId: req.params.id,
          kitchenId: ctx.kitchenId,
          motivo: motivoParaPrisma(parsed.data.motivo),
          reason: parsed.data.reason ?? null,
          expiresAt,
          items: {
            create: linhas.map((l) => ({
              orderItemId: l.orderItemId,
              qtyAnterior: l.qtyAnterior,
              qtyProposta: l.qtyProposta,
            })),
          },
        },
        include: { items: true, kitchen: { select: { slug: true, name: true } } },
      });

      const pendente = montarPendente(alteracao, itens);

      // O cliente está com o celular na mesa: o socket é o caminho que chega
      // sem depender de permissão de notificação nem de a aba estar aberta.
      const evento: OrderAlteracaoEvent = { orderId: req.params.id, alteracao: pendente };
      fastify.io.to(salaDoPedido(req.params.id)).emit('order:alteracao', evento);

      req.log.info(
        { orderId: req.params.id, kitchenId: ctx.kitchenId, linhas: linhas.length },
        'cozinha propos alteracao',
      );

      const response: CriarAlteracaoResponse = {
        id: alteracao.id,
        expiresAt: expiresAt.toISOString(),
      };
      return reply.code(201).send(response);
    },
  );

  // ─── POST /api/m/pedido/:id/alteracao/:aid/:resposta ─ cliente decide ────
  fastify.post<{ Params: { id: string; aid: string; resposta: string } }>(
    '/api/m/pedido/:id/alteracao/:aid/:resposta',
    async (req, reply) => {
      const mesa = req.mesa;
      if (!mesa) return reply.code(401).send({ error: 'Mesa nao identificada.' });

      if (req.params.resposta !== 'aceitar' && req.params.resposta !== 'recusar') {
        return reply.code(404).send({ error: 'Resposta invalida.' });
      }
      const resposta = req.params.resposta === 'aceitar' ? 'aceita' : 'recusada';

      // O join até o pedido E a mesa: sem isso, saber o id da alteração
      // bastaria pra responder pela mesa de outra pessoa.
      const alteracao = await prisma.orderChange.findFirst({
        where: {
          id: req.params.aid,
          orderId: req.params.id,
          order: { tableId: mesa.tableId },
        },
        include: { items: true, kitchen: { select: { id: true, slug: true } } },
      });

      if (!alteracao) {
        return reply.code(404).send({ error: 'Alteracao nao encontrada.' });
      }

      if (alteracao.status !== 'pendente') {
        return reply.code(409).send({
          error: 'Essa alteracao ja foi respondida.',
          status: alteracao.status,
        });
      }

      if (expirou(alteracao.expiresAt)) {
        await aplicarResposta(
          alteracao.id,
          alteracao.items,
          EFEITO_DA_EXPIRACAO,
          'expirada',
          alteracao.motivo,
          alteracao.reason,
        );
        return reply.code(409).send({
          error: 'O prazo de resposta acabou e a alteracao foi encerrada.',
          status: 'expirada',
        });
      }

      await aplicarResposta(
        alteracao.id,
        alteracao.items,
        resposta,
        resposta,
        alteracao.motivo,
        alteracao.reason,
      );

      // A cozinha precisa saber na hora: ou ela prepara a quantidade reduzida,
      // ou para de preparar o que foi recusado.
      const evento: OrderAlteracaoRespondidaEvent = {
        orderId: req.params.id,
        alteracaoId: alteracao.id,
        kitchenSlug: alteracao.kitchen.slug,
        resposta,
        at: new Date().toISOString(),
      };
      fastify.io.to(salaDaCozinha(alteracao.kitchen.id)).emit('order:alteracao-respondida', evento);
      fastify.io.to(salaDoPedido(req.params.id)).emit('order:alteracao-respondida', evento);

      req.log.info(
        { orderId: req.params.id, alteracaoId: alteracao.id, resposta },
        'cliente respondeu alteracao',
      );

      return reply.send({ ok: true, resposta });
    },
  );
}
