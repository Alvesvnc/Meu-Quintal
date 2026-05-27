import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Chip, Divider } from '@mq/design-system';
import { KITCHENS, fmtBRL, type KitchenSummary } from '../mocks/quintal';

type SortKey = 'name' | 'ordersToday' | 'grossCents' | 'avgEtaMin';
type SortDir = 'asc' | 'desc';

/**
 * Tela 02 — Restaurantes do quintal.
 * Tabela densa com sort por header. Row 44px. Edit inline future.
 * pages/dono.md § "Tabelas — primary da interface".
 */
export function RestaurantesScreen() {
  const [sortKey, setSortKey] = useState<SortKey>('grossCents');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [showInactive, setShowInactive] = useState(true);

  const rows = useMemo(() => {
    const filtered = KITCHENS.filter((k) => showInactive || k.active);
    const sorted = [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [sortKey, sortDir, showInactive]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  return (
    <>
      <header className="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="font-mono text-label uppercase tracking-wider text-inkDim mb-1">
            Configurar · cozinhas
          </p>
          <h1 className="font-display italic text-display-xl text-ink leading-tight">
            {KITCHENS.filter((k) => k.active).length} cozinhas ativas.
          </h1>
        </div>
        <Link to="/restaurantes/novo" className="self-start md:self-auto">
          <Button variant="primary" size="md">+ Adicionar cozinha</Button>
        </Link>
      </header>

      <div className="mb-4 flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="w-4 h-4 accent-primary cursor-pointer"
          />
          <span className="font-sans text-body-sm text-inkMuted">
            Mostrar inativas
          </span>
        </label>
      </div>

      <Divider />

      {/* overflow wrapper c/ padding INTERNO pra evitar conteúdo colado na borda no scroll */}
      <div className="overflow-x-auto -mx-4 md:mx-0">
      <div className="min-w-[680px] md:min-w-0 px-4 md:px-0">
      <table className="w-full mt-2 text-left">
        <thead>
          <tr className="border-b border-hairline">
            <SortHeader label="Nome"     active={sortKey === 'name'}        dir={sortDir} onClick={() => toggleSort('name')} />
            <ThText>Categoria</ThText>
            <ThText className="text-right">Hoje</ThText>
            <ThText className="text-right">
              <SortLabel label="Receita" active={sortKey === 'grossCents'} dir={sortDir} onClick={() => toggleSort('grossCents')} />
            </ThText>
            <ThText className="text-right">
              <SortLabel label="ETA"     active={sortKey === 'avgEtaMin'}  dir={sortDir} onClick={() => toggleSort('avgEtaMin')} />
            </ThText>
            <ThText className="text-right">Status</ThText>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairlineSoft">
          {rows.map((k) => <Row key={k.id} kitchen={k} />)}
        </tbody>
      </table>
      </div>
      </div>
    </>
  );
}

function Row({ kitchen: k }: { kitchen: KitchenSummary }) {
  return (
    <tr className={[
      'h-11 transition-colors duration-base ease-out',
      k.active ? 'hover:bg-surface' : 'opacity-60 hover:bg-surface',
    ].join(' ')}>
      <td className="pr-4">
        <Link
          to={`/restaurantes/${k.slug}`}
          className="font-sans text-body text-ink hover:text-primary no-underline
                     transition-colors duration-base ease-out"
        >
          {k.name}
          {k.hasLateOrders && (
            <span className="ml-2 inline-flex items-center" title="Pedidos atrasados">
              <Chip tone="warn">atrasado</Chip>
            </span>
          )}
        </Link>
      </td>
      <td className="pr-4 font-sans text-body-sm text-inkMuted">
        {k.category}
      </td>
      <td className="pr-4 text-right font-mono text-body text-ink tabular-nums">
        {k.ordersToday}
      </td>
      <td className="pr-4 text-right font-mono text-body text-ink tabular-nums">
        {fmtBRL(k.grossCents)}
      </td>
      <td className="pr-4 text-right font-mono text-body text-ink tabular-nums">
        {k.avgEtaMin > 0 ? `${k.avgEtaMin} min` : '—'}
      </td>
      <td className="text-right">
        <Chip tone={k.active ? 'accent' : 'neutral'}>
          {k.active ? 'ativa' : 'pausada'}
        </Chip>
      </td>
    </tr>
  );
}

function ThText({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`py-2 pr-4 font-mono text-label uppercase tracking-wider text-inkDim font-medium ${className}`}>
      {children}
    </th>
  );
}

function SortHeader(props: { label: string; active: boolean; dir: SortDir; onClick: () => void }) {
  return (
    <ThText>
      <SortLabel {...props} />
    </ThText>
  );
}

function SortLabel({ label, active, dir, onClick }: { label: string; active: boolean; dir: SortDir; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex items-center gap-1 cursor-pointer font-mono text-label uppercase tracking-wider',
        active ? 'text-primary font-semibold' : 'text-inkDim hover:text-ink font-medium',
        'transition-colors duration-base ease-out',
      ].join(' ')}
    >
      {label}
      <span aria-hidden className={active ? 'text-primary' : 'text-inkDim/30'}>
        {active ? (dir === 'asc' ? '↑' : '↓') : ' '}
      </span>
    </button>
  );
}
