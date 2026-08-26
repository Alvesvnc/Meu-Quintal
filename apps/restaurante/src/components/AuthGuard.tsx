import { useEffect, type ReactNode } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { getToken, clearToken } from '../api/client';
import { disconnectSocket } from '../api/socket';
import { useMe } from '../api/hooks';
import { useAuth } from '../stores/auth';

interface AuthGuardProps {
  children: ReactNode;
}

/**
 * Bloqueia acesso pra usuarios sem token, e revalida o token via /me.
 * Escuta evento `mq:auth:invalid` (disparado pelo axios interceptor em 401)
 * pra deslogar globalmente.
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const loc = useLocation();
  const navigate = useNavigate();
  const setMe = useAuth((s) => s.setMe);
  const hasToken = !!getToken();

  // Revalida token + carrega perfil ao montar
  const meQuery = useMe();

  // Escuta evento de 401 pra deslogar
  useEffect(() => {
    const handler = () => {
      clearToken();
      setMe(null);
      // O socket foi aberto com o JWT antigo no handshake. Sem derrubar aqui,
      // a sessao continua recebendo eventos da cozinha depois do logout.
      disconnectSocket();
      navigate('/login', { replace: true, state: { from: loc.pathname } });
    };
    window.addEventListener('mq:auth:invalid', handler);
    return () => window.removeEventListener('mq:auth:invalid', handler);
  }, [navigate, loc.pathname, setMe]);

  if (!hasToken) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }

  if (meQuery.isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="font-display italic text-display-md text-inkMuted">Carregando…</p>
      </main>
    );
  }

  if (meQuery.isError) {
    // Token invalido — interceptor ja limpou + disparou evento
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }

  return <>{children}</>;
}
