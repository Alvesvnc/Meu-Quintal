import { useMemo, useState } from 'react';
import { Chip, Divider } from '@mq/design-system';
import { LIVE_ORDERS, LIVE_STATUS_LABEL, type LiveStatus, type LiveOrder } from '../mocks/pedidos-live';
import { KITCHENS, fmtBRL } from '../mocks/quintal';

/**
 * Tela 06 — Pedidos ao vivo (espectador).
 * Mobile: cada pedido stack vertical, chip de status ao lado do título.
 * Desktop: row flat com colunas alinhadas.
 */
export function PedidosLiveScreen() {
  const [kitchenFilter, setKitchenFilter] = useState<string | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<LiveStatus | 'all'>('all');

  const filtered = useMemo(() => {
    return LIVE_ORDERS.filter((o) => {
      if (kitchenFilter !== 'all' && o.kitchenSlug !== kitchenFilter) return false;
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      return true;
    }).sort((a, b) => b.createdAt - a.createdAt);
  }, [kitchenFilter, statusFilter]);

  const lateCount = LIVE_ORDERS.filter((o) => o.isLate).length;

  return (
    <>
      <header className="mb-6">
        <p className="font-mono text-label uppercase tracking-wider text-inkDim mb-1">
          Diário · ao vivo
          <span className="inline-flex items-center gap-1.5 ml-3 normal-case tracking-normal">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" aria-hidden />
            <span className="text-accent">conectado</span>
          </span>
        </p>
        <h1 className="font-display italic text-display-xl text-ink leading-tight">
          {LIVE_ORDERS.length} pedidos abertos no quintal.
        </h1>
        {lateCount > 0 && (
          <p className="mt-2 font-sans text-body text-primary">
            {lateCount} acima do SLA.
          </p>
        )}
      </header>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <FilterGroup
          label="Cozinha"
          value={kitchenFilter}
          options={[
            { value: 'all', label: 'Todas' },
            ...KITCHENS.filter((k) => k.active).map((k) => ({ value: k.slug, label: k.name })),
          ]}
          onChange={setKitchenFilter}
        />
        <FilterGroup
          label="Status"
          value={statusFilter}
          options={[
            { value: 'all',        label: 'Todos' },
            { value: 'novo',       label: 'Novos' },
            { value: 'preparando', label: 'Preparando' },
            { value: 'pronto',     label: 'Prontos' },
          ]}
          onChange={(v) => setStatusFilter(v as any)}
        />
      </div>

      <Divider />

      <ul className="mt-2 divide-y divide-hairlineSoft">
        {filtered.length === 0 ? (
          <li className="py-12 text-center font-sans text-body text-inkMuted">
            Nenhum pedido com esse filtro agora.
          </li>
        ) : filtered.map((o) => <OrderRow key={o.id} order={o} />)}
      </ul>
    </>
  );
}

function OrderRow({ order: o }: { order: LiveOrder }) {
  const minutesAgo = Math.floor((Date.now() - o.createdAt) / 60_000);
  return (
    <li className="py-4">
      {/* Mobile: stack vertical · Desktop: flat */}
      <div className="md:flex md:items-baseline md:gap-4">
        {/* Linha 1: ID, mesa, status (mobile) */}
        <div className="flex items-baseline justify-between gap-3 md:contents">
          <div className="flex items-baseline gap-3 md:contents">
            <span className="font-mono text-mono text-inkDim md:w-16 md:shrink-0">#{o.id}</span>
            <span className="font-mono text-body text-ink tabular-nums md:w-20 md:shrink-0">
              Mesa {String(o.mesaNumero).padStart(2, '0')}
            </span>
          </div>
          {/* Status chip — no mobile fica aqui (canto direito da primeira linha) */}
          <span className="md:hidden">
            <StatusChip status={o.status} late={o.isLate} />
          </span>
        </div>

        {/* Linha 2: nome cozinha (mobile com label discreto) */}
        <p className="mt-1 md:mt-0 font-sans text-body-lg text-ink truncate md:flex-1">
          {o.kitchenName}
        </p>

        {/* Linha 3 mobile: meta em row · Desktop: colunas */}
        <div className="mt-1 md:mt-0 flex items-baseline gap-3 md:gap-0 md:contents">
          <span className="font-mono text-body-sm text-inkMuted tabular-nums md:w-24 md:text-right md:text-body">
            {o.itemCount} {o.itemCount === 1 ? 'item' : 'itens'}
          </span>
          <span className="font-mono text-body-sm text-ink tabular-nums md:w-24 md:text-right md:text-body">
            {fmtBRL(o.totalCents)}
          </span>
          <span className={[
            'font-mono text-body-sm tabular-nums md:w-24 md:text-right md:text-body',
            o.isLate ? 'text-primary' : 'text-inkDim',
          ].join(' ')}>
            {minutesAgo} min
          </span>
        </div>

        {/* Status chip — só desktop (no mobile já apareceu acima) */}
        <span className="hidden md:block md:w-28 md:text-right">
          <StatusChip status={o.status} late={o.isLate} />
        </span>
      </div>
    </li>
  );
}

function StatusChip({ status, late }: { status: LiveStatus; late: boolean }) {
  if (late) return <Chip tone="warn">{LIVE_STATUS_LABEL[status].toLowerCase()}</Chip>;
  const tone = status === 'pronto' ? 'primary' : status === 'novo' ? 'accent' : 'neutral';
  return <Chip tone={tone}>{LIVE_STATUS_LABEL[status].toLowerCase()}</Chip>;
}

interface FilterGroupProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}

function FilterGroup({ label, value, options, onChange }: FilterGroupProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-label uppercase tracking-wider text-inkDim">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 px-3 bg-surface border border-hairline rounded-md
                   font-sans text-body text-ink cursor-pointer
                   focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primaryWash"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
