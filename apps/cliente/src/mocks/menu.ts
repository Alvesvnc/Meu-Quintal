/**
 * Cardápio mock — substituido por GET /api/k/:slug/menu no MVP.
 * Preços em centavos pra evitar float; format em pt-BR no display.
 */

export type Category = 'entradas' | 'pratos' | 'sobremesas' | 'bebidas';

export interface MenuItem {
  id: string;
  kitchenSlug: string;
  category: Category;
  name: string;
  description: string;
  priceCents: number;
  photoUrl: string;
  available: boolean;
  badge?: 'novo' | 'sem-estoque' | 'esgotando';
}

export const CATEGORY_LABEL: Record<Category, string> = {
  entradas:   'Entradas',
  pratos:     'Pratos',
  sobremesas: 'Sobremesas',
  bebidas:    'Bebidas',
};

const PHOTO = {
  smash:    'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80&auto=format&fit=crop',
  smashVeg: 'https://images.unsplash.com/photo-1525059696034-4967a8e1dca2?w=400&q=80&auto=format&fit=crop',
  batata:   'https://images.unsplash.com/photo-1639024471283-03518883512d?w=400&q=80&auto=format&fit=crop',
  onion:    'https://images.unsplash.com/photo-1639024471283-03518883512d?w=400&q=80&auto=format&fit=crop',
  brownie:  'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=400&q=80&auto=format&fit=crop',
  refri:    'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&q=80&auto=format&fit=crop',
  agua:     'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=400&q=80&auto=format&fit=crop',
  cerveja:  'https://images.unsplash.com/photo-1608270586620-248524c67de9?w=400&q=80&auto=format&fit=crop',
};

export const LOU_BURGER_MENU: MenuItem[] = [
  // Entradas
  {
    id: 'lb-e1',
    kitchenSlug: 'lou-burger',
    category: 'entradas',
    name: 'Batata-doce frita',
    description: 'Cubos rústicos, sal de ervas, maionese de páprica defumada.',
    priceCents: 1800,
    photoUrl: PHOTO.batata,
    available: true,
  },
  {
    id: 'lb-e2',
    kitchenSlug: 'lou-burger',
    category: 'entradas',
    name: 'Onion rings',
    description: 'Cebola roxa em anéis grossos, empanado leve, molho ranch da casa.',
    priceCents: 2200,
    photoUrl: PHOTO.onion,
    available: true,
  },
  // Pratos
  {
    id: 'lb-p1',
    kitchenSlug: 'lou-burger',
    category: 'pratos',
    name: 'Smash Lou',
    description: 'Dois smashes de 90g, queijo prato derretido, picles, molho da casa. Pão brioche.',
    priceCents: 3200,
    photoUrl: PHOTO.smash,
    available: true,
    badge: 'novo',
  },
  {
    id: 'lb-p2',
    kitchenSlug: 'lou-burger',
    category: 'pratos',
    name: 'Smash duplo bacon',
    description: 'Dois smashes 90g, bacon caramelizado, cheddar inglês, cebola crispy.',
    priceCents: 3800,
    photoUrl: PHOTO.smash,
    available: true,
  },
  {
    id: 'lb-p3',
    kitchenSlug: 'lou-burger',
    category: 'pratos',
    name: 'Smash vegetariano',
    description: 'Burger de grão-de-bico e beterraba, queijo coalho, rúcula, maionese de coentro.',
    priceCents: 2900,
    photoUrl: PHOTO.smashVeg,
    available: true,
  },
  {
    id: 'lb-p4',
    kitchenSlug: 'lou-burger',
    category: 'pratos',
    name: 'Smash triplo',
    description: 'Três smashes 90g, cheddar duplo, sem firula. Para quem chegou com fome.',
    priceCents: 4600,
    photoUrl: PHOTO.smash,
    available: false,
    badge: 'sem-estoque',
  },
  // Sobremesas
  {
    id: 'lb-s1',
    kitchenSlug: 'lou-burger',
    category: 'sobremesas',
    name: 'Brownie quente',
    description: 'Brownie meio amargo recém-saído do forno, sorvete de baunilha de fava.',
    priceCents: 2400,
    photoUrl: PHOTO.brownie,
    available: true,
  },
  // Bebidas
  {
    id: 'lb-b1',
    kitchenSlug: 'lou-burger',
    category: 'bebidas',
    name: 'Refrigerante lata',
    description: 'Coca, Guaraná, Sprite, Coca zero.',
    priceCents: 700,
    photoUrl: PHOTO.refri,
    available: true,
  },
  {
    id: 'lb-b2',
    kitchenSlug: 'lou-burger',
    category: 'bebidas',
    name: 'Água com gás',
    description: '500ml, limão opcional.',
    priceCents: 600,
    photoUrl: PHOTO.agua,
    available: true,
  },
  {
    id: 'lb-b3',
    kitchenSlug: 'lou-burger',
    category: 'bebidas',
    name: 'Chopp artesanal',
    description: 'Pilsen da microcervejaria parceira, 350ml.',
    priceCents: 1400,
    photoUrl: PHOTO.cerveja,
    available: true,
    badge: 'esgotando',
  },
];

/** Lookup por slug — futuramente vem da API. Só Lou Burger tem cardápio mock. */
export function getMenuBySlug(slug: string): MenuItem[] {
  if (slug === 'lou-burger') return LOU_BURGER_MENU;
  return [];
}

export function getItemById(id: string): MenuItem | undefined {
  return LOU_BURGER_MENU.find((i) => i.id === id);
}

export function fmtBRL(cents: number): string {
  const reais = cents / 100;
  return reais.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  });
}
