/**
 * Pedidos da fila do restaurante. Mock estático ilustrando os 3 estados ativos:
 * NOVOS / PREPARANDO / PRONTOS.
 *
 * No MVP real vem de Socket.io "order:new" + estado inicial via GET /api/restaurante/fila.
 */

export type Status = 'novo' | 'preparando' | 'pronto' | 'retirado' | 'cancelado';

export const STATUS_LABEL: Record<Status, string> = {
  novo:       'Novo',
  preparando: 'Preparando',
  pronto:     'Pronto',
  retirado:   'Retirado',
  cancelado:  'Cancelado',
};

export interface OrderLine {
  qty: number;
  name: string;
  note?: string;
}

export interface Order {
  id: string;
  mesaNumero: number;
  status: Status;
  createdAt: number;            // epoch ms
  acceptedAt?: number;          // quando saiu de novo→preparando
  readyAt?: number;             // quando saiu de preparando→pronto
  pickedAt?: number;            // quando saiu de pronto→retirado
  lines: OrderLine[];
  /** Centavos — usado nas métricas, não aparece na fila. */
  totalCents: number;
}

const minutesAgo = (n: number) => Date.now() - n * 60_000;

export const INITIAL_QUEUE: Order[] = [
  // ─── NOVOS ───
  {
    id: '2421',
    mesaNumero: 12,
    status: 'novo',
    createdAt: minutesAgo(1),
    totalCents: 8000,
    lines: [
      { qty: 1, name: 'Smash Lou' },
      { qty: 1, name: 'Smash vegetariano', note: 'sem rúcula' },
      { qty: 2, name: 'Refrigerante lata' },
    ],
  },
  {
    id: '2422',
    mesaNumero: 4,
    status: 'novo',
    createdAt: minutesAgo(3),
    totalCents: 3200,
    lines: [
      { qty: 1, name: 'Smash Lou' },
    ],
  },
  {
    id: '2423',
    mesaNumero: 7,
    status: 'novo',
    createdAt: minutesAgo(0),
    totalCents: 4400,
    lines: [
      { qty: 1, name: 'Smash duplo bacon' },
      { qty: 1, name: 'Onion rings' },
    ],
  },

  // ─── PREPARANDO ───
  {
    id: '2418',
    mesaNumero: 4,
    status: 'preparando',
    createdAt: minutesAgo(10),
    acceptedAt: minutesAgo(8),
    totalCents: 6600,
    lines: [
      { qty: 2, name: 'Smash Lou' },
      { qty: 1, name: 'Batata-doce frita' },
    ],
  },
  {
    id: '2420',
    mesaNumero: 9,
    status: 'preparando',
    createdAt: minutesAgo(15), // ATRASADO — preparando há mais que SLA
    acceptedAt: minutesAgo(14),
    totalCents: 5800,
    lines: [
      { qty: 1, name: 'Smash duplo bacon' },
      { qty: 1, name: 'Brownie quente' },
      { qty: 1, name: 'Chopp artesanal' },
    ],
  },

  // ─── PRONTOS ───
  {
    id: '2419',
    mesaNumero: 9,
    status: 'pronto',
    createdAt: minutesAgo(18),
    acceptedAt: minutesAgo(16),
    readyAt: minutesAgo(2),
    totalCents: 4900,
    lines: [
      { qty: 1, name: 'Smash vegetariano' },
      { qty: 1, name: 'Batata-doce frita' },
    ],
  },
];

/** Histórico mock pra Tela 03. Pedidos do dia já finalizados. */
export const TODAY_HISTORY: Order[] = [
  {
    id: '2417', mesaNumero: 2, status: 'retirado',
    createdAt: minutesAgo(120), acceptedAt: minutesAgo(118), readyAt: minutesAgo(108), pickedAt: minutesAgo(105),
    totalCents: 5400,
    lines: [{ qty: 1, name: 'Smash Lou' }, { qty: 1, name: 'Refrigerante lata' }, { qty: 1, name: 'Batata-doce frita' }],
  },
  {
    id: '2416', mesaNumero: 11, status: 'retirado',
    createdAt: minutesAgo(140), acceptedAt: minutesAgo(138), readyAt: minutesAgo(126), pickedAt: minutesAgo(122),
    totalCents: 7600,
    lines: [{ qty: 2, name: 'Smash duplo bacon' }, { qty: 1, name: 'Onion rings' }],
  },
  {
    id: '2415', mesaNumero: 3, status: 'cancelado',
    createdAt: minutesAgo(155), acceptedAt: minutesAgo(154),
    totalCents: 3200,
    lines: [{ qty: 1, name: 'Smash triplo' }],
  },
  {
    id: '2414', mesaNumero: 8, status: 'retirado',
    createdAt: minutesAgo(180), acceptedAt: minutesAgo(178), readyAt: minutesAgo(168), pickedAt: minutesAgo(165),
    totalCents: 4600,
    lines: [{ qty: 1, name: 'Smash Lou' }, { qty: 1, name: 'Brownie quente' }],
  },
  {
    id: '2413', mesaNumero: 5, status: 'retirado',
    createdAt: minutesAgo(210), acceptedAt: minutesAgo(208), readyAt: minutesAgo(198), pickedAt: minutesAgo(195),
    totalCents: 9800,
    lines: [{ qty: 3, name: 'Smash Lou' }, { qty: 2, name: 'Refrigerante lata' }, { qty: 1, name: 'Onion rings' }],
  },
];

