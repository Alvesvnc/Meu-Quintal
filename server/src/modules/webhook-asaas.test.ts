import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { criarPrismaMock, CONTA, type PrismaMock } from '../test/prismaMock.js';

/**
 * Webhook do Asaas.
 *
 * O token precisa existir ANTES do `import('../app.js')` lá embaixo: `lib/env.ts`
 * valida no topo do módulo, e o vitest.setup zera esta variável de propósito.
 */
process.env.ASAAS_WEBHOOK_TOKEN = 'token-de-webhook-de-teste-bem-longo';

const prismaMock: PrismaMock = criarPrismaMock();
vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }));

const { buildApp } = await import('../app.js');

const TOKEN = 'token-de-webhook-de-teste-bem-longo';

let app: FastifyInstance;

/** Assinatura já ligada a uma assinatura do provedor. */
function assinatura(over: Record<string, unknown> = {}) {
  return {
    id: 'assin-1',
    accountId: CONTA.id,
    status: 'ativa',
    provedor: 'asaas',
    asaasCheckoutId: 'chk-1',
    asaasSubscriptionId: 'sub_123',
    asaasCustomerId: 'cus_123',
    precoMensalCents: 19900,
    proximaCobrancaEm: null,
    pagoEm: null,
    ...over,
  };
}

function post(corpo: unknown, token: string | null = TOKEN) {
  return app.inject({
    method: 'POST',
    url: '/api/webhooks/asaas',
    headers: token ? { 'asaas-access-token': token } : {},
    payload: corpo as Record<string, unknown>,
  });
}

/** Evento de pagamento, no formato que o Asaas manda. */
function evento(tipo: string, over: Record<string, unknown> = {}) {
  return {
    id: `evt_${tipo}_1`,
    event: tipo,
    dateCreated: '2026-08-26 10:00:00',
    payment: { id: 'pay_1', customer: 'cus_123', subscription: 'sub_123', value: 199 },
    ...over,
  };
}

beforeEach(async () => {
  vi.clearAllMocks();
  Object.assign(prismaMock, criarPrismaMock());
  prismaMock.assinatura.findFirst.mockResolvedValue(assinatura());
  prismaMock.$transaction.mockImplementation(async (fn: unknown) =>
    typeof fn === 'function' ? await (fn as (tx: unknown) => unknown)(prismaMock) : fn,
  );
  app = await buildApp({ socket: false, logger: false, cron: false });
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

// ─── Quem pode falar ────────────────────────────────────────────────────────

describe('autenticacao', () => {
  it('sem header nao entra', async () => {
    const r = await post(evento('PAYMENT_RECEIVED'), null);
    expect(r.statusCode).toBe(401);
    expect(prismaMock.assinatura.update).not.toHaveBeenCalled();
  });

  /**
   * A única razão de existir do token. Sem esta trava, qualquer um na internet
   * ativa a própria conta mandando um POST.
   */
  it('token errado nao ativa conta nenhuma', async () => {
    const r = await post(evento('PAYMENT_RECEIVED'), 'token-errado-mas-do-mesmo-tamanho!!');
    expect(r.statusCode).toBe(401);
    expect(prismaMock.account.update).not.toHaveBeenCalled();
  });
});

// ─── A regra do 200 ─────────────────────────────────────────────────────────

/**
 * A fila do Asaas é sequencial e para depois de 15 falhas seguidas — com os
 * eventos empilhando do lado dele e sendo apagados aos 14 dias. Cada teste
 * aqui protege um caso em que seria tentador devolver erro.
 */
describe('nunca travar a fila do provedor', () => {
  it('evento desconhecido responde 200', async () => {
    const r = await post(evento('PAYMENT_ALGO_QUE_NAO_EXISTE_AINDA'));
    expect(r.statusCode).toBe(200);
  });

  it('evento sem dono responde 200 e fica registrado', async () => {
    prismaMock.assinatura.findFirst.mockResolvedValue(null);

    const r = await post(evento('PAYMENT_RECEIVED'));

    expect(r.statusCode).toBe(200);
    // Registrado pra investigação, sem assinatura associada.
    expect(prismaMock.eventoDeCobranca.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ assinaturaId: null }) }),
    );
  });

  it('corpo sem id de evento responde 200', async () => {
    // Sem id não dá pra deduplicar, e o Asaas entrega "at least once".
    const r = await post({ event: 'PAYMENT_RECEIVED', payment: { id: 'pay_1' } });
    expect(r.statusCode).toBe(200);
    expect(prismaMock.assinatura.update).not.toHaveBeenCalled();
  });

  it('corpo vazio responde 200', async () => {
    const r = await post({});
    expect(r.statusCode).toBe(200);
  });

  /**
   * A exceção deliberada: banco fora é o ÚNICO caso em que reenviar resolve.
   * Engolir aqui seria perder um pagamento pra sempre.
   */
  it('banco fora responde 500, pra o Asaas reenviar', async () => {
    prismaMock.$transaction.mockRejectedValue(new Error('connection refused'));
    const r = await post(evento('PAYMENT_RECEIVED'));
    expect(r.statusCode).toBe(500);
  });
});

// ─── Idempotência ───────────────────────────────────────────────────────────

