import type { FastifyInstance } from 'fastify';
import {
  criarItemCardapioSchema,
  editarItemCardapioSchema,
  criarCategoriaSchema,
  editarCategoriaSchema,
  ordenarCategoriasSchema,
  excluirCategoriaSchema,
  perfilCozinhaSchema,
  janelaDiasSchema,
  type CardapioResponse,
  type CategoriaCardapio,
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
import { guardar, apagar, urlPublica } from '../lib/armazenamento.js';
import { fotoDaCozinha } from '../lib/fotoDaCozinha.js';

/**
 * Teto de fotos por item.
 *
 * Nao e limitacao tecnica: e edicao. Um prato com doze fotos vira album, o
 * cliente rola sem decidir nada e a primeira — que e a que vende — se perde.
 */
const MAX_FOTOS = 6;

/**
 * Teto de secoes por cardapio.
 *
 * Tambem e edicao, nao limite tecnico: a linha de secoes do app do cliente e
 * uma grade de celulas iguais. Passando de uma dezena, cada celula fica estreita
 * demais pra caber o nome, e o cliente perde de vista o cardapio inteiro logo na
 * primeira tela.
 */
const MAX_CATEGORIAS = 12;

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
    categoriaId: string;
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
    categoriaId: i.categoriaId,
    name: i.name,
    description: i.description,
    priceCents: i.priceCents,
    photoUrl: i.photoUrl,
    fotos: (i.fotos ?? []).map((f) => ({
      id: f.id,
      url: urlPublica(f.storageKey),
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

  /** Confirma que a secao e da cozinha logada. Devolve o id, ou `null`. */
  async function categoriaDaCozinha(id: string, kitchenId: string): Promise<string | null> {
    const c = await prisma.menuCategoria.findFirst({
      where: { id, kitchenId },
      select: { id: true },
    });
    return c?.id ?? null;
  }

  /**
   * As secoes do cardapio, na ordem de exibicao, com quantos itens tem cada uma.
   *
   * `itemCount` conta so o que esta VALENDO (nao arquivado): e o numero que a
   * cozinha reconhece olhando o proprio cardapio. Apagar uma secao, porem, olha
   * os arquivados tambem — eles continuam apontando pra ela.
   */
  async function categoriasDaCozinha(kitchenId: string): Promise<CategoriaCardapio[]> {
    const linhas = await prisma.menuCategoria.findMany({
      where: { kitchenId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        sortOrder: true,
        _count: { select: { items: { where: { archivedAt: null } } } },
      },
    });
    return linhas.map((c) => ({
      id: c.id,
      name: c.name,
      sortOrder: c.sortOrder,
      itemCount: c._count.items,
    }));
  }

  /**
   * Traduz a violacao de nome repetido do Postgres numa frase que se entende.
   *
   * O unique e (kitchenId, name). Sem isto o app mostraria "Unique constraint
   * failed on the fields: (kitchenId,name)" pra quem so quis criar duas secoes
   * com o mesmo nome sem perceber.
   */
  const nomeRepetido = (e: unknown) =>
    typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2002';

  // ─── GET /api/r/cardapio ────────────────────────────────────────────────
  fastify.get('/api/r/cardapio', auth, async (req) => {
    const ctx = req.kitchen!;

    const [categorias, items] = await Promise.all([
      categoriasDaCozinha(ctx.kitchenId),
      prisma.menuItem.findMany({
        // `archivedAt: null`: item excluido pela cozinha some daqui, mas continua
        // no banco porque OrderItem aponta pra ele — ver o comentario no schema.
        where: { kitchenId: ctx.kitchenId, archivedAt: null },
        orderBy: [{ categoria: { sortOrder: 'asc' } }, { sortOrder: 'asc' }, { name: 'asc' }],
        include: incluirFotos,
      }),
    ]);

    const response: CardapioResponse = { categorias, items: items.map(paraAPI) };
    return response;
  });

  // ─── POST /api/r/cardapio/categorias ────────────────────────────────────
  //
  // Os topicos do cardapio sao da COZINHA. Eram um enum de quatro valores ate
  // 2026-08-27, o que obrigava padaria, bar e sorveteria a se descrever com o
  // vocabulario de um restaurante.
  fastify.post('/api/r/cardapio/categorias', auth, async (req, reply) => {
    const ctx = req.kitchen!;
    const parsed = criarCategoriaSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: 'Secao invalida.', details: parsed.error.flatten().fieldErrors });
    }

    const quantas = await prisma.menuCategoria.count({ where: { kitchenId: ctx.kitchenId } });
    if (quantas >= MAX_CATEGORIAS) {
      return reply.code(409).send({
        error: `O cardapio cabe ate ${MAX_CATEGORIAS} secoes. Junte duas antes de criar outra.`,
      });
    }

    // A nova entra no FIM. Chegar no meio mexeria numa ordem que a cozinha
    // decidiu, e ela nao pediu isso — so pediu uma secao a mais.
    const ultima = await prisma.menuCategoria.findFirst({
      where: { kitchenId: ctx.kitchenId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    try {
      const criada = await prisma.menuCategoria.create({
        // `kitchenId` do TOKEN, nunca do body — mesma regra do item.
        data: {
          kitchenId: ctx.kitchenId,
          name: parsed.data.name,
          sortOrder: (ultima?.sortOrder ?? -1) + 1,
        },
        select: { id: true, name: true, sortOrder: true },
      });
      req.log.info(
        { categoriaId: criada.id, kitchenId: ctx.kitchenId },
        'secao de cardapio criada',
      );
      const resposta: CategoriaCardapio = { ...criada, itemCount: 0 };
      return reply.code(201).send(resposta);
    } catch (e) {
      if (nomeRepetido(e)) {
        return reply.code(409).send({ error: 'Ja existe uma secao com esse nome.' });
      }
      throw e;
    }
  });

  // ─── PATCH /api/r/cardapio/categorias/ordem ─────────────────────────────
  //
  // Vem ANTES da rota com `:id` por clareza — o roteador do Fastify ja prefere
  // o trecho literal, mas quem le o arquivo nao deveria precisar saber disso.
  //
  // Recebe a lista INTEIRA e reescreve numa transacao. O porque esta no schema
  // (ordenarCategoriasSchema): mover de um em um deixa duas secoes na mesma
  // posicao se a segunda escrita falhar.
  fastify.patch('/api/r/cardapio/categorias/ordem', auth, async (req, reply) => {
    const ctx = req.kitchen!;
    const parsed = ordenarCategoriasSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: 'Ordem invalida.', details: parsed.error.flatten().fieldErrors });
    }

    const { ids } = parsed.data;
    if (new Set(ids).size !== ids.length) {
      return reply.code(400).send({ error: 'A mesma secao apareceu duas vezes na ordem.' });
    }

    // Todas tem que ser da cozinha logada, e tem que ser TODAS as que ela tem:
    // uma lista parcial deixaria as de fora com posicao repetida, e o cardapio
    // escolheria sozinho quem vem antes.
    const minhas = await prisma.menuCategoria.findMany({
      where: { kitchenId: ctx.kitchenId },
      select: { id: true },
    });
    const conhecidas = new Set(minhas.map((c) => c.id));
    if (ids.length !== minhas.length || ids.some((id) => !conhecidas.has(id))) {
      return reply
        .code(400)
        .send({ error: 'A ordem precisa listar todas as secoes do cardapio.' });
    }

    await prisma.$transaction(
      ids.map((id, i) =>
        // `updateMany` com kitchenId no where mesmo depois da checagem acima: a
        // garantia de dono fica na propria escrita, nao numa leitura anterior.
        prisma.menuCategoria.updateMany({
          where: { id, kitchenId: ctx.kitchenId },
          data: { sortOrder: i },
        }),
      ),
    );

    return reply.send({ categorias: await categoriasDaCozinha(ctx.kitchenId) });
  });

  // ─── PATCH /api/r/cardapio/categorias/:id ───────────────────────────────
  //
  // So o nome. O item aponta pro ID, entao renomear NAO move item de lugar — e
  // era exatamente isso que o enum nao deixava fazer.
  fastify.patch<{ Params: { id: string } }>(
    '/api/r/cardapio/categorias/:id',
    auth,
    async (req, reply) => {
      const ctx = req.kitchen!;
      const parsed = editarCategoriaSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: 'Secao invalida.', details: parsed.error.flatten().fieldErrors });
      }

      try {
        const { count } = await prisma.menuCategoria.updateMany({
          where: { id: req.params.id, kitchenId: ctx.kitchenId },
          data: { name: parsed.data.name },
        });
        if (count === 0) return reply.code(404).send({ error: 'Secao nao encontrada.' });
      } catch (e) {
        if (nomeRepetido(e)) {
          return reply.code(409).send({ error: 'Ja existe uma secao com esse nome.' });
        }
        throw e;
      }

      return reply.send({ categorias: await categoriasDaCozinha(ctx.kitchenId) });
    },
  );

  // ─── DELETE /api/r/cardapio/categorias/:id ──────────────────────────────
  //
  // Apaga DE VERDADE (diferente do item, que arquiva): secao nao aparece em
  // pedido nenhum, entao nao ha historico pra preservar. O que ela nao pode e
  // levar item junto — por isso o `destino`.
  fastify.delete<{ Params: { id: string }; Querystring: { destino?: string } }>(
    '/api/r/cardapio/categorias/:id',
    auth,
    async (req, reply) => {
      const ctx = req.kitchen!;
      const parsed = excluirCategoriaSchema.safeParse(req.query);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: 'Pedido invalido.', details: parsed.error.flatten().fieldErrors });
      }

      const id = await categoriaDaCozinha(req.params.id, ctx.kitchenId);
      if (!id) return reply.code(404).send({ error: 'Secao nao encontrada.' });

      // A ultima nao sai. Sem nenhuma secao o cardapio nao teria onde por o
      // proximo item — e a cozinha descobriria isso no meio do servico, tentando
      // cadastrar um prato. Renomear resolve o caso real ("quero outra coisa
      // aqui") sem criar esse buraco.
      const quantas = await prisma.menuCategoria.count({ where: { kitchenId: ctx.kitchenId } });
      if (quantas <= 1) {
        return reply.code(409).send({
          error: 'O cardapio precisa de pelo menos uma secao. Renomeie esta em vez de apagar.',
        });
      }

      // Conta o ARQUIVADO tambem: ele continua apontando pra ca, e a chave
      // estrangeira (Restrict) barraria o DELETE mesmo sem nada visivel dentro.
      const itens = await prisma.menuItem.count({ where: { categoriaId: id } });

      if (itens > 0) {
        const destino = parsed.data.destino;
        if (!destino || destino === id) {
          return reply.code(409).send({
            error: 'Escolha pra onde vao os itens desta secao antes de apagar.',
            itemCount: itens,
          });
        }
        if (!(await categoriaDaCozinha(destino, ctx.kitchenId))) {
          return reply.code(400).send({ error: 'Essa secao de destino nao e do seu cardapio.' });
        }

        // Mover e apagar na MESMA transacao: se o apagar falhasse depois de
        // mover, os itens teriam trocado de secao sem que ninguem pedisse.
        await prisma.$transaction([
          prisma.menuItem.updateMany({
            where: { categoriaId: id, kitchenId: ctx.kitchenId },
            data: { categoriaId: destino },
          }),
          prisma.menuCategoria.deleteMany({ where: { id, kitchenId: ctx.kitchenId } }),
        ]);
      } else {
        await prisma.menuCategoria.deleteMany({ where: { id, kitchenId: ctx.kitchenId } });
      }

      req.log.info(
        { categoriaId: id, kitchenId: ctx.kitchenId, itensMovidos: itens },
        'secao de cardapio apagada',
      );
      return reply.send({ categorias: await categoriasDaCozinha(ctx.kitchenId) });
    },
  );

  // ─── POST /api/r/cardapio ───────────────────────────────────────────────
  fastify.post('/api/r/cardapio', auth, async (req, reply) => {
    const ctx = req.kitchen!;
    const parsed = criarItemCardapioSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: 'Item invalido.', details: parsed.error.flatten().fieldErrors });
    }

    // A secao vem do body (e um id), entao PRECISA ser conferida: sem isto
    // bastaria conhecer um id pra pendurar um item no cardapio da vizinha.
    if (!(await categoriaDaCozinha(parsed.data.categoriaId, ctx.kitchenId))) {
      return reply.code(400).send({ error: 'Essa secao nao e do seu cardapio.' });
    }

    const item = await prisma.menuItem.create({
      // `kitchenId` vem do TOKEN, nunca do body: aceitar do cliente deixaria
      // qualquer cozinha escrever no cardapio da vizinha.
      data: {
        kitchenId: ctx.kitchenId,
        categoriaId: parsed.data.categoriaId,
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

    // Mudar de secao passa pela mesma conferencia da criacao: o id vem do body.
    if (
      parsed.data.categoriaId !== undefined &&
      !(await categoriaDaCozinha(parsed.data.categoriaId, ctx.kitchenId))
    ) {
      return reply.code(400).send({ error: 'Essa secao nao e do seu cardapio.' });
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
        url: urlPublica(foto.storageKey),
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

    return reply.send(montarPerfil(k));
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

    return reply.send(montarPerfil(k));
  });

  // ─── POST /api/r/perfil/foto ────────────────────────────────────────────
  //
  // Sobe a foto de capa da cozinha do proprio dispositivo. Mesmo caminho da
  // foto de prato: `processarFoto` reencoda pra webp, redimensiona e joga fora
  // o metadado — inclusive o GPS que a camera do celular grava. Ver
  // lib/imagem.ts.
  fastify.post('/api/r/perfil/foto', auth, async (req, reply) => {
    const ctx = req.kitchen!;

    if (!req.isMultipart()) {
      return reply.code(400).send({ error: 'Envie o arquivo como multipart/form-data.' });
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

    const anterior = await prisma.kitchen.findUnique({
      where: { id: ctx.kitchenId },
      select: { photoKey: true },
    });

    const photoKey = await guardar(processada.data, EXTENSAO);
    const k = await prisma.kitchen.update({
      where: { id: ctx.kitchenId },
      data: { photoKey },
    });

    // So depois do commit. Apagar antes deixaria a cozinha sem foto nenhuma se
    // a escrita no banco falhasse — e o arquivo velho ja teria ido embora.
    if (anterior?.photoKey) await apagar(anterior.photoKey);

    req.log.info(
      { kitchenId: ctx.kitchenId, bytes: processada.bytes },
      'foto da cozinha enviada',
    );

    return reply.code(201).send(montarPerfil(k));
  });

  // ─── DELETE /api/r/perfil/foto ──────────────────────────────────────────
  //
  // Tira SO a foto enviada. A URL antiga, se existir, volta a valer — e ela
  // tem campo proprio no formulario, entao apagar as duas aqui seria mexer no
  // que a cozinha nao pediu pra mexer.
  fastify.delete('/api/r/perfil/foto', auth, async (req, reply) => {
    const ctx = req.kitchen!;

    const anterior = await prisma.kitchen.findUnique({
      where: { id: ctx.kitchenId },
      select: { photoKey: true },
    });

    const k = await prisma.kitchen.update({
      where: { id: ctx.kitchenId },
      data: { photoKey: null },
    });

    if (anterior?.photoKey) await apagar(anterior.photoKey);

    req.log.info({ kitchenId: ctx.kitchenId }, 'foto da cozinha removida');
    return reply.send(montarPerfil(k));
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

function montarPerfil(k: {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  tagline: string | null;
  description: string | null;
  photoUrl: string | null;
  photoKey: string | null;
  slaMinutes: number;
  status: 'ativa' | 'pausada' | 'rascunho';
}): PerfilCozinhaResponse {
  return {
    id: k.id,
    slug: k.slug,
    name: k.name,
    category: k.category,
    tagline: k.tagline,
    description: k.description,
    // O formulario precisa dos DOIS separados: `foto` e o que esta valendo,
    // `photoUrl` e o campo antigo que ele ainda deixa editar. Colapsar num so
    // deixaria a tela sem saber qual dos dois o botao "remover" apaga.
    foto: fotoDaCozinha(k),
    photoUrl: k.photoUrl,
    slaMinutes: k.slaMinutes,
    status: k.status,
  };
}

/** Meia-noite local de N-1 dias atrás. `dias: 1` = hoje desde as 00h. */
function inicioDeNDiasAtras(dias: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (dias - 1));
  return d;
}
