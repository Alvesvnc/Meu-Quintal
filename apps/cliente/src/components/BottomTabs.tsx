import { NavLink, useLocation } from 'react-router-dom';
import { useCart, selectItemCount } from '../stores/cart';

export const TABS_HEIGHT = 64; // px — usado pra calcular padding/offset em telas

interface Tab {
  to: string;
  label: string;
  /** Texto curto mono opcional abaixo do label (contador ou status). */
  badge?: string | null;
  /** Se true, esconde a tab. */
  hidden?: boolean;
  /** Match flexível (startsWith). Default: match exato. */
  matchPrefix?: boolean;
}

export function BottomTabs() {
  const cartCount = useCart(selectItemCount);
  const activeOrderId = useCart((s) => s.activeOrderId);
  const loc = useLocation();

  const tabs: Tab[] = [
    { to: '/', label: 'Quintal' },
    {
      to: '/carrinho',
      label: 'Carrinho',
      badge: cartCount > 0 ? String(cartCount) : null,
    },
    {
      to: activeOrderId ? `/pedido/${activeOrderId}` : '/pedido/_',
      label: 'Pedido',
      badge: activeOrderId ? `#${activeOrderId}` : null,
      hidden: !activeOrderId,
      matchPrefix: true,
    },
  ];

  const visible = tabs.filter((t) => !t.hidden);

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-20 pointer-events-none"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto max-w-[480px] bg-bg/95 backdrop-blur-[2px] border-t border-hairline pointer-events-auto">
        <ul className="grid" style={{ gridTemplateColumns: `repeat(${visible.length}, 1fr)` }}>
          {visible.map((t) => {
            const active = t.matchPrefix
              ? loc.pathname.startsWith(t.to.replace(/\/[^/]+$/, ''))
              : loc.pathname === t.to;
            return (
              <li key={t.label}>
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
                        active ? 'text-primary' : 'text-inkMuted',
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