describe('evento repetido', () => {
  it('nao aplica duas vezes', async () => {
    // O @unique em eventoId estoura, e a transação inteira aborta antes de
    // mexer em qualquer estado.
    prismaMock.eventoDeCobranca.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicado', {
        code: 'P2002',
        clientVersion: '5.22.0',
      }),
    );

    const r = await post(evento('PAYMENT_RECEIVED'));

    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ ignorado: 'evento ja processado' });
  });
});

// ─── O que cada evento faz de verdade ───────────────────────────────────────

describe('efeito no acesso', () => {
  it('pagamento recebido deixa a conta ativa', async () => {
    prismaMock.assinatura.findFirst.mockResolvedValue(assinatura({ status: 'atrasada' }));

    const r = await post(evento('PAYMENT_RECEIVED'));

    expect(r.statusCode).toBe(200);
    expect(prismaMock.assinatura.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'ativa' }) }),
    );
    expect(prismaMock.account.updateMany).toHaveBeenCalledWith({
      where: { id: CONTA.id, status: { not: 'cancelada' } },
      data: { status: 'ativa' },
    });
  });

  it('vencido suspende a conta', async () => {
    const r = await post(evento('PAYMENT_OVERDUE'));

    expect(r.statusCode).toBe(200);
    expect(prismaMock.account.updateMany).toHaveBeenCalledWith({
      where: { id: CONTA.id, status: { not: 'cancelada' } },
      data: { status: 'suspensa' },
    });
  });

  /**
   * Cancelar uma conta é decisão humana deliberada — fraude, abuso, acordo
   * desfeito. O cartão do sujeito continua renovando sozinho e o
   * PAYMENT_RECEIVED continua chegando; sem a condição no `where`, o webhook
   * devolveria o acesso a quem nós tiramos de propósito.
   */
  it('pagamento NAO desfaz um cancelamento nosso', async () => {
    await post(evento('PAYMENT_RECEIVED'));

    expect(prismaMock.account.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: { not: 'cancelada' } }),
      }),
    );
  });

  /**
   * O falso positivo mais caro: PAYMENT_CREATED nasce quando o Asaas GERA a
   * mensalidade do mês seguinte. Suspender aqui derrubaria todo cliente
   * adimplente no dia em que a próxima fatura é emitida.
   */
  it('cobranca do mes que vem NAO suspende quem esta em dia', async () => {
    const r = await post(evento('PAYMENT_CREATED'));

    expect(r.statusCode).toBe(200);
    // Inerte de verdade: nem toca na conta.
    expect(prismaMock.account.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.account.update).not.toHaveBeenCalled();
  });

  it('cancelamento suspende, nao cancela a conta', async () => {
    const r = await post(evento('SUBSCRIPTION_DELETED', { subscription: { id: 'sub_123' } }));

    expect(r.statusCode).toBe(200);
    // `cancelada` trancaria a pessoa fora do login, sem poder assinar de novo.
    expect(prismaMock.account.updateMany).toHaveBeenCalledWith({
      where: { id: CONTA.id, status: { not: 'cancelada' } },
      data: { status: 'suspensa' },
    });
  });

  it('conta em trial nao e tocada por evento sem efeito', async () => {
    prismaMock.assinatura.findFirst.mockResolvedValue(assinatura({ status: 'nenhuma' }));

    await post(evento('CHECKOUT_CREATED', { checkout: { id: 'chk-1' } }));

    expect(prismaMock.account.updateMany).not.toHaveBeenCalled();
  });
});

// ─── Descobrir de quem é o evento ───────────────────────────────────────────

describe('associacao', () => {
  it('procura por referencia, checkout, assinatura e cliente', async () => {
    await post(
      evento('SUBSCRIPTION_UPDATED', {
        subscription: {
          id: 'sub_123',
          customer: 'cus_123',
          externalReference: CONTA.id,
          nextDueDate: '2026-09-26',
        },
        payment: undefined,
      }),
    );

    const where = prismaMock.assinatura.findFirst.mock.calls[0][0].where;
    expect(where.OR).toEqual(
      expect.arrayContaining([
        { accountId: CONTA.id },
        { asaasSubscriptionId: 'sub_123' },
        { asaasCustomerId: 'cus_123' },
      ]),
    );
  });

  /**
   * A assinatura e o cliente nascem no Asaas quando o pagador CONCLUI o
   * checkout, não quando nós o criamos. Guardar os ids na primeira vez que
   * aparecem é o que torna os PAYMENT_* seguintes associáveis.
   */
  it('grava os ids do provedor na primeira vez que aparecem', async () => {
    prismaMock.assinatura.findFirst.mockResolvedValue(
      assinatura({ status: 'aguardando', asaasSubscriptionId: null, asaasCustomerId: null }),
    );

    await post(
      evento('SUBSCRIPTION_CREATED', {
        subscription: {
          id: 'sub_novo',
          customer: 'cus_novo',
          externalReference: CONTA.id,
          nextDueDate: '2026-09-26',
        },
        payment: undefined,
      }),
    );

    expect(prismaMock.assinatura.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          asaasSubscriptionId: 'sub_novo',
          asaasCustomerId: 'cus_novo',
          proximaCobrancaEm: new Date('2026-09-26'),
        }),
      }),
    );
  });
});
