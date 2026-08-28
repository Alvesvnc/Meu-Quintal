import { useNavigate } from 'react-router-dom';
import { Button, Chip, Divider } from '@mq/design-system';
import { useMe } from '../api/hooks';
import { clearToken } from '../api/client';
import { useAuth, useEspacoAtual } from '../stores/auth';
import { Carregando, ErroDaTela } from '../components/Estado';
import { PlanoDaConta } from '../components/PlanoDaConta';
import { AssinaturaDaConta } from '../components/AssinaturaDaConta';

/** Conta, quintal e equipe. */
export function ContaScreen() {
  const q = useMe();
  const navigate = useNavigate();
  const setMe = useAuth((s) => s.setMe);
  const setEspaco = useAuth((s) => s.setEspaco);
  const espacoAtual = useEspacoAtual();

  if (q.isLoading) return <Carregando o="sua conta" />;
  if (q.isError) return <ErroDaTela erro={q.error} aoTentar={() => q.refetch()} />;
  if (!q.data) return null;

  const me = q.data;
  const espaco = me.spaces.find((e) => e.slug === espacoAtual) ?? me.spaces[0];

  const sair = () => {
    clearToken();
    setMe(null);
    setEspaco(null);
    navigate('/login', { replace: true });
  };

  return (
    <>
      <header className="mb-8">
        <p className="font-mono text-label uppercase tracking-wider text-inkDim mb-1">Eu</p>
        <h1 className="font-display text-display-xl text-ink leading-tight">{me.account.name}</h1>
        {me.account.status !== 'ativa' && (
          <p className="mt-2 font-sans text-body text-warn">
            Conta {me.account.status}. Você continua vendo tudo, mas não consegue alterar nada.
          </p>
        )}
      </header>

      <div className="max-w-2xl space-y-10">
        {/* Só faz sentido escolher quando há mais de um. */}
        {me.spaces.length > 1 && (
          <section>
            <Divider label="Quintal em uso" />
            <div className="mt-4 flex flex-wrap gap-2">
              {me.spaces.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setEspaco(e.slug)}
                  className={[
                    'px-3 py-2 border font-sans text-body-sm cursor-pointer',
                    'transition-colors duration-base ease-out',
                    e.slug === espaco?.slug
                      ? 'border-primary bg-primaryWash text-primary'
                      : 'border-hairline text-inkMuted hover:text-ink',
                  ].join(' ')}
                >
                  {e.name}
                </button>
              ))}
            </div>
          </section>
        )}

        {espaco && (
          <section>
            <Divider label={me.spaces.length > 1 ? 'Detalhes' : 'Quintal'} />
            <dl className="mt-4 divide-y divide-hairlineSoft">
              <Linha rotulo="Nome" valor={espaco.name} />
              <Linha rotulo="Mesas" valor={String(espaco.tablesTotal)} />
              <Linha rotulo="Comissão padrão" valor={`${espaco.defaultCommissionPct}%`} />
              {/* "Fechamento", não"repasse": o dinheiro não sai daqui — é a
                  cozinha que deve ao quintal. */}
              <Linha rotulo="Ciclo fecha" valor={`dia ${espaco.closingDay} do mês`} />
            </dl>
          </section>
        )}

        {espaco && (
          <PlanoDaConta
            plano={me.account.plan}
            tipo={espaco.tipo}
            testeAte={me.account.trialEndsAt ?? null}
          />
        )}

        {/* Logo abaixo do plano: o preço é do plano, e quem acabou de ler o
            que o plano permite é quem decide pagar por ele. */}
        <AssinaturaDaConta />

        <section>
          <Divider label="Você" />
          <ul className="mt-4 divide-y divide-hairlineSoft">
            <li className="py-3 flex items-center gap-4 flex-wrap">
              <span className="font-display text-body-lg text-ink">{me.name ?? me.email}</span>
              <span className="font-sans text-body-sm text-inkMuted">{me.email}</span>
              <Chip tone="primary" className="ml-auto">
                {me.role}
              </Chip>
            </li>
          </ul>
          {me.kitchenId && (
            <p className="mt-3 font-sans text-body-sm text-inkMuted">
              Este login também abre o app do restaurante — você opera a cozinha diretamente.
            </p>
          )}
          <p className="mt-4 font-sans text-body-sm text-inkDim">
            Convidar mais pessoas para a equipe ainda não tem tela. O convite de cozinha está em
            Adicionar cozinha.
          </p>
        </section>

        <section className="pt-4">
          <Button variant="ghost" size="lg" onClick={sair}>
            Sair da conta
          </Button>
        </section>
      </div>
    </>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="py-3 flex items-baseline justify-between gap-4">
      <dt className="font-mono text-label uppercase tracking-wider text-inkDim">{rotulo}</dt>
      <dd className="font-sans text-body text-ink">{valor}</dd>
    </div>
  );
}
