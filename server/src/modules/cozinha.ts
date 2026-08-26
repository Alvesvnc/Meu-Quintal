import type { FastifyInstance } from 'fastify';
import {
  criarItemCardapioSchema,
  editarItemCardapioSchema,
  perfilCozinhaSchema,
  janelaDiasSchema,
  type CardapioResponse,
  type ItemCardapio,
  type PerfilCozinhaResponse,
  type HistoricoResponse,
  type HistoricoPedido,
  type MetricasResponse,
  type BadgeMenu,
  type OrderItemStatus,
} from '@mq/shared';
import { prisma } from '../lib/prisma.js';
import { totalAtivoCents } from '../lib/orderStatus.js';
import { processarFoto, ImagemInvalida, EXTENSAO } from '../lib/imagem.js';
import { guardar, apagar } from '../lib/armazenamento.js';

/**
 * Teto de fotos por item.
 *
 * Nao e limitacao tecnica: e edicao. Um prato com doze fotos vira album, o
 * cliente rola sem decidir nada e a primeira — que e a que vende — se perde.
 */
const MAX_FOTOS = 6;

/**
 * A cozinha administrando a si mesma: cardápio, perfil, histórico e métricas.
 *
 * Separado de `restaurante.ts`, que é a OPERAÇÃO (login, fila, avançar status).
 * A fila fica aberta o dia inteiro num tablet e é o caminho quente; isto aqui é
 * consultado de vez em quando. Misturar os dois num arquivo só faria a parte
 * que importa ficar difícil de achar.
 *
 * Tudo escopado por `req.kitchen.kitchenId`. Nenhuma rota daqui aceita id de
 * cozinha vindo do cliente — o único jeito de mexer em outra cozinha seria
 * fazer login nela.
 */
