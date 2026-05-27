/**
 * Mock do quintal — substituido por GET /api/m/:tableToken/quintal no MVP.
 * Fotos: Unsplash com hash estavel (4:5 vertical conforme MASTER §8.e).
 */

export interface Kitchen {
  id: string;
  slug: string;
  name: string;
  tagline: string;       // 1 linha, 2 chaves do menu (ver pages/cliente.md)
  etaMinutes: number;    // tempo medio agora
  priceMin: number;
  priceMax: number;
  photoUrl: string;
  isOpen: boolean;
  closingNote?: string;  // ex: "fechando 22h"
}

export const MESA_ATUAL = { numero: 12, token: 'mesa-12-aXk9' };

export const KITCHENS: Kitchen[] = [
  {
    id: 'k1',
    slug: 'lou-burger',
    name: 'Lou Burger',
    tagline: 'Hambúrguer de pasto, batata-doce frita.',
    etaMinutes: 12,
    priceMin: 18,
    priceMax: 46,
    photoUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80&auto=format&fit=crop&ar=4:5',
    isOpen: true,
  },
  {
    id: 'k2',
    slug: 'cumbuca-caicara',
    name: 'Cumbuca Caiçara',
    tagline: 'Moqueca, peixe do dia, arroz de coco.',
    etaMinutes: 18,
    priceMin: 22,
    priceMax: 58,
    photoUrl: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&q=80&auto=format&fit=crop&ar=4:5',
    isOpen: true,
  },
  {
    id: 'k3',
    slug: 'pasteloka',
    name: 'Pasteloka',
    tagline: 'Pastel de feira, caldo de cana, queijo coalho.',
    etaMinutes: 8,
    priceMin: 9,
    priceMax: 22,
    photoUrl: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800&q=80&auto=format&fit=crop&ar=4:5',
    isOpen: true,
  },
  {
    id: 'k4',
    slug: 'horta-do-zé',
    name: 'Horta do Zé',
    tagline: 'Tigela de grãos, vegetais grelhados, missô.',
    etaMinutes: 10,
    priceMin: 24,
    priceMax: 38,
    photoUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80&auto=format&fit=crop&ar=4:5',
    isOpen: true,
  },
  {
    id: 'k5',
    slug: 'dolce-marina',
    name: 'Dolce Marina',
    tagline: 'Brigadeiro de colher, pudim, café coado.',
    etaMinutes: 5,
    priceMin: 8,
    priceMax: 24,
    photoUrl: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800&q=80&auto=format&fit=crop&ar=4:5',
    isOpen: true,
    closingNote: 'fecha 22h',
  },
];
