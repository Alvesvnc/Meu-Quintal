import type { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { AssinaturaStatus } from '@mq/shared';
import { prisma } from '../lib/prisma.js';
import { env } from '../lib/env.js';
import { efeitoDoEvento, aplicarEfeito, contaDeveVirar } from '../lib/assinatura.js';

/**
 * Recebe os webhooks do Asaas. **Rota pública** — quem autentica é o header.
 *
 * ─── A REGRA QUE MANDA NESTE ARQUIVO: RESPONDER 200 ─────────────────────────
 *
 * A fila do Asaas é sequencial e frágil. Depois de **15 falhas seguidas** ela é
 * INTERROMPIDA: os eventos param de chegar, empilham do lado dele e são
 * apagados aos 14 dias. O sintoma seria o pior possível — ninguém mais ativa,
 * ninguém mais suspende, e nada no meu lado parece quebrado.
 *
 * Por isso aqui quase tudo vira 200: evento que eu não conheço, evento que eu
 * não consigo associar a ninguém, corpo com campo faltando. Tudo isso é
 * GRAVADO e devolvido como sucesso, porque "eu não soube o que fazer" não é
 * problema do Asaas e não pode travar a fila de todo mundo.
 *
 * As duas exceções, ambas deliberadas:
 *   401 — token errado. Aceitar seria deixar qualquer um ativar contas.
 *   500 — o banco caiu. Aí eu QUERO que ele reenvie depois.
 *
 * ─── E NADA DE FALAR COM A REDE AQUI ────────────────────────────────────────
 *
 * Este handler não faz chamada HTTP pro Asaas. Seria a forma mais fácil de
 * completar dados que faltam no payload — e a forma mais fácil de travar a
 * fila: um handler lento ou uma instabilidade na API viraria timeout, timeout
 * vira falha, e 15 delas param a cobrança. O que falta se resolve no próximo
 * evento ou na tela de suporte.
 */

/**
 * Corpo de um evento. Modelado como "quase tudo é opcional" de propósito: o
 * payload varia por família de evento, e um campo ausente não pode virar
 * exceção — ver a regra do 200 acima.
 */
interface EventoAsaas {
  id?: string;
  event?: string;
  payment?: {
    id?: string;
    customer?: string;
    subscription?: string;
    externalReference?: string | null;
    value?: number;
  };
  subscription?: {
    id?: string;
    customer?: string;
    externalReference?: string | null;
    nextDueDate?: string | null;
    value?: number;
  };
  checkout?: {
    id?: string;
    customer?: string;
    externalReference?: string | null;
  };
}

/**
 * Compara sem vazar por tempo, e sem vazar o comprimento.
 *
 * O sha256 dos dois lados iguala o tamanho antes do `timingSafeEqual` — sem
 * isso, comparar comprimentos primeiro já contaria ao atacante quantos
 * caracteres o token tem.
 */
function tokenConfere(recebido: unknown, esperado: string): boolean {
  if (typeof recebido !== 'string' || recebido.length === 0) return false;
  const a = crypto.createHash('sha256').update(recebido).digest();
  const b = crypto.createHash('sha256').update(esperado).digest();
  return crypto.timingSafeEqual(a, b);
}

/** Data do provedor (`YYYY-MM-DD`) pra Date, tolerando lixo. */
function paraData(valor: string | null | undefined): Date | null {
  if (!valor) return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function webhookAsaasRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/api/webhooks/asaas',
    {
      // Generoso: o Asaas manda em rajada quando a fila destrava depois de uma
      // interrupção, e um 429 aqui seria exatamente a falha que trava tudo de
      // novo. Quem protege esta rota é o token, não o teto.
      config: { rateLimit: { max: 600, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const esperado = env.ASAAS_WEBHOOK_TOKEN;

      // Sem token configurado a rota não existe de fato. Aceitar qualquer POST
      // aqui deixaria qualquer um na internet ativar a própria conta de graça.
      if (!esperado) {
        req.log.warn('webhook do Asaas chegou sem ASAAS_WEBHOOK_TOKEN configurado');
        return reply.code(503).send({ error: 'Webhook nao configurado.' });
      }

      if (!tokenConfere(req.headers['asaas-access-token'], esperado)) {
        req.log.warn({ ip: req.ip }, 'webhook do Asaas com token invalido');
        return reply.code(401).send({ error: 'Token invalido.' });
      }

      const corpo = (req.body ?? {}) as EventoAsaas;
      const eventoId = corpo.id;
      const tipo = corpo.event ?? 'DESCONHECIDO';

      // Sem id não há como deduplicar, e o Asaas entrega "at least once".
      // Gravar assim mesmo criaria efeito duplicado a cada reenvio; melhor
      // registrar no log e devolver 200.
      if (!eventoId) {
        req.log.error({ tipo }, 'webhook do Asaas sem id de evento; ignorado');
        return reply.send({ ok: true, ignorado: 'sem id de evento' });
      }

      const efeito = efeitoDoEvento(tipo);

      // ── De quem é este evento? ───────────────────────────────────────────
      const referencia =
        corpo.subscription?.externalReference ??
        corpo.payment?.externalReference ??
        corpo.checkout?.externalReference ??
        null;
      const checkoutId = corpo.checkout?.id ?? null;
      const subscriptionId = corpo.subscription?.id ?? corpo.payment?.subscription ?? null;
      const customerId =
        corpo.subscription?.customer ?? corpo.payment?.customer ?? corpo.checkout?.customer ?? null;

      // Várias pistas porque nenhuma sozinha cobre todos os eventos: o de
      // checkout traz o id do checkout, o de assinatura traz a referência que
      // nós mesmos mandamos, e o de pagamento só traz o id da assinatura.
      // A ordem vai da pista mais forte pra mais fraca.
      const assinatura = await prisma.assinatura.findFirst({
        where: {
          OR: [
            ...(referencia ? [{ accountId: referencia }] : []),
            ...(checkoutId ? [{ asaasCheckoutId: checkoutId }] : []),
            ...(subscriptionId ? [{ asaasSubscriptionId: subscriptionId }] : []),
            ...(customerId ? [{ asaasCustomerId: customerId }] : []),
          ],
        },
      });

      // Não achou dono. NÃO é erro: pode ser evento de uma cobrança feita à mão
      // no painel do Asaas, ou de um checkout que nunca virou linha aqui. Fica
      // gravado, e a fila segue.
      if (!assinatura) {
        await registrarSolto(eventoId, tipo, corpo, req.log);
        return reply.send({ ok: true, ignorado: 'evento nao associado a nenhuma conta' });
      }

      const antes = assinatura.status as AssinaturaStatus;
      const depois = aplicarEfeito(antes, efeito);
      const novoStatusConta = contaDeveVirar(depois);

      // Ids que só aparecem depois — a assinatura e o cliente nascem no Asaas
      // quando o pagador conclui o checkout, não quando nós o criamos. Guardar
      // agora é o que torna os PAYMENT_* seguintes associáveis.
      const idsNovos = {
        ...(subscriptionId && !assinatura.asaasSubscriptionId
          ? { asaasSubscriptionId: subscriptionId }
          : {}),
        ...(customerId && !assinatura.asaasCustomerId ? { asaasCustomerId: customerId } : {}),
      };

      const proxima = paraData(corpo.subscription?.nextDueDate);

      try {
        await prisma.$transaction(async (tx) => {
          // PRIMEIRO o registro do evento. O @unique em `eventoId` é a trava de
          // idempotência: se este evento já foi aplicado, isto estoura P2002 e
          // a transação inteira é abortada antes de mexer em qualquer estado.
          await tx.eventoDeCobranca.create({
            data: {
              eventoId,
              tipo,
              assinaturaId: assinatura.id,
              payload: corpo as unknown as Prisma.InputJsonValue,
              efeito:
                efeito.tipo === 'ignorar'
                  ? `ignorado: ${efeito.motivo}`
                  : `${efeito.tipo}: ${antes} -> ${depois}`,
            },
          });

          await tx.assinatura.update({
            where: { id: assinatura.id },
            data: {
              status: depois,
              ...idsNovos,
              ...(proxima ? { proximaCobrancaEm: proxima } : {}),
              ...(efeito.tipo === 'ativar' ? { pagoEm: new Date() } : {}),
            },
          });

          // A conta só é tocada quando a assinatura tem opinião sobre ela. Ver
          // `contaDeveVirar` — trial e conta feita à mão não podem ser
          // derrubadas por não terem assinatura.
          //
          // ─── E SÓ QUANDO O EVENTO SIGNIFICOU ALGUMA COISA ──────────────
          //
          // `ignorar` tem que ser inerte de verdade. PAYMENT_CREATED chega
          // todo mês, quando o Asaas gera a mensalidade seguinte; sem o
          // `!== 'ignorar'` ele reescreveria o status da conta a cada ciclo.
          //
          // ─── E NUNCA POR CIMA DE `cancelada` ───────────────────────────
          //
          // Cancelar é decisão humana deliberada — fraude, abuso, acordo
          // desfeito. Um pagamento que ainda caia (cartão que renova sozinho
          // é o caso normal) não pode desfazê-la e devolver o acesso.
          //
          // A condição vai no `where` do `updateMany` em vez de num `if`
          // depois de ler: sem leitura a mais, e sem a janela entre ler e
          // escrever em que alguém cancela a conta.
          if (novoStatusConta && efeito.tipo !== 'ignorar') {
            await tx.account.updateMany({
              where: { id: assinatura.accountId, status: { not: 'cancelada' } },
              data: { status: novoStatusConta },
            });
          }
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          // Reentrega do mesmo evento. Estado intacto, e 200 pra fila andar.
          req.log.info({ eventoId, tipo }, 'webhook do Asaas repetido; ignorado');
          return reply.send({ ok: true, ignorado: 'evento ja processado' });
        }
        // Banco fora. AQUI eu quero 500: é o único caso em que reenviar
        // resolve, e perder o evento seria perder um pagamento.
        req.log.error({ err, eventoId, tipo }, 'falha ao aplicar webhook do Asaas');
        throw err;
      }

      req.log.info(
        { eventoId, tipo, conta: assinatura.accountId, antes, depois, efeito: efeito.tipo },
        'webhook do Asaas aplicado',
      );
      return reply.send({ ok: true });
    },
  );
}

/**
 * Grava um evento que não pertence a nenhuma conta conhecida.
 *
 * Fora da transação e com o erro engolido: isto é registro para investigação,
 * e falhar aqui não pode virar 500 — 15 deles parariam a fila por causa de um
 * evento que nem é meu.
 */
async function registrarSolto(
  eventoId: string,
  tipo: string,
  corpo: EventoAsaas,
  log: FastifyInstance['log'],
) {
  try {
    await prisma.eventoDeCobranca.create({
      data: {
        eventoId,
        tipo,
        assinaturaId: null,
        payload: corpo as unknown as Prisma.InputJsonValue,
        efeito: 'nao associado a nenhuma conta',
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return;
    log.error({ err, eventoId, tipo }, 'falha ao registrar evento solto do Asaas');
  }
}
