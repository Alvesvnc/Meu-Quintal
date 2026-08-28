import { useState } from 'react';
import { Divider } from '@mq/design-system';
import { MOTIVO_LABEL, mensagemDeErro, type MetricasResponse } from '@mq/shared';
import { useMetricas, useMetricasCancelamento } from '../api/hooks';
import { fmtBRL } from '../lib/formato';

const JANELAS = [
  { dias: 7, label: '7 dias' },
  { dias: 30, label: '30 dias' },
];

/**
 * Como a cozinha está indo: carro-chefe, ticket médio, horário de pico e por
 * que ela cancela.
 *
 * Não é dashboard: são blocos verticais que respondem uma pergunta cada. Tudo
 * vem do servidor — a versão anterior calculava os três primeiros blocos em
 * cima de um array de pedidos mockado, então mostrava números inventados ao
 * lado do bloco de cancelamentos, que era real.
 */
export function MetricsScreen() {
  const [dias, setDias] = useState(7);
  const q = useMetricas(dias);

  return (
    <main className="w-full max-w-[720px] mx-auto px-5 sm:px-6 pb-28">
      <section className="pt-6">
        <p className="font-mono text-mono-sm uppercase tracking-wider text-inkDim">
          Últimos {dias} dias
        </p>
        <h1 className="mt-1 font-display text-display-lg text-ink leading-tight">
          Como você está indo.
        </h1>

        <div className="mt-4 flex gap-2">
          {JANELAS.map((j) => (
            <button
              key={j.dias}
              type="button"
              onClick={() => setDias(j.dias)}
              className={[
                'min-h-11 px-3 border font-mono text-mono-sm uppercase tracking-wider',
                'cursor-pointer transition-colors duration-base ease-out',
                dias === j.dias
                  ? 'border-primary bg-primary text-bg'
                  : 'border-hairline text-inkDim',
              ].join(' ')}
            >
              {j.label}
            </button>
          ))}
        </div>
      </section>

      {q.isLoading && <p className="mt-10 font-sans text-body text-inkMuted">Carregando…</p>}
      {q.isError && (
        <p className="mt-10 font-sans text-body text-danger">
          {mensagemDeErro(q.error, 'Nao consegui carregar as metricas.')}
        </p>
      )}
      {q.data && <Blocos dados={q.data} />}

      <BlocoCancelamentos />
    </main>
  );
}

