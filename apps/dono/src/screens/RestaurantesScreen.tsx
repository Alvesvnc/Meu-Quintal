import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Chip, Divider } from '@mq/design-system';
import type { CozinhaResumo } from '@mq/shared';
import { useCozinhas } from '../api/hooks';
import { Carregando, ErroDaTela, Vazio } from '../components/Estado';
import { fmtBRL } from '../lib/formato';

type Coluna = 'name' | 'grossTodayCents';
type Direcao = 'asc' | 'desc';

/**
 * As cozinhas do quintal e o acordo de cada uma.
 *
 * ─── É UMA TELA DE CONFIGURAÇÃO, NÃO DE ACOMPANHAMENTO ──────────────────────
 *
 * Quantos pedidos a cozinha tirou hoje e quanto ela vendeu são **informação
 * dela**, não do dono do espaço. O dono aluga o ponto e cobra comissão; como a
 * cozinha foi no almoço de hoje não muda nada disso, e não é dele para
 * consultar.
 *
 * O que ele cobra continua visível onde tem uso: o bruto do **ciclo** aparece
 * no Financeiro, quando o acordo tem comissão — ali o número é a base da conta.
 *
 * A exceção é a cozinha que o próprio usuário opera (restaurante único, ou
 * dono de praça que também toca uma casinha): aí o dia aparece, porque o caixa
 * é dele. Quem decide é a API — a tela só desenha o que chegou.
 */