/** Cardápio mock — usado na Tela 04 (editar). Espelha o que o cliente vê. */
export type MenuCategory = 'entradas' | 'pratos' | 'sobremesas' | 'bebidas';

export interface MenuItemAdmin {
  id: string;
  category: MenuCategory;
  name: string;
  description: string;
  priceCents: number;
  available: boolean;
  /** URL da foto. Pode ser remota (Unsplash) ou object URL local de file picker. */
  photoUrl?: string;
}

const PHOTO = {
  smash:    'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=80&auto=format&fit=crop',
  smashVeg: 'https://images.unsplash.com/photo-1525059696034-4967a8e1dca2?w=600&q=80&auto=format&fit=crop',
  batata:   'https://images.unsplash.com/photo-1639024471283-03518883512d?w=600&q=80&auto=format&fit=crop',
  onion:    'https://images.unsplash.com/photo-1639024471283-03518883512d?w=600&q=80&auto=format&fit=crop',
  brownie:  'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=600&q=80&auto=format&fit=crop',
  refri:    'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=600&q=80&auto=format&fit=crop',
  agua:     'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=600&q=80&auto=format&fit=crop',
  cerveja:  'https://images.unsplash.com/photo-1608270586620-248524c67de9?w=600&q=80&auto=format&fit=crop',
};

export const MENU_ADMIN: MenuItemAdmin[] = [
  { id: 'lb-e1', category: 'entradas',   name: 'Batata-doce frita',     description: 'Cubos rústicos, sal de ervas, maionese de páprica defumada.',          priceCents: 1800, available: true,  photoUrl: PHOTO.batata },
  { id: 'lb-e2', category: 'entradas',   name: 'Onion rings',           description: 'Cebola roxa em anéis grossos, empanado leve, molho ranch da casa.',     priceCents: 2200, available: true,  photoUrl: PHOTO.onion },
  { id: 'lb-p1', category: 'pratos',     name: 'Smash Lou',             description: 'Dois smashes de 90g, queijo prato derretido, picles, molho da casa.',    priceCents: 3200, available: true,  photoUrl: PHOTO.smash },
  { id: 'lb-p2', category: 'pratos',     name: 'Smash duplo bacon',     description: 'Dois smashes 90g, bacon caramelizado, cheddar inglês, cebola crispy.',   priceCents: 3800, available: true,  photoUrl: PHOTO.smash },
  { id: 'lb-p3', category: 'pratos',     name: 'Smash vegetariano',     description: 'Burger de grão-de-bico e beterraba, queijo coalho, rúcula.',              priceCents: 2900, available: true,  photoUrl: PHOTO.smashVeg },
  { id: 'lb-p4', category: 'pratos',     name: 'Smash triplo',          description: 'Três smashes 90g, cheddar duplo, sem firula.',                            priceCents: 4600, available: false, photoUrl: PHOTO.smash },
  { id: 'lb-s1', category: 'sobremesas', name: 'Brownie quente',        description: 'Brownie meio amargo recém-saído do forno, sorvete de baunilha.',         priceCents: 2400, available: true,  photoUrl: PHOTO.brownie },
  { id: 'lb-b1', category: 'bebidas',    name: 'Refrigerante lata',     description: 'Coca, Guaraná, Sprite, Coca zero.',                                       priceCents: 700,  available: true,  photoUrl: PHOTO.refri },
  { id: 'lb-b2', category: 'bebidas',    name: 'Água com gás',          description: '500ml, limão opcional.',                                                  priceCents: 600,  available: true,  photoUrl: PHOTO.agua },
  { id: 'lb-b3', category: 'bebidas',    name: 'Chopp artesanal',       description: 'Pilsen da microcervejaria parceira, 350ml.',                              priceCents: 1400, available: true,  photoUrl: PHOTO.cerveja },
];

export const CATEGORY_LABEL: Record<MenuCategory, string> = {
  entradas:   'Entradas',
  pratos:     'Pratos',
  sobremesas: 'Sobremesas',
  bebidas:    'Bebidas',
};

export function fmtBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  });
}

export function fmtTime(epoch: number): string {
  return new Date(epoch).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function minutesSince(epoch: number): number {
  return Math.floor((Date.now() - epoch) / 60_000);
}
