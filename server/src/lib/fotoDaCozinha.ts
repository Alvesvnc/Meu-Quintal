import { urlPublica } from './armazenamento.js';

/**
 * A foto de capa da cozinha, pronta pro `<img>` — ou `null` se não tem.
 *
 * Duas fontes convivem e a ORDEM IMPORTA:
 *
 *   - `photoKey` é arquivo nosso, enviado pela cozinha e já reencodado pra
 *     webp (ver lib/imagem.ts);
 *   - `photoUrl` é o campo antigo, uma URL colada à mão apontando pra imagem
 *     hospedada em outro site — que some no dia em que aquele site cair.
 *
 * Quem enviou uma foto quis trocar a antiga, então o arquivo enviado ganha. A
 * URL velha continua guardada e volta a valer se a foto enviada for removida:
 * apagar o registro dela junto seria decidir pela cozinha.
 *
 * Mesma regra do cardápio (`fotosDoItem`, no app do cliente). Se as duas
 * divergirem, um prato e a cozinha dele mostram fotos de origens diferentes.
 */
export function fotoDaCozinha(k: {
  photoKey: string | null;
  photoUrl: string | null;
}): string | null {
  if (k.photoKey) return urlPublica(k.photoKey);
  return k.photoUrl;
}
