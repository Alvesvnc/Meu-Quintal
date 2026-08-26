import { Link } from 'react-router-dom';
import { Divider } from '@mq/design-system';
import { useOverview, useCozinhas } from '../api/hooks';
import { useAuth, useEspacoAtual, useRestauranteUnico } from '../stores/auth';
import { Carregando, ErroDaTela } from '../components/Estado';
import { fmtBRL } from '../lib/formato';

/**
 * Visão geral do dia.
 *
 * Editorial, não bento: hierarquia pela tipografia. Tudo aqui vem de
 * `/api/a/overview` e `/api/a/cozinhas` — os números que a versão mockada
 * mostrava e a API não tem (série por hora, itens mais vendidos) foram
 * removidos em vez de preenchidos com invenção. Um gráfico bonito com dado
 * falso é pior que nenhum gráfico.
 */
export function OverviewScreen() {
  const overview = useOverview();
  const cozinhas = useCozinhas();
  const unico = useRestauranteUnico();
  const espacoAtual = useEspacoAtual();
  const espaco = useAuth((s) => s.me?.spaces.find((e) => e.slug === espacoAtual));

  const agora = new Date();
  const dia = agora.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
  const hora = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  if (overview.isLoading) return <Carregando o="o resumo do dia" />;
  if (overview.isError) {
    return <ErroDaTela erro={overview.error} aoTentar={() => overview.refetch()} />;
  }
  if (!overview.data) return null;

  const { hoje, mesas, cozinhas: contagem } = overview.data;

  return (
    <>
      <header className="mb-8">
        <Divider label={`Hoje · ${dia}, ${hora}`} />
      </header>

      <section className="grid grid-cols-2 gap-12 mb-4">
        <NumeroGrande rotulo="Faturamento hoje" valor={fmtBRL(hoje.grossCents)} />
        <NumeroGrande
          rotulo="Ticket médio"
          valor={fmtBRL(hoje.ticketMedioCents)}
          sub={`· ${hoje.ordersCount} pedido${hoje.ordersCount === 1 ? '' : 's'}`}
        />
      </section>

      <div className="mt-8">
        <Divider />
      </div>

      <p className="mt-6 mb-10 font-sans text-body-lg text-inkMuted">
        {!unico && (
          <>
            <strong className="text-ink font-medium">{contagem.ativas}</strong> de{' '}
            {contagem.total} cozinhas abertas ·{' '}
          </>
        )}
        <strong className="text-ink font-medium">{mesas.ocupadas}</strong> de {mesas.total} mesas
        ocupadas
        {mesas.precisamLimpar > 0 && (
          <>
            {' · '}
            <strong className="text-warn font-medium">{mesas.precisamLimpar}</strong> esperando
            limpeza
          </>
        )}
      </p>

      <section className="mb-10">
        <Divider label="O que exige sua atenção" />
        <Atencoes
          precisamLimpar={mesas.precisamLimpar}
          pausadas={contagem.pausadas}
          diaDeFechamento={espaco?.closingDay ?? null}
          unico={unico}
        />
      </section>

      {/* O movimento por cozinha so entra pra cozinha que o proprio usuario
          opera. Numa praca, como cada cozinha foi hoje e informacao dela — o
          dono cobra sobre o ciclo, e isso esta no Financeiro. */}
      {cozinhas.data?.some((k) => k.grossTodayCents !== null) && (
        <section>
          <Divider label="Sua cozinha · hoje" />
          <ol className="mt-4 divide-y divide-hairlineSoft">
            {cozinhas.data
              .filter((k) => k.grossTodayCents !== null)
              .map((k) => (
                <li key={k.id} className="py-3 flex items-baseline gap-4">
                  <Link
                    to={`/restaurantes/${k.slug}`}
                    className="flex-1 font-sans text-body-lg text-ink no-underline hover:text-primary
                               transition-colors duration-base ease-out"
                  >
                    {k.name}
                  </Link>
                  <span className="w-28 text-right font-sans text-body text-inkMuted tabular-nums">
                    {k.ordersToday} ped.
                  </span>
                  <span className="w-32 text-right font-mono text-body text-ink tabular-nums">
                    {fmtBRL(k.grossTodayCents!)}
                  </span>
                </li>
              ))}
          </ol>
        </section>
      )}
    </>
  );
}

