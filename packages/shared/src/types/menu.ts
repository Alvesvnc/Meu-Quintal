/** Resposta de GET /api/m/k/:slug — cardápio de uma cozinha. */

export type MenuBadge = 'novo' | 'esgotando' | 'sem-estoque';

/**
 * Uma secao do cardapio, escrita pela cozinha.
 *
 * Era um enum de quatro valores ('entradas' | 'pratos' | ...) e o app do
 * cliente traduzia cada um pro rotulo. Agora o rotulo vem pronto do servidor:
 * quem escreve "Do forno" ou "Pra beber" e a casa, nao a gente.
 */
export interface MenuCategoria {
  id: string;
  name: string;
}

export interface MenuItemFoto {
  id: string;
  url: string;
  width: number;
  height: number;
}

export interface MenuItem {
  id: string;
  kitchenSlug: string;
  /** A secao do cardapio. Resolve em `KitchenMenuResponse.categorias`. */
  categoriaId: string;
  name: string;
  description: string | null;
  priceCents: number;
  /** URL externa, legado. Foto nova vem em `fotos`. */
  photoUrl: string | null;
  /**
   * Fotos do prato. A primeira e a capa — e a unica que aparece na lista.
   * As outras so no detalhe: o cliente decide o que pedir olhando, e um prato
   * tem angulos.
   */
  fotos: MenuItemFoto[];
  available: boolean;
  badge: MenuBadge | null;
}

export interface KitchenMenuResponse {
  kitchen: {
    id: string;
    slug: string;
    name: string;
    tagline: string | null;
    photoUrl: string | null;
    slaMinutes: number;
  };
  /**
   * Na ordem em que a cozinha decidiu exibir. Vem inteira, inclusive secao
   * vazia — filtrar aqui obrigaria o app a adivinhar a ordem das que sobraram.
   */
  categorias: MenuCategoria[];
  items: MenuItem[];
}
