import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { criarPrismaMock, type PrismaMock, cozinhaLogada } from '../test/prismaMock.js';

const prismaMock: PrismaMock = criarPrismaMock();
vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }));

/**
 * Armazenamento de mentira: teste de rota nao escreve em disco.
 *
 * `vi.hoisted` porque `vi.mock` e icado pro topo do arquivo — um `const`
 * declarado aqui embaixo ainda estaria na zona morta quando a fabrica rodasse.
 */
const { guardadas, apagadas, contador } = vi.hoisted(() => ({
  guardadas: new Map<string, Buffer>(),
  apagadas: [] as string[],
  contador: { n: 0 },
}));

vi.mock('../lib/armazenamento.js', async () => {
  const real =
    await vi.importActual<typeof import('../lib/armazenamento.js')>('../lib/armazenamento.js');
  return {
    // `urlPublica` e o de verdade: e a regra que monta o endereco da foto, e
    // um dublê aqui deixaria o teste passar com a rota errada.
    ...real,
    prepararArmazenamento: vi.fn(),
    guardar: vi.fn(async (data: Buffer, ext: string) => {
      const chave = String(++contador.n).padStart(2, '0').repeat(16) + '.' + ext;
      guardadas.set(chave, data);
      return chave;
    }),
    ler: vi.fn(async (chave: string) => guardadas.get(chave) ?? null),
    apagar: vi.fn(async (chave: string) => {
      apagadas.push(chave);
      guardadas.delete(chave);
    }),
  };
});

const { buildApp } = await import('../app.js');
const sharp = (await import('sharp')).default;

/**
 * A foto de capa da cozinha, enviada do dispositivo.
 *
 * O que importa aqui, e que a tela de perfil não garante sozinha:
 *
 *   1. nada é guardado como veio — sai webp, redimensionado e sem metadado;
 *   2. trocar a foto não deixa o arquivo antigo apodrecendo no disco;
 *   3. a URL antiga NÃO é apagada por tabela: ela tem campo próprio e volta a
 *      valer se a foto enviada for removida;
 *   4. `foto` e `photoUrl` chegam separados no formulário — sem isso a tela
 *      não sabe qual dos dois o botão "remover" apaga.
 */

let app: FastifyInstance;