interface NumeroProps {
  rotulo: string;
  valor: string;
  sub?: string;
}

function NumeroGrande({ rotulo, valor, sub }: NumeroProps) {
  return (
    <div>
      <p className="font-mono text-label uppercase tracking-wider text-inkDim mb-2">{rotulo}</p>
      <div className="flex items-baseline gap-2 flex-wrap">
        <p className="font-display text-[44px] leading-none text-ink tabular-nums">{valor}</p>
        {sub && <span className="font-mono text-body text-inkMuted">{sub}</span>}
      </div>
    </div>
  );
}

interface AtencoesProps {
  precisamLimpar: number;
  pausadas: number;
  diaDeFechamento: number | null;
  unico: boolean;
}

/**
 * Só entra aqui o que sai de dado real e tem ação do outro lado.
 *
 * A versão mockada listava coisas que o servidor não sabe responder ("Lou
 * Burger atrasando", "solicitação esperando aprovação"). Alerta que não pode
 * ser verificado é pior que ausência de alerta: ensina o dono a ignorar a
 * seção.
 */
function Atencoes({ precisamLimpar, pausadas, diaDeFechamento, unico }: AtencoesProps) {
  const itens: Array<{ tom: string; titulo: string; detalhe: string; href: string }> = [];

  if (precisamLimpar > 0) {
    itens.push({
      tom: 'border-l-warn',
      titulo: `${precisamLimpar} mesa${precisamLimpar > 1 ? 's' : ''} esperando limpeza`,
      detalhe: 'Mesa suja não recebe cliente novo.',
      href: '/mesas',
    });
  }

  if (!unico && pausadas > 0) {
    itens.push({
      tom: 'border-l-primary',
      titulo: `${pausadas} cozinha${pausadas > 1 ? 's' : ''} pausada${pausadas > 1 ? 's' : ''}`,
      detalhe: 'Não aparece pro cliente enquanto estiver assim.',
      href: '/restaurantes',
    });
  }

  if (diaDeFechamento !== null) {
    const hoje = new Date();
    const diasAteFechar = diasAte(hoje, diaDeFechamento);
    if (diasAteFechar <= 7) {
      itens.push({
        tom: 'border-l-accent',
        titulo:
          diasAteFechar === 0
            ? 'O ciclo fecha hoje'
            : `O ciclo fecha em ${diasAteFechar} dia${diasAteFechar > 1 ? 's' : ''}`,
        detalhe: 'Depois de fechado, os valores congelam e não recalculam.',
        href: '/financeiro',
      });
    }
  }

  if (itens.length === 0) {
    return (
      <p className="mt-4 font-sans text-body-lg text-inkMuted">
        Nada pedindo atenção agora.
      </p>
    );
  }

  return (
    <ul className="mt-4 space-y-3">
      {itens.map((f) => (
        <li key={f.titulo}>
          <Link
            to={f.href}
            className="block no-underline hover:bg-surface rounded-r-md -mx-2 px-2
                       transition-colors duration-base ease-out"
          >
            <div className={`border-l-2 ${f.tom} pl-4 py-1`}>
              <p className="font-sans text-body-lg text-ink leading-tight">{f.titulo}</p>
              <p className="mt-0.5 font-sans text-body text-inkMuted">{f.detalhe}</p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Dias até o próximo dia `alvo` do mês. Zero se for hoje. */
function diasAte(hoje: Date, alvo: number): number {
  const dia = hoje.getDate();
  if (dia === alvo) return 0;
  if (dia < alvo) return alvo - dia;
  // Já passou neste mês: conta até o do mês que vem.
  const ultimoDoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  return ultimoDoMes - dia + alvo;
}
