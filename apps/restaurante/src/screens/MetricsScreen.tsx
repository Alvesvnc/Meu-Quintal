import { Divider } from '@mq/design-system';
import { TODAY_HISTORY, fmtBRL, type Order } from '../mocks/orders';
import { useQueue } from '../stores/queue';

/**
 * Tela 05 — Métricas (não-dashboard).
 * 3 blocos verticais: carro-chefe da semana · ticket médio · horário de pico.
 * pages/restaurante.md § "Tela 05 — Métricas".
 */
export function MetricsScreen() {
  const live = useQueue((s) => s.orders);
  const finished = [...TODAY_HISTORY, ...live.filter((o) => o.status === 'retirado')];

  const carroChefe = topItems(finished, 5);
  const ticketMed = finished.length > 0
    ? finished.reduce((a, o) => a + o.totalCents, 0) / finished.length
    : 0;
  const peakHist = pedidosPorHora(finished);

  return (
    <main className="px-5 pb-28">
      <section className="pt-6">
        <p className="font-mono text-mono-sm uppercase tracking-wider text-inkDim">
          Esta semana · estimativa
        </p>
        <h1 className="mt-1 font-display text-display-lg italic text-ink leading-tight">
          Como você está indo.
        </h1>
      </section>

      <section className="mt-7">
        <Divider label="Carro-chefe" />
        <ol className="mt-2 divide-y divide-hairlineSoft">
          {carroChefe.length === 0 ? (
            <li className="py-4 font-sans text-body text-inkDim">
              Sem dados ainda. Volta amanhã.
            </li>
          ) : (
            carroChefe.map((row, i) => (
              <li key={row.name} className="py-4 flex items-center gap-4">
                <span className="font-mono text-mono text-primary w-6 shrink-0 tabular-nums">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="font-sans text-body-lg text-ink flex-1">
                  {row.name}
                </span>
                <span className="font-mono text-mono text-ink tabular-nums">
                  {row.qty}×
                </span>
              </li>
            ))
          )}
        </ol>
      </section>

      <section className="mt-8">
        <Divider label="Ticket médio" />
        <p className="mt-3 font-mono text-mono-lg text-ink text-[40px] leading-none tabular-nums">
          {fmtBRL(ticketMed)}
        </p>
        <p className="mt-2 font-sans text-body-sm text-inkDim">
          baseado em {finished.length} {finished.length === 1 ? 'pedido' : 'pedidos'}
        </p>
      </section>

      <section className="mt-8">
        <Divider label="Horário de pico" />
        <HourBars hist={peakHist} />
      </section>
    </main>
  );
}

function topItems(orders: Order[], limit: number) {
  const count = new Map<string, number>();
  for (const o of orders) {
    for (const l of o.lines) {
      count.set(l.name, (count.get(l.name) ?? 0) + l.qty);
    }
  }
  return Array.from(count.entries())
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, limit);
}

function pedidosPorHora(orders: Order[]): number[] {
  // 24 buckets, simplificado pra apenas 11h-23h (horário operacional do quintal)
  const hours = new Array(13).fill(0); // 11h..23h
  for (const o of orders) {
    const h = new Date(o.createdAt).getHours();
    if (h >= 11 && h <= 23) hours[h - 11] += 1;
  }
  return hours;
}

function HourBars({ hist }: { hist: number[] }) {
  const max = Math.max(...hist, 1);
  return (
    <div className="mt-3 flex items-end gap-1 h-32">
      {hist.map((v, i) => {
        const hour = 11 + i;
        const isPeak = v === max && v > 0;
        const heightPct = (v / max) * 100;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
            <div className="w-full flex-1 flex items-end">
              <div
                className={[
                  'w-full rounded-t-sm transition-all duration-base ease-out',
                  isPeak ? 'bg-primary' : 'bg-inkDim/40',
                ].join(' ')}
                style={{ height: v > 0 ? `${Math.max(heightPct, 4)}%` : '2px' }}
              />
            </div>
            {(hour % 2 === 0 || isPeak) && (
              <span
                className={[
                  'font-mono text-mono-sm tabular-nums',
                  isPeak ? 'text-primary' : 'text-inkDim',
                ].join(' ')}
              >
                {hour}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
