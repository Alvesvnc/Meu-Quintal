import { Chip, Divider } from '@mq/design-system';
import { TODAY_HISTORY, fmtBRL, fmtTime, STATUS_LABEL, type Order } from '../mocks/orders';
import { useQueue } from '../stores/queue';

/**
 * Tela 03 — Histórico do dia.
 * Lista flat ordenada por createdAt desc, agrupa por status fechado.
 * No MVP vem de GET /api/restaurante/historico?day=today.
 */
export function HistoryScreen() {
  // Combina histórico mock com pedidos do store já finalizados
  const live = useQueue((s) => s.orders);
  const all = [...TODAY_HISTORY, ...live.filter((o) => o.status === 'retirado' || o.status === 'cancelado')]
    .sort((a, b) => b.createdAt - a.createdAt);

  const retirados = all.filter((o) => o.status === 'retirado');
  const cancelados = all.filter((o) => o.status === 'cancelado');

  const receitaCents = retirados.reduce((acc, o) => acc + o.totalCents, 0);
  const ticketMed = retirados.length > 0 ? receitaCents / retirados.length : 0;

  return (
    <main className="px-5 pb-28">
      <section className="pt-6">
        <p className="font-mono text-mono-sm uppercase tracking-wider text-inkDim">
          Hoje
        </p>
        <h1 className="mt-1 font-display text-display-lg italic text-ink leading-tight text-pretty">
          {retirados.length} {retirados.length === 1 ? 'pedido' : 'pedidos'} entregue{retirados.length === 1 ? '' : 's'}.
        </h1>

        <div className="mt-5 grid grid-cols-2 gap-4">
          <Stat label="Receita" value={fmtBRL(receitaCents)} />
          <Stat label="Ticket médio" value={fmtBRL(ticketMed)} />
        </div>

        {cancelados.length > 0 && (
          <p className="mt-4 font-mono text-mono-sm text-inkDim">
            {cancelados.length} cancelado(s)
          </p>
        )}
      </section>

      <div className="mt-8">
        <Divider label="Todos os pedidos" />
      </div>

      <ul className="mt-2 divide-y divide-hairlineSoft">
        {all.map((o) => (
          <li key={o.id}>
            <HistoryRow order={o} />
          </li>
        ))}
        {all.length === 0 && (
          <li className="py-10 text-center font-sans text-body text-inkDim">
            Sem pedidos ainda hoje.
          </li>
        )}
      </ul>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-label uppercase tracking-wider text-inkDim">
        {label}
      </p>
      <p className="mt-1 font-mono text-mono-lg text-ink tabular-nums">
        {value}
      </p>
    </div>
  );
}

function HistoryRow({ order }: { order: Order }) {
  const time = order.pickedAt ?? order.readyAt ?? order.acceptedAt ?? order.createdAt;
  const isCancel = order.status === 'cancelado';

  return (
    <div className="py-4 flex items-start gap-4">
      <div className="shrink-0 w-14">
        <p className="font-mono text-mono text-inkDim tabular-nums">{fmtTime(time)}</p>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="font-mono text-mono text-inkDim">#{order.id}</span>
          <span className="font-sans text-body text-ink">
            Mesa {String(order.mesaNumero).padStart(2, '0')}
          </span>
        </div>
        <p
          className={[
            'font-sans text-body-sm',
            isCancel ? 'text-inkDim line-through' : 'text-inkDim',
          ].join(' ')}
        >
          {order.lines.map((l) => `${l.qty}× ${l.name}`).join(' · ')}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-mono text-body text-ink">{fmtBRL(order.totalCents)}</p>
        <Chip tone={isCancel ? 'danger' : 'accent'} className="mt-1">
          {STATUS_LABEL[order.status].toLowerCase()}
        </Chip>
      </div>
    </div>
  );
}
