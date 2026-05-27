/**
 * Mock de acompanhamento ao vivo. Substituido por GET /api/pedido/:id
 * + Socket.io "order:status" no MVP.
 *
 * Os estados estao mockados em variacoes pra a tela mostrar o design completo
 * de uma só vez: PREPARANDO, PRONTO, RECEBIDO. No backend real cada cozinha
 * avanca independente.
 */

export type Status = 'recebido' | 'preparando' | 'pronto' | 'retirado';

export const STATUS_LABEL: Record<Status, string> = {
  recebido:   'Recebido',
  preparando: 'Preparando',
  pronto:     'Pronto',
  retirado:   'Retirado',
};

export const STATUS_ORDER: Status[] = ['recebido', 'preparando', 'pronto', 'retirado'];

export interface OrderItem {
  qty: number;
  name: string;
}

export interface OrderKitchen {
  kitchenSlug: string;
  kitchenName: string;
  items: OrderItem[];
  status: Status;
  /** epoch ms quando cada status foi atingido. ausente = futuro. */
  timestamps: Partial<Record<Status, number>>;
  /** SLA da cozinha em minutos — base pra calcular tempo restante. */
  slaMinutes: number;
}

export interface MockOrder {
  id: string;
  mesaNumero: number;
  createdAt: number;
  kitchens: OrderKitchen[];
}

const minutesAgo = (n: number) => Date.now() - n * 60_000;

export function getMockOrder(id: string): MockOrder {
  return {
    id,
    mesaNumero: 12,
    createdAt: minutesAgo(8),
    kitchens: [
      {
        kitchenSlug: 'lou-burger',
        kitchenName: 'Lou Burger',
        slaMinutes: 12,
        status: 'preparando',
        timestamps: {
          recebido:   minutesAgo(8),
          preparando: minutesAgo(6),
        },
        items: [
          { qty: 1, name: 'Smash Lou' },
          { qty: 1, name: 'Batata-doce frita' },
          { qty: 2, name: 'Refrigerante lata' },
        ],
      },
      {
        kitchenSlug: 'cumbuca-caicara',
        kitchenName: 'Cumbuca Caiçara',
        slaMinutes: 18,
        status: 'pronto',
        timestamps: {
          recebido:   minutesAgo(8),
          preparando: minutesAgo(7),
          pronto:     minutesAgo(0),
        },
        items: [
          { qty: 1, name: 'Moqueca de peixe' },
        ],
      },
      {
        kitchenSlug: 'pasteloka',
        kitchenName: 'Pasteloka',
        slaMinutes: 8,
        status: 'recebido',
        timestamps: {
          recebido: minutesAgo(2),
        },
        items: [
          { qty: 2, name: 'Pastel de feira' },
          { qty: 1, name: 'Caldo de cana' },
        ],
      },
    ],
  };
}

export function fmtTime(epoch: number): string {
  return new Date(epoch).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
