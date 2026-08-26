import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { criarPrismaMock, type PrismaMock } from '../test/prismaMock.js';

const prismaMock: PrismaMock = criarPrismaMock();
vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }));

/**
 * Armazenamento de mentira: teste de rota nao escreve em disco.
 *
 * `vi.hoisted` porque `vi.mock` e icado pro topo do arquivo — um `const`
 * declarado aqui embaixo ainda estaria na zona morta quando a fabrica rodasse.
 */
const { guardadas } = vi.hoisted(() => ({ guardadas: new Map<string, Buffer>() }));

vi.mock('../lib/armazenamento.js', () => ({
  prepararArmazenamento: vi.fn(),
  guardar: vi.fn(async (data: Buffer, ext: string) => {
    const chave = `${'ab'.repeat(16)}.${ext}`;
    guardadas.set(chave, data);
    return chave;
  }),
  ler: vi.fn(async (chave: string) => guardadas.get(chave) ?? null),
  apagar: vi.fn(async (chave: string) => {
    guardadas.delete(chave);
  }),
}));

const { buildApp } = await import('../app.js');
const sharp = (await import('sharp')).default;

/**
 * Fotos do cardápio: quem pode enviar, quem pode apagar, e o que é servido.
 *
 * O isolamento aqui não é sobre dinheiro, é sobre o cardápio da vizinha: sem o
 * join até a cozinha, bastaria conhecer um id de foto para apagar a dela.
 */

let app: FastifyInstance;

const COZINHA = { id: 'k1', slug: 'lou-burger', name: 'Lou Burger', status: 'ativa' as const };
const ITEM = { id: 'mi1' };

function token(kitchenId = COZINHA.id) {
  return app.jwt.sign({
    kind: 'cozinha' as const,
    sub: 'ku1',
    kitchenId,
    kitchenSlug: COZINHA.slug,
    email: 'marcos@louburger.com',
    role: 'owner',
  });
}
const auth = () => ({ authorization: `Bearer ${token()}` });

/** Corpo multipart montado à mão — `inject` não monta sozinho. */
function multipart(buf: Buffer, nome = 'prato.jpg', tipo = 'image/jpeg') {
  const b = '----mqtest';
  const cabeca = Buffer.from(
    `--${b}\r\nContent-Disposition: form-data; name="file"; filename="${nome}"\r\n` +
      `Content-Type: ${tipo}\r\n\r\n`,
  );
  return {
    payload: Buffer.concat([cabeca, buf, Buffer.from(`\r\n--${b}--\r\n`)]),
    headers: { ...auth(), 'content-type': `multipart/form-data; boundary=${b}` },
  };
}

const umaFoto = () =>
  sharp({ create: { width: 900, height: 600, channels: 3, background: '#c85a28' } })
    .jpeg()
    .toBuffer();

