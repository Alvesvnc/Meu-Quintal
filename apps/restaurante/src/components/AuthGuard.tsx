import { useEffect, type ReactNode } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { mensagemDeErro, requestIdDoErro, statusDoErro } from '@mq/shared';
import { getToken, clearToken } from '../api/client';
import { disconnectSocket } from '../api/socket';
import { useMe } from '../api/hooks';
import { useAuth } from '../stores/auth';
import { ScreenError } from './ScreenError';

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
        <p className="font-display text-display-md text-inkMuted">Carregando…</p>
      </main>
    );
  }

  if (meQuery.isError) {
    // ─── NEM TODO ERRO NO /me E CREDENCIAL RUIM ───────────────────────────
    //
    // Antes daqui, QUALQUER falha mandava pra /login. Com o servidor doente
    // (500, banco fora, rede caida) o token continua no localStorage — e o
    // LoginScreen, que redireciona quem ja tem token, devolvia a pessoa pra
    // ca na hora. Ida e volta sem fim: o /me era refeito a cada montagem, o
    // Chrome cortava a navegacao ("Throttling navigation to prevent the
    // browser from hanging") e a tela ficava branca, sem nunca dizer o que
    // houve.
    //
    // Quem decide deslogar e o status: 401/403 sao resposta sobre a
    // credencial, e o interceptor ja limpou o token. O resto e problema do
    // servidor, e a pessoa continua logada — so nao da pra carregar agora.
    const status = statusDoErro(meQuery.error);

    if (status === 401 || status === 403) {
      return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
    }

    // O requestId aparece em 5xx e transforma "deu erro" numa busca de uma
    // linha no log do servidor — ver docs/observabilidade.md.
    const requestId = requestIdDoErro(meQuery.error);

    return (
      <ScreenError
        title="Nao consegui abrir sua cozinha."
        body={
          mensagemDeErro(meQuery.error, 'O servidor nao respondeu.') +
          (requestId ? ` (codigo ${requestId})` : '')
        }
        onRetry={() => meQuery.refetch()}
      />
    );
  }

  return <>{children}</>;
}
