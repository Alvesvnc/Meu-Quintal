import { Button, Chip } from '@mq/design-system';
import { fmtTime, minutesSince, type Order, type Status } from '../mocks/orders';
import { MINHA_COZINHA } from '../mocks/kitchen';
import { useQueue } from '../stores/queue';

interface OrderCardProps {
  order: Order;
}

/**
 * Card de pedido na fila. Tap target XL (botão h=64 conforme pages/restaurante.md).
 * Cronômetro UP (sempre crescente). Atraso = border-left primary + chip ATRASADO.
 */
export function OrderCard({ order }: OrderCardProps) {
  const advance = useQueue((s) => s.advance);
  const cancel = useQueue((s) => s.cancel);

  const elapsed = minutesSince(order.acceptedAt ?? order.createdAt);
  const sla = MINHA_COZINHA.slaMinutes;
  const isLate = order.status === 'preparando' && elapsed > sla;
  const isCritical = order.status === 'preparando' && elapsed > sla * 2;

  const CTA_LABEL: Partial<Record<Status, string>> = {
    novo:       'Aceitar',
    preparando: 'Pronto',
    pronto:     'Retirado',
  };
  const cta = CTA_LABEL[order.status] ?? null;

  const elapsedLabel = (() => {
    if (order.status === 'novo')       return `entrou há ${minutesSince(order.createdAt)} min`;
    if (order.status === 'preparando') return `preparando há ${elapsed} min`;
    if (order.status === 'pronto' && order.readyAt) return `pronto às ${fmtTime(order.readyAt)}`;
    return '';
  })();

  return (
    <article
      className={[
        'rounded-lg bg-surface p-5',
        isLate ? 'border-l-4 border-l-primary' : '',
        order.status === 'pronto' ? 'border border-primary' : 'border border-hairline',
      ].filter(Boolean).join(' ')}
    >
      {/* Header: #id + mesa + tempo */}
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-mono text-inkDim">#{order.id}</span>
          <span className="font-display text-display-md text-ink leading-none">
            Mesa {String(order.mesaNumero).padStart(2, '0')}
          </span>
        </div>
        {isCritical && <Chip tone="danger">atrasado</Chip>}
        {isLate && !isCritical && <Chip tone="warn">no limite</Chip>}
      </div>

      <p className={[
        'font-mono text-mono mb-3',
        isLate ? 'text-primary' : 'text-inkDim',
      ].join(' ')}>
        {elapsedLabel}
      </p>

      {/* Itens */}
      <ul className="border-t border-b border-hairline py-3 my-3 space-y-1.5">
        {order.lines.map((l, i) => (
          <li key={i}>
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-body text-ink tabular-nums shrink-0">
                {l.qty}×
              </span>
              <span className="font-sans text-body-lg text-ink flex-1">
                {l.name}
              </span>
            </div>
            {l.note && (
              <p className="ml-9 mt-0.5 font-sans text-body italic text-inkDim">
                obs: {l.note}
              </p>
            )}
          </li>
        ))}
      </ul>

      {/* Ação primária XL + cancelar discreto */}
      {cta && (
        <div className="mt-4">
          <Button
            variant="primary"
            size="xl"
            fullWidth
            onClick={() => advance(order.id)}
          >
            {cta}
          </Button>
          {order.status === 'novo' && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Cancelar pedido #${order.id}?`)) cancel(order.id);
              }}
              className="block mx-auto mt-3 px-3 py-1 cursor-pointer
                         font-mono text-mono-sm uppercase tracking-wider text-inkDim
                         hover:text-danger transition-colors duration-base ease-out"
            >
              Cancelar pedido
            </button>
          )}
        </div>
      )}
    </article>
  );
}
