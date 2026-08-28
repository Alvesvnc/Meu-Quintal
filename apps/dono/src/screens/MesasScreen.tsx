import { useState } from 'react';
import { Button, Chip, Divider } from '@mq/design-system';
import { mensagemDeErro, type MesaDesempenho, type MesaResumo } from '@mq/shared';
import { useMesas, useMudarStatusMesa, useDesempenhoMesas } from '../api/hooks';
import { Carregando, ErroDaTela, Vazio } from '../components/Estado';
import { fmtBRL, fmtRefMonth, refMonthAtual } from '../lib/formato';

const ROTULO: Record<MesaResumo['status'], string> = {
  livre: 'livre',
  ocupada: 'ocupada',
  'precisa-limpar': 'limpar',
};

/**
 * O salão: quem está ocupada agora, e quanto cada mesa rendeu no mês.
 *
 * As duas perguntas moram na mesma tela porque são a mesma imagem mental — o
 * desenho do salão. O valor do mês vai em cima do número da mesa, então o
 * ranking se lê **olhando o layout**, sem tabela: dá pra ver que o canto da
 * janela rende e o fundo não.
 *
 * A comparação com a média fica no painel lateral, ao clicar. É o número que
 * informa decisão ("essa mesa rende 34% acima"), mas ocupa espaço demais para
 * caber em dezesseis quadradinhos.
 *
 * O `qrToken` NÃO aparece aqui, e a API nem o devolve: é a credencial da mesa.
 * Quem tem o token abre a mesa. A versão mockada desta tela exibia o token num
 * painel lateral.
 */
export function MesasScreen() {
  const salao = useMesas();
  const mes = useDesempenhoMesas();
  const [selecionada, setSelecionada] = useState<number | null>(null);

  if (salao.isLoading) return <Carregando o="as mesas" />;
  if (salao.isError) return <ErroDaTela erro={salao.error} aoTentar={() => salao.refetch()} />;
  if (!salao.data) return null;

  const ativas = salao.data.filter((m) => m.isActive);
  const livres = ativas.filter((m) => m.status === 'livre').length;
  const ocupadas = ativas.filter((m) => m.status === 'ocupada').length;
  const limpar = ativas.filter((m) => m.status === 'precisa-limpar').length;

  const desempenhoDe = (id: string): MesaDesempenho | undefined =>
    mes.data?.mesas.find((d) => d.id === id);

  const mesa = selecionada != null ? salao.data.find((m) => m.numero === selecionada) : null;

  return (
    <>
      <header className="mb-6">
        <p className="font-mono text-label uppercase tracking-wider text-inkDim mb-1">
          Diário · mesas
        </p>
        <h1 className="font-display text-display-xl text-ink leading-tight">
          {ocupadas} ocupadas, {livres} livres.
        </h1>
        {limpar > 0 && (
          <p className="mt-2 font-sans text-body text-warn">
            {limpar} mesa{limpar > 1 ? 's' : ''} esperando limpeza.
          </p>
        )}
      </header>

      {salao.data.length === 0 ? (
        <Vazio>Nenhuma mesa cadastrada ainda.</Vazio>
      ) : (
        <div className="flex flex-col md:flex-row gap-8">
          <div className="flex-1 min-w-0">
            <Divider
              label={
                mes.data
                  ? `Layout do quintal · valores de ${fmtRefMonth(mes.data.refMonth)}`
                  : 'Layout do quintal'
              }
            />

            {/*
              Tres colunas no celular, quatro a partir do sm. Cada celula e um
              quadrado com o valor do mes dentro: com quatro colunas num
              aparelho de 320px sobram ~70px por celula, e o valor nao cabe.
              O teto de 440px mantem o desenho do salao compacto na tela grande.
            */}
            <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 gap-3 max-w-[440px]">
              {salao.data.map((m) => (
                <Celula
                  key={m.id}
                  mesa={m}
                  noMes={desempenhoDe(m.id)}
                  selecionada={selecionada === m.numero}
                  onClick={() => setSelecionada(m.numero)}
                />
              ))}
            </div>

            <div className="mt-6 flex items-center gap-4 flex-wrap">
              <Legenda tom="accent" rotulo="livre" />
              <Legenda tom="primary" rotulo="ocupada" />
              <Legenda tom="warn" rotulo="precisa limpar" />
            </div>

            {mes.data && (
              <>
                <p className="mt-6 font-sans text-body text-inkMuted">
                  Média por mesa no mês:{' '}
                  <strong className="text-ink font-medium">
                    {fmtBRL(mes.data.media.grossCents)}
                  </strong>
                  {mes.data.media.mesasNaBase > 0 && (
                    <span className="text-inkDim">
                      {' '}
                      · sobre {mes.data.media.mesasNaBase} mesa
                      {mes.data.media.mesasNaBase === 1 ? '' : 's'} que existia
                      {mes.data.media.mesasNaBase === 1 ? '' : 'm'} o mês inteiro
                    </span>
                  )}
                </p>
              </>
            )}
          </div>

          <aside
            className="w-full md:w-80 shrink-0 md:border-l border-t md:border-t-0 border-hairline
                       pt-6 md:pt-0 md:pl-8 min-h-[320px]"
          >
            {mesa ? (
              <Painel
                mesa={mesa}
                noMes={desempenhoDe(mesa.id)}
                refMonth={mes.data?.refMonth ?? refMonthAtual()}
                onFechar={() => setSelecionada(null)}
              />
            ) : (
              <Vazio>Selecione uma mesa pra ver detalhes.</Vazio>
            )}
          </aside>
        </div>
      )}
    </>
  );
}

