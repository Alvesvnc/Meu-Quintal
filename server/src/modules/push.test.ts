import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { criarPrismaMock, type PrismaMock, cozinhaLogada } from '../test/prismaMock.js';

/*
  PUSH LIGADO SÓ NESTE ARQUIVO.

  A suíte inteira roda com VAPID vazio (ver vitest.setup.ts) — que é o estado de
  qualquer instalação que ainda não configurou push. Aqui a gente quer o
  contrário, então as chaves entram ANTES do import dinâmico do app: `lib/env.ts`
  valida no topo do módulo, e depois do import não há como mudar.

  Valor falso serve: nenhuma destas rotas assina nada. Quem chama
  `setVapidDetails` (e portanto exigiria chave real) é o `avisarCozinha`, que
  não passa por aqui.
*/
process.env.VAPID_PUBLIC_KEY = 'chave-publica-de-teste';
process.env.VAPID_PRIVATE_KEY = 'chave-privada-de-teste';

const prismaMock: PrismaMock = criarPrismaMock();
vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }));

const { buildApp } = await import('../app.js');

/**
 * Inscrição de aparelho no aviso de tela apagada.
 *
 * O que mais importa aqui é ISOLAMENTO, e por um motivo específico: diferente
 * do resto do app, o identificador do aparelho (`endpoint`) chega no CORPO da
 * requisição, não da sessão. Sem escopo por cozinha, quem estivesse logado em
 * qualquer cozinha do food-court poderia mandar o endpoint de um aparelho
 * alheio e calar o aviso da vizinha — sem ver dado nenhum dela, o que faria a
 * coisa passar despercebida.
 */

let app: FastifyInstance;

const COZINHA = {
  id: 'k1',
  slug: 'lou-burger',
  name: 'Lou Burger',
  status: 'ativa' as const,
  spaceId: 'space-1',
};

const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/abc123';

const INSCRICAO = {
  endpoint: ENDPOINT,
  p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM',
  auth: 'tBHItJI5svbpez7KI4CCXg',
};

function token() {
  return app.jwt.sign({
    kind: 'cozinha' as const,
    sub: 'ku1',
    kitchenId: COZINHA.id,
    kitchenSlug: COZINHA.slug,
    email: 'marcos@louburger.com',
    role: 'owner',
  });
}
const auth = () => ({ authorization: `Bearer ${token()}` });

beforeEach(async () => {
  vi.clearAllMocks();
  Object.assign(prismaMock, criarPrismaMock());
  cozinhaLogada(prismaMock, COZINHA.id, 'ku1');
  prismaMock.kitchen.findUnique.mockResolvedValue(COZINHA);
  app = await buildApp({ socket: false, logger: false, cron: false });
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

describe('GET /api/r/push/chave', () => {
  it('sem token, 401', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/r/push/chave' });
    expect(r.statusCode).toBe(401);
  });

  it('devolve a chave publica e quantos aparelhos ja avisam', async () => {
    prismaMock.pushSubscription.count.mockResolvedValue(2);

    const r = await app.inject({ method: 'GET', url: '/api/r/push/chave', headers: auth() });

    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ chavePublica: 'chave-publica-de-teste', aparelhos: 2 });
  });

  it('conta SO os aparelhos da propria cozinha', async () => {
    await app.inject({ method: 'GET', url: '/api/r/push/chave', headers: auth() });

    expect(prismaMock.pushSubscription.count).toHaveBeenCalledWith({
      where: { kitchenId: COZINHA.id },
    });
  });
});

