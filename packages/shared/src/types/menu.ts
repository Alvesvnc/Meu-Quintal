/** Resposta de GET /api/m/k/:slug — cardápio de uma cozinha. */

export type MenuCategory = 'entradas' | 'pratos' | 'sobremesas' | 'bebidas';
export type MenuBadge = 'novo' | 'esgotando' | 'sem-estoque';

export interface MenuItemFoto {
  id: string;
  url: string;
  width: number;
  height: number;
}

export interface MenuItem {
  id: string;
  kitchenSlug: string;
  category: MenuCategory;
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
  items: MenuItem[];
}