const COZINHA = {
  id: 'k1',
  slug: 'lou-burger',
  name: 'Lou Burger',
  category: 'Hamburgueria',
  tagline: null,
  description: null,
  photoUrl: null,
  photoKey: null,
  slaMinutes: 12,
  status: 'ativa' as const,
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
const auth = () => ({ authorization: 'Bearer ' + token() });

/** Corpo multipart montado à mão — `inject` não monta sozinho. */
function multipart(buf: Buffer, nome = 'cozinha.jpg', tipo = 'image/jpeg') {
  const b = '----mqtest';
  const cabeca = Buffer.from(
    '--' +
      b +
      '\r\nContent-Disposition: form-data; name="file"; filename="' +
      nome +
      '"\r\n' +
      'Content-Type: ' +
      tipo +
      '\r\n\r\n',
  );
  return {
    payload: Buffer.concat([cabeca, buf, Buffer.from('\r\n--' + b + '--\r\n')]),
    headers: { ...auth(), 'content-type': 'multipart/form-data; boundary=' + b },
  };
}

const umaFoto = (largura = 3000, altura = 2000) =>
  sharp({ create: { width: largura, height: altura, channels: 3, background: '#c85a28' } })
    .jpeg()
    .toBuffer();

beforeEach(async () => {
  vi.clearAllMocks();
  guardadas.clear();
  apagadas.length = 0;
  contador.n = 0;
  Object.assign(prismaMock, criarPrismaMock());
  cozinhaLogada(prismaMock, COZINHA.id, 'ku1');
  prismaMock.kitchen.findUnique.mockResolvedValue(COZINHA);
  app = await buildApp({ socket: false, logger: false, cron: false });
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

/** O update devolve a cozinha com o que a rota mandou gravar. */
function updateEcoa() {
  prismaMock.kitchen.update.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({ ...COZINHA, ...data }),
  );
}

describe('POST /api/r/perfil/foto', () => {
  it('converte pra webp e encolhe antes de guardar', async () => {
    updateEcoa();

    const res = await app.inject({
      method: 'POST',
      url: '/api/r/perfil/foto',
      ...multipart(await umaFoto()),
    });

    expect(res.statusCode).toBe(201);
    const chave = prismaMock.kitchen.update.mock.calls[0][0].data.photoKey;
    expect(chave).toMatch(/\.webp$/);

    // A prova de que nao guardou o arquivo como veio.
    const meta = await sharp(guardadas.get(chave)!).metadata();
    expect(meta.format).toBe('webp');
    expect(Math.max(meta.width!, meta.height!)).toBe(1600);
  });

  it('a resposta ja traz a foto que esta valendo', async () => {
    updateEcoa();

    const res = await app.inject({
      method: 'POST',
      url: '/api/r/perfil/foto',
      ...multipart(await umaFoto()),
    });

    const corpo = res.json();
    expect(corpo.foto).toMatch(/^\/api\/fotos\/.+\.webp$/);
    // O campo antigo continua separado — a tela precisa dos dois pra saber
    // qual deles ela esta editando.
    expect(corpo.photoUrl).toBeNull();
  });

  it('trocar a foto apaga o arquivo anterior', async () => {
    prismaMock.kitchen.findUnique.mockResolvedValue({ ...COZINHA, photoKey: 'velha.webp' });
    updateEcoa();

    await app.inject({
      method: 'POST',
      url: '/api/r/perfil/foto',
      ...multipart(await umaFoto()),
    });

    expect(apagadas).toEqual(['velha.webp']);
  });

  it('arquivo que nao e imagem nao vira foto', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/r/perfil/foto',
      ...multipart(Buffer.from('nao sou uma imagem'), 'x.jpg'),
    });

    expect(res.statusCode).toBe(400);
    expect(prismaMock.kitchen.update).not.toHaveBeenCalled();
    expect(guardadas.size).toBe(0);
  });

  it('sem token nao envia', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/r/perfil/foto',
      payload: Buffer.from(''),
      headers: { 'content-type': 'multipart/form-data; boundary=----x' },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('DELETE /api/r/perfil/foto', () => {
  it('remove a foto enviada e apaga o arquivo', async () => {
    prismaMock.kitchen.findUnique.mockResolvedValue({ ...COZINHA, photoKey: 'atual.webp' });
    prismaMock.kitchen.update.mockResolvedValue({ ...COZINHA, photoKey: null });

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/r/perfil/foto',
      headers: auth(),
    });

    expect(res.statusCode).toBe(200);
    expect(prismaMock.kitchen.update.mock.calls[0][0].data).toEqual({ photoKey: null });
    expect(apagadas).toEqual(['atual.webp']);
    expect(res.json().foto).toBeNull();
  });

  it('a URL antiga NAO vai junto — ela volta a valer', async () => {
    const legado = 'https://exemplo.com/lou.jpg';
    prismaMock.kitchen.findUnique.mockResolvedValue({
      ...COZINHA,
      photoKey: 'atual.webp',
      photoUrl: legado,
    });
    prismaMock.kitchen.update.mockResolvedValue({
      ...COZINHA,
      photoKey: null,
      photoUrl: legado,
    });

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/r/perfil/foto',
      headers: auth(),
    });

    expect(res.json().photoUrl).toBe(legado);
    expect(res.json().foto).toBe(legado);
  });

  it('cozinha sem foto: nao tenta apagar arquivo nenhum', async () => {
    prismaMock.kitchen.update.mockResolvedValue(COZINHA);

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/r/perfil/foto',
      headers: auth(),
    });

    expect(res.statusCode).toBe(200);
    expect(apagadas).toEqual([]);
  });
});