beforeEach(async () => {
  vi.clearAllMocks();
  guardadas.clear();
  Object.assign(prismaMock, criarPrismaMock());
  prismaMock.kitchen.findUnique.mockResolvedValue(COZINHA);
  prismaMock.menuItem.findFirst.mockResolvedValue(ITEM);
  prismaMock.menuItemPhoto.count.mockResolvedValue(0);
  app = await buildApp({ socket: false, logger: false, cron: false });
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

// ─── Envio ──────────────────────────────────────────────────────────────────

describe('POST /api/r/cardapio/:id/fotos', () => {
  it('guarda a foto processada e devolve a url', async () => {
    prismaMock.menuItemPhoto.create.mockResolvedValue({
      id: 'f1',
      storageKey: `${'ab'.repeat(16)}.webp`,
      width: 900,
      height: 600,
    });

    const r = await app.inject({
      method: 'POST',
      url: '/api/r/cardapio/mi1/fotos',
      ...multipart(await umaFoto()),
    });

    expect(r.statusCode).toBe(201);
    expect(r.json().url).toMatch(/^\/api\/fotos\/[a-f0-9]{32}\.webp$/);
  });

  it('sem token, 401', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/r/cardapio/mi1/fotos',
      payload: Buffer.alloc(4),
      headers: { 'content-type': 'multipart/form-data; boundary=x' },
    });
    expect(r.statusCode).toBe(401);
  });

  it('item de OUTRA cozinha devolve 404', async () => {
    prismaMock.menuItem.findFirst.mockResolvedValue(null);
    const r = await app.inject({
      method: 'POST',
      url: '/api/r/cardapio/mi-da-vizinha/fotos',
      ...multipart(await umaFoto()),
    });
    expect(r.statusCode).toBe(404);
    // O where amarra item + cozinha logada; sem isso bastaria saber o id.
    expect(prismaMock.menuItem.findFirst.mock.calls[0][0].where.kitchenId).toBe(COZINHA.id);
  });

  it('arquivo que nao e imagem devolve 400', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/r/cardapio/mi1/fotos',
      ...multipart(Buffer.from('<?php system($_GET["c"]); ?>'), 'foto.jpg'),
    });
    // A extensao e o content-type sao escritos por quem envia. A unica prova
    // de que aquilo e imagem e decodificar.
    expect(r.statusCode).toBe(400);
    expect(prismaMock.menuItemPhoto.create).not.toHaveBeenCalled();
  });

  it('nada e gravado quando a imagem e recusada', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/r/cardapio/mi1/fotos',
      ...multipart(Buffer.from('lixo'), 'foto.png', 'image/png'),
    });
    // Linha sem arquivo seria buraco no cardapio.
    expect(guardadas.size).toBe(0);
  });

  it('recusa acima do teto de fotos por item', async () => {
    prismaMock.menuItemPhoto.count.mockResolvedValue(6);
    const r = await app.inject({
      method: 'POST',
      url: '/api/r/cardapio/mi1/fotos',
      ...multipart(await umaFoto()),
    });
    expect(r.statusCode).toBe(409);
  });

  it('a primeira foto entra como capa', async () => {
    prismaMock.menuItemPhoto.count.mockResolvedValue(0);
    prismaMock.menuItemPhoto.create.mockResolvedValue({
      id: 'f1',
      storageKey: `${'ab'.repeat(16)}.webp`,
      width: 1,
      height: 1,
    });
    await app.inject({
      method: 'POST',
      url: '/api/r/cardapio/mi1/fotos',
      ...multipart(await umaFoto()),
    });
    expect(prismaMock.menuItemPhoto.create.mock.calls[0][0].data.sortOrder).toBe(0);
  });

  it('a seguinte entra no fim da fila', async () => {
    prismaMock.menuItemPhoto.count.mockResolvedValue(2);
    prismaMock.menuItemPhoto.create.mockResolvedValue({
      id: 'f3',
      storageKey: `${'ab'.repeat(16)}.webp`,
      width: 1,
      height: 1,
    });
    await app.inject({
      method: 'POST',
      url: '/api/r/cardapio/mi1/fotos',
      ...multipart(await umaFoto()),
    });
    expect(prismaMock.menuItemPhoto.create.mock.calls[0][0].data.sortOrder).toBe(2);
  });

  it('corpo que nao e multipart devolve 400', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/r/cardapio/mi1/fotos',
      headers: auth(),
      payload: { url: 'https://exemplo.com/foto.jpg' },
    });
    expect(r.statusCode).toBe(400);
  });
});

// ─── Remoção ────────────────────────────────────────────────────────────────

