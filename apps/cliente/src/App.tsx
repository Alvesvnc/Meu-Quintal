import { Routes, Route, useLocation } from 'react-router-dom';
import { AppHeader } from './components/AppHeader';
import { BottomTabs } from './components/BottomTabs';
import { LandingScreen } from './screens/LandingScreen';
import { MenuScreen } from './screens/MenuScreen';
import { ItemDetailSheet } from './screens/ItemDetailSheet';
import { CartScreen } from './screens/CartScreen';
import { TrackScreen } from './screens/TrackScreen';
import { OrdersListScreen } from './screens/OrdersListScreen';
import { ReviewScreen } from './screens/ReviewScreen';
import { TableEntryScreen } from './screens/TableEntryScreen';
import { NoTableScreen } from './screens/NoTableScreen';
import { PlaceholderScreen } from './screens/PlaceholderScreen';
import { useCart, selectItemCount } from './stores/cart';
import { useQuintal } from './api/hooks';
import { getTableToken } from './api/client';

export function App() {
  const cartCount = useCart(selectItemCount);
  const loc = useLocation();
  const isHome = loc.pathname === '/';
  const isEntry = loc.pathname.startsWith('/m/');

  // Mesa vem da API (não mais do mock). Antes do primeiro fetch usa fallback.
  const { data: quintal } = useQuintal();
  const mesaNumero = quintal?.table.numero ?? 0;
  const hasToken = !!getTableToken();

  // Tela de entrada (/m/:token) e quando não tem token: layout sem header/tabs
  if (isEntry || (!hasToken && !isEntry)) {
    return (
      <div className="min-h-screen mx-auto max-w-[480px] bg-bg">
        <Routes>
          <Route path="/m/:tableToken" element={<TableEntryScreen />} />
          <Route path="*" element={<NoTableScreen />} />
        </Routes>
      </div>
    );
  }

  return (
    <div className="min-h-screen mx-auto max-w-[480px] bg-bg">
      <AppHeader
        mesaNumero={mesaNumero}
        cartCount={cartCount}
        backTo={
          isHome
            ? undefined
            : { to: '/', label: `Mesa ${String(mesaNumero).padStart(2, '0')}` }
        }
      />
      <Routes>
        <Route path="/" element={<LandingScreen />} />
        <Route path="/k/:slug" element={<MenuScreen />}>
          <Route path="i/:itemId" element={<ItemDetailSheet />} />
        </Route>
        <Route path="/carrinho" element={<CartScreen />} />
        <Route path="/pedidos" element={<OrdersListScreen />} />
        <Route path="/pedido/:orderId" element={<TrackScreen />} />
        <Route path="/pedido/:orderId/avaliar" element={<ReviewScreen />} />
        <Route path="*" element={<PlaceholderScreen title="Página não encontrada" />} />
      </Routes>
      <BottomTabs />
    </div>
  );
}
