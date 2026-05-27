import { useState } from 'react';
import { Button } from '@mq/design-system';
import { useQueue, useOrdersByStatus } from '../stores/queue';
import { OrderCard } from '../components/OrderCard';
import { StatusTabs } from '../components/StatusTabs';
import type { Status } from '../mocks/orders';

type ActiveStatus = Exclude<Status, 'retirado' | 'cancelado'>;

/**
 * Tela 01 ★ — Fila de pedidos.
 * Tabs sticky alternam entre Novos / Preparando / Prontos.
 * pages/restaurante.md § "Tela 01 — Fila de pedidos".
 */
export function QueueScreen() {
  const [active, setActive] = useState<ActiveStatus>('novo');

  const novos      = useOrdersByStatus('novo');
  const preparando = useOrdersByStatus('preparando');
  const prontos    = useOrdersByStatus('pronto');
  const pushFake   = useQueue((s) => s.pushFakeNew);

  const tabs = [
    { id: 'novo',       label: 'Novos',       count: novos.length },
    { id: 'preparando', label: 'Preparando',  count: preparando.length },
    { id: 'pronto',     label: 'Prontos',     count: prontos.length },
  ] as const;

  const list =
    active === 'novo' ? novos :
    active === 'preparando' ? preparando :
    prontos;

  return (
    <>
      <StatusTabs tabs={tabs as any} activeId={active} onSelect={setActive} />

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

        {/* DEV ONLY — simular pedido novo entrando */}
        <div className="mt-10 pt-6 border-t border-hairline">
          <p className="font-mono text-label uppercase tracking-wider text-inkDim mb-3">
            Dev · simular
          </p>
          <Button variant="ghost" size="md" onClick={pushFake}>
            Receber pedido fake
          </Button>
        </div>
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
