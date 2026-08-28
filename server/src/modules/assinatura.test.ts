import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { criarPrismaMock, CONTA, usuarioDono, type PrismaMock } from '../test/prismaMock.js';

/**
 * Rotas da assinatura do QRO — o dono pagando A NÓS.
 *
 * O provedor é substituído por inteiro: teste não fala com o Asaas nem em
 * sandbox. O que se prova aqui são os guardas e as decisões, não o HTTP dele.
 */

const preco = 19900;
process.env.PRECO_PRACA_CENTS = String(preco);

const prismaMock: PrismaMock = criarPrismaMock();
vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }));

const asaas = vi.hoisted(() => ({
  ativo: true,
  criarCheckout: vi.fn(),
  cancelarAssinatura: vi.fn(),
}));

vi.mock('../lib/asaas.js', () => {
  class ErroAsaas extends Error {
    constructor(
      msg: string,
      readonly status: number,
      readonly corpo?: unknown,
    ) {
      super(msg);
    }
  }
  return {
    pagamentoAtivo: () => asaas.ativo,
    criarCheckout: asaas.criarCheckout,
    cancelarAssinatura: asaas.cancelarAssinatura,
    ambienteAsaas: () => 'sandbox' as const,
    ErroAsaas,
  };
});

const { buildApp } = await import('../app.js');

let app: FastifyInstance;

function tokenDono(role: 'owner' | 'admin' | 'staff' = 'owner') {
  return app.jwt.sign({
    kind: 'dono' as const,
    sub: 'user-1',
    accountId: CONTA.id,
    accountSlug: CONTA.slug,
    email: 'marina@qro.app',
    role,
  });
}

const comAuth = (token: string) => ({ authorization: `Bearer ${token}` });

const abrirCheckout = (role: 'owner' | 'admin' | 'staff' = 'owner') =>
  app.inject({
    method: 'POST',
    url: '/api/a/assinatura/checkout',
    headers: comAuth(tokenDono(role)),
  });

