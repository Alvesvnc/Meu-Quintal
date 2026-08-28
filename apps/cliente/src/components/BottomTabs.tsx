import { NavLink, useLocation } from 'react-router-dom';
import { Utensils, ShoppingBasket, ReceiptText, type LucideIcon } from 'lucide-react';
import { useCart, selectItemCount } from '../stores/cart';
import { useOrders } from '../api/hooks';
import { useRestauranteUnico } from '../lib/useTipoDeEspaco';

export const TABS_HEIGHT = 64;

interface Tab {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: string | null;
  hidden?: boolean;
  matchPrefix?: boolean;
}

/**
 * Barra de abas: régua de 2px em cima, células iguais divididas por 1px.
 *
 * A célula ativa é um BLOCO vermelho sólido, não um sublinhado nem uma pílula.
 * Num aparelho segurado com uma mão, o polegar cobre metade da barra; um traço
 * de 2px na borda de cima é a primeira coisa que some debaixo do dedo, e o
 * bloco continua legível pela cor que sobra na periferia.
 *
 * Ícone e rótulo alinham à ESQUERDA da célula, como todo rótulo do sistema —
 * centralizar aqui abriria exceção pra única barra da tela.
 */
export function BottomTabs() {
  const cartCount = useCart(selectItemCount);
  // Fonte de verdade = server (não localStorage). Compartilha cache TanStack Query.
  const { data: ordersData } = useOrders();
  const activeOrders = ordersData?.orders ?? [];
  const loc = useLocation();

  // Se só 1 pedido ativo, tab leva direto pra ele. 2+, leva pra lista.
  const orderTo = activeOrders.length === 1 ? `/pedido/${activeOrders[0].id}` : '/pedidos';
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
    { to: '/', label: restauranteUnico ? 'Cardápio' : 'Cozinhas', icon: Utensils },
    {
      to: '/carrinho',
      label: 'Carrinho',
      icon: ShoppingBasket,
      badge: cartCount > 0 ? String(cartCount) : null,
    },
    {
      to: orderTo,
      label: orderLabel,
      icon: ReceiptText,
      badge: orderBadge,
      hidden: activeOrders.length === 0,
      matchPrefix: true,
    },
  ];

  const visible = tabs.filter((t) => !t.hidden);

  return (
    <nav
      aria-label="Navegação principal"
      // O fundo vai no <nav>, e não só na barra: o padding do safe-area fica
      // ABAIXO dela, e sem cor essa faixa deixaria o conteúdo aparecer sob a
      // faixa de gestos do iPhone.
      className="fixed inset-x-0 bottom-0 z-20 bg-bg pointer-events-none"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Opaca: com `bg-bg/95` + blur o conteúdo aparecia atrás e sujava a
          barra, principalmente por cima das fotos de comida. */}
      <div className="mx-auto max-w-[480px] bg-bg border-t-rule border-divider pointer-events-auto">
        <ul className="grid" style={{ gridTemplateColumns: `repeat(${visible.length}, 1fr)` }}>
          {visible.map((t, i) => {
            const active = t.matchPrefix
              ? loc.pathname.startsWith('/pedido')
              : loc.pathname === t.to;
            const Icone = t.icon;
            return (
              <li key={t.label} className={i > 0 ? 'border-l border-divider' : ''}>
                <NavLink
                  to={t.to}
                  className={[
                    'flex flex-col justify-center gap-1 px-4 py-3 cursor-pointer no-underline',
                    'transition-colors duration-base ease-out',
                    active ? 'bg-accent text-bg' : 'text-neutral-700 hover:text-ink',
                  ].join(' ')}
                  style={{ height: TABS_HEIGHT }}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className="flex items-start gap-1.5">
                    <Icone size={22} strokeWidth={2} aria-hidden />
                    {t.badge && (
                      <span
                        className={[
                          'px-1.5 font-display text-label-sm font-bold tabular leading-[1.4]',
                          active ? 'bg-bg text-accent' : 'bg-accent text-bg',
                        ].join(' ')}
                      >
                        {t.badge}
                      </span>
                    )}
                  </span>
                  <span className="font-display text-label font-bold uppercase">{t.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
