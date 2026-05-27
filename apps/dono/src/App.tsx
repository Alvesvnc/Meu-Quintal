import { Routes, Route } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { OverviewScreen } from './screens/OverviewScreen';
import { RestaurantesScreen } from './screens/RestaurantesScreen';
import { OnboardScreen } from './screens/OnboardScreen';
import { FinanceiroScreen } from './screens/FinanceiroScreen';
import { MesasScreen } from './screens/MesasScreen';
import { PedidosLiveScreen } from './screens/PedidosLiveScreen';
import { ContaScreen } from './screens/ContaScreen';
import { PlaceholderScreen } from './screens/PlaceholderScreen';

export function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<OverviewScreen />} />
        <Route path="/restaurantes"       element={<RestaurantesScreen />} />
        <Route path="/restaurantes/novo"  element={<OnboardScreen />} />
        <Route path="/restaurantes/:slug" element={<PlaceholderScreen title="Detalhe da cozinha" note="Em construção." />} />
        <Route path="/financeiro"         element={<FinanceiroScreen />} />
        <Route path="/mesas"              element={<MesasScreen />} />
        <Route path="/pedidos"            element={<PedidosLiveScreen />} />
        <Route path="/conta"              element={<ContaScreen />} />
        <Route path="*"                   element={<PlaceholderScreen title="Página não encontrada" />} />
      </Routes>
    </AppShell>
  );
}
