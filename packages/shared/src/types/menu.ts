/** Resposta de GET /api/m/k/:slug — cardápio de uma cozinha. */

export type MenuCategory = 'entradas' | 'pratos' | 'sobremesas' | 'bebidas';
export type MenuBadge = 'novo' | 'esgotando' | 'sem-estoque';

export interface MenuItem {
  id: string;
  kitchenSlug: string;
  category: MenuCategory;
  name: string;
  description: string | null;
  priceCents: number;
  photoUrl: string | null;
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