interface CelulaProps {
  mesa: MesaResumo;
  noMes?: MesaDesempenho;
  selecionada: boolean;
  onClick: () => void;
}

function Celula({ mesa, noMes, selecionada, onClick }: CelulaProps) {
  const tom = !mesa.isActive
    ? 'bg-surface border-hairline text-inkDim'
    : {
        livre: 'bg-accentWash border-accent/30 text-ink hover:border-accent',
        ocupada: 'bg-primaryWash border-primary/30 text-ink hover:border-primary',
        'precisa-limpar': 'bg-warn/10 border-warn/30 text-ink hover:border-warn',
      }[mesa.status];

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'aspect-square border-2 cursor-pointer',
        'flex flex-col items-center justify-center gap-0.5 px-1',
        'transition-colors duration-base ease-out',
        tom,
        selecionada ? 'ring-2 ring-primary ring-offset-2 ring-offset-bg' : '',
      ].join(' ')}
    >
      {/* O valor do mês vem PRIMEIRO: é o que se compara batendo o olho no
          salão inteiro. O número da mesa só identifica. */}
      {noMes && (
        <span
          className={[
            'font-mono text-mono tabular-nums leading-none',
            noMes.grossCents > 0 ? 'text-ink' : 'text-inkDim',
          ].join(' ')}
        >
          {fmtBRL(noMes.grossCents)}
        </span>
      )}
      <span className="font-mono text-mono-lg tabular-nums leading-none">
        {String(mesa.numero).padStart(2, '0')}
      </span>
      {mesa.ordersToday > 0 && (
        <span className="font-mono text-mono-sm text-inkDim leading-none">
          {mesa.ordersToday} hoje
        </span>
      )}
    </button>
  );
}

function Legenda({ tom, rotulo }: { tom: 'accent' | 'primary' | 'warn'; rotulo: string }) {
  const cls = { accent: 'bg-accent', primary: 'bg-primary', warn: 'bg-warn' }[tom];
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`w-2.5 h-2.5 ${cls}`} aria-hidden />
      <span className="font-mono text-mono-sm uppercase tracking-wider text-inkDim">{rotulo}</span>
    </span>
  );
}

interface PainelProps {
  mesa: MesaResumo;
  noMes?: MesaDesempenho;
  refMonth: string;
  onFechar: () => void;
}

