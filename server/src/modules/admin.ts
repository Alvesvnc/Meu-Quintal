import type { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import {
  donoLoginSchema,
  conviteCozinhaSchema,
  mesaStatusSchema,
  acordoSchema,
  financeiroQuerySchema,
  fecharCicloSchema,
  cobrancaStatusSchema,
  type DonoLoginResponse,
  type DonoMeResponse,
  type OverviewResponse,
  type CozinhaResumo,
  type FinanceiroResponse,
  type CobrancaLinha,
  type MesaResumo,
  type ConviteResponse,
  type DesempenhoMesasResponse,
} from '@mq/shared';
import { prisma } from '../lib/prisma.js';
import { senhaConfere } from '../lib/senha.js';
import { exigeContaAtiva } from '../plugins/auth-dono.js';
import { calcularCobranca, janelaDoCiclo, refMonthDe } from '../lib/cobranca.js';
import { totalAtivoCents } from '../lib/orderStatus.js';
import { brutoVisivel, somarVisiveis } from '../lib/faturamento.js';
import { ranquearMesas } from '../lib/desempenhoMesa.js';
import { podeAdicionarCozinha } from '../lib/planos.js';
import { enviar, emailAtivo, conviteDeCozinha } from '../lib/email.js';
import { env } from '../lib/env.js';
import { loginsFalhados, ciclosFechados } from '../plugins/observabilidade.js';

/**
 * Rotas do app do dono, sob /api/a/*.
 *
 * ISOLAMENTO: /api/a/auth/login e publica; todo o resto passa por
 * `app.authDono`, que popula `req.conta.accountId`. NENHUMA query aqui pode
 * rodar sem filtrar por esse accountId — e o que separa um cliente do SaaS do
 * outro. O helper `espacoDaConta` centraliza isso: buscar Space por id sem
 * conferir a conta seria o vazamento classico de multi-tenant.
 */

/** Dias de validade de um convite. */
const CONVITE_VALIDO_DIAS = 7;

/** Resolve um espaco GARANTINDO que ele pertence a conta do requisitante. */
async function espacoDaConta(accountId: string, spaceSlug?: string) {
  return prisma.space.findFirst({
    where: spaceSlug ? { accountId, slug: spaceSlug } : { accountId },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Recorte de "hoje" no fuso do Brasil, nao em UTC.
 *
 * Sem isso, um pedido das 22h de sabado apareceria como domingo pro dono — o
 * horario de pico do quintal cai justamente depois das 21h UTC-3.
 */
function inicioDeHoje(): Date {
  const agora = new Date();
  // -03:00 fixo. Simplificacao consciente: o Brasil nao tem horario de verao
  // desde 2019. Se voltar, trocar por uma lib de timezone.
  const brasilia = new Date(agora.getTime() - 3 * 60 * 60 * 1000);
  brasilia.setUTCHours(0, 0, 0, 0);
  return new Date(brasilia.getTime() + 3 * 60 * 60 * 1000);
}

/** Decimal do Prisma chega como objeto; o contrato da API e number. */
const paraNumero = (d: unknown): number => Number(d);

export async function adminRoutes(fastify: FastifyInstance) {
  const soLeitura = { preHandler: fastify.authDono };
  const escrita = {
    preHandler: [fastify.authDono, fastify.exigePapel('owner', 'admin'), exigeContaAtiva],
  };
  const soFinanceiro = {
    preHandler: [fastify.authDono, fastify.exigePapel('owner', 'admin')],
  };

  // ─── POST /api/a/auth/login ─────────────────────────────────────────────
  fastify.post(
    '/api/a/auth/login',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const parsed = donoLoginSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Email ou senha invalidos.' });
      }
      const { email, password } = parsed.data;

      const user = await prisma.accountUser.findUnique({
        where: { email: email.toLowerCase().trim() },
        include: { account: true },
      });

      // Mesma resposta pra usuario inexistente e senha errada: diferenciar as
      // duas entrega ao atacante uma lista de emails validos.
      if (!user || !(await senhaConfere(user.passwordHash, password))) {
        loginsFalhados.inc({ app: 'dono' });
        return reply.code(401).send({ error: 'Email ou senha invalidos.' });
      }

      if (user.account.status === 'cancelada') {
        return reply.code(403).send({ error: 'Esta conta foi cancelada.' });
      }

      prisma.accountUser
        .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
        .catch((err) => fastify.log.warn({ err }, 'falha ao atualizar lastLoginAt do dono'));

      const token = fastify.jwt.sign({
        kind: 'dono' as const,
        sub: user.id,
        accountId: user.accountId,
        accountSlug: user.account.slug,
        email: user.email,
        role: user.role,
        // Restaurante unico: o token ja sai autorizado tambem pras rotas da
        // cozinha. O vinculo e reconferido no banco a cada requisicao.
        ...(user.kitchenId ? { kitchenId: user.kitchenId } : {}),
      });

      const response: DonoLoginResponse = {
        token,
        me: await montarMe(user.id, user.accountId),
      };
      return reply.send(response);
    },
  );

  // ─── GET /api/a/auth/me ─────────────────────────────────────────────────
  fastify.get('/api/a/auth/me', soLeitura, async (req) => {
    const ctx = req.conta!;
    return montarMe(ctx.userId, ctx.accountId);
  });

  // ─── GET /api/a/overview ────────────────────────────────────────────────
  fastify.get<{ Querystring: { espaco?: string } }>(
    '/api/a/overview',
    soLeitura,
    async (req, reply) => {
      const ctx = req.conta!;
      const space = await espacoDaConta(ctx.accountId, req.query.espaco);
      if (!space) return reply.code(404).send({ error: 'Quintal nao encontrado.' });

      const desde = inicioDeHoje();

      const [pedidosHoje, mesas, cozinhas] = await Promise.all([
        prisma.order.findMany({
          where: { spaceId: space.id, createdAt: { gte: desde } },
          // Itens e nao `totalCents`: o total do pedido e o snapshot do que foi
          // PEDIDO e nao acompanha cancelamento nem reducao de quantidade.
          select: {
            items: { select: { qty: true, unitPriceCents: true, status: true } },
          },
        }),
        prisma.table.groupBy({
          by: ['status'],
          where: { spaceId: space.id, isActive: true },
          _count: true,
        }),
        prisma.kitchen.groupBy({
          by: ['status'],
          where: { spaceId: space.id },
          _count: true,
        }),
      ]);

      // O faturamento do dia e o que foi de fato VENDIDO. Somar o snapshot
      // inflaria o numero — e ficaria em desacordo com o proprio financeiro
      // desta mesma tela, que ja calcula por item.
      //
      // Conta TODAS as cozinhas, inclusive as que pagam so aluguel. Este e o
      // faturamento do ESPACO, nao de restaurante nenhum — e esta resposta nao
      // quebra por cozinha, entao nao ha o que identificar. Ver
      // lib/faturamento.ts, secao "onde a regra vale, e onde nao".
      const grossCents = pedidosHoje.reduce((a, o) => a + totalAtivoCents(o.items), 0);
      const contaMesa = (s: string) => mesas.find((m) => m.status === s)?._count ?? 0;
      const contaCozinha = (s: string) => cozinhas.find((k) => k.status === s)?._count ?? 0;

      const response: OverviewResponse = {
        space: {
          id: space.id,
          slug: space.slug,
          name: space.name,
          tipo: space.tipo === 'restaurante_unico' ? 'restaurante-unico' : 'food-court',
        },
        hoje: {
          ordersCount: pedidosHoje.length,
          grossCents,
          ticketMedioCents:
            pedidosHoje.length > 0 ? Math.round(grossCents / pedidosHoje.length) : 0,
        },
        mesas: {
          total: mesas.reduce((a, m) => a + m._count, 0),
          livres: contaMesa('livre'),
          ocupadas: contaMesa('ocupada'),
          precisamLimpar: contaMesa('precisa_limpar'),
        },
        cozinhas: {
          total: cozinhas.reduce((a, k) => a + k._count, 0),
          ativas: contaCozinha('ativa'),
          pausadas: contaCozinha('pausada'),
        },
      };
      return response;
    },
  );

  // ─── GET /api/a/cozinhas ────────────────────────────────────────────────
  fastify.get<{ Querystring: { espaco?: string } }>(
    '/api/a/cozinhas',
    soLeitura,
    async (req, reply) => {
      const ctx = req.conta!;
      const space = await espacoDaConta(ctx.accountId, req.query.espaco);
      if (!space) return reply.code(404).send({ error: 'Quintal nao encontrado.' });

      const desde = inicioDeHoje();
      const padrao = paraNumero(space.defaultCommissionPct);

      const cozinhas = await prisma.kitchen.findMany({
        where: { spaceId: space.id },
        orderBy: { name: 'asc' },
        include: {
          orderItems: {
            where: { createdAt: { gte: desde }, status: { not: 'cancelado' } },
            select: { qty: true, unitPriceCents: true, orderId: true },
          },
        },
      });

      const response: CozinhaResumo[] = cozinhas.map((k) => {
        const proprio = k.commissionPct === null ? null : paraNumero(k.commissionPct);

        // ESTA ROTA E DE CONFIGURACAO: responde "qual e o acordo com cada
        // cozinha", nao "como cada cozinha foi hoje". O movimento do dia e
        // operacao dela e nao e base de cobranca nenhuma — o que o dono cobra
        // sai do bruto do CICLO, que segue em /api/a/financeiro quando o
        // acordo tem comissao.
        //
        // Por isso o dia so aparece pra cozinha que o proprio usuario opera:
        // restaurante unico, ou dono de praca que tambem toca uma casinha.
        const propriaCozinha = k.id === ctx.kitchenId;

        return {
          id: k.id,
          slug: k.slug,
          name: k.name,
          category: k.category,
          status: k.status,
          slaMinutes: k.slaMinutes,
          // Pedidos distintos, nao linhas: 3 itens do mesmo pedido sao 1 pedido.
          ordersToday: propriaCozinha ? new Set(k.orderItems.map((i) => i.orderId)).size : null,
          grossTodayCents: propriaCozinha
            ? k.orderItems.reduce((a, i) => a + i.qty * i.unitPriceCents, 0)
            : null,
          acordo: {
            chargeCommission: k.chargeCommission,
            commissionPct: proprio,
            commissionPctEfetivo: k.chargeCommission ? (proprio ?? padrao) : 0,
            chargeRent: k.chargeRent,
            rentCents: k.rentCents,
          },
        };
      });
      return response;
    },
  );

  // ─── PATCH /api/a/cozinhas/:slug/acordo ─────────────────────────────────
  fastify.patch<{ Params: { slug: string }; Querystring: { espaco?: string } }>(
    '/api/a/cozinhas/:slug/acordo',
    escrita,
    async (req, reply) => {
      const ctx = req.conta!;
      const parsed = acordoSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: 'Acordo invalido.', details: parsed.error.flatten().fieldErrors });
      }

      const space = await espacoDaConta(ctx.accountId, req.query.espaco);
      if (!space) return reply.code(404).send({ error: 'Quintal nao encontrado.' });

      // updateMany com spaceId no where: um update por slug sozinho alcancaria
      // a cozinha homonima de outro cliente do SaaS.
      const { count } = await prisma.kitchen.updateMany({
        where: { slug: req.params.slug, spaceId: space.id },
        data: parsed.data,
      });

      if (count === 0) {
        return reply.code(404).send({ error: 'Cozinha nao encontrada nesse quintal.' });
      }

      req.log.info(
        { kitchenSlug: req.params.slug, por: ctx.email, acordo: parsed.data },
        'acordo financeiro alterado',
      );
      return reply.send({ ok: true });
    },
  );

  // ─── POST /api/a/cozinhas/convite ───────────────────────────────────────
  fastify.post<{ Querystring: { espaco?: string } }>(
    '/api/a/cozinhas/convite',
    escrita,
    async (req, reply) => {
      const ctx = req.conta!;
      const parsed = conviteCozinhaSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: 'Convite invalido.', details: parsed.error.flatten().fieldErrors });
      }

      const space = await espacoDaConta(ctx.accountId, req.query.espaco);
      if (!space) return reply.code(404).send({ error: 'Quintal nao encontrado.' });

      // ─── O TETO DO PLANO ────────────────────────────────────────────────
      //
      // E aqui que "restaurante unico" deixa de ser rotulo e vira regra: o
      // plano Restaurante nao convida uma segunda cozinha. Sem esta trava,
      // qualquer assinante do plano mais barato viraria praca sozinho.
      //
      // Conta CONVITE PENDENTE junto com cozinha existente: senao daria pra
      // disparar cinco convites e estourar o teto quando fossem aceitos.
      const conta = await prisma.account.findUniqueOrThrow({
        where: { id: ctx.accountId },
        select: { plan: true },
      });
      const [cozinhas, convitesAbertos] = await Promise.all([
        prisma.kitchen.count({ where: { spaceId: space.id } }),
        prisma.invite.count({
          where: { spaceId: space.id, kind: 'cozinha', acceptedAt: null, expiresAt: { gt: new Date() } },
        }),
      ]);

      const recusa = podeAdicionarCozinha(conta.plan, cozinhas + convitesAbertos);
      if (recusa) return reply.code(402).send({ error: recusa.motivo });

      // Token vai por email; o banco guarda so o hash. Vazamento de banco nao
      // pode virar convite aceitavel.
      const token = crypto.randomBytes(32).toString('base64url');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      const expiresAt = new Date(Date.now() + CONVITE_VALIDO_DIAS * 24 * 60 * 60 * 1000);

      const convite = await prisma.invite.create({
        data: {
          accountId: ctx.accountId,
          spaceId: space.id,
          email: parsed.data.email.toLowerCase().trim(),
          tokenHash,
          kind: 'cozinha',
          expiresAt,
          kitchenName: parsed.data.kitchenName,
          chargeCommission: parsed.data.chargeCommission,
          commissionPct: parsed.data.commissionPct,
          chargeRent: parsed.data.chargeRent,
          rentCents: parsed.data.rentCents,
        },
      });

      // O link leva pro app do RESTAURANTE, nao pro do dono: e la que a pessoa
      // vai trabalhar depois de aceitar.
      const link = `${env.APP_RESTAURANTE_URL}/convite/${token}`;

      // ─── O ENVIO NAO PODE DERRUBAR A CRIACAO ────────────────────────────
      //
      // O convite JA ESTA no banco. Se o Resend estiver fora do ar e a rota
      // respondesse erro, o dono acharia que precisa convidar de novo — e
      // criaria um segundo convite pra mesma pessoa. Falhou: registra e segue,
      // com o link na resposta pra ele mandar na mao.
      const envio = await enviar(
        conviteDeCozinha({
          para: convite.email,
          nomeDaCozinha: parsed.data.kitchenName,
          nomeDoQuintal: space.name,
          link,
          expiraEm: expiresAt,
        }),
      );
      if (!envio.enviado && emailAtivo()) {
        req.log.error({ inviteId: convite.id, erro: envio.erro }, 'falha ao enviar convite por email');
      }

      const response: ConviteResponse = {
        id: convite.id,
        email: convite.email,
        kind: 'cozinha',
        expiresAt: convite.expiresAt.toISOString(),
        emailEnviado: envio.enviado,
        // Unica vez que o token existe em texto puro. Continua vindo mesmo com
        // email ligado: email cai em spam, e sem o link o dono ficaria sem
        // saida nenhuma.
        linkDeAceite: link,
      };
      return reply.code(201).send(response);
    },
  );

  // ─── GET /api/a/financeiro ──────────────────────────────────────────────
  fastify.get<{ Querystring: { espaco?: string; refMonth?: string } }>(
    '/api/a/financeiro',
    soFinanceiro,
    async (req, reply) => {
      const ctx = req.conta!;
      const q = financeiroQuerySchema.safeParse(req.query);
      if (!q.success) {
        return reply.code(400).send({ error: 'refMonth deve ser "AAAA-MM".' });
      }

      const space = await espacoDaConta(ctx.accountId, req.query.espaco);
      if (!space) return reply.code(404).send({ error: 'Quintal nao encontrado.' });

      const refMonth = q.data.refMonth ?? refMonthDe(new Date());
      const { startsAt, endsAt } = janelaDoCiclo(refMonth);

      // Ciclo ja fechado: os valores estao congelados em kitchen_charges e sao
      // lidos como estao. Renegociar comissao depois NAO pode mexer no que ja
      // foi cobrado.
      const ciclo = await prisma.billingCycle.findUnique({
        where: { spaceId_refMonth: { spaceId: space.id, refMonth } },
        include: {
          charges: { include: { kitchen: { select: { slug: true, name: true } } } },
        },
      });

      if (ciclo?.status === 'fechado') {
        const linhas: CobrancaLinha[] = ciclo.charges.map((c) => ({
          chargeId: c.id,
          kitchenId: c.kitchenId,
          kitchenSlug: c.kitchen.slug,
          kitchenName: c.kitchen.name,
          // O acordo CONGELADO na cobranca, nao o atual da cozinha: um mes
          // fechado sob aluguel fixo continua protegido mesmo que a comissao
          // seja ligada depois.
          grossCents: brutoVisivel(
            c.grossCents,
            { id: c.kitchenId, chargeCommission: c.chargeCommission },
            ctx,
          ),
          commissionPct: paraNumero(c.commissionPct),
          commissionCents: c.commissionCents,
          rentCents: c.rentCents,
          totalDueCents: c.totalDueCents,
          status: c.status,
          paidAt: c.paidAt?.toISOString() ?? null,
        }));
        return montarFinanceiro(space, refMonth, startsAt, endsAt, true, linhas);
      }

      // Ciclo em andamento: calcula ao vivo a partir dos pedidos do periodo.
      const cozinhas = await prisma.kitchen.findMany({
        where: { spaceId: space.id },
        orderBy: { name: 'asc' },
        include: {
          orderItems: {
            where: {
              createdAt: { gte: startsAt, lte: endsAt },
              status: { not: 'cancelado' },
            },
            select: { qty: true, unitPriceCents: true },
          },
        },
      });

      const padrao = paraNumero(space.defaultCommissionPct);

      const linhas: CobrancaLinha[] = cozinhas.map((k) => {
        const grossCents = k.orderItems.reduce((a, i) => a + i.qty * i.unitPriceCents, 0);
        const calc = calcularCobranca(
          grossCents,
          {
            chargeCommission: k.chargeCommission,
            commissionPct: k.commissionPct === null ? null : paraNumero(k.commissionPct),
            chargeRent: k.chargeRent,
            rentCents: k.rentCents,
          },
          padrao,
        );
        return {
          // Ciclo aberto: nao ha linha gravada, entao nao ha o que marcar como
          // paga. O valor ainda sobe a cada pedido.
          chargeId: null,
          kitchenId: k.id,
          kitchenSlug: k.slug,
          kitchenName: k.name,
          grossCents: brutoVisivel(grossCents, k, ctx),
          ...calc,
          status: 'aberta' as const,
          paidAt: null,
        };
      });

      return montarFinanceiro(space, refMonth, startsAt, endsAt, false, linhas);
    },
  );

  // ─── GET /api/a/mesas/desempenho ────────────────────────────────────────
  //
  // Quais mesas rendem mais, no periodo. Rota separada de /api/a/mesas de
  // proposito: aquela e a visao do salao AGORA (quem esta ocupada, quem precisa
  // limpar) e roda o tempo todo; esta varre um mes inteiro e e consultada de
  // vez em quando. Juntar as duas encareceria a que roda sempre.
  //
  // `soFinanceiro`: e ferramenta de decisao do dono, nao de operacao de salao.
  fastify.get<{ Querystring: { espaco?: string; refMonth?: string } }>(
    '/api/a/mesas/desempenho',
    soFinanceiro,
    async (req, reply) => {
      const ctx = req.conta!;
      const q = financeiroQuerySchema.safeParse(req.query);
      if (!q.success) {
        return reply.code(400).send({ error: 'refMonth deve ser "AAAA-MM".' });
      }

      const space = await espacoDaConta(ctx.accountId, req.query.espaco);
      if (!space) return reply.code(404).send({ error: 'Quintal nao encontrado.' });

      const refMonth = q.data.refMonth ?? refMonthDe(new Date());
      const { startsAt, endsAt } = janelaDoCiclo(refMonth);

      const mesas = await prisma.table.findMany({
        where: { spaceId: space.id },
        orderBy: { numero: 'asc' },
        include: {
          orders: {
            where: { createdAt: { gte: startsAt, lte: endsAt } },
            select: {
              createdAt: true,
              items: { select: { qty: true, unitPriceCents: true, status: true } },
            },
          },
        },
      });

      // Conta TODAS as cozinhas. O salao e do dono: decidir layout, quantas
      // mesas e onde exige o numero cheio, e filtrar por acordo faria a mesa
      // boa da cozinha so-aluguel parecer fraca — decisao errada garantida.
      //
      // A resposta nao quebra por cozinha em lugar nenhum, entao o total nao
      // identifica ninguem. Ha teste guardando essa ausencia.
      const ranking = ranquearMesas(
        mesas.map((m) => ({
          id: m.id,
          numero: m.numero,
          isActive: m.isActive,
          criadaEm: m.createdAt,
          pedidos: m.orders.map((o) => ({
            em: o.createdAt,
            grossCents: totalAtivoCents(o.items),
          })),
        })),
        startsAt,
      );

      const response: DesempenhoMesasResponse = {
        refMonth,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        media: ranking.media,
        mesas: ranking.mesas,
      };
      return response;
    },
  );

  // ─── GET /api/a/mesas ───────────────────────────────────────────────────
  fastify.get<{ Querystring: { espaco?: string } }>(
    '/api/a/mesas',
    soLeitura,
    async (req, reply) => {
      const ctx = req.conta!;
      const space = await espacoDaConta(ctx.accountId, req.query.espaco);
      if (!space) return reply.code(404).send({ error: 'Quintal nao encontrado.' });

      const desde = inicioDeHoje();
      const mesas = await prisma.table.findMany({
        where: { spaceId: space.id },
        orderBy: { numero: 'asc' },
        include: {
          orders: {
            where: { createdAt: { gte: desde } },
            select: {
              items: { select: { qty: true, unitPriceCents: true, status: true } },
            },
          },
        },
      });

      // qrToken NAO entra na resposta: e a credencial da mesa. Devolve-lo aqui
      // colocaria o token em cache de browser, em screenshot e no devtools de
      // qualquer pessoa com acesso ao painel.
      const response: MesaResumo[] = mesas.map((m) => ({
        id: m.id,
        numero: m.numero,
        status: m.status === 'precisa_limpar' ? 'precisa-limpar' : m.status,
        isActive: m.isActive,
        ordersToday: m.orders.length,
        // O que a mesa de fato consumiu, contando TODAS as cozinhas: a mesa e
        // do dono, e o numero serve pra ele decidir salao. Nao quebra por
        // cozinha, entao nao identifica ninguem.
        grossTodayCents: m.orders.reduce((a, o) => a + totalAtivoCents(o.items), 0),
      }));
      return response;
    },
  );

  // ─── PATCH /api/a/mesas/:numero ─────────────────────────────────────────
  // staff tambem mexe: e a equipe de salao que marca mesa pra limpar.
  fastify.patch<{ Params: { numero: string }; Querystring: { espaco?: string } }>(
    '/api/a/mesas/:numero',
    { preHandler: [fastify.authDono, exigeContaAtiva] },
    async (req, reply) => {
      const ctx = req.conta!;
      const parsed = mesaStatusSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Status invalido.' });
      }

      const numero = Number(req.params.numero);
      if (!Number.isInteger(numero) || numero < 1) {
        return reply.code(400).send({ error: 'Numero de mesa invalido.' });
      }

      const space = await espacoDaConta(ctx.accountId, req.query.espaco);
      if (!space) return reply.code(404).send({ error: 'Quintal nao encontrado.' });

      const status =
        parsed.data.status === 'precisa-limpar' ? 'precisa_limpar' : parsed.data.status;

      const { count } = await prisma.table.updateMany({
        where: { spaceId: space.id, numero },
        data: { status },
      });

      if (count === 0) return reply.code(404).send({ error: 'Mesa nao encontrada.' });
      return reply.send({ ok: true, numero, status: parsed.data.status });
    },
  );

  // ─── POST /api/a/financeiro/fechar ──────────────────────────────────────
  // Congela o ciclo: calcula a cobranca de cada cozinha com o acordo VIGENTE
  // HOJE e grava os valores. Depois disso, renegociar comissao nao mexe no que
  // ja foi cobrado — e o motivo de KitchenCharge guardar snapshot.
  fastify.post<{ Querystring: { espaco?: string } }>(
    '/api/a/financeiro/fechar',
    { preHandler: [fastify.authDono, fastify.exigePapel('owner'), exigeContaAtiva] },
    async (req, reply) => {
      const ctx = req.conta!;
      const parsed = fecharCicloSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'refMonth deve ser "AAAA-MM".' });
      }

      const space = await espacoDaConta(ctx.accountId, req.query.espaco);
      if (!space) return reply.code(404).send({ error: 'Quintal nao encontrado.' });

      const { refMonth } = parsed.data;
      const { startsAt, endsAt } = janelaDoCiclo(refMonth);

      // Fechar um mes que ainda esta correndo cobraria menos do que o devido.
      if (endsAt.getTime() > Date.now()) {
        return reply.code(409).send({
          error: `O ciclo ${refMonth} ainda nao terminou. So da pra fechar depois de ${endsAt.toISOString().slice(0, 10)}.`,
        });
      }

      const jaExiste = await prisma.billingCycle.findUnique({
        where: { spaceId_refMonth: { spaceId: space.id, refMonth } },
        select: { status: true },
      });
      if (jaExiste?.status === 'fechado') {
        return reply.code(409).send({ error: `O ciclo ${refMonth} ja foi fechado.` });
      }

      const cozinhas = await prisma.kitchen.findMany({
        where: { spaceId: space.id },
        include: {
          orderItems: {
            where: { createdAt: { gte: startsAt, lte: endsAt }, status: { not: 'cancelado' } },
            select: { qty: true, unitPriceCents: true },
          },
        },
      });

      const padrao = paraNumero(space.defaultCommissionPct);

      const cobrancas = cozinhas.map((k) => {
        const grossCents = k.orderItems.reduce((a, i) => a + i.qty * i.unitPriceCents, 0);
        const calc = calcularCobranca(
          grossCents,
          {
            chargeCommission: k.chargeCommission,
            commissionPct: k.commissionPct === null ? null : paraNumero(k.commissionPct),
            chargeRent: k.chargeRent,
            rentCents: k.rentCents,
          },
          padrao,
        );
        // `chargeCommission` vai junto: e o que decide, dali em diante, se o
        // dono pode ver este `grossCents`. Ver KitchenCharge no schema.
        return { kitchenId: k.id, grossCents, chargeCommission: k.chargeCommission, ...calc };
      });

      // Transacao: ciclo fechado sem as cobrancas dentro seria um mes que
      // aparece como cobrado e nao cobra ninguem.
      const ciclo = await prisma.$transaction(async (tx) => {
        const c = await tx.billingCycle.upsert({
          where: { spaceId_refMonth: { spaceId: space.id, refMonth } },
          create: {
            spaceId: space.id,
            refMonth,
            startsAt,
            endsAt,
            status: 'fechado',
            closedAt: new Date(),
          },
          update: { status: 'fechado', closedAt: new Date() },
        });

        await tx.kitchenCharge.deleteMany({ where: { cycleId: c.id } });
        await tx.kitchenCharge.createMany({
          data: cobrancas.map((cb) => ({
            cycleId: c.id,
            kitchenId: cb.kitchenId,
            grossCents: cb.grossCents,
            chargeCommission: cb.chargeCommission,
            commissionPct: cb.commissionPct,
            commissionCents: cb.commissionCents,
            rentCents: cb.rentCents,
            totalDueCents: cb.totalDueCents,
            status: 'fechada' as const,
          })),
        });

        return c;
      });

      ciclosFechados.inc();

      const totalCents = cobrancas.reduce((a, c) => a + c.totalDueCents, 0);
      req.log.info(
        { refMonth, spaceId: space.id, por: ctx.email, totalCents },
        'ciclo de cobranca fechado',
      );

      return reply.code(201).send({
        ok: true,
        cicloId: ciclo.id,
        refMonth,
        cobrancas: cobrancas.length,
        totalDueCents: totalCents,
      });
    },
  );

  // ─── PATCH /api/a/cobrancas/:id ─────────────────────────────────────────
  // Baixa manual: o dinheiro nao passa pelo app, entao quem confirma que a
  // cozinha pagou e o dono.
  fastify.patch<{ Params: { id: string } }>(
    '/api/a/cobrancas/:id',
    { preHandler: [fastify.authDono, fastify.exigePapel('owner', 'admin'), exigeContaAtiva] },
    async (req, reply) => {
      const ctx = req.conta!;
      const parsed = cobrancaStatusSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Status invalido.' });
      }

      // O join ate a Account e o que impede baixar a cobranca de outro cliente
      // do SaaS so sabendo o id.
      const cobranca = await prisma.kitchenCharge.findFirst({
        where: { id: req.params.id, cycle: { space: { accountId: ctx.accountId } } },
        select: { id: true },
      });
      if (!cobranca) return reply.code(404).send({ error: 'Cobranca nao encontrada.' });

      const atualizada = await prisma.kitchenCharge.update({
        where: { id: cobranca.id },
        data: {
          status: parsed.data.status,
          note: parsed.data.note,
          paidAt: parsed.data.status === 'paga' ? new Date() : null,
        },
      });

      req.log.info(
        { cobrancaId: atualizada.id, status: atualizada.status, por: ctx.email },
        'status de cobranca alterado',
      );
      return reply.send({ ok: true, status: atualizada.status });
    },
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export async function montarMe(userId: string, accountId: string): Promise<DonoMeResponse> {
  const user = await prisma.accountUser.findUniqueOrThrow({
    where: { id: userId },
    include: {
      account: {
        include: {
          spaces: {
            orderBy: { createdAt: 'asc' },
            include: { _count: { select: { tables: true } } },
          },
        },
      },
    },
  });

  // Cinto e suspensorio: o accountId do token tem que bater com o do banco.
  if (user.accountId !== accountId) {
    throw new Error('Inconsistencia de conta no token');
  }

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    account: {
      id: user.account.id,
      slug: user.account.slug,
      name: user.account.name,
      plan: user.account.plan,
      status: user.account.status,
      trialEndsAt: user.account.trialEndsAt?.toISOString() ?? null,
    },
    spaces: user.account.spaces.map((s) => ({
      id: s.id,
      slug: s.slug,
      name: s.name,
      tipo: s.tipo === 'restaurante_unico' ? ('restaurante-unico' as const) : ('food-court' as const),
      defaultCommissionPct: paraNumero(s.defaultCommissionPct),
      closingDay: s.closingDay,
      tablesTotal: s._count.tables,
    })),
    // No restaurante unico, este e o vinculo que faz um login servir os dois apps.
    kitchenId: user.kitchenId,
  };
}

function montarFinanceiro(
  space: { id: string; slug: string; name: string; closingDay: number },
  refMonth: string,
  startsAt: Date,
  endsAt: Date,
  fechado: boolean,
  linhas: CobrancaLinha[],
): FinanceiroResponse {
  const visiveis = somarVisiveis(linhas.map((l) => l.grossCents));

  return {
    space: { id: space.id, slug: space.slug, name: space.name },
    refMonth,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    fechado,
    closingDay: space.closingDay,
    totais: {
      // Soma so o visivel. Esconder linha por linha e totalizar todo mundo no
      // rodape entregaria a oculta por subtracao — com cinco cozinhas isso e
      // conta de guardanapo, nao criptanalise.
      grossCents: visiveis.grossCents,
      commissionCents: linhas.reduce((a, l) => a + l.commissionCents, 0),
      rentCents: linhas.reduce((a, l) => a + l.rentCents, 0),
      aReceberCents: linhas.reduce((a, l) => a + l.totalDueCents, 0),
      grossParcial: visiveis.parcial,
      cozinhasOcultas: visiveis.ocultas,
    },
    linhas,
  };
}
