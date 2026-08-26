import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@mq/design-system';
import { mensagemDeErro, type PrimeiroAcessoResponse } from '@mq/shared';
import { usePrimeiroAcesso, useDefinirSenha } from '../api/hooks';

/**
 * Criar a senha e entrar.
 *
 * **Rota pública** — quem chega aqui ainda não consegue logar; é isto que está
 * resolvendo. O que autentica é o token do link, que só existe no email.
 *
 * A tela diz DE QUAL CONTA é o link antes de pedir a senha. Chegar numa tela de
 * "crie sua senha" sem saber de que se trata é o formato de todo golpe de
 * phishing, e a pessoa acabou de pagar por isso — merece reconhecer o que vê.
 */
export function PrimeiroAcessoScreen() {
  const { token = '' } = useParams();
  const q = usePrimeiroAcesso(token);

  if (q.isLoading) {
    return (
      <Moldura>
        <p className="font-display italic text-display-md text-inkMuted">Abrindo o link…</p>
      </Moldura>
    );
  }

  if (q.isError || !q.data) {
    return (
      <Moldura>
        <h1 className="font-display italic text-display-lg text-ink leading-tight text-pretty">
          Não consegui abrir este link.
        </h1>
        <p className="mt-3 font-sans text-body text-inkMuted text-pretty">
          {mensagemDeErro(q.error, 'Ele pode ter expirado ou já ter sido usado.')}
        </p>
      </Moldura>
    );
  }

  return <Formulario token={token} dados={q.data} />;
}

function Formulario({ token, dados }: { token: string; dados: PrimeiroAcessoResponse }) {
  const navigate = useNavigate();
  const definir = useDefinirSenha();
  const [senha, setSenha] = useState('');
  const [repetir, setRepetir] = useState('');

  const valida = senha.length >= 8;
  const confere = senha === repetir;
  const pode = valida && confere && !definir.isPending;
  const erro = definir.error ? mensagemDeErro(definir.error, 'Nao consegui salvar a senha.') : null;

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pode) return;
    definir.mutate(
      { token, password: senha },
      { onSuccess: () => navigate('/', { replace: true }) },
    );
  };

  const campo =
    'w-full px-4 py-3 bg-surface border border-hairline rounded-md ' +
    'font-sans text-body-lg text-ink placeholder:text-inkDim ' +
    'focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primaryWash';
  const rotulo = 'block font-mono text-label uppercase tracking-wider text-inkDim mb-2';

  return (
    <Moldura>
      <p className="font-mono text-mono-sm uppercase tracking-wider text-inkDim">
        Meu Quintal · primeiro acesso
      </p>
      <h1 className="mt-2 font-display italic text-display-xl text-ink leading-tight text-pretty">
        {dados.name ? `Oi, ${dados.name}.` : 'Sua conta está pronta.'}
      </h1>
      <p className="mt-3 font-sans text-body text-inkMuted text-pretty">
        A conta <span className="text-ink">{dados.accountName}</span> está pronta. Crie sua senha e
        você já entra.
      </p>

      <form onSubmit={enviar} className="mt-8 space-y-5">
        <div>
          <label className={rotulo}>Seu login</label>
          {/* Não editável: o email é o do convite. Poder trocá-lo aqui
              deixaria quem tem o link mudar o dono da conta. */}
          <p className="px-4 py-3 bg-surface border border-hairline rounded-md font-mono text-body text-inkMuted">
            {dados.email}
          </p>
        </div>

        <div>
          <label htmlFor="senha" className={rotulo}>
            Crie sua senha
          </label>
          <input
            id="senha"
            type="password"
            autoComplete="new-password"
            autoFocus
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className={campo}
          />
          {senha !== '' && !valida && (
            <p className="mt-2 font-mono text-mono-sm text-danger">Pelo menos 8 caracteres.</p>
          )}
        </div>

        <div>
          <label htmlFor="repetir" className={rotulo}>
            Repita a senha
          </label>
          <input
            id="repetir"
            type="password"
            autoComplete="new-password"
            value={repetir}
            onChange={(e) => setRepetir(e.target.value)}
            className={campo}
          />
          {repetir !== '' && !confere && (
            <p className="mt-2 font-mono text-mono-sm text-danger">As senhas não batem.</p>
          )}
        </div>

        {erro && <p className="font-mono text-mono-sm text-danger text-center">{erro}</p>}

        <Button type="submit" variant="primary" size="lg" fullWidth disabled={!pode}>
          {definir.isPending ? 'Entrando…' : 'Criar senha e entrar'}
        </Button>
      </form>

      <p className="mt-6 font-sans text-body-sm text-inkDim text-pretty">
        Este link serve uma vez só. Guarde a senha — ainda não existe recuperação por email.
      </p>
    </Moldura>
  );
}

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex flex-col justify-center px-7 py-10 max-w-[440px] mx-auto">
      {children}
    </main>
  );
}
