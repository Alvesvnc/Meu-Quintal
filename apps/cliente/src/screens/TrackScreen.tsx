import { useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button, Chip, Divider } from '@mq/design-system';
import type { OrderItemStatus, OrderKitchenGroup } from '@mq/shared';
import { useOrder } from '../api/hooks';
import { ScreenError } from '../components/ScreenError';
import { fmtTime } from '../lib/format';

const STATUS_LABEL: Record<OrderItemStatus, string> = {
  novo:       'Recebido',
  preparando: 'Preparando',
  pronto:     'Pronto',
  retirado:   'Retirado',
  cancelado:  'Cancelado',
};
const STATUS_FLOW: OrderItemStatus[] = ['novo', 'preparando', 'pronto', 'retirado'];

/** Tela 05 ★ — Acompanhamento ao vivo via Socket.io. */
export function TrackScreen() {
  const { orderId = '' } = useParams<{ orderId: string }>();
  const { data: order, isLoading, error, refetch } = useOrder(orderId);

  // Vibrar 1x quando uma cozinha fica pronta
  const buzzedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!order) return;
    order.kitchens.forEach((k) => {
      if (k.status === 'pronto' && !buzzedRef.current.has(k.kitchenSlug)) {
        buzzedRef.current.add(k.kitchenSlug);
        if ('vibrate' in navigator) navigator.vibrate(50);
      }
    });
  }, [order]);

  if (isLoading) {
    return (
      <main className="px-5 pt-8 text-center">
        <p className="font-display italic text-display-md text-inkMuted">Buscando seu pedido…</p>
      </main>
    );
  }

  if (error || !order) {
    return (
      <ScreenError
        title="Não encontrei esse pedido."
        body="Pode ser que ele tenha sido criado em outra mesa."
        onRetry={() => refetch()}
      />
    );
  }

  const allDone = order.kitchens.every((k) => k.status === 'retirado');

  return (
    <main className="pb-10 px-5">
      <section className="pt-6 pb-2">
        <p className="font-mono text-mono-sm uppercase tracking-wider text-inkDim">
          Pedido #{order.shortId} · Mesa {String(order.mesaNumero).padStart(2, '0')}
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
          <Link to={`/pedido/${orderId}/avaliar`}>
            <Button variant="primary" size="lg" fullWidth>
              Como foi?
            </Button>
          </Link>
        </div>
      )}

      <div className="mt-8">
        <Divider />
        <p className="mt-4 text-center font-mono text-mono-sm uppercase tracking-wider text-inkDim">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" aria-hidden />
            Atualizando ao vivo
          </span>
        </p>
      </div>
    </main>
  );
}

function KitchenTimeline({ k }: { k: OrderKitchenGroup }) {
  const isReady = k.status === 'pronto';
  const isInProgress = k.status === 'preparando';

  const remaining = (() => {
    const start = k.acceptedAt ?? null;
    if (!start) return null;
    const elapsedMin = Math.floor((Date.now() - new Date(start).getTime()) / 60_000);
    return Math.max(0, k.slaMinutes - elapsedMin);
  })();

  const headerRight = (() => {
    if (k.status === 'pronto') return <Chip tone="primary">retire no balcão</Chip>;
    if (k.status === 'retirado') return <Chip tone="accent">retirado</Chip>;
    if (k.status === 'cancelado') return <Chip tone="danger">cancelado</Chip>;
    if (remaining !== null) {
      const tone = remaining <= 5 ? 'text-primary' : 'text-ink';
      return <span className={`font-mono text-body ${tone}`}>~{remaining} min restantes</span>;
    }
    return null;
  })();

  return (
    <section className={[
      'rounded-lg border bg-surface p-5',
      isReady ? 'border-primary' : 'border-hairline',
    ].join(' ')}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-display-md text-ink leading-tight">{k.kitchenName}</h2>
        {headerRight}
      </div>

      <ul className="mt-4 space-y-1">
        {k.items.map((it) => (
          <li key={it.id} className="font-sans text-body text-inkMuted">
            <span className="font-mono text-mono text-ink mr-2 tabular-nums">{it.qty}×</span>
            {it.name}
            {it.note && <span className="ml-2 italic text-inkDim">— {it.note}</span>}
          </li>
        ))}
      </ul>

      <div className="mt-5">
        <Divider />
      </div>

      <ol className="mt-3 space-y-2.5">
        {STATUS_FLOW.map((s) => (
          <TimelineRow
            key={s}
            label={STATUS_LABEL[s]}
            done={isStatusReached(k.status, s)}
            current={k.status === s}
            time={
              s === 'novo' ? null :
              s === 'preparando' ? k.acceptedAt :
              s === 'pronto' ? k.readyAt :
              s === 'retirado' ? k.pickedAt : null
            }
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
  time: string | null;
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
      <span className={[
        'font-sans text-body',
        done || current ? 'text-ink' : 'text-inkDim',
      ].join(' ')}>
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

function isStatusReached(current: OrderItemStatus, target: OrderItemStatus): boolean {
  return STATUS_FLOW.indexOf(target) < STATUS_FLOW.indexOf(current);
}
