/**
 * Mocks das mesas do quintal — 16 mesas.
 * No MVP vem de GET /api/admin/mesas + SSE/WS pra atualizar status.
 */

export type MesaStatus = 'livre' | 'ocupada' | 'precisa-limpar';

export interface Mesa {
  numero: number;
  status: MesaStatus;
  /** Token do QR (efêmero - rotaciona a cada sessão). */
  qrToken: string;
  /** Pedidos do dia nessa mesa. */
  ordersToday: number;
  /** Quanto a mesa fez de bruto hoje (cents). */
  grossCents: number;
  /** Última atividade — epoch ms. */
  lastActivityAt?: number;
}

const minAgo = (n: number) => Date.now() - n * 60_000;

function gen(numero: number, status: MesaStatus, ordersToday: number, grossCents: number, lastActivityAt?: number): Mesa {
  return {
    numero,
    status,
    qrToken: `mesa-${numero}-${Math.random().toString(36).slice(2, 7)}`,
    ordersToday,
    grossCents,
    lastActivityAt,
  };
}

export const MESAS: Mesa[] = [
  gen(1,  'ocupada',         3,  18400, minAgo(8)),
  gen(2,  'livre',           1,   5400, minAgo(120)),
  gen(3,  'livre',           0,      0),
  gen(4,  'ocupada',         2,  12200, minAgo(4)),
  gen(5,  'precisa-limpar',  4,  21800, minAgo(15)),
  gen(6,  'livre',           1,   8800, minAgo(90)),
  gen(7,  'ocupada',         1,   4400, minAgo(2)),
  gen(8,  'ocupada',         5,  31200, minAgo(10)),
  gen(9,  'ocupada',         2,  14800, minAgo(20)),
  gen(10, 'livre',           0,      0),
  gen(11, 'ocupada',         3,  22600, minAgo(6)),
  gen(12, 'ocupada',         2,  17400, minAgo(1)),
  gen(13, 'livre',           1,   6200, minAgo(150)),
  gen(14, 'ocupada',         4,  28800, minAgo(7)),
  gen(15, 'ocupada',         1,   8400, minAgo(3)),
  gen(16, 'livre',           0,      0),
];

export const MESA_STATUS_LABEL: Record<MesaStatus, string> = {
  livre:           'livre',
  ocupada:         'ocupada',
  'precisa-limpar':'limpar',
};
