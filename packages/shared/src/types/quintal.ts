/** Resposta de GET /api/m/quintal — visão do cliente pós-QR. */

export interface QuintalResponse {
  space: {
    id: string;
    slug: string;
    name: string;
  };
  table: {
    id: string;
    numero: number;
  };
  kitchens: KitchenSummary[];
}

export interface KitchenSummary {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  tagline: string | null;
  photoUrl: string | null;
  slaMinutes: number;
  priceMinCents: number;
  priceMaxCents: number;
  isOpen: boolean;
  closingNote: string | null;
}
