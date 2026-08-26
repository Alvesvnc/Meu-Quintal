import { useNavigate } from 'react-router-dom';
import { Button, Divider } from '@mq/design-system';
import { mensagemDeErro } from '@mq/shared';
import { usePerfil, useSalvarPerfil } from '../api/hooks';
import { clearToken } from '../api/client';
import { disconnectSocket } from '../api/socket';
import { useAuth } from '../stores/auth';
import { Switch } from '../components/Switch';
import { ScreenError } from '../components/ScreenError';

/**
 * A conta da cozinha: quem é, e o botão de pausar.
 *
 * PAUSAR É A AÇÃO MAIS PESADA DESTA TELA e por isso não fica escondida no
 * perfil: com a cozinha pausada ela some do quintal e ninguém consegue pedir.
 * É o que se usa quando acaba o gás no meio do almoço.
 */
export function AccountScreen() {
  const navigate = useNavigate();
  const q = usePerfil();
  const salvar = useSalvarPerfil();
  const setMe = useAuth((s) => s.setMe);

  const sair = () => {
    clearToken();
    setMe(null);
    // O handshake do socket carrega o JWT antigo: sem derrubar, a sessão
    // continuaria recebendo pedidos desta cozinha depois do logout.
    disconnectSocket();
    navigate('/login', { replace: true });
  };

  if (q.isLoading) {
    return <main className="px-5 py-12 font-sans text-body text-inkDim">Carregando…</main>;
  }
  if (q.isError || !q.data) {
    return (
      <ScreenError
        title="Nao consegui carregar sua cozinha."
        body={mensagemDeErro(q.error, 'O servidor nao respondeu.')}
        onRetry={() => q.refetch()}
      />
    );
  }

  const perfil = q.data;
  const pausada = perfil.status === 'pausada';
  const erro = salvar.error ? mensagemDeErro(salvar.error, 'Nao consegui salvar.') : null;

  return (
    <main className="px-5 pb-28">
      <section className="pt-6">
        <p className="font-mono text-mono-sm uppercase tracking-wider text-inkDim">Cozinha</p>
        <h1 className="mt-1 font-display text-display-lg italic text-ink leading-tight">
          {perfil.name}
        </h1>
        <p className="mt-2 font-sans text-body text-inkDim">
          {perfil.category ?? 'sem categoria'} · SLA {perfil.slaMinutes} min
        </p>

        <div className="mt-5">
          <Button variant="secondary" size="md" fullWidth onClick={() => navigate('/perfil')}>
            Editar perfil público
          </Button>
          <p className="mt-2 font-sans text-body-sm text-inkDim">
            Nome, foto, categoria, frase, tempo de preparo.
          </p>
        </div>
      </section>

      <section className="mt-8">
        <Divider label="Atendimento" />
        <ul className="mt-2 divide-y divide-hairlineSoft">
          <li className="py-4 flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <p className="font-sans text-body-lg text-ink">
                {pausada ? 'Cozinha pausada' : 'Recebendo pedidos'}
              </p>
              <p className="mt-0.5 font-sans text-body-sm text-inkDim">
                {pausada
                  ? 'Você não aparece no quintal e ninguém consegue pedir.'
                  : 'Pause se precisar parar de receber — acabou o gás, fim de expediente.'}
              </p>
            </div>
            <div className="mt-1">
              <Switch
                checked={!pausada}
                onChange={() => salvar.mutate({ status: pausada ? 'ativa' : 'pausada' })}
                ariaLabel="Receber pedidos"
              />
            </div>
          </li>
        </ul>
        {erro && <p className="mt-3 font-mono text-mono-sm text-danger">{erro}</p>}
        {/* Pedido que já entrou continua na fila: pausar impede pedido NOVO,
            não abandona quem já está esperando comida. */}
        {pausada && (
          <p className="mt-3 font-sans text-body-sm text-inkDim">
            Os pedidos que já entraram continuam na sua fila.
          </p>
        )}
      </section>

      <section className="mt-8">
        <Divider label="Atalhos" />
        <ul className="mt-2 divide-y divide-hairlineSoft">
          <LinkRow rotulo="Histórico" onClick={() => navigate('/historico')} />
          <LinkRow rotulo="Métricas" onClick={() => navigate('/metricas')} />
          <LinkRow rotulo="Avisos no celular" onClick={() => navigate('/push')} />
        </ul>
      </section>

      <section className="mt-10">
        <Button variant="ghost" size="lg" fullWidth onClick={sair}>
          Sair
        </Button>
        <p className="mt-4 text-center font-mono text-mono-sm uppercase tracking-wider text-inkDim">
          Meu Quintal · cozinha
        </p>
      </section>
    </main>
  );
}

function LinkRow({ rotulo, onClick }: { rotulo: string; onClick: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="w-full py-4 flex items-center justify-between gap-4 cursor-pointer
                   text-left font-sans text-body-lg text-ink
                   hover:text-primary transition-colors duration-base ease-out"
      >
        <span>{rotulo}</span>
        <span aria-hidden className="font-mono text-mono text-inkDim">
          →
        </span>
      </button>
    </li>
  );
}
