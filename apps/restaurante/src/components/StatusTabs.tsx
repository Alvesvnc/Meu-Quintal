import type { Status } from '../mocks/orders';

interface StatusTab {
  id: Exclude<Status, 'retirado' | 'cancelado'>;
  label: string;
  count: number;
}

interface StatusTabsProps {
  tabs: StatusTab[];
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
