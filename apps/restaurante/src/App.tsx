import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppHeader } from './components/AppHeader';
import { BottomTabs } from './components/BottomTabs';
import { AuthGuard } from './components/AuthGuard';
import { LoginScreen } from './screens/LoginScreen';
import { ConviteScreen } from './screens/ConviteScreen';
import { SenhaScreen } from './screens/SenhaScreen';
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
  // Idem: quem chega em /senha/:token esqueceu a senha, entao nao consegue
  // passar pelo login.
  const isSenha = loc.pathname.startsWith('/senha/');

  // A COZINHA TRABALHA EM TABLET, nao em celular.
  //
  // Este container era `max-w-[480px]` fixo: no tablet do balcao — que e o
  // aparelho principal — o app virava uma coluna estreita no meio da tela,
  // mostrando uma ficha por vez com o resto vazio. Num turno cheio isso
  // significa rolar a lista o tempo todo pra ver o que ja esta na tela.
  //
  // Agora a largura acompanha o aparelho e so trava em 1400px, onde uma linha
  // de leitura ja ficaria longa demais.
  return (
    <div className="min-h-screen mx-auto w-full max-w-[1400px] bg-bg text-ink">
      {/* Login renderiza fora do shell (sem header/tabs) */}
      {isLogin || isConvite || isSenha ? (
        <Routes>
          <Route path="/login" element={<LoginScreen />} />
          <Route path="/convite/:token" element={<ConviteScreen />} />
          <Route path="/senha/:token" element={<SenhaScreen />} />
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
