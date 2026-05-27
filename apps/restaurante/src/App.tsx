import { Routes, Route, Navigate } from 'react-router-dom';
import { AppHeader } from './components/AppHeader';
import { BottomTabs } from './components/BottomTabs';
import { QueueScreen } from './screens/QueueScreen';
import { PushScreen } from './screens/PushScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { MenuEditScreen } from './screens/MenuEditScreen';
import { MetricsScreen } from './screens/MetricsScreen';
import { AccountScreen } from './screens/AccountScreen';
import { PerfilScreen } from './screens/PerfilScreen';

export function App() {
  return (
    <div className="min-h-screen mx-auto max-w-[480px] bg-bg text-ink">
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
    </div>
  );
}
