import { NavLink, useLocation } from 'react-router-dom';
import { useCart, selectItemCount } from '../stores/cart';
import { useOrders } from '../api/hooks';
import { useRestauranteUnico } from '../lib/useTipoDeEspaco';

export const TABS_HEIGHT = 64;

interface Tab {
  to: string;
  label: string;
  badge?: string | null;
  hidden?: boolean;
  matchPrefix?: boolean;
}

export function BottomTabs() {
  const cartCount = useCart(selectItemCount);
  // Fonte de verdade = server (não localStorage). Compartilha cache TanStack Query.
  const { data: ordersData } = useOrders();
  const activeOrders = ordersData?.orders ?? [];
  const loc = useLocation();

  // Se só 1 pedido ativo, tab leva direto pra ele. 2+, leva pra lista.
  const orderTo =
    activeOrders.length === 1 ? `/pedido/${activeOrders[0].id}` : '/pedidos';
  const restauranteUnico = useRestauranteUnico();
  const orderLabel = activeOrders.length > 1 ? 'Pedidos' : 'Pedido';
  const orderBadge =
    activeOrders.length === 1
      ? `#${activeOrders[0].shortId}`
      : activeOrders.length > 1
        ? String(activeOrders.length)
        : null;

  const tabs: Tab[] = [
    // Num restaurante unico nao ha "quintal": `/` redireciona pro cardapio,
    // entao a aba leva ao mesmo lugar — so o rotulo muda pra fazer sentido.
    { to: '/', label: restauranteUnico ? 'Cardápio' : 'Quintal' },
    {
      to: '/carrinho',
      label: 'Carrinho',
      badge: cartCount > 0 ? String(cartCount) : null,
    },
    {
      to: orderTo,
      label: orderLabel,
      badge: orderBadge,
      hidden: activeOrders.length === 0,
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
              ? loc.pathname.startsWith('/pedido')
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
