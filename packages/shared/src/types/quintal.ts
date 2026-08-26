/** Resposta de GET /api/m/quintal — visão do cliente pós-QR. */

export interface QuintalResponse {
  space: {
    id: string;
    slug: string;
    name: string;
    /**
     * Em `restaurante-unico` a tela do cliente pula a lista de cozinhas e vai
     * direto ao cardapio — uma lista de um item so nao ajuda ninguem.
     *
     * O tipo, e nao `kitchens.length === 1`: uma praca de alimentacao com uma
     * cozinha unica no momento continua sendo uma praca, e a tela deve seguir
     * mostrando a lista.
     */
    tipo: import('./admin').TipoDeEspaco;
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
