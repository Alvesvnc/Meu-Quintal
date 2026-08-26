import { useState, useMemo, useCallback } from 'react';
import type { OrderItemStatus } from '@mq/shared';
import { useFila, useKitchenSocket } from '../api/hooks';
import { useAuth } from '../stores/auth';
import { OrderCard } from '../components/OrderCard';
import { StatusTabs } from '../components/StatusTabs';
import { ScreenError } from '../components/ScreenError';
import { playOrderNewSound, buzzShort } from '../lib/sound';

type ActiveStatus = Extract<OrderItemStatus, 'novo' | 'preparando' | 'pronto'>;

/**
 * Tela 01 ★ — Fila de pedidos (REAL, conectada ao server).
 * Tabs sticky alternam entre Novos / Preparando / Prontos.
 * Socket.io recebe order:new e toca som + vibra ao chegar pedido novo.
 */
export function QueueScreen() {
  const [active, setActive] = useState<ActiveStatus>('novo');
  const { data, isLoading, error, refetch } = useFila();
  const me = useAuth((s) => s.me);
  const kitchenSlug = me?.kitchen.slug;

  // Som + vibração quando pedido novo chega
  const onOrderNew = useCallback(() => {
    playOrderNewSound();
    buzzShort();
  }, []);

  useKitchenSocket(kitchenSlug, { onOrderNew });

  const buckets = useMemo(() => {
    const orders = data?.orders ?? [];
    return {
      novo:       orders.filter((o) => o.status === 'novo'),
      preparando: orders.filter((o) => o.status === 'preparando'),
      pronto:     orders.filter((o) => o.status === 'pronto'),
    };
  }, [data]);

  const tabs = [
    { id: 'novo',       label: 'Novos',       count: buckets.novo.length },
    { id: 'preparando', label: 'Preparando',  count: buckets.preparando.length },
    { id: 'pronto',     label: 'Prontos',     count: buckets.pronto.length },
  ] as const;

  const list = buckets[active];

  if (isLoading && !data) {
    return (
      <main className="px-5 pt-8 text-center">
        <p className="font-display italic text-display-md text-inkMuted">Buscando a fila…</p>
      </main>
    );
  }

  if (error) {
    return (
      <ScreenError
        title="Não consegui carregar a fila."
        body="Verifique sua conexão e tente de novo."
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <>
      <StatusTabs tabs={tabs} activeId={active} onSelect={setActive} />

      <main className="px-5 pb-28">
        {list.length === 0 ? (
          <EmptyState status={active} />
        ) : (
          <ul className="space-y-4 pt-5">
            {list.map((o) => (
              <li key={o.id}>
                <OrderCard order={o} />
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}

function EmptyState({ status }: { status: ActiveStatus }) {
  const copy = {
    novo:       'Sem pedidos novos. Respira.',
    preparando: 'Nada na chapa agora.',
    pronto:     'Nada esperando no balcão.',
  }[status];
  const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return (
    <div className="py-20 text-center">
      <p className="font-display italic text-display-lg text-ink text-pretty">
        {copy}
      </p>
      <p className="mt-4 font-mono text-mono-lg text-inkDim tabular-nums">{now}</p>
    </div>
  );
}