describe('POST /api/r/push/inscrever', () => {
  it('sem token, 401', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/r/push/inscrever',
      payload: INSCRICAO,
    });
    expect(r.statusCode).toBe(401);
  });

  it('recusa corpo sem as chaves do aparelho', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/r/push/inscrever',
      headers: auth(),
      payload: { endpoint: ENDPOINT },
    });

    expect(r.statusCode).toBe(400);
    expect(prismaMock.pushSubscription.upsert).not.toHaveBeenCalled();
  });

  it('recusa endpoint que nao e URL', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/r/push/inscrever',
      headers: auth(),
      payload: { ...INSCRICAO, endpoint: 'nao-e-url' },
    });

    expect(r.statusCode).toBe(400);
  });

  it('grava o aparelho com a cozinha e o usuario DA SESSAO, nao do corpo', async () => {
    prismaMock.pushSubscription.count.mockResolvedValue(1);

    // O corpo tenta se pendurar em outra cozinha. O schema nem olha esses
    // campos, e a rota monta o vinculo a partir do token — este teste existe
    // pra impedir que alguem "melhore" isso lendo o corpo um dia.
    const r = await app.inject({
      method: 'POST',
      url: '/api/r/push/inscrever',
      headers: auth(),
      payload: { ...INSCRICAO, kitchenId: 'cozinha-da-vizinha', userId: 'outra-pessoa' },
    });

    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ ok: true, aparelhos: 1 });

    const args = prismaMock.pushSubscription.upsert.mock.calls[0][0];
    expect(args.where).toEqual({ endpoint: ENDPOINT });
    expect(args.create.kitchenId).toBe(COZINHA.id);
    expect(args.create.userId).toBe('ku1');
    expect(args.update.kitchenId).toBe(COZINHA.id);
  });

  it('reinscrever o MESMO aparelho atualiza, nao duplica', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/r/push/inscrever',
      headers: auth(),
      payload: INSCRICAO,
    });

    // Upsert pelo endpoint: e o que garante uma linha por aparelho. Com
    // `create` puro, cada rotacao de chave do navegador criaria outra e a
    // cozinha receberia o aviso em duplicata.
    expect(prismaMock.pushSubscription.upsert).toHaveBeenCalledTimes(1);
    expect(prismaMock.pushSubscription.upsert.mock.calls[0][0].where).toEqual({
      endpoint: ENDPOINT,
    });
  });
});

describe('DELETE /api/r/push/inscrever', () => {
  it('sem token, 401', async () => {
    const r = await app.inject({
      method: 'DELETE',
      url: '/api/r/push/inscrever',
      payload: { endpoint: ENDPOINT },
    });
    expect(r.statusCode).toBe(401);
  });

  it('so apaga aparelho DA PROPRIA cozinha', async () => {
    prismaMock.pushSubscription.deleteMany.mockResolvedValue({ count: 1 });

    const r = await app.inject({
      method: 'DELETE',
      url: '/api/r/push/inscrever',
      headers: auth(),
      payload: { endpoint: ENDPOINT },
    });

    expect(r.statusCode).toBe(200);
    // O `kitchenId` no where E O TESTE. Sem ele, conhecer o endpoint de um
    // aparelho bastaria pra desligar o aviso da cozinha vizinha.
    expect(prismaMock.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { endpoint: ENDPOINT, kitchenId: COZINHA.id },
    });
  });

  it('endpoint que nao e da cozinha some sem erro, e sem apagar nada', async () => {
    prismaMock.pushSubscription.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.pushSubscription.count.mockResolvedValue(3);

    const r = await app.inject({
      method: 'DELETE',
      url: '/api/r/push/inscrever',
      headers: auth(),
      payload: { endpoint: 'https://fcm.googleapis.com/fcm/send/de-outra-cozinha' },
    });

    // 200 e nao 404 de proposito: a resposta nao pode revelar se aquele
    // endpoint existe em outra cozinha. E o estado desejado ("este aparelho
    // nao avisa mais") foi alcancado de qualquer jeito.
    expect(r.statusCode).toBe(200);
    expect(r.json().aparelhos).toBe(3);
  });

  it('recusa corpo sem endpoint', async () => {
    const r = await app.inject({
      method: 'DELETE',
      url: '/api/r/push/inscrever',
      headers: auth(),
      payload: {},
    });

    expect(r.statusCode).toBe(400);
    expect(prismaMock.pushSubscription.deleteMany).not.toHaveBeenCalled();
  });
});
