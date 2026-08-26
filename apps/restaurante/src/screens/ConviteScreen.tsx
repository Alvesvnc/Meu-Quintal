import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Divider } from '@mq/design-system';
import { mensagemDeErro, type ConvitePublicoResponse } from '@mq/shared';
import { useConvite, useAceitarConvite } from '../api/hooks';
import { ScreenError } from '../components/ScreenError';
import { fmtBRL } from '../lib/formato';

/**
 * Aceitar o convite e criar o acesso da cozinha.
 *
 * **Rota pública** — quem chega aqui ainda não tem conta; é isto que está
 * criando. O que autentica é o token do link, que só existe no email.
 *
 * A tela mostra o ACORDO FINANCEIRO antes de pedir a senha. Aceitar comissão e
 * aluguel sem ler seria assinar em branco, e o convite é o único momento em que
 * esses termos passam pela frente do responsável.
 */
export function ConviteScreen() {
  const { token = '' } = useParams();
  const q = useConvite(token);

  if (q.isLoading) {
    return (
      <main className="px-5 py-16 text-center">
        <p className="font-display italic text-display-md text-inkMuted">Abrindo o convite…</p>
      </main>
    );
  }

  if (q.isError || !q.data) {
    return (
      <ScreenError
        title="Não consegui abrir este convite."
        body={mensagemDeErro(q.error, 'O link pode ter expirado ou já ter sido usado.')}
      />
    );
  }

  return <Formulario token={token} convite={q.data} />;
}

function Formulario({ token, convite }: { token: string; convite: ConvitePublicoResponse }) {
  const navigate = useNavigate();
  const aceitar = useAceitarConvite();
  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [repetir, setRepetir] = useState('');

  const senhaValida = senha.length >= 8;
  const confere = senha === repetir;
  const podeEnviar = senhaValida && confere && !aceitar.isPending;

  const erro = aceitar.error ? mensagemDeErro(aceitar.error, 'Nao consegui aceitar o convite.') : null;

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!podeEnviar) return;
    aceitar.mutate(
      { token, password: senha, name: nome.trim() || undefined },
      // Já entra logado — o hook guarda o token. Vai direto pro cardápio
      // porque a cozinha nasce pausada e sem pratos: a fila estaria vazia e
      // não haveria o que fazer nela.
      { onSuccess: () => navigate('/cardapio', { replace: true }) },
    );
  };

  const { acordo } = convite;
  const termos: string[] = [];
  if (acordo.chargeCommission) {
    termos.push(
      acordo.commissionPct === null
        ? 'comissão sobre as vendas (percentual padrão do quintal)'
        : `${acordo.commissionPct}% de comissão sobre as vendas`,
    );
  }
  if (acordo.chargeRent) termos.push(`${fmtBRL(acordo.rentCents)} de aluguel por mês`);

  const campo =
    'w-full px-4 py-3 bg-surface border border-hairline rounded-md ' +
    'font-sans text-body-lg text-ink placeholder:text-inkDim ' +
    'focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primaryWash';
  const rotulo = 'block font-mono text-label uppercase tracking-wider text-inkDim mb-2';

  return (
    <main className="px-5 py-10 max-w-[440px] mx-auto pb-20">
      <header>
        <p className="font-mono text-mono-sm uppercase tracking-wider text-inkDim">
          Convite · {convite.spaceName}
        </p>
        <h1 className="mt-2 font-display italic text-display-xl text-ink leading-tight text-pretty">
          Sua cozinha no {convite.spaceName}.
        </h1>
        <p className="mt-3 font-sans text-body text-inkMuted text-pretty">
          {convite.accountName} convidou você para operar a{' '}
          <span className="text-ink">{convite.kitchenName}</span>. Crie sua senha e o acesso está
          pronto.
        </p>
      </header>

      <section className="mt-8">
        <Divider label="O acordo combinado" />
        {termos.length > 0 ? (
          <ul className="mt-3 space-y-1">
            {termos.map((t) => (
              <li key={t} className="font-sans text-body text-ink">
                · {t}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 font-sans text-body text-ink">
            Sem comissão e sem aluguel.
          </p>
        )}
        <p className="mt-3 font-sans text-body-sm text-inkDim text-pretty">
          {/* Dito aqui de propósito: é a dúvida que todo mundo tem ao ver
              "comissão" numa tela de cadastro. */}
          O dinheiro não passa pelo sistema. Você cobra o cliente no seu caixa e acerta com o
          quintal no fim do ciclo.
        </p>
      </section>

      <form onSubmit={enviar} className="mt-8 space-y-5">
        <Divider label="Seu acesso" />

        <div>
          <label className={rotulo}>Email</label>
          {/* Não editável: o email é do convite. Deixar mudar aqui permitiria a
              quem tem o link criar acesso para outro endereço. */}
          <p className="px-4 py-3 bg-surface border border-hairline rounded-md font-mono text-body text-inkMuted">
            {convite.email}
          </p>
        </div>

        <div>
          <label htmlFor="nome" className={rotulo}>
            Seu nome <span className="normal-case tracking-normal">(opcional)</span>
          </label>
          <input
            id="nome"
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            maxLength={80}
            placeholder="Marcos"
            className={campo}
          />
        </div>

        <div>
          <label htmlFor="senha" className={rotulo}>
            Senha
          </label>
          <input
            id="senha"
            type="password"
            autoComplete="new-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className={campo}
          />
          {senha !== '' && !senhaValida && (
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

        <Button type="submit" variant="primary" size="lg" fullWidth disabled={!podeEnviar}>
          {aceitar.isPending ? 'Criando…' : 'Aceitar e criar meu acesso'}
        </Button>
      </form>

      <p className="mt-6 font-sans text-body-sm text-inkDim text-center text-pretty">
        Sua cozinha começa pausada. Cadastre os pratos e publique quando estiver pronta — o cliente
        só vê depois disso.
      </p>
    </main>
  );
}