beforeEach(async () => {
  vi.clearAllMocks();
  Object.assign(prismaMock, criarPrismaMock());
  asaas.ativo = true;
  asaas.criarCheckout.mockResolvedValue({
    id: 'chk-1',
    link: 'https://sandbox.asaas.com/checkoutSession/show/chk-1',
    expiraEm: new Date('2026-08-26T12:00:00Z'),
  });

  prismaMock.accountUser.findUnique.mockResolvedValue(usuarioDono('owner'));
  prismaMock.account.findUniqueOrThrow.mockResolvedValue({
    id: CONTA.id,
    name: CONTA.name,
    plan: 'praca',
    trialEndsAt: null,
  });

  app = await buildApp({ socket: false, logger: false, cron: false });
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

// ─── Leitura ────────────────────────────────────────────────────────────────

describe('GET /api/a/assinatura', () => {
  it('conta sem assinatura aparece como "nenhuma" e pode assinar', async () => {
    const r = await app.inject({
      method: 'GET',
      url: '/api/a/assinatura',
      headers: comAuth(tokenDono()),
    });

    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({
      status: 'nenhuma',
      plan: 'praca',
      planoNome: 'Praça de alimentação',
      precoMensalCents: preco,
      podeAssinar: true,
      pagamentoAtivo: true,
    });
  });

  /**
   * Mexer na tabela de preços não pode remarcar quem já é cliente. O valor
   * congelado na assinatura ganha do preço de tabela.
   */
  it('mostra o preco CONGELADO, nao o de tabela', async () => {
    prismaMock.assinatura.findUnique.mockResolvedValue({
      status: 'ativa',
      precoMensalCents: 9900,
      proximaCobrancaEm: new Date('2026-09-26'),
    });

    const r = await app.inject({
      method: 'GET',
      url: '/api/a/assinatura',
      headers: comAuth(tokenDono()),
    });

    expect(r.json()).toMatchObject({ precoMensalCents: 9900, podeAssinar: false });
  });

  it('sem chave do provedor a tela sabe que nao da pra assinar', async () => {
    asaas.ativo = false;

    const r = await app.inject({
      method: 'GET',
      url: '/api/a/assinatura',
      headers: comAuth(tokenDono()),
    });

    expect(r.json()).toMatchObject({ pagamentoAtivo: false, podeAssinar: false });
  });
});

// ─── Abrir o checkout ───────────────────────────────────────────────────────

describe('POST /api/a/assinatura/checkout', () => {
  it('devolve o link do provedor', async () => {
    const r = await abrirCheckout();

    expect(r.statusCode).toBe(201);
    expect(r.json().link).toContain('asaas.com');
    expect(asaas.criarCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ referencia: CONTA.id, valorCents: preco }),
    );
  });

  it('guarda o id do checkout pro webhook conseguir associar depois', async () => {
    await abrirCheckout();

    expect(prismaMock.assinatura.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { accountId: CONTA.id },
        create: expect.objectContaining({ asaasCheckoutId: 'chk-1', status: 'aguardando' }),
      }),
    );
  });

  /**
   * A ARMADILHA QUE ESTA ROTA EVITA.
   *
   * `exigeContaAtiva` devolve 402 pra conta suspensa. Se ele estivesse aqui, o
   * inadimplente entraria pra regularizar e receberia "regularize o pagamento"
   * como resposta a tentar pagar — um beco sem saída em que só nós perdemos.
   */
  it('conta SUSPENSA consegue pagar', async () => {
    prismaMock.accountUser.findUnique.mockResolvedValue({
      ...usuarioDono('owner'),
      account: { id: CONTA.id, slug: CONTA.slug, status: 'suspensa' },
    });
    prismaMock.account.findUnique.mockResolvedValue({ status: 'suspensa' });
    prismaMock.assinatura.findUnique.mockResolvedValue({ status: 'atrasada' });

    const r = await abrirCheckout();

    expect(r.statusCode).toBe(201);
  });

  it('quem ja paga nao abre um segundo checkout', async () => {
    // Deixar passar criaria uma SEGUNDA assinatura no provedor, e o cliente
    // seria cobrado duas vezes todo mês.
    prismaMock.assinatura.findUnique.mockResolvedValue({ status: 'ativa' });

    const r = await abrirCheckout();

    expect(r.statusCode).toBe(409);
    expect(asaas.criarCheckout).not.toHaveBeenCalled();
  });

  /**
   * Preço não configurado tem que falhar alto. Silencioso, viraria assinatura
   * cobrando o valor errado — e ninguém descobre até o extrato.
   */
  it('sem preco configurado, recusa dizendo qual variavel falta', async () => {
    prismaMock.account.findUniqueOrThrow.mockResolvedValue({
      id: CONTA.id,
      name: CONTA.name,
      plan: 'restaurante',
      trialEndsAt: null,
    });

    const r = await abrirCheckout();

    expect(r.statusCode).toBe(503);
    expect(r.json().error).toContain('PRECO_RESTAURANTE_CENTS');
    expect(asaas.criarCheckout).not.toHaveBeenCalled();
  });

  it('provedor fora vira 502, sem gravar nada', async () => {
    const { ErroAsaas } = await import('../lib/asaas.js');
    asaas.criarCheckout.mockRejectedValue(new ErroAsaas('recusado', 400, { errors: [] }));

    const r = await abrirCheckout();

    expect(r.statusCode).toBe(502);
    expect(prismaMock.assinatura.upsert).not.toHaveBeenCalled();
  });

  /**
   * O papel vem do BANCO, não do token — é assim de propósito, pra que
   * rebaixar alguém valha na hora em vez de esperar o token expirar. Por isso
   * o mock do usuário é que decide aqui; forjar `role: 'admin'` no token não
   * muda nada.
   */
  it('assinar e coisa de owner, nao de admin', async () => {
    prismaMock.accountUser.findUnique.mockResolvedValue(usuarioDono('admin'));

    const r = await abrirCheckout('admin');

    expect(r.statusCode).toBe(403);
    expect(asaas.criarCheckout).not.toHaveBeenCalled();
  });

  it('sem chave do provedor responde 503', async () => {
    asaas.ativo = false;
    const r = await abrirCheckout();
    expect(r.statusCode).toBe(503);
  });
});

// ─── Cancelar ───────────────────────────────────────────────────────────────

describe('DELETE /api/a/assinatura', () => {
  const cancelar = () =>
    app.inject({ method: 'DELETE', url: '/api/a/assinatura', headers: comAuth(tokenDono()) });

  it('cancela no provedor', async () => {
    prismaMock.assinatura.findUnique.mockResolvedValue({ asaasSubscriptionId: 'sub_123' });
    asaas.cancelarAssinatura.mockResolvedValue(undefined);

    const r = await cancelar();

    expect(r.statusCode).toBe(200);
    expect(asaas.cancelarAssinatura).toHaveBeenCalledWith('sub_123');
  });

  /**
   * Quem manda no estado é o webhook — é a única fonte que também cobre o
   * cancelamento feito direto no painel do provedor. Escrever nos dois lugares
   * é como duas verdades divergem.
   */
  it('NAO escreve o estado aqui; quem faz isso e o webhook', async () => {
    prismaMock.assinatura.findUnique.mockResolvedValue({ asaasSubscriptionId: 'sub_123' });
    asaas.cancelarAssinatura.mockResolvedValue(undefined);

    await cancelar();

    expect(prismaMock.assinatura.update).not.toHaveBeenCalled();
    expect(prismaMock.account.update).not.toHaveBeenCalled();
  });

  it('sem assinatura no provedor, 404', async () => {
    prismaMock.assinatura.findUnique.mockResolvedValue(null);

    const r = await cancelar();

    expect(r.statusCode).toBe(404);
    expect(asaas.cancelarAssinatura).not.toHaveBeenCalled();
  });
});
