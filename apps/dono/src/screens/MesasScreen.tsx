import { useState } from 'react';
import { Button, Chip, Divider } from '@mq/design-system';
import { MESAS, MESA_STATUS_LABEL, type Mesa, type MesaStatus } from '../mocks/mesas';
import { fmtBRL } from '../mocks/quintal';

/**
 * Tela 05 — Mesas & QR.
 * Grid 4x4 de mesas, side panel direita ao selecionar.
 * pages/dono.md § "Tela 05 — Mesas & QR".
 */
export function MesasScreen() {
  const [selected, setSelected] = useState<number | null>(null);
  const mesa = selected != null ? MESAS.find((m) => m.numero === selected) : null;

  const livres = MESAS.filter((m) => m.status === 'livre').length;
  const ocupadas = MESAS.filter((m) => m.status === 'ocupada').length;
  const limpar = MESAS.filter((m) => m.status === 'precisa-limpar').length;

  return (
    <>
      <header className="mb-6">
        <p className="font-mono text-label uppercase tracking-wider text-inkDim mb-1">
          Diário · mesas
        </p>
        <h1 className="font-display italic text-display-xl text-ink leading-tight">
          {ocupadas} ocupadas, {livres} livres.
        </h1>
        {limpar > 0 && (
          <p className="mt-2 font-sans text-body text-warn">
            {limpar} mesa{limpar > 1 ? 's' : ''} esperando limpeza.
          </p>
        )}
      </header>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Grid de mesas */}
        <div className="flex-1 min-w-0">
          <Divider label="Layout do quintal" />
          <div className="mt-4 grid grid-cols-4 gap-3 max-w-[400px]">
            {MESAS.map((m) => (
              <MesaCell
                key={m.numero}
                mesa={m}
                selected={selected === m.numero}
                onClick={() => setSelected(m.numero)}
              />
            ))}
          </div>

          <div className="mt-6 flex items-center gap-4 flex-wrap">
            <LegendDot tone="accent" label="livre" />
            <LegendDot tone="primary" label="ocupada" />
            <LegendDot tone="warn" label="precisa limpar" />
          </div>
        </div>

        {/* Side panel (lateral em desktop, abaixo em mobile) */}
        <aside className="w-full md:w-80 shrink-0 md:border-l border-t md:border-t-0 border-hairline pt-6 md:pt-0 md:pl-8 min-h-[320px]">
          {mesa ? (
            <MesaPanel mesa={mesa} onClose={() => setSelected(null)} />
          ) : (
            <div className="py-12 text-center">
              <p className="font-display italic text-display-md text-inkMuted text-pretty">
                Selecione uma mesa pra ver detalhes.
              </p>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

function MesaCell({ mesa, selected, onClick }: { mesa: Mesa; selected: boolean; onClick: () => void }) {
  const tone = {
    'livre':           'bg-accentWash border-accent/30 text-ink hover:border-accent',
    'ocupada':         'bg-primaryWash border-primary/30 text-ink hover:border-primary',
    'precisa-limpar':  'bg-warn/10 border-warn/30 text-ink hover:border-warn',
  }[mesa.status];

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'aspect-square rounded-md border-2 cursor-pointer relative flex flex-col items-center justify-center gap-0.5',
        'transition-colors duration-base ease-out',
        tone,
        selected ? 'ring-2 ring-primary ring-offset-2 ring-offset-bg' : '',
      ].join(' ')}
    >
      <span className="font-mono text-mono-lg text-ink tabular-nums">
        {String(mesa.numero).padStart(2, '0')}
      </span>
      {mesa.ordersToday > 0 && (
        <span className="font-mono text-mono-sm text-inkDim">
          {mesa.ordersToday} ped.
        </span>
      )}
    </button>
  );
}

function LegendDot({ tone, label }: { tone: 'accent' | 'primary' | 'warn'; label: string }) {
  const cls = { accent: 'bg-accent', primary: 'bg-primary', warn: 'bg-warn' }[tone];
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`w-2.5 h-2.5 rounded-full ${cls}`} aria-hidden />
      <span className="font-mono text-mono-sm uppercase tracking-wider text-inkDim">{label}</span>
    </span>
  );
}

function MesaPanel({ mesa, onClose }: { mesa: Mesa; onClose: () => void }) {
  return (
    <>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="font-mono text-label uppercase tracking-wider text-inkDim">
            Mesa
          </p>
          <p className="font-display text-display-lg italic text-ink leading-none mt-1">
            {String(mesa.numero).padStart(2, '0')}
          </p>
        </div>
        <Chip tone={statusToTone(mesa.status)}>
          {MESA_STATUS_LABEL[mesa.status]}
        </Chip>
      </div>

      <Divider />

      <dl className="mt-4 space-y-3">
        <DlRow label="Pedidos hoje" value={String(mesa.ordersToday)} />
        <DlRow label="Bruto hoje" value={fmtBRL(mesa.grossCents)} />
        <DlRow label="QR token" value={mesa.qrToken} mono />
      </dl>

      <div className="mt-6 space-y-2">
        <Button variant="secondary" size="md" fullWidth>
          Baixar QR (PDF)
        </Button>
        <Button variant="ghost" size="md" fullWidth>
          Reimprimir QR
        </Button>
        {mesa.status === 'precisa-limpar' && (
          <Button variant="primary" size="md" fullWidth>
            Marcar limpa
          </Button>
        )}
      </div>

      <button
        type="button"
        onClick={onClose}
        className="mt-6 font-mono text-mono-sm uppercase tracking-wider text-inkDim
                   hover:text-ink cursor-pointer transition-colors duration-base ease-out"
      >
        Fechar
      </button>
    </>
  );
}

function DlRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-hairlineSoft pb-2">
      <dt className="font-mono text-label uppercase tracking-wider text-inkDim">{label}</dt>
      <dd className={mono ? 'font-mono text-mono-sm text-ink' : 'font-mono text-body text-ink tabular-nums'}>
        {value}
      </dd>
    </div>
  );
}

function statusToTone(s: MesaStatus): 'accent' | 'primary' | 'warn' {
  return s === 'livre' ? 'accent' : s === 'ocupada' ? 'primary' : 'warn';
}