function Blocos({ dados }: { dados: MetricasResponse }) {
  const semVenda = dados.pedidosCount === 0;

  if (semVenda) {
    return (
      <section className="mt-10">
        <p className="font-display text-display-md text-inkMuted text-pretty">
          Nenhum pedido no período. Os números aparecem sozinhos quando a cozinha rodar.
        </p>
      </section>
    );
  }

  return (
    <>
      <section className="mt-7">
        <Divider label="Carro-chefe" />
        <ol className="mt-2 divide-y divide-hairlineSoft">
          {dados.carroChefe.map((row, i) => (
            <li key={row.name} className="py-4 flex items-center gap-4">
              <span className="font-mono text-mono text-primary w-6 shrink-0 tabular-nums">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="font-sans text-body-lg text-ink flex-1 min-w-0">{row.name}</span>
              <span className="font-mono text-mono text-inkMuted tabular-nums shrink-0">
                {fmtBRL(row.receitaCents)}
              </span>
              <span className="font-mono text-mono text-ink tabular-nums shrink-0 w-12 text-right">
                {row.qty}×
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-8">
        <Divider label="Ticket médio" />
        <p className="mt-3 font-mono text-ink text-[40px] leading-none tabular-nums">
          {fmtBRL(dados.ticketMedioCents)}
        </p>
        <p className="mt-2 font-sans text-body-sm text-inkDim">
          {/* Por PEDIDO, não por linha: um pedido de R$ 30 em duas linhas tem
              ticket 30, não 15. */}
          {dados.pedidosCount} {dados.pedidosCount === 1 ? 'pedido' : 'pedidos'} ·{' '}
          {fmtBRL(dados.receitaCents)} no total
        </p>
      </section>

      <section className="mt-8">
        <Divider label="Horário de pico" />
        <BarrasPorHora porHora={dados.porHora} />
      </section>
    </>
  );
}

/**
 * Movimento por hora.
 *
 * A faixa é calculada a partir do que existe, não fixada em 11h–23h como na
 * versão anterior: cozinha de café da manhã e bar que vira a noite ficavam
 * fora do gráfico e apareciam como se não tivessem vendido nada.
 */
function BarrasPorHora({ porHora }: { porHora: MetricasResponse['porHora'] }) {
  if (porHora.length === 0) return null;

  const primeira = porHora[0].hora;
  const ultima = porHora[porHora.length - 1].hora;
  const porHoraMap = new Map(porHora.map((h) => [h.hora, h.pedidos]));
  const faixa = Array.from({ length: ultima - primeira + 1 }, (_, i) => primeira + i);
  const max = Math.max(...porHora.map((h) => h.pedidos), 1);

  return (
    <div className="mt-3 flex items-end gap-1 h-32">
      {faixa.map((hora) => {
        const v = porHoraMap.get(hora) ?? 0;
        const pico = v === max && v > 0;
        return (
          <div key={hora} className="flex-1 flex flex-col items-center gap-1.5">
            <div className="w-full flex-1 flex items-end">
              <div
                className={[
                  'w-full transition-all duration-base ease-out',
                  pico ? 'bg-primary' : 'bg-inkDim/40',
                ].join(' ')}
                style={{ height: v > 0 ? `${Math.max((v / max) * 100, 4)}%` : '2px' }}
              />
            </div>
            {(hora % 2 === 0 || pico) && (
              <span
                className={[
                  'font-mono text-mono-sm tabular-nums',
                  pico ? 'text-primary' : 'text-inkDim',
                ].join(' ')}
              >
                {hora}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Por que esta cozinha cancela.
 *
 * A pergunta que responde: "o que mais me faz cancelar?". Antes o motivo era
 * validado e descartado, então ninguém sabia.
 */
function BlocoCancelamentos() {
  const { data, isLoading, error } = useMetricasCancelamento(30);

  if (isLoading) {
    return (
      <section className="mt-12">
        <Divider label="Cancelamentos · 30 dias" />
        <p className="mt-4 font-sans text-body text-inkMuted">Carregando…</p>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="mt-12">
        <Divider label="Cancelamentos · 30 dias" />
        <p className="mt-4 font-sans text-body text-inkMuted">Não consegui carregar agora.</p>
      </section>
    );
  }

  if (data.totalItens === 0) {
    return (
      <section className="mt-12">
        <Divider label="Cancelamentos · 30 dias" />
        <p className="mt-4 font-display text-display-md text-ink">
          Nenhum cancelamento no período.
        </p>
        <p className="mt-1 font-sans text-body text-inkMuted">É o melhor número possível aqui.</p>
      </section>
    );
  }

  const maior = data.porMotivo[0]?.itens ?? 1;

  return (
    <section className="mt-12">
      <Divider label="Cancelamentos · 30 dias" />

      <p className="mt-4 font-display text-display-lg text-ink leading-none">
        {fmtBRL(data.perdaTotalCents)}
      </p>
      <p className="mt-1 font-sans text-body text-inkMuted">
        deixou de ser vendido em {data.totalItens} {data.totalItens === 1 ? 'item' : 'itens'}
      </p>

      {/*
        O total inclui REDUCAO aceita, nao so cancelamento cheio — reduzir de 3
        pra 1 perde duas unidades igual a cancelar perderia. Mas quem for
        conferir contando os cancelados na mao nao ia fechar a conta, e o numero
        pareceria errado. Entao a tela diz de onde vem a diferenca.
      */}
      {data.reducoes.itens > 0 && (
        <p className="mt-1 font-sans text-body-sm text-inkDim">
          inclui {data.reducoes.itens}{' '}
          {data.reducoes.itens === 1 ? 'unidade reduzida' : 'unidades reduzidas'} em pedidos que
          seguiram ({fmtBRL(data.reducoes.perdaCents)})
        </p>
      )}

      <ul className="mt-6 space-y-3">
        {data.porMotivo.map((m) => (
          <li key={m.motivo}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-sans text-body text-ink">{MOTIVO_LABEL[m.motivo]}</span>
              <span className="font-mono text-body text-inkMuted tabular-nums shrink-0">
                {m.itens} · {fmtBRL(m.perdaCents)}
              </span>
            </div>
            {/* Barra proporcional: a causa dominante salta aos olhos sem ler número */}
            <div className="mt-1 h-1.5 bg-neutral-300 overflow-hidden">
              <div
                className="h-full bg-primary"
                style={{ width: `${Math.max(2, (m.itens / maior) * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>

      {data.itensMaisCancelados.length > 0 && (
        <>
          <p className="mt-8 font-mono text-label uppercase tracking-wider text-inkDim">
            Itens que mais caem
          </p>
          <ul className="mt-2 divide-y divide-hairlineSoft">
            {data.itensMaisCancelados.map((i) => (
              <li key={i.name} className="py-2 flex items-baseline justify-between gap-3">
                <span className="font-sans text-body text-ink">{i.name}</span>
                <span className="font-mono text-body-sm text-inkMuted tabular-nums shrink-0">
                  {i.itens}× · {fmtBRL(i.perdaCents)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
