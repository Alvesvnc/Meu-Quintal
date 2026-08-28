import type { FastifyInstance } from 'fastify';
import type { AssinaturaResponse, CheckoutResponse, AssinaturaStatus } from '@mq/shared';
import { prisma } from '../lib/prisma.js';
import { env } from '../lib/env.js';
import { PLANOS, precoMensalCents, varDePreco } from '../lib/planos.js';
import { aoAbrirCheckout } from '../lib/assinatura.js';
import { pagamentoAtivo, criarCheckout, cancelarAssinatura, ErroAsaas } from '../lib/asaas.js';

/**
 * A assinatura do QRO, do lado do dono (/api/a/assinatura).
 *
 * É o dono pagando A NÓS. Não confundir com /api/a/financeiro, que é o dono
 * cobrando as cozinhas dele — aquele dinheiro nunca passa pelo app.
 */
export async function assinaturaRoutes(fastify: FastifyInstance) {
  const soLeitura = { preHandler: fastify.authDono };

  /**
   * PAGAR NÃO EXIGE CONTA ATIVA — e isso não é descuido.
   *
   * `exigeContaAtiva` devolve 402 pra conta suspensa. Aplicá-lo aqui fecharia a
   * porta na cara de quem está inadimplente, que é EXATAMENTE quem precisa
   * desta rota: a pessoa entraria pra regularizar e receberia "regularize o
   * pagamento" como resposta a tentar pagar. Um beco sem saída em que só eu
   * perco.
   *
   * `owner` e não `admin`: assinar e cancelar mexem no dinheiro da empresa.
   */
  const soDono = { preHandler: [fastify.authDono, fastify.exigePapel('owner')] };

  // ─── GET /api/a/assinatura ────────────────────────────────────────────────
  fastify.get('/api/a/assinatura', soLeitura, async (req) => {
    const ctx = req.conta!;

    const [conta, assinatura] = await Promise.all([
      prisma.account.findUniqueOrThrow({
        where: { id: ctx.accountId },
        select: { plan: true, trialEndsAt: true },
      }),
      prisma.assinatura.findUnique({ where: { accountId: ctx.accountId } }),
    ]);

    const status = (assinatura?.status ?? 'nenhuma') as AssinaturaStatus;
    const ativo = pagamentoAtivo();

    const response: AssinaturaResponse = {
      status,
      plan: conta.plan,
      planoNome: PLANOS[conta.plan].nome,
      // O preço CONGELADO na assinatura ganha do preço de tabela: quem já é
      // cliente precisa ver o que paga, não o que passaria a pagar.
      precoMensalCents: assinatura?.precoMensalCents ?? precoMensalCents(conta.plan),
      proximaCobrancaEm: assinatura?.proximaCobrancaEm?.toISOString() ?? null,
      trialEndsAt: conta.trialEndsAt?.toISOString() ?? null,
      podeAssinar: ativo && status !== 'ativa',
      pagamentoAtivo: ativo,
    };
    return response;
  });

  // ─── POST /api/a/assinatura/checkout ──────────────────────────────────────
  fastify.post('/api/a/assinatura/checkout', soDono, async (req, reply) => {
    const ctx = req.conta!;

    if (!pagamentoAtivo()) {
      return reply.code(503).send({ error: 'Pagamento ainda nao esta configurado.' });
    }

    const conta = await prisma.account.findUniqueOrThrow({
      where: { id: ctx.accountId },
      select: { id: true, name: true, plan: true },
    });

    const existente = await prisma.assinatura.findUnique({ where: { accountId: conta.id } });
    if (existente?.status === 'ativa') {
      // Deixar passar abriria uma SEGUNDA assinatura no provedor pra mesma
      // conta, e o cliente seria cobrado duas vezes todo mês.
      return reply.code(409).send({ error: 'Esta conta ja tem assinatura ativa.' });
    }

    const preco = precoMensalCents(conta.plan);
    if (preco === null) {
      // Falha barulhenta e específica. Sem isto, um preço não configurado
      // viraria cobrança de valor errado — e ninguém descobre até o extrato.
      req.log.error({ plano: conta.plan }, 'checkout pedido sem preco configurado');
      return reply.code(503).send({
        error: `Preco do plano ${PLANOS[conta.plan].nome} nao configurado. Defina ${varDePreco(conta.plan)}.`,
      });
    }

    const usuario = await prisma.accountUser.findUnique({
      where: { id: ctx.userId },
      select: { name: true, email: true },
    });

    let checkout;
    try {
      checkout = await criarCheckout({
        // Volta nos eventos de assinatura e é a pista mais forte que o webhook
        // tem pra saber de quem é o pagamento.
        referencia: conta.id,
        descricao: `QRO · plano ${PLANOS[conta.plan].nome}`,
        valorCents: preco,
        nome: usuario?.name ?? conta.name,
        email: usuario?.email,
        // PRIMEIRA MENSALIDADE HOJE. Assinar é passar a pagar; adiar o primeiro
        // vencimento pro fim do trial parece gentil e depende de um
        // comportamento do provedor que ainda não foi verificado em sandbox —
        // e o modo de falhar seria não cobrar ninguém, calado.
        primeiroVencimento: new Date(),
        // A assinatura vive dentro da tela de Conta; não há rota própria.
        // Apontar pra uma que não existe mandaria quem acabou de pagar pra um
        // 404 — a pior tela possível logo depois de passar o cartão.
        urlSucesso: `${env.APP_DONO_URL}/conta?assinatura=sucesso`,
        urlCancelado: `${env.APP_DONO_URL}/conta?assinatura=cancelado`,
        urlExpirado: `${env.APP_DONO_URL}/conta?assinatura=expirado`,
      });
    } catch (err) {
      if (err instanceof ErroAsaas) {
        // O erro do provedor vai pro log inteiro, mas pra tela vai só o
        // essencial: a resposta dele pode carregar detalhe de conta.
        req.log.error(
          { err: err.message, status: err.status, corpo: err.corpo },
          'checkout recusado pelo Asaas',
        );
        return reply
          .code(502)
          .send({ error: 'Nao consegui abrir o pagamento agora. Tente de novo.' });
      }
      throw err;
    }

    const status = aoAbrirCheckout((existente?.status ?? 'nenhuma') as AssinaturaStatus);

    await prisma.assinatura.upsert({
      where: { accountId: conta.id },
      create: {
        accountId: conta.id,
        status,
        asaasCheckoutId: checkout.id,
        precoMensalCents: preco,
      },
      update: {
        status,
        asaasCheckoutId: checkout.id,
        // O preço só é (re)travado enquanto não há assinatura ativa. Ver
        // `Assinatura.precoMensalCents`.
        precoMensalCents: preco,
      },
    });

    req.log.info(
      { conta: conta.id, checkout: checkout.id, preco },
      'checkout de assinatura aberto',
    );

    const response: CheckoutResponse = {
      link: checkout.link,
      expiraEm: checkout.expiraEm.toISOString(),
    };
    return reply.code(201).send(response);
  });

  // ─── DELETE /api/a/assinatura ─────────────────────────────────────────────
  //
  // Cancelar aqui NÃO tranca a conta. O provedor responde com
  // SUBSCRIPTION_DELETED, o webhook marca `encerrada`, e `contaDeveVirar` põe a
  // conta em `suspensa` — lê, não escreve, e pode assinar de novo. Ver
  // lib/assinatura.ts, "por que cancelar não tranca a porta".
  fastify.delete('/api/a/assinatura', soDono, async (req, reply) => {
    const ctx = req.conta!;

    const assinatura = await prisma.assinatura.findUnique({
      where: { accountId: ctx.accountId },
      select: { asaasSubscriptionId: true },
    });

    if (!assinatura?.asaasSubscriptionId) {
      return reply.code(404).send({ error: 'Nao ha assinatura ativa pra cancelar.' });
    }

    try {
      await cancelarAssinatura(assinatura.asaasSubscriptionId);
    } catch (err) {
      if (err instanceof ErroAsaas) {
        req.log.error({ err: err.message, status: err.status }, 'cancelamento recusado pelo Asaas');
        return reply.code(502).send({ error: 'Nao consegui cancelar agora. Tente de novo.' });
      }
      throw err;
    }

    // O estado NÃO é escrito aqui. Quem manda no estado é o webhook, que é a
    // única fonte que também cobre cancelamento feito direto no painel do
    // provedor. Escrever nos dois lugares é como duas verdades divergem.
    req.log.info({ conta: ctx.accountId }, 'cancelamento de assinatura pedido');
    return reply.send({ ok: true });
  });
}
