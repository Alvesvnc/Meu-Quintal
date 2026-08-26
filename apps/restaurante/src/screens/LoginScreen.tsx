import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@mq/design-system';
import { mensagemDeErro } from '@mq/shared';
import { useLogin } from '../api/hooks';
import { getToken } from '../api/client';
import { EsqueciSenha } from '../components/EsqueciSenha';

/** Tela de login do operador da cozinha. */
export function LoginScreen() {
  const navigate = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showDevHint, setShowDevHint] = useState(false);
  const login = useLogin();

  const from = (loc.state as { from?: string } | null)?.from ?? '/fila';

  // Se ja tem token, redireciona
  useEffect(() => {
    if (getToken()) navigate(from, { replace: true });
  }, [from, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login.mutateAsync({ email: email.trim(), password });
      navigate(from, { replace: true });
    } catch {
      // erro vem via login.error
    }
  };

  const fillDev = (devEmail: string) => {
    setEmail(devEmail);
    setPassword('quintal2026');
  };

  const errMsg = login.error ? mensagemDeErro(login.error, 'Nao foi possivel entrar.') : null;

  return (
    <main className="min-h-screen flex flex-col justify-center px-7 py-10 max-w-[440px] mx-auto">
      <header className="mb-8">
        <p className="font-mono text-mono-sm uppercase tracking-wider text-inkDim">
          Meu Quintal · restaurante
        </p>
        <h1 className="mt-2 font-display italic text-display-xl text-ink leading-tight text-pretty">
          Bem-vinda à<br />sua cozinha.
        </h1>
      </header>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="email" className="block font-mono text-label uppercase tracking-wider text-inkDim mb-2">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="responsavel@cozinha.com"
            required
            autoFocus
            className="w-full px-4 py-3 bg-surface border border-hairline rounded-md
                       font-sans text-body-lg text-ink placeholder:text-inkDim
                       focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primaryWash"
          />
        </div>

        <div>
          <label htmlFor="password" className="block font-mono text-label uppercase tracking-wider text-inkDim mb-2">
            Senha
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full px-4 py-3 bg-surface border border-hairline rounded-md
                       font-sans text-body-lg text-ink
                       focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primaryWash"
          />
        </div>

        {errMsg && (
          <p className="font-mono text-mono-sm text-danger text-center">{errMsg}</p>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          loading={login.isPending}
          disabled={login.isPending}
        >
          {login.isPending ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>

      <EsqueciSenha emailInicial={email} />

      {/* Dev: atalhos pra users seedados */}
      {import.meta.env.DEV && (
        <div className="mt-10 pt-6 border-t border-hairlineSoft">
          <button
            type="button"
            onClick={() => setShowDevHint((v) => !v)}
            className="font-mono text-mono-sm uppercase tracking-wider text-inkDim
                       hover:text-ink cursor-pointer transition-colors duration-base ease-out"
          >
            Dev · usuarios mockados {showDevHint ? '↑' : '↓'}
          </button>
          {showDevHint && (
            <div className="mt-3 space-y-1">
              <p className="font-sans text-body-sm text-inkMuted mb-2">
                Senha pra todos: <span className="font-mono text-ink">quintal2026</span>
              </p>
              {[
                'marcos@louburger.com',
                'ana@cumbuca.com',
                'seujose@pasteloka.com',
                'ze@hortadoze.com',
                'marina@dolcemarina.com',
              ].map((dev) => (
                <button
                  key={dev}
                  type="button"
                  onClick={() => fillDev(dev)}
                  className="block w-full text-left px-3 py-2 rounded-md
                             font-mono text-mono text-ink cursor-pointer
                             hover:bg-primaryWash hover:text-primary
                             transition-colors duration-base ease-out"
                >
                  {dev}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
