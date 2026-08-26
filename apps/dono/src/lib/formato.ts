/** Formatação de números para a tela do dono. */

/** R$ 1.234 — sem centavos. Para números grandes, onde o centavo é ruído. */
export function fmtBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

/** R$ 1.234,56 — com centavos. Para valor que alguém vai cobrar ou pagar. */
export function fmtBRLPrecise(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  });
}

/**
 * Valor que pode estar oculto.
 *
 * `null` NÃO é zero: significa "você não vê este número" (cozinha que paga só
 * aluguel). Renderizar como R$ 0,00 diria que ela não vendeu nada — que é falso
 * e levaria o dono a agir em cima disso.
 */
export function fmtBRLOuOculto(cents: number | null): string {
  return cents === null ? '—' : fmtBRL(cents);
}

/** "↑ 12%" / "↓ 8%". `null` quando não há base de comparação. */
export function fmtDelta(pct: number | null): string {
  if (pct === null) return '—';
  return `${pct >= 0 ? '↑' : '↓'} ${Math.abs(pct)}%`;
}

/** "2026-08" -> "agosto de 2026" */
export function fmtRefMonth(refMonth: string): string {
  const [ano, mes] = refMonth.split('-').map(Number);
  return new Date(Date.UTC(ano, mes - 1, 1)).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** "2026-08" do mês corrente. */
export function refMonthAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
