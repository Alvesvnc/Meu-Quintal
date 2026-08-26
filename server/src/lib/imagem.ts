import sharp from 'sharp';

/**
 * Processa foto enviada pela cozinha antes de guardar.
 *
 * NUNCA se guarda o arquivo como veio. Reencodar resolve quatro problemas de
 * uma vez, e nenhum deles é opcional:
 *
 * 1. VALIDAÇÃO DE VERDADE. O `content-type` do upload é escrito por quem
 *    envia; a extensão também. A única prova de que aquilo é uma imagem é
 *    decodificar. Um arquivo que abre como imagem E é executável em outro
 *    contexto (polyglot) não sobrevive ao reencode.
 *
 * 2. EXIF, QUE INCLUI GPS. Foto de prato tirada no celular carrega a
 *    coordenada de onde foi tirada. Se a cozinheira fotografa em casa e a foto
 *    vai pro cardápio público, o endereço dela vai junto. `sharp` só preserva
 *    metadado quando mandam — o padrão descarta tudo, e é o que queremos.
 *
 * 3. TAMANHO. Foto de celular tem 4 a 12 MB. O cliente abre o cardápio no 4G
 *    dentro do restaurante; servir o original é o mesmo que não servir.
 *
 * 4. BOMBA DE DESCOMPRESSÃO. Um PNG de 200 KB pode declarar 20000×20000 e
 *    querer 1,2 GB de RAM pra abrir. `limitInputPixels` corta antes de alocar.
 */

/** Lado maior depois do processamento. Cobre tela cheia em retina sem exagero. */
const LADO_MAXIMO = 1600;

/** Teto de pixels na ENTRADA (~50 MP). Foto de celular topo de linha tem ~50 MP. */
const PIXELS_MAXIMOS = 50_000_000;

/** 8 MB. Acima disso é foto que ninguém tirou pra cardápio. */
export const BYTES_MAXIMOS = 8 * 1024 * 1024;

export const EXTENSAO = 'webp';
export const CONTENT_TYPE = 'image/webp';

export interface ImagemProcessada {
  data: Buffer;
  width: number;
  height: number;
  bytes: number;
}

export class ImagemInvalida extends Error {}

export async function processarFoto(entrada: Buffer): Promise<ImagemProcessada> {
  if (entrada.length === 0) throw new ImagemInvalida('Arquivo vazio.');
  if (entrada.length > BYTES_MAXIMOS) {
    throw new ImagemInvalida('Imagem maior que 8 MB.');
  }

  try {
    const data = await sharp(entrada, { limitInputPixels: PIXELS_MAXIMOS })
      // `rotate()` sem argumento APLICA a orientação do EXIF e só então a
      // descarta. Sem isto, foto tirada em pé chega deitada — a informação de
      // rotação some junto com o resto do metadado.
      .rotate()
      .resize(LADO_MAXIMO, LADO_MAXIMO, { fit: 'inside', withoutEnlargement: true })
      // webp: metade do peso de um JPEG equivalente, e todo navegador que este
      // produto atende já lê há anos.
      .webp({ quality: 82 })
      .toBuffer();

    const meta = await sharp(data).metadata();
    return {
      data,
      width: meta.width ?? 0,
      height: meta.height ?? 0,
      bytes: data.length,
    };
  } catch (e) {
    // Qualquer falha aqui significa "isto não é uma imagem que eu consiga
    // abrir" — inclusive o arquivo grande demais em pixels. Não vaza a
    // mensagem do sharp, que expõe detalhe de biblioteca.
    if (e instanceof ImagemInvalida) throw e;
    throw new ImagemInvalida('Nao consegui ler essa imagem.');
  }
}
