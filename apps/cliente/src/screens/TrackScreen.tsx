import { useEffect, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button, Chip, Divider } from '@mq/design-system';
import {
  STATUS_ORDER,
  STATUS_LABEL,
  fmtTime,
  getMockOrder,
  type Status,
  type OrderKitchen,
} from '../mocks/order';

/**
 * Tela 05 ★ — Acompanhamento ao vivo.
 * Mock estatico que ilustra os 3 estados principais ao mesmo tempo (PREPARANDO/PRONTO/RECEBIDO).
 * pages/cliente.md § "Acompanhamento ao vivo".
 */
export function TrackScreen() {
  const { orderId = '0000' } = useParams<{ orderId: string }>();
  const order = useMemo(() => getMockOrder(orderId), [orderId]);

  // Vibrar uma vez quando uma cozinha fica pronta. Aqui rodamos no mount
  // pra cada cozinha já PRONTA (no MVP real isso virá de Socket.io status:pronto).
  const buzzedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    order.kitchens.forEach((k) => {
      if (k.status === 'pronto' && !buzzedRef.current.has(k.kitchenSlug)) {
        buzzedRef.current.add(k.kitchenSlug);
        if ('vibrate' in navigator) navigator.vibrate(50);
      }
    });
  }, [order]);

  const allDone = order.kitchens.every((k) => k.status === 'retirado');

  return (
    <main className="pb-24 px-5">
      <section className="pt-6 pb-2">
        <p className="font-mono text-mono-sm uppercase tracking-wider text-inkDim">
          Pedido #{order.id} · Mesa {String(order.mesaNumero).padStart(2, '0')}
        </p>
        <h1 className="mt-1 font-display text-display-lg italic text-ink leading-tight text-pretty">
          {allDone ? 'Pedido completo.' : 'Acompanhando seu pedido.'}
        </h1>
        <p className="mt-2 font-sans text-body text-inkMuted">
          {allDone
            ? 'Pode caprichar nas fotos.'
            : 'Cada cozinha vai te avisar quando o seu sair.'}
        </p>
      </section>

      <div className="space-y-8 mt-6">
        {order.kitchens.map((k) => (
          <KitchenTimeline key={k.kitchenSlug} k={k} />
        ))}
      </div>

      {allDone && (
        <div className="mt-10">
          <Link to={`/pedido/${order.id}/avaliar`}>
            <Button variant="primary" size="lg" fullWidth>
              Como foi?
            </Button>
          </Link>
        </div>
      )}

      <div className="mt-8">
        <Divider />
        <p className="mt-4 text-center font-mono text-mono-sm uppercase tracking-wider text-inkDim">
          Atualizando ao vivo
        </p>
      </div>
    </main>
  );
}

function KitchenTimeline({ k }: { k: OrderKitchen }) {
  const isReady = k.status === 'pronto';
  const isInProgress = k.status === 'preparando';
  const remaining = remainingMinutes(k);

  const headerRight = (() => {
    if (k.status === 'pronto') {
      return <Chip tone="primary">retire no balcão</Chip>;
    }
    if (k.status === 'retirado') {
      return <Chip tone="accent">retirado</Chip>;
    }
    if (remaining !== null) {
      const tone = remaining <= 5 ? 'text-primary' : 'text-ink';
      return (
        <span className={`font-mono text-body ${tone}`}>
          ~{remaining} min restantes
        </span>
      );
    }
    return null;
  })();

  return (
    <section
      className={[
        'rounded-lg border bg-surface p-5',
        isReady ? 'border-primary' : 'border-hairline',
      ].join(' ')}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-display-md text-ink leading-tight">
          {k.kitchenName}
        </h2>
        {headerRight}
      </div>

      <ul className="mt-4 space-y-1">
        {k.items.map((it, i) => (
          <li key={i} className="font-sans text-body text-inkMuted">
            <span className="font-mono text-mono text-ink mr-2 tabular-nums">
              {it.qty}×
            </span>
            {it.name}
          </li>
        ))}
      </ul>

      <div className="mt-5">
        <Divider />
      </div>

      <ol className="mt-3 space-y-2.5">
        {STATUS_ORDER.map((s) => (
          <TimelineRow
            key={s}
            label={STATUS_LABEL[s]}
            done={isStatusReached(k.status, s)}
            current={k.status === s}
            time={k.timestamps[s]}
            pulse={isInProgress && s === 'preparando'}
          />
        ))}
      </ol>
    </section>
  );
}

function TimelineRow({
  label, done, current, time, pulse,
}: {
  label: string;
  done: boolean;
  current: boolean;
  time?: number;
  pulse?: boolean;
}) {
  const mark = done ? '✓' : current ? '◐' : '○';
  return (
    <li className="flex items-center gap-3">
      <span
        className={[
          'inline-flex items-center justify-center w-6 h-6 rounded-full font-mono text-mono',
          done
            ? 'text-accent bg-accentWash'
            : current
              ? 'text-primary bg-primaryWash'
              : 'text-inkDim bg-transparent',
          pulse ? 'animate-pulse motion-reduce:animate-none' : '',
        ].join(' ')}
        aria-hidden
      >
        {mark}
      </span>
      <span
        className={[
          'font-sans text-body',
          done || current ? 'text-ink' : 'text-inkDim',
        ].join(' ')}
      >
        {label}
      </span>
      {time && (
        <span className="ml-auto font-mono text-mono text-inkDim tabular-nums">
          {fmtTime(time)}
        </span>
      )}
    </li>
  );
}

function isStatusReached(current: Status, target: Status): boolean {
  return STATUS_ORDER.indexOf(target) < STATUS_ORDER.indexOf(current);
}

function remainingMinutes(k: OrderKitchen): number | null {
  const startedAt = k.timestamps.preparando ?? k.timestamps.recebido;
  if (!startedAt) return null;
  const elapsedMin = Math.floor((Date.now() - startedAt) / 60_000);
  const left = k.slaMinutes - elapsedMin;
  return Math.max(0, left);
}
