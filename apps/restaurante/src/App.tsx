import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppHeader } from './components/AppHeader';
import { BottomTabs } from './components/BottomTabs';
import { AuthGuard } from './components/AuthGuard';
import { LoginScreen } from './screens/LoginScreen';
import { ConviteScreen } from './screens/ConviteScreen';
import { QueueScreen } from './screens/QueueScreen';
import { PushScreen } from './screens/PushScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { MenuEditScreen } from './screens/MenuEditScreen';
import { MetricsScreen } from './screens/MetricsScreen';
import { AccountScreen } from './screens/AccountScreen';
import { PerfilScreen } from './screens/PerfilScreen';

export function App() {
  const loc = useLocation();
  const isLogin = loc.pathname === '/login';
  // O convite e PUBLICO: quem chega nele ainda nao tem conta, e passar pelo
  // AuthGuard mandaria a pessoa pro login — onde ela nao tem o que digitar.
  const isConvite = loc.pathname.startsWith('/convite/');

  return (
    <div className="min-h-screen mx-auto max-w-[480px] bg-bg text-ink">
      {/* Login renderiza fora do shell (sem header/tabs) */}
      {isLogin || isConvite ? (
        <Routes>
          <Route path="/login" element={<LoginScreen />} />
          <Route path="/convite/:token" element={<ConviteScreen />} />
        </Routes>
      ) : (
        <AuthGuard>
          <AppHeader />
          <Routes>
            <Route path="/" element={<Navigate to="/fila" replace />} />
            <Route path="/fila" element={<QueueScreen />} />
            <Route path="/historico" element={<HistoryScreen />} />
            <Route path="/cardapio" element={<MenuEditScreen />} />
            <Route path="/metricas" element={<MetricsScreen />} />
            <Route path="/eu" element={<AccountScreen />} />
            <Route path="/perfil" element={<PerfilScreen />} />
            <Route path="/push" element={<PushScreen />} />
            <Route path="*" element={<Navigate to="/fila" replace />} />
          </Routes>
          <BottomTabs />
        </AuthGuard>
      )}
    </div>
  );
}
