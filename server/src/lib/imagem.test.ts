import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { processarFoto, ImagemInvalida, BYTES_MAXIMOS } from './imagem.js';

/**
 * O processamento da foto enviada.
 *
 * Cada teste aqui corresponde a uma coisa que aconteceria em produção se o
 * arquivo fosse guardado como veio: o GPS da cozinheira no cardápio público, um
 * cardápio de 40 MB no 4G, um arquivo executável com nome de imagem.
 */

/** Imagem de verdade, do tamanho pedido. */
function foto(width: number, height: number) {
  return sharp({ create: { width, height, channels: 3, background: { r: 200, g: 90, b: 40 } } })
    .jpeg({ quality: 92 })
    .toBuffer();
}

describe('o que sai', () => {
  it('reencoda pra webp, seja qual for a entrada', async () => {
    const r = await processarFoto(await foto(800, 600));
    const meta = await sharp(r.data).metadata();
    // Reencodar é o que mata polyglot: um arquivo que é imagem E outra coisa
    // não sobrevive a ser decodificado e escrito de novo.
    expect(meta.format).toBe('webp');
  });

  it('reduz foto de celular pro que cabe numa tela', async () => {
    const r = await processarFoto(await foto(3024, 4032));
    // Lado maior em 1600. O cliente abre o cardápio no 4G dentro do
    // restaurante; servir 4032px é o mesmo que não servir.
    expect(Math.max(r.width, r.height)).toBe(1600);
    expect(r.width).toBe(1200);
  });

  it('NAO amplia imagem pequena', async () => {
    const r = await processarFoto(await foto(300, 200));
    // Esticar 300px pra 1600 não cria detalhe nenhum: só peso e borrão.
    expect(r.width).toBe(300);
    expect(r.height).toBe(200);
  });

  it('devolve a dimensao final, nao a de entrada', async () => {
    const r = await processarFoto(await foto(2000, 1000));
    const meta = await sharp(r.data).metadata();
    // O front usa isso pra reservar espaço antes de a imagem carregar. Se
    // vier a dimensão de entrada, a lista pula quando cada foto chega.
    expect(r.width).toBe(meta.width);
    expect(r.height).toBe(meta.height);
    expect(r.bytes).toBe(r.data.length);
  });
});

describe('metadado', () => {
  it('apaga o EXIF — inclusive o GPS', async () => {
    const comGps = await sharp({
      create: { width: 400, height: 300, channels: 3, background: '#c85a28' },
    })
      // IFD3 e onde o GPS mora no EXIF — e o bloco que a camera do celular
      // preenche com a coordenada de onde a foto foi tirada.
      .withExif({
        IFD0: { Artist: 'camera do celular' },
        IFD3: { GPSLatitude: '23/1 33/1 0/1', GPSLongitude: '46/1 38/1 0/1' },
      })
      .jpeg()
      .toBuffer();

    expect((await sharp(comGps).metadata()).exif).toBeDefined();

    const r = await processarFoto(comGps);
    // Foto de prato tirada em casa carrega a coordenada de casa. Se ela vai
    // pro cardápio público, o endereço vai junto.
    expect((await sharp(r.data).metadata()).exif).toBeUndefined();
  });

  it('mas APLICA a rotacao do EXIF antes de descartar', async () => {
    // orientation 6 = girada 90°. É o que a câmera grava quando a foto é
    // tirada em pé; sem aplicar, o prato chega deitado no cardápio.
    const deitada = await sharp({
      create: { width: 400, height: 300, channels: 3, background: '#c85a28' },
    })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();

    const r = await processarFoto(deitada);
    expect(r.height).toBeGreaterThan(r.width);
  });
});

describe('o que e recusado', () => {
  it('arquivo que nao e imagem', async () => {
    await expect(processarFoto(Buffer.from('<?php system($_GET["c"]); ?>'))).rejects.toBeInstanceOf(
      ImagemInvalida,
    );
  });

  it('arquivo vazio', async () => {
    await expect(processarFoto(Buffer.alloc(0))).rejects.toBeInstanceOf(ImagemInvalida);
  });

  it('acima de 8 MB', async () => {
    const gordo = Buffer.alloc(BYTES_MAXIMOS + 1, 1);
    await expect(processarFoto(gordo)).rejects.toThrow(/8 MB/);
  });

  it('bomba de descompressao', async () => {
    // PNG pequeno em bytes, absurdo em pixels: abrir custaria gigabytes de RAM.
    const bomba = await sharp({
      create: { width: 12_000, height: 12_000, channels: 3, background: '#000' },
    })
      .png({ compressionLevel: 9 })
      .toBuffer();

    expect(bomba.length).toBeLessThan(BYTES_MAXIMOS);
    await expect(processarFoto(bomba)).rejects.toBeInstanceOf(ImagemInvalida);
  });

  it('a mensagem de erro nao vaza detalhe de biblioteca', async () => {
    try {
      await processarFoto(Buffer.from('nao sou imagem'));
      expect.unreachable();
    } catch (e) {
      // O erro do sharp cita caminho de arquivo e versão de libvips. Nada disso
      // interessa a quem está tentando cadastrar um prato.
      expect((e as Error).message).toBe('Nao consegui ler essa imagem.');
    }
  });
});
