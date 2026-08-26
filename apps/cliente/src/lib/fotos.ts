import { API_BASE } from '../api/client';
import type { MenuItem } from '@mq/shared';

/**
 * Endereço completo de uma foto do cardápio.
 *
 * O servidor devolve caminho relativo (`/api/fotos/…`) porque não sabe em que
 * domínio está publicado. Sem este prefixo o `<img>` procuraria a foto no
 * próprio app — que roda em outra porta — e receberia o `index.html` de volta.
 */
export function urlDaFoto(caminho: string): string {
  return caminho.startsWith('http') ? caminho : `${API_BASE}${caminho}`;
}

/**
 * Todas as fotos do item, na ordem, prontas pra `<img>`.
 *
 * Foto enviada pela cozinha tem precedência sobre `photoUrl` — o campo antigo,
 * que aponta pra imagem hospedada em outro site e some no dia em que aquele
 * site cair. Quando não há foto enviada, ele ainda serve.
 */
export function fotosDoItem(item: Pick<MenuItem, 'fotos' | 'photoUrl'>): string[] {
  if (item.fotos.length > 0) return item.fotos.map((f) => urlDaFoto(f.url));
  return item.photoUrl ? [item.photoUrl] : [];
}
