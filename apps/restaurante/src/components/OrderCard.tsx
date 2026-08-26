import { useState } from 'react';
import { Button, Chip, useAgora, useMinutosDesde } from '@mq/design-system';
import type { FilaOrder, OrderItemStatus } from '@mq/shared';
import { useAccept, useReady, useDelivered, useCancel } from '../api/hooks';
import { PropormAlteracaoSheet } from '../screens/PropormAlteracaoSheet';
import { CancelarPedidoSheet } from '../screens/CancelarPedidoSheet';

interface OrderCardProps {
  order: FilaOrder;
}

/**
 * Card de pedido na fila — usa FilaOrder do server (sem mais mock).
 * Cronômetro UP (sempre crescente). Atraso = border-left primary + chip ATRASADO.
 */
export function OrderCard({ order }: OrderCardProps) {
  const accept = useAccept();
  const ready = useReady();
  const delivered = useDelivered();
  const cancel = useCancel();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [proporAlteracao, setProporAlteracao] = useState(false);

  // Proposta desta cozinha esperando resposta. O contador precisa ANDAR: um
  // "4:59" congelado nao diz se ainda ha tempo.
  const aguardando = order.alteracaoAguardando;
  const agora = useAgora();
  const restantes = aguardando
    ? Math.max(0, Math.floor((new Date(aguardando.expiresAt).getTime() - agora) / 1000))
    : 0;
  const minutosRestantes = Math.floor(restantes / 60);
  const segundosRestantes = restantes % 60;

  // Cronometro que anda de verdade. Date.now() no corpo do render deixava o
  // numero congelado ate outra coisa causar re-render — ver useAgora.
  const startedAt = order.acceptedAt ?? order.createdAt;
  const elapsedMin = useMinutosDesde(startedAt) ?? 0;
  const createdMin = useMinutosDesde(order.createdAt) ?? 0;

  const CTA_LABEL: Partial<Record<OrderItemStatus, string>> = {
    novo:       'Aceitar',
    preparando: 'Pronto',
    pronto:     'Retirado',
  };
  const cta = CTA_LABEL[order.status] ?? null;

  const isPending =
    accept.isPending || ready.isPending || delivered.isPending || cancel.isPending;

  const handleAdvance = () => {
    if (order.status === 'novo')       accept.mutate(order.id);
    else if (order.status === 'preparando') ready.mutate(order.id);
    else if (order.status === 'pronto')     delivered.mutate(order.id);
  };

  const elapsedLabel = (() => {
    if (order.status === 'novo')       return `entrou há ${createdMin} min`;
    if (order.status === 'preparando') return `preparando há ${elapsedMin} min`;
    if (order.status === 'pronto' && order.readyAt) {
      return `pronto às ${fmtTime(order.readyAt)}`;
    }
    return '';
  })();

  const showLate = order.isLate;

  return (
    <article
      className={[
        'rounded-lg bg-surface p-5',
        showLate ? 'border-l-4 border-l-primary' : '',
        order.status === 'pronto'
          ? 'border border-primary'
          : 'border border-hairline',
      ].filter(Boolean).join(' ')}
    >
      {/* Header: #id + mesa + chips */}
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-mono text-inkDim">#{order.shortId}</span>
          <span className="font-display text-display-md text-ink leading-none">
            Mesa {String(order.mesaNumero).padStart(2, '0')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {order.paymentRequestedAt && (
            <Chip tone="primary">fechou conta</Chip>
          )}
          {showLate && <Chip tone="warn">atrasado</Chip>}
        </div>
      </div>

      <p className={[
        'font-mono text-mono mb-3',
        showLate ? 'text-primary' : 'text-inkDim',
      ].join(' ')}>
        {elapsedLabel}
      </p>

      {/* Itens (snapshot do nome do server) */}
      <ul className="border-t border-b border-hairline py-3 my-3 space-y-1.5">
        {aguardando && (
          <li className="mb-4 list-none rounded-md border border-primary bg-primaryWash px-4 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-mono text-mono-sm uppercase tracking-wider text-primaryDeep">
                Aguardando o cliente
              </span>
              <span className="font-mono text-mono-sm tabular-nums text-primaryDeep shrink-0">
                {minutosRestantes}:{String(segundosRestantes).padStart(2, '0')}
              </span>
            </div>

            <ul className="mt-2 space-y-1">
              {aguardando.linhas.map((l) => (
                <li key={l.orderItemId} className="font-sans text-body-sm text-primaryDeep">
                  {l.name}: <span className="line-through">{l.qtyAnterior}×</span>{' '}
                  {l.qtyProposta === 0 ? 'cancelar' : `${l.qtyProposta}×`}
                </li>
              ))}
            </ul>

            <p className="mt-2 font-sans text-body-sm text-primaryDeep/80">
              Sem resposta até lá,{' '}
              {aguardando.linhas.length === 1 ? 'o item é cancelado' : 'os itens são cancelados'}.
            </p>
          </li>
        )}

        {order.items.map((it) => {
          // Item cancelado precisa estar visivelmente riscado. Sem marca, o
          // operador prepara comida que ninguem vai buscar.
          const cancelado = it.status === 'cancelado';
          return (
            <li key={it.id}>
              <div className="flex items-baseline gap-3">
                <span
                  className={[
                    'font-mono text-body tabular-nums shrink-0',
                    cancelado ? 'text-inkDim' : 'text-ink',
                  ].join(' ')}
                >
                  {it.qty}×
                </span>
                <span
                  className={[
                    'font-sans text-body-lg flex-1',
                    cancelado ? 'text-inkDim line-through' : 'text-ink',
                  ].join(' ')}
                >
                  {it.name}
                </span>
                {cancelado && (
                  <span className="font-mono text-mono-sm uppercase tracking-wider text-danger shrink-0">
                    cancelado
                  </span>
                )}
              </div>
              {it.note && !cancelado && (
                <p className="ml-9 mt-0.5 font-sans text-body italic text-inkDim">
                  obs: {it.note}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      {/* Ação primária XL + cancelar discreto */}
      {cta && (
        <div className="mt-4">
          <Button
            variant="primary"
            size="xl"
            fullWidth
            loading={isPending}
            disabled={isPending}
            onClick={handleAdvance}
          >
            {cta}
          </Button>
          <div className="mt-3 flex items-center justify-center gap-5">
            {/*
              Alterar vem ANTES de cancelar, e nao so por ordem de leitura:
              reduzir "2 para 1" resolve a falta de ingrediente sem o cliente
              perder o pedido inteiro. Cancelar tudo e a saida de ultimo caso.
            */}
            {/*
              Enquanto ha proposta aberta o botao some: o servidor recusaria
              com 409, e mostrar um botao que so da erro e pior que nao mostrar.
            */}
            {!aguardando && (
              <button
                type="button"
                onClick={() => setProporAlteracao(true)}
                className="px-3 py-1 cursor-pointer
                           font-mono text-mono-sm uppercase tracking-wider text-inkDim
                           hover:text-primary transition-colors duration-base ease-out"
              >
                Alterar itens
              </button>
            )}

            {order.status === 'novo' && (
              <button
                type="button"
                onClick={() => setConfirmCancel(true)}
                className="px-3 py-1 cursor-pointer
                           font-mono text-mono-sm uppercase tracking-wider text-inkDim
                           hover:text-danger transition-colors duration-base ease-out"
              >
                Cancelar pedido
              </button>
            )}
          </div>
        </div>
      )}

      {proporAlteracao && (
        <PropormAlteracaoSheet order={order} onClose={() => setProporAlteracao(false)} />
      )}

      {confirmCancel && (
        <CancelarPedidoSheet order={order} onClose={() => setConfirmCancel(false)} />
      )}

    </article>
  );
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
