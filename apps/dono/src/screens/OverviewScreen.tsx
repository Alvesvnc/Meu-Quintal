import { Link } from 'react-router-dom';
import { Divider } from '@mq/design-system';
import {
  QUINTAL_INFO, KITCHENS, TODAY_BY_HOUR, FLAGS, TOP_ITEMS,
  fmtBRL, fmtPercentDelta,
} from '../mocks/quintal';

/**
 * Tela 01 ★ — Visão geral.
 * Editorial overview (anti-bento). Hierarquia pela tipografia, não por cards.
 * pages/dono.md § "Layout — não é dashboard de SaaS genérico".
 */
export function OverviewScreen() {
  const now = new Date();
  const dateLabel = now.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
  const timeLabel = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const totalRevenue = TODAY_BY_HOUR.reduce((a, p) => a + p.grossCents, 0);
  const totalOrders = TODAY_BY_HOUR.reduce((a, p) => a + p.orders, 0);
  const commission = Math.round(totalRevenue * (QUINTAL_INFO.commissionPct / 100));
  const kitchensOpen = KITCHENS.filter((k) => k.active).length;

  return (
    <>
      <header className="mb-8">
        <Divider label={`Hoje · ${dateLabel}, ${timeLabel}`} />
      </header>

      {/* Hero: dois números grandes editoriais */}
      <section className="grid grid-cols-2 gap-12 mb-10">
        <BigNumber
          label="Receita até agora"
          value={fmtBRL(totalRevenue)}
          chart={<MiniBars data={TODAY_BY_HOUR.map((p) => p.grossCents)} />}
        />
        <BigNumber
          label="Comissão do quintal"
          value={fmtBRL(commission)}
          sub={`· ${QUINTAL_INFO.commissionPct}%`}
          delta={fmtPercentDelta(8)}
          deltaSub="vs. terça passada"
        />
      </section>

      <Divider />

      <p className="mt-6 mb-10 font-sans text-body-lg text-inkMuted">
        <strong className="text-ink font-medium">{kitchensOpen}</strong> cozinhas abertas ·{' '}
        <strong className="text-ink font-medium">{totalOrders}</strong> pedidos ·{' '}
        <strong className="text-ink font-medium">{QUINTAL_INFO.tablesOccupied}/{QUINTAL_INFO.tablesTotal}</strong> mesas ocupadas
      </p>

      {/* O que exige sua atenção */}
      <section className="mb-10">
        <Divider label="O que exige sua atenção" />
        <ul className="mt-4 space-y-3">
          {FLAGS.map((f, i) => (
            <li key={i}>
              <FlagRow flag={f} />
            </li>
          ))}
        </ul>
      </section>

      {/* Carros-chefe */}
      <section>
        <Divider label="Carros-chefe do quintal · esta semana" />
        <ol className="mt-4 divide-y divide-hairlineSoft">
          {TOP_ITEMS.map((it) => (
            <li key={it.rank} className="py-3 flex items-center gap-4">
              <span className="w-8 shrink-0 font-mono text-mono text-primary tabular-nums">
                {String(it.rank).padStart(2, '0')}.
              </span>
              <span className="flex-1 font-sans text-body-lg text-ink">
                {it.name}
              </span>
              <span className="w-44 font-sans text-body text-inkMuted">
                {it.kitchen}
              </span>
              <span className="w-16 text-right font-mono text-body text-ink tabular-nums">
                {it.qty}×
              </span>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

interface BigNumberProps {
  label: string;
  value: string;
  sub?: string;
  delta?: string;
  deltaSub?: string;
  chart?: React.ReactNode;
}

function BigNumber({ label, value, sub, delta, deltaSub, chart }: BigNumberProps) {
  return (
    <div>
      <p className="font-mono text-label uppercase tracking-wider text-inkDim mb-2">
        {label}
      </p>
      <div className="flex items-baseline gap-2">
        <p className="font-display text-[44px] leading-none text-ink tabular-nums">
          {value}
        </p>
        {sub && (
          <span className="font-mono text-body text-inkMuted">{sub}</span>
        )}
      </div>
      {chart && <div className="mt-3">{chart}</div>}
      {delta && (
        <p className="mt-3 font-mono text-mono-sm text-accent">
          {delta} <span className="text-inkDim">{deltaSub}</span>
        </p>
      )}
    </div>
  );
}

/** Mini bar chart inline pro hero — 13 buckets (11h-23h). */
function MiniBars({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  const peakIdx = data.indexOf(max);
  return (
    <div className="flex items-end gap-0.5 h-10" aria-hidden>
      {data.map((v, i) => (
        <div
          key={i}
          className={[
            'flex-1 rounded-sm',
            i === peakIdx ? 'bg-primary' : 'bg-inkDim/30',
          ].join(' ')}
          style={{ height: `${Math.max((v / max) * 100, 4)}%` }}
        />
      ))}
    </div>
  );
}

function FlagRow({ flag }: { flag: typeof FLAGS[number] }) {
  const tone = {
    'late':                 'border-l-primary',
    'payout-due':           'border-l-warn',
    'low-stock':            'border-l-warn',
    'new-kitchen-request':  'border-l-accent',
  }[flag.kind];

  const body = (
    <div className={`border-l-2 ${tone} pl-4 py-1`}>
      <p className="font-sans text-body-lg text-ink leading-tight">
        {flag.title}
      </p>
      <p className="mt-0.5 font-sans text-body text-inkMuted">
        {flag.detail}
      </p>
    </div>
  );

  return flag.href ? (
    <Link
      to={flag.href}
      className="block no-underline hover:bg-surface rounded-r-md transition-colors duration-base ease-out -mx-2 px-2"
    >
      {body}
    </Link>
  ) : body;
}
