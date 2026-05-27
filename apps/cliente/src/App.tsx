import { Routes, Route, useLocation } from 'react-router-dom';
import { AppHeader } from './components/AppHeader';
import { BottomTabs } from './components/BottomTabs';
import { LandingScreen } from './screens/LandingScreen';
import { MenuScreen } from './screens/MenuScreen';
import { ItemDetailSheet } from './screens/ItemDetailSheet';
import { CartScreen } from './screens/CartScreen';
import { TrackScreen } from './screens/TrackScreen';
import { ReviewScreen } from './screens/ReviewScreen';
import { PlaceholderScreen } from './screens/PlaceholderScreen';
import { MESA_ATUAL } from './mocks/quintal';
import { useCart, selectItemCount } from './stores/cart';

export function App() {
  const cartCount = useCart(selectItemCount);
  const loc = useLocation();
  const isHome = loc.pathname === '/';

  return (
    <div className="min-h-screen mx-auto max-w-[480px] bg-bg">
      <AppHeader
        mesaNumero={MESA_ATUAL.numero}
        cartCount={cartCount}
        backTo={
          isHome
            ? undefined
            : { to: '/', label: `Mesa ${String(MESA_ATUAL.numero).padStart(2, '0')}` }
        }
      />
      <Routes>
        <Route path="/" element={<LandingScreen />} />
        <Route path="/k/:slug" element={<MenuScreen />}>
          <Route path="i/:itemId" element={<ItemDetailSheet />} />
        </Route>
        <Route path="/carrinho" element={<CartScreen />} />
        <Route path="/pedido/:orderId" element={<TrackScreen />} />
        <Route path="/pedido/:orderId/avaliar" element={<ReviewScreen />} />
        <Route path="*" element={<PlaceholderScreen title="Página não encontrada" />} />
      </Routes>
      <BottomTabs />
    </div>
  );
}