function Painel({ mesa, noMes, refMonth, onFechar }: PainelProps) {
  const mudar = useMudarStatusMesa();
  const erro = mudar.error ? mensagemDeErro(mudar.error, 'Nao consegui mudar o status.') : null;
  const tom = mesa.status === 'livre' ? 'accent' : mesa.status === 'ocupada' ? 'primary' : 'warn';

  return (
    <>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="font-mono text-label uppercase tracking-wider text-inkDim">Mesa</p>
          <p className="font-display text-display-lg text-ink leading-none mt-1">
            {String(mesa.numero).padStart(2, '0')}
          </p>
        </div>
        <Chip tone={tom}>{ROTULO[mesa.status]}</Chip>
      </div>

      <Divider label={fmtRefMonth(refMonth)} />
      {noMes ? (
        <dl className="mt-4 space-y-3">
          <Linha rotulo="Rendeu no mês" valor={fmtBRL(noMes.grossCents)} />
          <Linha rotulo="Comparada à média" valor={<VsMedia pct={noMes.vsMediaPct} />} />
          {/* Giro: "12 pedidos em 9 dias" separa a mesa que trabalha todo dia
              da que pegou uma noite cheia. Mesmo valor, decisões diferentes. */}
          <Linha
            rotulo="Giro"
            valor={`${noMes.pedidos} ped. em ${noMes.diasComMovimento} dia${
              noMes.diasComMovimento === 1 ? '' : 's'
            }`}
          />
          <Linha rotulo="Ticket médio" valor={fmtBRL(noMes.ticketMedioCents)} />
        </dl>
      ) : (
        <p className="mt-4 font-sans text-body-sm text-inkMuted">Sem dados do mês.</p>
      )}

      {noMes?.novaNoPeriodo && (
        <p className="mt-3 font-sans text-body-sm text-inkDim">
          Cadastrada no meio do período — não teve o mês inteiro pra faturar, e por isso fica fora
          da média.
        </p>
      )}

      <div className="mt-6">
        <Divider label="Hoje" />
      </div>
      <dl className="mt-4 space-y-3">
        <Linha rotulo="Pedidos" valor={String(mesa.ordersToday)} />
        <Linha rotulo="Consumo" valor={fmtBRL(mesa.grossTodayCents)} />
      </dl>

      <div className="mt-6 space-y-2">
        {mesa.status !== 'livre' && (
          <Button
            variant="primary"
            size="md"
            fullWidth
            disabled={mudar.isPending}
            onClick={() => mudar.mutate({ numero: mesa.numero, status: 'livre' })}
          >
            {mudar.isPending ? 'Salvando…' : 'Marcar livre'}
          </Button>
        )}
        {mesa.status !== 'precisa-limpar' && (
          <Button
            variant="secondary"
            size="md"
            fullWidth
            disabled={mudar.isPending}
            onClick={() => mudar.mutate({ numero: mesa.numero, status: 'precisa-limpar' })}
          >
            Marcar pra limpar
          </Button>
        )}
      </div>

      {erro && <p className="mt-3 font-mono text-mono-sm text-danger">{erro}</p>}

      <button
        type="button"
        onClick={onFechar}
        className="mt-6 font-mono text-mono-sm uppercase tracking-wider text-inkDim
                   hover:text-ink cursor-pointer transition-colors duration-base ease-out"
      >
        Fechar
      </button>
    </>
  );
}

function VsMedia({ pct }: { pct: number | null }) {
  // Sem base de comparação não se escreve "0%": isso afirmaria "está na média",
  // e não há dado que sustente a afirmação.
  if (pct === null) return <span className="text-inkDim">sem base</span>;
  const acima = pct >= 0;
  return (
    <span className={acima ? 'text-accent' : 'text-inkMuted'}>
      {acima ? '↑' : '↓'} {Math.abs(pct)}%
    </span>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-hairlineSoft pb-2">
      <dt className="font-mono text-label uppercase tracking-wider text-inkDim">{rotulo}</dt>
      <dd className="font-mono text-body text-ink tabular-nums">{valor}</dd>
    </div>
  );
}
