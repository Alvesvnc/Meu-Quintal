import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { AuthGuard } from './components/AuthGuard';
import { LoginScreen } from './screens/LoginScreen';
import { SenhaScreen } from './screens/SenhaScreen';
import { OverviewScreen } from './screens/OverviewScreen';
import { RestaurantesScreen } from './screens/RestaurantesScreen';
import { OnboardScreen } from './screens/OnboardScreen';
import { FinanceiroScreen } from './screens/FinanceiroScreen';
import { MesasScreen } from './screens/MesasScreen';
import { ContaScreen } from './screens/ContaScreen';
import { PlaceholderScreen } from './screens/PlaceholderScreen';

export function App() {
  const loc = useLocation();

  // Login e primeiro acesso ficam FORA do shell: sidebar e topo dependem de
  // estar logado pra saber o nome do quintal. E o primeiro acesso e publico —
  // quem chega nele ainda nao consegue logar, e passar pelo AuthGuard o
  // mandaria pro login, onde ele nao tem senha pra digitar.
  const fora = loc.pathname === '/login' || loc.pathname.startsWith('/senha/');
  if (fora) {
    return (
      <Routes>
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/senha/:token" element={<SenhaScreen />} />
      </Routes>
    );
  }

  return (
    <AuthGuard>
      <AppShell>
        <Routes>
          <Route path="/" element={<OverviewScreen />} />
          <Route path="/restaurantes" element={<RestaurantesScreen />} />
          <Route path="/restaurantes/novo" element={<OnboardScreen />} />
          <Route
            path="/restaurantes/:slug"
            element={<PlaceholderScreen title="Detalhe da cozinha" note="Em construção." />}
          />
          <Route path="/financeiro" element={<FinanceiroScreen />} />
          <Route path="/mesas" element={<MesasScreen />} />
          <Route path="/conta" element={<ContaScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </AuthGuard>
  );
}
