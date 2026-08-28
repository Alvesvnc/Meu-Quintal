import { urlPublica } from './armazenamento.js';

/**
 * A foto de capa de um item de cardápio, pronta pro `<img>` — ou `null`.
 *
 * Mesma ordem de precedência de `fotoDaCozinha`: arquivo enviado ganha da URL
 * externa colada à mão, que é legado e some no dia em que o site dela cair.
 *
 * Aceita a relação possivelmente ausente porque quem chama nem sempre pediu
 * `include: { fotos: true }` — e uma miniatura que falta vale menos que a rota
 * inteira estourando.
 */
export function fotoDoItem(
  mi: { photoUrl: string | null; fotos?: Array<{ storageKey: string }> } | null | undefined,
): string | null {
  if (!mi) return null;
  const capa = mi.fotos?.[0];
  if (capa) return urlPublica(capa.storageKey);
  return mi.photoUrl;
}