export async function cozinhaRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: fastify.authRestaurante };

  /** `sem_estoque` no Prisma, `sem-estoque` na API (enum não aceita hífen). */
  const badgeParaAPI = (b: string | null): BadgeMenu | null =>
    b === null ? null : b === 'sem_estoque' ? 'sem-estoque' : (b as BadgeMenu);
  const badgeParaPrisma = (b: BadgeMenu | null | undefined) =>
    b === undefined ? undefined : b === 'sem-estoque' ? 'sem_estoque' : b;

  const paraAPI = (i: {
    id: string;
    category: string;
    name: string;
    description: string | null;
    priceCents: number;
    photoUrl: string | null;
    available: boolean;
    badge: string | null;
    sortOrder: number;
    fotos?: Array<{ id: string; storageKey: string; width: number; height: number }>;
  }): ItemCardapio => ({
    id: i.id,
    category: i.category as ItemCardapio['category'],
    name: i.name,
    description: i.description,
    priceCents: i.priceCents,
    photoUrl: i.photoUrl,
    fotos: (i.fotos ?? []).map((f) => ({
      id: f.id,
      url: urlDaFoto(f.storageKey),
      width: f.width,
      height: f.height,
    })),
    available: i.available,
    badge: badgeParaAPI(i.badge),
    sortOrder: i.sortOrder,
  });

  /** As fotos do item, na ordem — a primeira e a capa. */
  const incluirFotos = {
    fotos: {
      orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }],
      select: { id: true, storageKey: true, width: true, height: true },
    },
  };

  /** Confirma que o item e da cozinha logada. Devolve o id, ou `null`. */
  async function itemDaCozinha(itemId: string, kitchenId: string): Promise<string | null> {
    const item = await prisma.menuItem.findFirst({
      where: { id: itemId, kitchenId, archivedAt: null },
      select: { id: true },
    });
    return item?.id ?? null;
  }

  // ─── GET /api/r/cardapio ────────────────────────────────────────────────
  fastify.get('/api/r/cardapio', auth, async (req) => {
    const ctx = req.kitchen!;

    const items = await prisma.menuItem.findMany({
      // `archivedAt: null`: item excluido pela cozinha some daqui, mas continua
      // no banco porque OrderItem aponta pra ele — ver o comentario no schema.
      where: { kitchenId: ctx.kitchenId, archivedAt: null },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      include: incluirFotos,
    });

    const response: CardapioResponse = { items: items.map(paraAPI) };
    return response;
  });

  // ─── POST /api/r/cardapio ───────────────────────────────────────────────
  fastify.post('/api/r/cardapio', auth, async (req, reply) => {
    const ctx = req.kitchen!;
    const parsed = criarItemCardapioSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: 'Item invalido.', details: parsed.error.flatten().fieldErrors });
    }

    const item = await prisma.menuItem.create({
      // `kitchenId` vem do TOKEN, nunca do body: aceitar do cliente deixaria
      // qualquer cozinha escrever no cardapio da vizinha.
      data: {
        kitchenId: ctx.kitchenId,
        category: parsed.data.category,
        name: parsed.data.name,
        description: parsed.data.description,
        priceCents: parsed.data.priceCents,
        photoUrl: parsed.data.photoUrl,
        available: parsed.data.available,
        badge: badgeParaPrisma(parsed.data.badge),
        sortOrder: parsed.data.sortOrder,
      },
    });

    req.log.info({ menuItemId: item.id, kitchenId: ctx.kitchenId }, 'item de cardapio criado');
    return reply.code(201).send(paraAPI(item));
  });

  // ─── PATCH /api/r/cardapio/:id ──────────────────────────────────────────
  fastify.patch<{ Params: { id: string } }>('/api/r/cardapio/:id', auth, async (req, reply) => {
    const ctx = req.kitchen!;
    const parsed = editarItemCardapioSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: 'Alteracao invalida.', details: parsed.error.flatten().fieldErrors });
    }

    // `updateMany` com kitchenId no where, e nao `update` por id: com `update`
    // o registro seria localizado antes de qualquer checagem de dono, e bastaria
    // conhecer um id pra editar o cardapio de outra cozinha.
    const { count } = await prisma.menuItem.updateMany({
      where: { id: req.params.id, kitchenId: ctx.kitchenId, archivedAt: null },
      data: { ...parsed.data, badge: badgeParaPrisma(parsed.data.badge) },
    });
    if (count === 0) return reply.code(404).send({ error: 'Item nao encontrado.' });

    const item = await prisma.menuItem.findUniqueOrThrow({
      where: { id: req.params.id },
      include: incluirFotos,
    });
    return reply.send(paraAPI(item));
  });

  // ─── DELETE /api/r/cardapio/:id ─────────────────────────────────────────
  //
  // ARQUIVA, nao apaga. OrderItem referencia MenuItem com onDelete padrao
  // (Restrict): um DELETE de verdade falharia em qualquer item ja vendido — e
  // "consertar" isso com Cascade apagaria o historico de pedidos junto,
  // reescrevendo faturamento de ciclo ja fechado.
  fastify.delete<{ Params: { id: string } }>('/api/r/cardapio/:id', auth, async (req, reply) => {
    const ctx = req.kitchen!;

    const { count } = await prisma.menuItem.updateMany({
      where: { id: req.params.id, kitchenId: ctx.kitchenId, archivedAt: null },
      // `available: false` junto: o cardapio do cliente filtra por arquivado,
      // mas qualquer consulta que olhe so `available` tambem para de oferecer.
      data: { archivedAt: new Date(), available: false },
    });
    if (count === 0) return reply.code(404).send({ error: 'Item nao encontrado.' });

    req.log.info({ menuItemId: req.params.id, kitchenId: ctx.kitchenId }, 'item arquivado');
    return reply.send({ ok: true });
  });

  // ─── POST /api/r/cardapio/:id/fotos ─────────────────────────────────────
  //
  // O arquivo NUNCA e guardado como veio: passa por `processarFoto`, que
  // reencoda, redimensiona e joga fora o metadado — inclusive o GPS que a
  // camera do celular grava. Ver lib/imagem.ts.
  fastify.post<{ Params: { id: string } }>(
    '/api/r/cardapio/:id/fotos',
    auth,
    async (req, reply) => {
      const ctx = req.kitchen!;

      const itemId = await itemDaCozinha(req.params.id, ctx.kitchenId);
      if (!itemId) return reply.code(404).send({ error: 'Item nao encontrado.' });

      if (!req.isMultipart()) {
        return reply.code(400).send({ error: 'Envie o arquivo como multipart/form-data.' });
      }

      const jaTem = await prisma.menuItemPhoto.count({ where: { menuItemId: itemId } });
      if (jaTem >= MAX_FOTOS) {
        return reply.code(409).send({ error: 'Maximo de ' + MAX_FOTOS + ' fotos por item.' });
      }

      const arquivo = await req.file();
      if (!arquivo) return reply.code(400).send({ error: 'Nenhum arquivo recebido.' });

      let bruto: Buffer;
      try {
        bruto = await arquivo.toBuffer();
      } catch {
        // O @fastify/multipart estoura aqui quando passa do limite configurado.
        return reply.code(413).send({ error: 'Imagem maior que 8 MB.' });
      }
      if (arquivo.file.truncated) {
        return reply.code(413).send({ error: 'Imagem maior que 8 MB.' });
      }

      let processada;
      try {
        processada = await processarFoto(bruto);
      } catch (e) {
        if (e instanceof ImagemInvalida) return reply.code(400).send({ error: e.message });
        throw e;
      }

      const storageKey = await guardar(processada.data, EXTENSAO);

      const foto = await prisma.menuItemPhoto.create({
        data: {
          menuItemId: itemId,
          storageKey,
          width: processada.width,
          height: processada.height,
          bytes: processada.bytes,
          // Entra no fim da fila. A primeira foto de um item vira capa
          // sozinha, que e o que se espera de quem so vai enviar uma.
          sortOrder: jaTem,
        },
      });

      req.log.info(
        { menuItemId: itemId, fotoId: foto.id, bytes: processada.bytes },
        'foto de item enviada',
      );

      return reply.code(201).send({
        id: foto.id,
        url: urlDaFoto(foto.storageKey),
        width: foto.width,
        height: foto.height,
      });
    },
  );

  // ─── DELETE /api/r/cardapio/:id/fotos/:fotoId ───────────────────────────
  fastify.delete<{ Params: { id: string; fotoId: string } }>(
    '/api/r/cardapio/:id/fotos/:fotoId',
    auth,
    async (req, reply) => {
      const ctx = req.kitchen!;

      // O join ate a cozinha e o isolamento: sem ele, bastaria conhecer um id
      // de foto pra apagar a do vizinho.
      const foto = await prisma.menuItemPhoto.findFirst({
        where: {
          id: req.params.fotoId,
          menuItemId: req.params.id,
          menuItem: { kitchenId: ctx.kitchenId },
        },
        select: { id: true, storageKey: true },
      });
      if (!foto) return reply.code(404).send({ error: 'Foto nao encontrada.' });

      // A LINHA PRIMEIRO. Se o arquivo sumisse e o banco falhasse depois,
      // sobraria uma linha apontando pra nada — buraco no cardapio. Nesta
      // ordem o pior caso e um arquivo orfao no disco, que e so lixo.
      await prisma.menuItemPhoto.delete({ where: { id: foto.id } });
      await apagar(foto.storageKey);

      return reply.send({ ok: true });
    },
  );

  // ─── PATCH /api/r/cardapio/:id/fotos/:fotoId/capa ───────────────────────
  //
  // Reordenar arrastando seria melhor, mas exige gesto preciso num tablet que
  // costuma estar engordurado. "Virar capa" resolve o caso que importa: a
  // unica ordem que o cliente enxerga na lista e quem esta em primeiro.
  fastify.patch<{ Params: { id: string; fotoId: string } }>(
    '/api/r/cardapio/:id/fotos/:fotoId/capa',
    auth,
    async (req, reply) => {
      const ctx = req.kitchen!;

      const itemId = await itemDaCozinha(req.params.id, ctx.kitchenId);
      if (!itemId) return reply.code(404).send({ error: 'Item nao encontrado.' });

      const fotos = await prisma.menuItemPhoto.findMany({
        where: { menuItemId: itemId },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: { id: true },
      });
      if (!fotos.some((f) => f.id === req.params.fotoId)) {
        return reply.code(404).send({ error: 'Foto nao encontrada.' });
      }

      // Reescreve a ordem inteira numa transacao: a escolhida em 0, o resto
      // atras preservando a ordem relativa. Mexer so na escolhida deixaria
      // duas fotos com sortOrder 0, e a capa passaria a depender do desempate.
      const nova = [
        req.params.fotoId,
        ...fotos.filter((f) => f.id !== req.params.fotoId).map((f) => f.id),
      ];
      await prisma.$transaction(
        nova.map((id, i) => prisma.menuItemPhoto.update({ where: { id }, data: { sortOrder: i } })),
      );

      return reply.send({ ok: true });
    },
  );

  // ─── GET /api/r/perfil ──────────────────────────────────────────────────
  fastify.get('/api/r/perfil', auth, async (req, reply) => {
    const ctx = req.kitchen!;
    const k = await prisma.kitchen.findUnique({ where: { id: ctx.kitchenId } });
    if (!k) return reply.code(404).send({ error: 'Cozinha nao encontrada.' });

    const response: PerfilCozinhaResponse = {
      id: k.id,
      slug: k.slug,
      name: k.name,
      category: k.category,
      tagline: k.tagline,
      description: k.description,
      photoUrl: k.photoUrl,
      slaMinutes: k.slaMinutes,
      status: k.status,
    };
    return reply.send(response);
  });

  // ─── PATCH /api/r/perfil ────────────────────────────────────────────────
  fastify.patch('/api/r/perfil', auth, async (req, reply) => {
    const ctx = req.kitchen!;
    const parsed = perfilCozinhaSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: 'Perfil invalido.', details: parsed.error.flatten().fieldErrors });
    }

    const k = await prisma.kitchen.update({
      where: { id: ctx.kitchenId },
      data: parsed.data,
    });

    // Pausar tira a cozinha do quintal do cliente na hora. Vale log: e a
    // pergunta "por que sumi do app?" chegando pro suporte.
    if (parsed.data.status) {
      req.log.info(
        { kitchenId: ctx.kitchenId, status: parsed.data.status, por: ctx.email },
        'status da cozinha alterado',
      );
    }

    const response: PerfilCozinhaResponse = {
      id: k.id,
      slug: k.slug,
      name: k.name,
      category: k.category,
      tagline: k.tagline,
      description: k.description,
      photoUrl: k.photoUrl,
      slaMinutes: k.slaMinutes,
      status: k.status,
    };
    return reply.send(response);
  });

  // ─── GET /api/r/historico ───────────────────────────────────────────────
  //
  // O que JA SAIU da fila: retirado ou cancelado. Pedido em andamento nao entra
  // — ele esta na fila, e ver o mesmo pedido nos dois lugares confunde quem
  // esta conferindo o dia.
  fastify.get('/api/r/historico', auth, async (req, reply) => {
    const ctx = req.kitchen!;
    const q = janelaDiasSchema.safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: 'dias deve ser 1..90.' });

    const desde = inicioDeNDiasAtras(q.data.dias);

    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: desde },
        // So pedidos que tem item DESTA cozinha. O join e o isolamento.
        items: { some: { kitchenId: ctx.kitchenId } },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        shortId: true,
        createdAt: true,
        table: { select: { numero: true } },
        items: {
          where: { kitchenId: ctx.kitchenId },
          select: {
            qty: true,
            unitPriceCents: true,
            nameSnapshot: true,
            status: true,
            pickedAt: true,
            canceledAt: true,
          },
        },
      },
      // Teto: a tela e "o dia", nao um relatorio. Sem limite, 90 dias de uma
      // praca movimentada viraria uma resposta de megabytes.
      take: 500,
    });

    const pedidos: HistoricoPedido[] = [];
    for (const o of orders) {
      const ativos = o.items.filter((i) => i.status !== 'cancelado');

      // Fechado = todos os itens desta cozinha sairam da fila. Um pedido com
      // item ainda 'preparando' continua sendo trabalho, nao historico.
      const todosRetirados = ativos.length > 0 && ativos.every((i) => i.status === 'retirado');
      const tudoCancelado = ativos.length === 0;
      if (!todosRetirados && !tudoCancelado) continue;

      const datas = o.items
        .map((i) => i.pickedAt ?? i.canceledAt)
        .filter((d): d is Date => d != null);
      const fechadoEm = datas.length > 0 ? new Date(Math.max(...datas.map((d) => +d))) : o.createdAt;

      pedidos.push({
        id: o.id,
        shortId: o.shortId,
        mesaNumero: o.table.numero,
        createdAt: o.createdAt.toISOString(),
        fechadoEm: fechadoEm.toISOString(),
        status: tudoCancelado ? 'cancelado' : 'retirado',
        itens: o.items.map((i) => ({
          qty: i.qty,
          name: i.nameSnapshot,
          status: i.status as OrderItemStatus,
        })),
        totalCents: totalAtivoCents(o.items),
      });
    }

    const entregues = pedidos.filter((p) => p.status === 'retirado');
    const receitaCents = entregues.reduce((a, p) => a + p.totalCents, 0);

    const response: HistoricoResponse = {
      dias: q.data.dias,
      pedidos,
      totais: {
        entregues: entregues.length,
        cancelados: pedidos.length - entregues.length,
        receitaCents,
        // Divide pelos ENTREGUES: incluir cancelado no denominador derrubaria o
        // ticket sem que nada tenha mudado no que a cozinha vende.
        ticketMedioCents: entregues.length > 0 ? Math.round(receitaCents / entregues.length) : 0,
      },
    };
    return reply.send(response);
  });

  // ─── GET /api/r/metricas ────────────────────────────────────────────────
  fastify.get('/api/r/metricas', auth, async (req, reply) => {
    const ctx = req.kitchen!;
    const q = janelaDiasSchema.safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: 'dias deve ser 1..90.' });

    const desde = inicioDeNDiasAtras(q.data.dias);

    const itens = await prisma.orderItem.findMany({
      where: {
        kitchenId: ctx.kitchenId,
        createdAt: { gte: desde },
        // Cancelado nao vendeu. Contar como carro-chefe o prato que mais some
        // do estoque seria o inverso da verdade.
        status: { not: 'cancelado' },
      },
      select: {
        qty: true,
        unitPriceCents: true,
        nameSnapshot: true,
        createdAt: true,
        orderId: true,
      },
    });

    const porNome = new Map<string, { qty: number; receitaCents: number }>();
    const porHora = new Map<number, { pedidos: Set<string>; receitaCents: number }>();
    const pedidos = new Set<string>();
    let receitaCents = 0;

    for (const i of itens) {
      const valor = i.qty * i.unitPriceCents;
      receitaCents += valor;
      pedidos.add(i.orderId);

      // Agrupa pelo NOME EM SNAPSHOT, nao pelo menuItemId: item renomeado ou
      // arquivado ainda precisa aparecer no ranking do periodo em que vendeu.
      const n = porNome.get(i.nameSnapshot) ?? { qty: 0, receitaCents: 0 };
      n.qty += i.qty;
      n.receitaCents += valor;
      porNome.set(i.nameSnapshot, n);

      const h = i.createdAt.getHours();
      const bloco = porHora.get(h) ?? { pedidos: new Set<string>(), receitaCents: 0 };
      bloco.pedidos.add(i.orderId);
      bloco.receitaCents += valor;
      porHora.set(h, bloco);
    }

    const response: MetricasResponse = {
      dias: q.data.dias,
      carroChefe: [...porNome.entries()]
        .map(([name, v]) => ({ name, qty: v.qty, receitaCents: v.receitaCents }))
        // Empate pelo nome pra a lista nao dancar entre dois carregamentos.
        .sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name))
        .slice(0, 10),
      pedidosCount: pedidos.size,
      receitaCents,
      ticketMedioCents: pedidos.size > 0 ? Math.round(receitaCents / pedidos.size) : 0,
      porHora: [...porHora.entries()]
        .map(([hora, v]) => ({ hora, pedidos: v.pedidos.size, receitaCents: v.receitaCents }))
        .sort((a, b) => a.hora - b.hora),
    };
    return reply.send(response);
  });
}

/** Endereco publico de uma foto guardada. Ver modules/fotos.ts. */
function urlDaFoto(storageKey: string): string {
  return '/api/fotos/' + storageKey;
}

/** Meia-noite local de N-1 dias atrás. `dias: 1` = hoje desde as 00h. */
function inicioDeNDiasAtras(dias: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (dias - 1));
  return d;
}
