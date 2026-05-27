/** Info da cozinha que o app representa. No MVP vem do login + GET /api/me/kitchen. */

export type KitchenStatus = 'ativa' | 'pausada' | 'rascunho';

export interface KitchenInfo {
  slug: string;
  /** Nome oficial — aparece pro cliente */
  name: string;
  category: string;
  tagline: string;        // 1 linha, 2 chaves do menu
  description: string;    // bio mais longa, opcional
  photoUrl?: string;      // capa 4:5 vertical
  ownerName: string;
  ownerEmail: string;
  slaMinutes: number;
  status: KitchenStatus;
}

export const MINHA_COZINHA: KitchenInfo = {
  slug: 'lou-burger',
  name: 'Lou Burger',
  category: 'Hamburgueria',
  tagline: 'Hambúrguer de pasto, batata-doce frita.',
  description: '',
  photoUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80&auto=format&fit=crop',
  ownerName: 'Marcos',
  ownerEmail: 'marcos@louburger.com',
  slaMinutes: 12,
  status: 'ativa',
};

export const STATUS_LABEL: Record<KitchenStatus, string> = {
  ativa:    'ativa',
  pausada:  'pausada — não aparece pro cliente',
  rascunho: 'rascunho — ainda não publicada',
};
