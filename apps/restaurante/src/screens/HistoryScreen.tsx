import { useState } from 'react';
import { Chip, Divider } from '@mq/design-system';
import { mensagemDeErro, type HistoricoPedido } from '@mq/shared';
import { useHistorico } from '../api/hooks';
import { ScreenError } from '../components/ScreenError';
import { fmtBRL, fmtHora } from '../lib/formato';

const JANELAS = [
  { dias: 1, label: 'hoje' },
  { dias: 7, label: '7 dias' },
  { dias: 30, label: '30 dias' },
];

/**
 * O que já saiu da fila.
 *
 * Pedido em andamento NÃO aparece aqui — ele está na fila, e vê-lo nos dois
 * lugares atrapalha quem está conferindo o dia. Quem decide isso é o servidor;
 * a tela só desenha o que chegou.
 */
export function HistoryScreen() {
  const [dias, setDias] = useState(1);
  const q = useHistorico(dias);

  const titulo = () => {
    if (!q.data) return 'Carregando…';
    const n = q.data.totais.entregues;
    return `${n} ${n === 1 ? 'pedido entregue' : 'pedidos entregues'}.`;
  };

  return (
    <main className="px-5 pb-28">
      <section className="pt-6">
        <p className="font-mono text-mono-sm uppercase tracking-wider text-inkDim">
          {dias === 1 ? 'Hoje' : `Últimos ${dias} dias`}
        </p>
        <h1 className="mt-1 font-display text-display-lg italic text-ink leading-tight text-pretty">
          {titulo()}
        </h1>

        <div className="mt-4 flex gap-2">
          {JANELAS.map((j) => (
            <button
              key={j.dias}
              type="button"
              onClick={() => setDias(j.dias)}
              className={[
                'min-h-11 px-3 rounded-md border font-mono text-mono-sm uppercase tracking-wider',
                'cursor-pointer transition-colors duration-base ease-out',
                dias === j.dias
                  ? 'border-primary bg-primary text-inkInverse'
                  : 'border-hairline text-inkDim',
              ].join(' ')}
            >
              {j.label}
            </button>
          ))}
        </div>

        {q.data && (
          <>
            <div className="mt-5 grid grid-cols-2 gap-4">
              <Stat rotulo="Receita" valor={fmtBRL(q.data.totais.receitaCents)} />
              <Stat rotulo="Ticket médio" valor={fmtBRL(q.data.totais.ticketMedioCents)} />
            </div>
            {q.data.totais.cancelados > 0 && (
              <p className="mt-4 font-mono text-mono-sm text-inkDim">
                {q.data.totais.cancelados} cancelado
                {q.data.totais.cancelados === 1 ? '' : 's'}
              </p>
            )}
          </>
        )}
      </section>

      <div className="mt-8">
        <Divider label="Todos os pedidos" />
      </div>

      {q.isLoading && (
        <p className="py-10 text-center font-sans text-body text-inkDim">Carregando…</p>
      )}
      {q.isError && (
        <ScreenError
          title="Nao consegui carregar o historico."
          body={mensagemDeErro(q.error, 'O servidor nao respondeu.')}
          onRetry={() => q.refetch()}
        />
      )}

      {q.data && (
        <ul className="mt-2 divide-y divide-hairlineSoft">
          {q.data.pedidos.map((p) => (
            <li key={p.id}>
              <Linha pedido={p} />
            </li>
          ))}
          {q.data.pedidos.length === 0 && (
            <li className="py-10 text-center font-sans text-body text-inkDim">
              {dias === 1 ? 'Sem pedidos fechados ainda hoje.' : 'Nada nesse período.'}
            </li>
          )}
        </ul>
      )}
    </main>
  );
}

function Stat({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <p className="font-mono text-label uppercase tracking-wider text-inkDim">{rotulo}</p>
      <p className="mt-1 font-mono text-mono-lg text-ink tabular-nums">{valor}</p>
    </div>
  );
}

function Linha({ pedido }: { pedido: HistoricoPedido }) {
  const cancelado = pedido.status === 'cancelado';

  return (
    <div className="py-4 flex items-start gap-4">
      <div className="shrink-0 w-14">
        <p className="font-mono text-mono text-inkDim tabular-nums">{fmtHora(pedido.fechadoEm)}</p>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="font-mono text-mono text-inkDim">#{pedido.shortId}</span>
          <span className="font-sans text-body text-ink">
            Mesa {String(pedido.mesaNumero).padStart(2, '0')}
          </span>
        </div>
        <p className="font-sans text-body-sm text-inkDim">
          {pedido.itens.map((i, n) => (
            <span key={n}>
              {n > 0 && ' · '}
              {/* Item cancelado dentro de um pedido entregue fica riscado: sem
                  isso o histórico mostraria comida que não saiu. */}
              <span className={i.status === 'cancelado' ? 'line-through' : ''}>
                {i.qty}× {i.name}
              </span>
            </span>
          ))}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p className="font-mono text-body text-ink">{fmtBRL(pedido.totalCents)}</p>
        <Chip tone={cancelado ? 'danger' : 'accent'} className="mt-1">
          {cancelado ? 'cancelado' : 'entregue'}
        </Chip>
      </div>
    </div>
  );
}
