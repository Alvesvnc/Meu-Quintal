import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@mq/design-system';
import { mensagemDeErro } from '@mq/shared';
import { useLogin } from '../api/hooks';
import { getToken } from '../api/client';
import { EsqueciSenha } from '../components/EsqueciSenha';

/** Entrada do dono do quintal. */
export function LoginScreen() {
  const navigate = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const login = useLogin();

  const from = (loc.state as { from?: string } | null)?.from ?? '/';

  useEffect(() => {
    if (getToken()) navigate(from, { replace: true });
  }, [from, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login.mutateAsync({ email: email.trim(), password });
      navigate(from, { replace: true });
    } catch {
      // A mensagem sai por login.error — nao ha o que fazer aqui.
    }
  };

  const errMsg = login.error ? mensagemDeErro(login.error, 'Nao foi possivel entrar.') : null;

  const campo =
    'w-full px-4 py-3 bg-surface border border-hairline rounded-md ' +
    'font-sans text-body-lg text-ink placeholder:text-inkDim ' +
    'focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primaryWash';
  const rotulo = 'block font-mono text-label uppercase tracking-wider text-inkDim mb-2';

  return (
    <main className="min-h-screen flex flex-col justify-center px-7 py-10 max-w-[440px] mx-auto">
      <header className="mb-8">
        <p className="font-mono text-mono-sm uppercase tracking-wider text-inkDim">
          Meu Quintal · administração
        </p>
        <h1 className="mt-2 font-display italic text-display-xl text-ink leading-tight text-pretty">
          Seu quintal,
          <br />
          por dentro.
        </h1>
      </header>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="email" className={rotulo}>
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@seuquintal.com"
            required
            autoFocus
            className={campo}
          />
        </div>

        <div>
          <label htmlFor="password" className={rotulo}>
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
            className={campo}
          />
        </div>

        {errMsg && <p className="font-mono text-mono-sm text-danger text-center">{errMsg}</p>}

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

      {import.meta.env.DEV && (
        <div className="mt-10 pt-6 border-t border-hairlineSoft">
          <p className="font-sans text-body-sm text-inkMuted">
            Dev:{' '}
            <button
              type="button"
              onClick={() => {
                setEmail('marina@meuquintal.app');
                setPassword('quintal2026');
              }}
              className="font-mono text-mono text-ink hover:text-primary cursor-pointer
                         transition-colors duration-base ease-out"
            >
              marina@meuquintal.app
            </button>
          </p>
        </div>
      )}
    </main>
  );
}