export function RestaurantesScreen() {
  const q = useCozinhas();
  const [coluna, setColuna] = useState<Coluna>('name');
  const [direcao, setDirecao] = useState<Direcao>('asc');
  const [mostrarInativas, setMostrarInativas] = useState(true);

  // Se alguma linha traz o dia, é porque o usuário opera aquela cozinha.
  const mostraOperacao = (q.data ?? []).some((k) => k.grossTodayCents !== null);

  const linhas = useMemo(() => {
    const base = (q.data ?? []).filter((k) => mostrarInativas || k.status === 'ativa');
    return [...base].sort((a, b) => {
      if (coluna === 'grossTodayCents') {
        // Oculto nunca compete por posição: vai sempre para o fim, nas duas
        // direções. Tratá-lo como 0 diria "vendeu menos que todo mundo".
        const av = a.grossTodayCents;
        const bv = b.grossTodayCents;
        if (av !== null || bv !== null) {
          if (av === null) return 1;
          if (bv === null) return -1;
          const cmp = av - bv;
          return direcao === 'asc' ? cmp : -cmp;
        }
      }
      const cmp = a.name.localeCompare(b.name);
      return direcao === 'asc' ? cmp : -cmp;
    });
  }, [q.data, coluna, direcao, mostrarInativas]);

  const ordenarPor = (c: Coluna) => {
    if (coluna === c) setDirecao((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setColuna(c);
      setDirecao(c === 'name' ? 'asc' : 'desc');
    }
  };

  if (q.isLoading) return <Carregando o="as cozinhas" />;
  if (q.isError) return <ErroDaTela erro={q.error} aoTentar={() => q.refetch()} />;

  const ativas = (q.data ?? []).filter((k) => k.status === 'ativa').length;

  return (
    <>
      <header className="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="font-mono text-label uppercase tracking-wider text-inkDim mb-1">
            Configurar · cozinhas
          </p>
          <h1 className="font-display italic text-display-xl text-ink leading-tight">
            {ativas} cozinha{ativas === 1 ? '' : 's'} ativa{ativas === 1 ? '' : 's'}.
          </h1>
        </div>
        <Link to="/restaurantes/novo" className="self-start md:self-auto">
          <Button variant="primary" size="md">
            + Adicionar cozinha
          </Button>
        </Link>
      </header>

      <div className="mb-4 flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={mostrarInativas}
            onChange={(e) => setMostrarInativas(e.target.checked)}
            className="w-4 h-4 accent-primary cursor-pointer"
          />
          <span className="font-sans text-body-sm text-inkMuted">Mostrar pausadas</span>
        </label>
      </div>

      <Divider />

      {linhas.length === 0 ? (
        <Vazio>Nenhuma cozinha ainda. Comece convidando a primeira.</Vazio>
      ) : (
        <>
          <div className="overflow-x-auto -mx-4 md:mx-0">
            <div className="min-w-[560px] md:min-w-0 px-4 md:px-0">
              <table className="w-full mt-2 text-left">
                <thead>
                  <tr className="border-b border-hairline">
                    <Th>
                      <Ordenavel
                        rotulo="Nome"
                        ativo={coluna === 'name'}
                        direcao={direcao}
                        onClick={() => ordenarPor('name')}
                      />
                    </Th>
                    <Th>Categoria</Th>
                    {mostraOperacao && (
                      <Th className="text-right">
                        <Ordenavel
                          rotulo="Vendeu hoje"
                          ativo={coluna === 'grossTodayCents'}
                          direcao={direcao}
                          onClick={() => ordenarPor('grossTodayCents')}
                        />
                      </Th>
                    )}
                    <Th className="text-right">Acordo</Th>
                    <Th className="text-right">Status</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairlineSoft">
                  {linhas.map((k) => (
                    <Linha key={k.id} cozinha={k} mostraOperacao={mostraOperacao} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {!mostraOperacao && (
            <p className="mt-6 font-sans text-body-sm text-inkMuted border-l-2 border-l-hairline pl-3">
              Quanto cada cozinha vendeu é informação dela. O que você tem a receber — comissão e
              aluguel — está em{' '}
              <Link to="/financeiro" className="text-primary no-underline hover:text-ink">
                Cobranças &amp; receita
              </Link>
              .
            </p>
          )}
        </>
      )}
    </>
  );
}

function Linha({ cozinha, mostraOperacao }: { cozinha: CozinhaResumo; mostraOperacao: boolean }) {
  const { acordo } = cozinha;
  const termos = [
    acordo.chargeCommission ? `${acordo.commissionPctEfetivo}%` : null,
    acordo.chargeRent ? fmtBRL(acordo.rentCents) : null,
  ].filter(Boolean);

  return (
    <tr className="h-12 hover:bg-surface transition-colors duration-base ease-out">
      <td className="pr-4">
        <Link
          to={`/restaurantes/${cozinha.slug}`}
          className="font-display text-body-lg text-ink no-underline hover:text-primary
                     transition-colors duration-base ease-out"
        >
          {cozinha.name}
        </Link>
      </td>
      <td className="pr-4 font-sans text-body text-inkMuted">{cozinha.category ?? '—'}</td>
      {mostraOperacao && (
        <td className="pr-4 text-right font-mono text-body text-ink tabular-nums">
          {cozinha.grossTodayCents === null ? (
            <span className="text-inkDim" title="O movimento desta cozinha é informação dela">
              —
            </span>
          ) : (
            fmtBRL(cozinha.grossTodayCents)
          )}
        </td>
      )}
      <td className="pr-4 text-right font-mono text-mono-sm text-inkMuted">
        {termos.length > 0 ? termos.join(' + ') : <span className="text-inkDim">nada</span>}
      </td>
      <td className="text-right">
        <Chip tone={cozinha.status === 'ativa' ? 'accent' : 'warn'}>{cozinha.status}</Chip>
      </td>
    </tr>
  );
}

function Ordenavel({
  rotulo,
  ativo,
  direcao,
  onClick,
}: {
  rotulo: string;
  ativo: boolean;
  direcao: Direcao;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'cursor-pointer transition-colors duration-base ease-out',
        ativo ? 'text-ink' : 'hover:text-ink',
      ].join(' ')}
    >
      {rotulo}
      {ativo && <span aria-hidden> {direcao === 'asc' ? '↑' : '↓'}</span>}
    </button>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`py-2 pr-4 font-mono text-label uppercase tracking-wider text-inkDim font-medium ${className}`}
    >
      {children}
    </th>
  );
}
