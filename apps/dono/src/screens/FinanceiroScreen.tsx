import { useState } from 'react';
import { Button, Chip, Divider } from '@mq/design-system';
import { MONTH_CURRENT, MONTH_PREVIOUS, type MonthSummary, type PayoutStatus } from '../mocks/financeiro';

/**
 * Tela 04 — Financeiro.
 * Tabs: mês atual · mês anterior · histórico (placeholder).
 * Tabela com totalização sticky no rodapé.
 */
export function FinanceiroScreen() {
  const [tab, setTab] = useState<'atual' | 'anterior' | 'historico'>('atual');

  const month: MonthSummary | null =
    tab === 'atual' ? MONTH_CURRENT :
    tab === 'anterior' ? MONTH_PREVIOUS :
    null;

  return (
    <>
      <header className="mb-6">
        <p className="font-mono text-label uppercase tracking-wider text-inkDim mb-1">
          Financeiro
        </p>
        <h1 className="font-display italic text-display-xl text-ink leading-tight">
          Repasses & receita.
        </h1>
      </header>

      <div role="tablist" className="flex items-center gap-1 border-b border-hairline mb-6">
        {([
          ['atual',     'Mês atual'],
          ['anterior',  'Mês anterior'],
          ['historico', 'Histórico'],
        ] as const).map(([id, label]) => {
          const active = tab === id;
          return (
            <button
              key={id}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(id)}
              className={[
                'relative h-11 px-4 cursor-pointer font-sans text-body',
                'transition-colors duration-base ease-out',
                active ? 'text-ink' : 'text-inkDim hover:text-ink',
              ].join(' ')}
            >
              {label}
              <span
                aria-hidden
                className={[
                  'absolute left-3 right-3 bottom-0 h-[2px] rounded-t-sm',
                  active ? 'bg-primary' : 'bg-transparent',
                ].join(' ')}
              />
            </button>
          );
        })}
      </div>

      {month ? (
        <MonthView month={month} />
      ) : (
        <p className="font-sans text-body text-inkMuted py-12 text-center">
          Histórico completo · em construção.
        </p>
      )}
    </>
  );
}

function MonthView({ month }: { month: MonthSummary }) {
  const fmt = (cents: number) =>
    (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mb-8">
        <Stat label={month.monthLabel} value={fmt(month.totalGrossCents)} sub="bruto do quintal" />
        <Stat label="Comissão da casa" value={fmt(month.totalCommissionCents)} sub="15% das vendas" />
        <Stat
          label="A transferir"
          value={fmt(month.totalNetCents)}
          sub={`fecha em ${month.closesAt.split('-').reverse().join('/')}`}
          highlight
        />
      </div>

      <Divider label={`${month.rows.length} cozinhas no ciclo`} />

      {/* wrapper interno c/ padding pra evitar conteúdo colado na borda no scroll */}
      <div className="overflow-x-auto -mx-4 md:mx-0">
      <div className="min-w-[720px] md:min-w-0 px-4 md:px-0">
      <table className="w-full mt-2 text-left">
        <thead>
          <tr className="border-b border-hairline">
            <Th>Cozinha</Th>
            <Th className="text-right">Bruto</Th>
            <Th className="text-right">Comissão</Th>
            <Th className="text-right">Aluguel</Th>
            <Th className="text-right">A transferir</Th>
            <Th className="text-right">Status</Th>
            <Th className="text-right">Ação</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairlineSoft">
          {month.rows.map((r) => (
            <tr key={r.kitchenSlug} className="h-12 hover:bg-surface transition-colors duration-base ease-out">
              <td className="pr-4 font-display text-body-lg text-ink">{r.kitchenName}</td>
              <td className="pr-4 text-right font-mono text-body text-ink tabular-nums">{fmt(r.grossCents)}</td>
              <td className="pr-4 text-right font-mono text-body text-inkMuted tabular-nums">
                −{fmt(r.commissionCents)}
              </td>
              <td className="pr-4 text-right font-mono text-body text-inkMuted tabular-nums">
                −{fmt(r.rentCents)}
              </td>
              <td className="pr-4 text-right font-mono text-body-lg text-primary tabular-nums">
                {fmt(r.netCents)}
              </td>
              <td className="pr-4 text-right">
                <StatusChip status={r.status} />
              </td>
              <td className="text-right">
                {r.status === 'pendente' ? (
                  <Button size="sm" variant="secondary">Liberar</Button>
                ) : (
                  <span className="font-mono text-mono-sm text-inkDim">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-hairline">
            <td className="py-3 pr-4 font-mono text-label uppercase tracking-wider text-inkDim">
              Total
            </td>
            <td className="py-3 pr-4 text-right font-mono text-body text-ink tabular-nums">{fmt(month.totalGrossCents)}</td>
            <td className="py-3 pr-4 text-right font-mono text-body text-inkMuted tabular-nums">−{fmt(month.totalCommissionCents)}</td>
            <td className="py-3 pr-4 text-right font-mono text-body text-inkMuted tabular-nums">−{fmt(month.totalRentCents)}</td>
            <td className="py-3 pr-4 text-right font-mono text-mono-lg text-primary tabular-nums">{fmt(month.totalNetCents)}</td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
      </div>
      </div>

      <div className="mt-6 flex items-center justify-end gap-3">
        <Button variant="ghost" size="sm">Exportar CSV</Button>
      </div>
    </>
  );
}

function Stat({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div>
      <p className="font-mono text-label uppercase tracking-wider text-inkDim mb-1">
        {label}
      </p>
      <p className={[
        'font-display text-[32px] leading-none tabular-nums',
        highlight ? 'text-primary' : 'text-ink',
      ].join(' ')}>
        {value}
      </p>
      {sub && (
        <p className="mt-1 font-mono text-mono-sm text-inkDim">{sub}</p>
      )}
    </div>
  );
}

function StatusChip({ status }: { status: PayoutStatus }) {
  const map = {
    pendente:  { tone: 'warn'    as const, label: 'pendente' },
    liberado:  { tone: 'primary' as const, label: 'liberado' },
    pago:      { tone: 'accent'  as const, label: 'pago' },
    atrasado:  { tone: 'danger'  as const, label: 'atrasado' },
  }[status];
  return <Chip tone={map.tone}>{map.label}</Chip>;
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`py-2 pr-4 font-mono text-label uppercase tracking-wider text-inkDim font-medium ${className}`}>
      {children}
    </th>
  );
}
