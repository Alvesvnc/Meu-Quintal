import { NavLink, useLocation } from 'react-router-dom';
import { useQueue, selectActiveCount } from '../stores/queue';

export const TABS_HEIGHT = 64;

export function BottomTabs() {
  const activeCount = useQueue(selectActiveCount);
  const loc = useLocation();

  const tabs = [
    { to: '/fila',     label: 'Fila',     badge: activeCount > 0 ? String(activeCount) : null },
    { to: '/cardapio', label: 'Cardápio', badge: null },
    { to: '/eu',       label: 'Eu',       badge: null },
  ];

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-20 pointer-events-none"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto max-w-[480px] bg-bg/95 backdrop-blur-[2px] border-t border-hairline pointer-events-auto">
        <ul className="grid grid-cols-3">
          {tabs.map((t) => {
            const active = loc.pathname.startsWith(t.to);
            return (
              <li key={t.to}>
                <NavLink
                  to={t.to}
                  className={[
                    'flex flex-col items-center justify-center gap-0.5 h-16 cursor-pointer',
                    'transition-colors duration-base ease-out relative',
                    active ? 'text-primary' : 'text-inkDim hover:text-ink',
                  ].join(' ')}
                  aria-current={active ? 'page' : undefined}
                >
                  <span
                    aria-hidden
                    className={[
                      'absolute top-0 left-3 right-3 h-[2px] rounded-b-sm',
                      'transition-colors duration-base ease-out',
                      active ? 'bg-primary' : 'bg-transparent',
                    ].join(' ')}
                  />
                  <span className="font-sans text-label uppercase tracking-wider">
                    {t.label}
                  </span>
                  {t.badge && (
                    <span
                      className={[
                        'font-mono text-mono-sm tabular-nums',
                        active ? 'text-primary' : 'text-inkDim',
                      ].join(' ')}
                    >
                      {t.badge}
                    </span>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
