import { useEffect, type ReactNode } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { getToken, clearToken } from '../api/client';
import { useMe } from '../api/hooks';
import { useAuth } from '../stores/auth';

interface Props {
  children: ReactNode;
}

/**
 * Barra quem não tem token e revalida o token contra `/api/a/auth/me`.
 *
 * Ter token não basta: ele vale sete dias, e nesse intervalo a conta pode ter
 * sido suspensa por inadimplência ou a pessoa removida da equipe. O `/me`
 * responde com 401 nesses casos e o interceptor derruba a sessão.
 */
export function AuthGuard({ children }: Props) {
  const loc = useLocation();
  const navigate = useNavigate();
  const setMe = useAuth((s) => s.setMe);
  const setEspaco = useAuth((s) => s.setEspaco);
  const temToken = !!getToken();

  const meQuery = useMe();

  useEffect(() => {
    const handler = () => {
      clearToken();
      setMe(null);
      // O quintal escolhido some junto: ele pertence à conta que acabou de
      // sair, e ficaria pendurado no próximo login de outra pessoa.
      setEspaco(null);
      navigate('/login', { replace: true, state: { from: loc.pathname } });
    };
    window.addEventListener('mq:auth:invalid', handler);
    return () => window.removeEventListener('mq:auth:invalid', handler);
  }, [navigate, loc.pathname, setMe, setEspaco]);

  if (!temToken) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }

  if (meQuery.isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="font-display text-display-md text-inkMuted">Carregando…</p>
      </main>
    );
  }

  if (meQuery.isError) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }

  return <>{children}</>;
}