describe('DELETE /api/r/cardapio/:id/fotos/:fotoId', () => {
  it('apaga a linha E o arquivo', async () => {
    const chave = `${'ab'.repeat(16)}.webp`;
    guardadas.set(chave, Buffer.from('x'));
    prismaMock.menuItemPhoto.findFirst.mockResolvedValue({ id: 'f1', storageKey: chave });

    const r = await app.inject({
      method: 'DELETE',
      url: '/api/r/cardapio/mi1/fotos/f1',
      headers: auth(),
    });

    expect(r.statusCode).toBe(200);
    expect(prismaMock.menuItemPhoto.delete).toHaveBeenCalled();
    expect(guardadas.has(chave)).toBe(false);
  });

  it('o where sobe ate a cozinha logada', async () => {
    prismaMock.menuItemPhoto.findFirst.mockResolvedValue(null);
    await app.inject({ method: 'DELETE', url: '/api/r/cardapio/mi1/fotos/f1', headers: auth() });
    const where = prismaMock.menuItemPhoto.findFirst.mock.calls[0][0].where;
    expect(where.menuItem.kitchenId).toBe(COZINHA.id);
  });

  it('foto de outra cozinha devolve 404 e nao apaga nada', async () => {
    prismaMock.menuItemPhoto.findFirst.mockResolvedValue(null);
    const r = await app.inject({
      method: 'DELETE',
      url: '/api/r/cardapio/mi1/fotos/f-alheia',
      headers: auth(),
    });
    expect(r.statusCode).toBe(404);
    expect(prismaMock.menuItemPhoto.delete).not.toHaveBeenCalled();
  });
});

// ─── Capa ───────────────────────────────────────────────────────────────────

describe('PATCH /api/r/cardapio/:id/fotos/:fotoId/capa', () => {
  it('reescreve a ordem inteira, nao so a escolhida', async () => {
    prismaMock.menuItemPhoto.findMany.mockResolvedValue([
      { id: 'f1' },
      { id: 'f2' },
      { id: 'f3' },
    ]);
    prismaMock.$transaction.mockResolvedValue([]);

    const r = await app.inject({
      method: 'PATCH',
      url: '/api/r/cardapio/mi1/fotos/f3/capa',
      headers: auth(),
    });

    expect(r.statusCode).toBe(200);
    // Mexer so na escolhida deixaria duas com sortOrder 0, e a capa passaria a
    // depender do desempate.
    expect(prismaMock.menuItemPhoto.update).toHaveBeenCalledTimes(3);
    const ordens = prismaMock.menuItemPhoto.update.mock.calls.map((c) => [
      c[0].where.id,
      c[0].data.sortOrder,
    ]);
    expect(ordens).toEqual([
      ['f3', 0],
      ['f1', 1],
      ['f2', 2],
    ]);
  });

  it('foto que nao e do item devolve 404', async () => {
    prismaMock.menuItemPhoto.findMany.mockResolvedValue([{ id: 'f1' }]);
    const r = await app.inject({
      method: 'PATCH',
      url: '/api/r/cardapio/mi1/fotos/f-alheia/capa',
      headers: auth(),
    });
    expect(r.statusCode).toBe(404);
    expect(prismaMock.menuItemPhoto.update).not.toHaveBeenCalled();
  });
});

// ─── Servir ─────────────────────────────────────────────────────────────────

describe('GET /api/fotos/:chave', () => {
  const chave = `${'ab'.repeat(16)}.webp`;

  it('serve SEM token — <img> nao manda Authorization', async () => {
    guardadas.set(chave, Buffer.from('conteudo'));
    const r = await app.inject({ method: 'GET', url: `/api/fotos/${chave}` });
    expect(r.statusCode).toBe(200);
  });

  it('content-type fixo, nao deduzido do arquivo', async () => {
    guardadas.set(chave, Buffer.from('conteudo'));
    const r = await app.inject({ method: 'GET', url: `/api/fotos/${chave}` });
    // Tudo que entra e reencodado pra webp; qualquer outro valor seria mentira.
    expect(r.headers['content-type']).toBe('image/webp');
    expect(r.headers['x-content-type-options']).toBe('nosniff');
  });

  it('cache imutavel — a chave nunca e reaproveitada', async () => {
    guardadas.set(chave, Buffer.from('conteudo'));
    const r = await app.inject({ method: 'GET', url: `/api/fotos/${chave}` });
    expect(r.headers['cache-control']).toContain('immutable');
  });

  it('chave inexistente devolve 404', async () => {
    const r = await app.inject({ method: 'GET', url: `/api/fotos/${'cd'.repeat(16)}.webp` });
    expect(r.statusCode).toBe(404);
  });
});
