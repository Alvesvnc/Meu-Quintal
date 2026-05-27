/**
 * Mocks do financeiro — repasses por cozinha, ciclos mensais.
 * No MVP vem de GET /api/admin/financeiro.
 */

import { KITCHENS } from './quintal';

export type PayoutStatus = 'pendente' | 'liberado' | 'pago' | 'atrasado';

export interface PayoutRow {
  kitchenSlug: string;
  kitchenName: string;
  grossCents: number;
  commissionPct: number;
  commissionCents: number;
  rentCents: number; // aluguel fixo da casinha
  netCents: number;  // a transferir
  status: PayoutStatus;
  /** Quando o ciclo fecha — yyyy-mm-dd */
  cycleClosesAt: string;
}

export interface MonthSummary {
  monthLabel: string;            // "Junho · 2026"
  startsAt: string;
  closesAt: string;
  totalGrossCents: number;
  totalCommissionCents: number;
  totalRentCents: number;
  totalNetCents: number;          // a transferir
  rows: PayoutRow[];
}

/** Helper pra gerar valor com base em ratio. */
function calc(grossCents: number, commissionPct: number, rentCents: number): Pick<PayoutRow, 'commissionCents' | 'netCents'> {
  const commissionCents = Math.round(grossCents * (commissionPct / 100));
  const netCents = grossCents - commissionCents - rentCents;
  return { commissionCents, netCents };
}

const RENT_DEFAULT = 80000; // R$ 800 fixo mensal

export const MONTH_CURRENT: MonthSummary = (() => {
  const rows: PayoutRow[] = KITCHENS
    .filter((k) => k.active)
    .map((k) => {
      const grossCents = k.grossCents * 22; // simula 22 dias úteis ~
      const commissionPct = 15;
      const { commissionCents, netCents } = calc(grossCents, commissionPct, RENT_DEFAULT);
      return {
        kitchenSlug: k.slug,
        kitchenName: k.name,
        grossCents,
        commissionPct,
        commissionCents,
        rentCents: RENT_DEFAULT,
        netCents,
        status: 'pendente' as PayoutStatus,
        cycleClosesAt: '2026-06-05',
      };
    });

  const totalGrossCents = rows.reduce((a, r) => a + r.grossCents, 0);
  const totalCommissionCents = rows.reduce((a, r) => a + r.commissionCents, 0);
  const totalRentCents = rows.reduce((a, r) => a + r.rentCents, 0);
  const totalNetCents = rows.reduce((a, r) => a + r.netCents, 0);

  return {
    monthLabel: 'Junho · 2026',
    startsAt: '2026-06-01',
    closesAt: '2026-06-05',
    totalGrossCents,
    totalCommissionCents,
    totalRentCents,
    totalNetCents,
    rows,
  };
})();

/** Ciclo anterior — já pago. */
export const MONTH_PREVIOUS: MonthSummary = (() => {
  const rows: PayoutRow[] = KITCHENS
    .filter((k) => k.active)
    .map((k) => {
      const grossCents = Math.round(k.grossCents * 20 * 0.92); // mês anterior ~8% menor
      const commissionPct = 15;
      const { commissionCents, netCents } = calc(grossCents, commissionPct, RENT_DEFAULT);
      return {
        kitchenSlug: k.slug,
        kitchenName: k.name,
        grossCents,
        commissionPct,
        commissionCents,
        rentCents: RENT_DEFAULT,
        netCents,
        status: 'pago' as PayoutStatus,
        cycleClosesAt: '2026-05-05',
      };
    });

  const totalGrossCents = rows.reduce((a, r) => a + r.grossCents, 0);
  return {
    monthLabel: 'Maio · 2026',
    startsAt: '2026-05-01',
    closesAt: '2026-05-05',
    totalGrossCents,
    totalCommissionCents: rows.reduce((a, r) => a + r.commissionCents, 0),
    totalRentCents: rows.reduce((a, r) => a + r.rentCents, 0),
    totalNetCents: rows.reduce((a, r) => a + r.netCents, 0),
    rows,
  };
})();
