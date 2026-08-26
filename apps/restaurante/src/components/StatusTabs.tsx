import type { OrderItemStatus } from '@mq/shared';

/**
 * Status vem do contrato da API (@mq/shared), nao de mocks/orders. A tela ja le
 * dados reais; manter o tipo preso ao mock faria a compilacao quebrar no dia em
 * que os mocks forem apagados — sem que nada de errado tenha sido feito.
 */
interface StatusTab {
  id: Exclude<OrderItemStatus, 'retirado' | 'cancelado'>;
  label: string;
  count: number;
}

interface StatusTabsProps {
  /**
   * `readonly` de proposito: o chamador monta a lista com `as const`, e um
   * array mutavel aqui obrigaria um cast do lado de la — que era exatamente o
   * `tabs as any` que existia antes.
   */
  tabs: readonly StatusTab[];
  activeId: StatusTab['id'];
  onSelect: (id: StatusTab['id']) => void;
}

/**
 * Tabs horizontais sticky pra alternar entre Novos/Preparando/Prontos no portrait.
 * Visualmente parecido com TabBar do cliente mas dark.
 */
export function StatusTabs({ tabs, activeId, onSelect }: StatusTabsProps) {
  return (
    <div
      role="tablist"
      className="sticky top-16 z-10 bg-bg border-b border-hairline"
    >
      <div className="grid grid-cols-3">
        {tabs.map((t) => {
          const active = activeId === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(t.id)}
              className={[
                'relative h-14 flex flex-col items-center justify-center gap-0.5 cursor-pointer',
                'transition-colors duration-base ease-out',
                active ? 'text-ink' : 'text-inkDim hover:text-ink',
              ].join(' ')}
            >
              <span className="font-sans text-label uppercase tracking-wider">{t.label}</span>
              <span className="font-mono text-mono-sm tabular-nums">{t.count}</span>
              <span
                aria-hidden
                className={[
                  'absolute bottom-0 left-3 right-3 h-[2px] rounded-t-sm',
                  'transition-colors duration-base ease-out',
                  active ? 'bg-primary' : 'bg-transparent',
                ].join(' ')}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
