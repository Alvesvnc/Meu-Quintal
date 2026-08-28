import { useState } from 'react';
import { Button, Chip, useAgora, useMinutosDesde } from '@mq/design-system';
import { BellRing, ChevronRight, Clock, ShoppingBasket } from 'lucide-react';
import { estadoDaProposta } from '../lib/escalonamento';
import type { FilaOrder, OrderItemStatus } from '@mq/shared';
import { useAccept, useReady, useDelivered, useCancel } from '../api/hooks';
import { PropormAlteracaoSheet } from '../screens/PropormAlteracaoSheet';
import { CancelarPedidoSheet } from '../screens/CancelarPedidoSheet';
import { fmtHora } from '../lib/formato';

interface OrderCardProps {
  order: FilaOrder;
}

/**
 * Card de pedido na fila.
 *
 * O número da MESA virou um tile de 54×54 preenchido, e não mais texto numa
 * linha de cabeçalho: quem monta o prato lê esse número de pé, a um metro da
 * tela, com as mãos ocupadas. É a única informação do card que precisa ser
 * legível sem foco — atrasado, o tile fica vermelho e o card ganha contorno da
 * mesma cor.
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

  // Passado tempo demais sem resposta, para de esperar o celular: alguem vai
  // ate a mesa. Ver lib/escalonamento.ts — no iOS nao ha notificacao que
  // resolva isso, entao o caminho confiavel e humano.
  const semResposta =
    aguardando !== null && estadoDaProposta(aguardando.createdAt, agora) === 'ir-na-mesa';

  // Alterar so ate `preparando`: depois do `pronto` a comida ja existe, e
  // propor reduzir vira desperdicio. O servidor recusa item por item (ver
  // ALTERAVEIS em server/src/lib/alteracao.ts); aqui e so pra nao oferecer um
  // botao que so daria erro.
  //
  // `order.status` e o status AGREGADO, que e o mais atrasado dos itens ativos
  // — entao um pedido com um item pronto e outro ainda preparando continua
  // aparecendo como `preparando`, e o botao segue disponivel. Correto: ainda
  // ha o que alterar.
  const podeAlterar = order.status === 'novo' || order.status === 'preparando';

  // Cronometro que anda de verdade. Date.now() no corpo do render deixava o
  // numero congelado ate outra coisa causar re-render — ver useAgora.
  const startedAt = order.acceptedAt ?? order.createdAt;
  const elapsedMin = useMinutosDesde(startedAt) ?? 0;
  const createdMin = useMinutosDesde(order.createdAt) ?? 0;

  const isPending = accept.isPending || ready.isPending || delivered.isPending || cancel.isPending;

  const handleAdvance = () => {
    if (order.status === 'novo') accept.mutate(order.id);
    else if (order.status === 'preparando') ready.mutate(order.id);
    else if (order.status === 'pronto') delivered.mutate(order.id);
  };

  /** Rótulo e ícone da ação primária. O ícone diz o que acontece depois. */
  const CTA: Partial<Record<OrderItemStatus, { label: string; icone: typeof ChevronRight }>> = {
    novo: { label: 'Aceitar pedido', icone: ChevronRight },
    preparando: { label: 'Marcar pronto', icone: BellRing },
    pronto: { label: 'Entregue', icone: ShoppingBasket },
  };
  const cta = CTA[order.status] ?? null;
  const IconeCta = cta?.icone;

  const tempoLabel = (() => {
    if (order.status === 'novo') return `há ${createdMin} min`;
    if (order.status === 'preparando') return `preparando há ${elapsedMin} min`;
    if (order.status === 'pronto' && order.readyAt) return `pronto às ${fmtHora(order.readyAt)}`;
    return '';
  })();

  const atrasado = order.isLate;
  const mesa = String(order.mesaNumero).padStart(2, '0');

  return (
    <article
      className={[
        'border-rule p-4 flex flex-col gap-3',
        atrasado ? 'border-accent' : 'border-divider',
      ].join(' ')}
    >
      {/* ── Cabeçalho: tile da mesa + identificação + status ────────────── */}
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className={[
            'w-[54px] h-[54px] shrink-0 inline-flex items-center justify-center',
            'font-display text-[22px] font-bold tabular',
            atrasado ? 'bg-accent text-bg' : 'bg-neutral-900 text-bg',
          ].join(' ')}
        >
          {mesa}
        </span>

        <div className="min-w-0 flex flex-col gap-0.5">
          <span className="font-display text-body-lg font-bold uppercase text-ink truncate">
            Mesa {mesa}
            {/*
              O nome vem DEPOIS da mesa e em cinza: quem entrega procura a mesa
              primeiro, e o nome so desempata quando ha mais de uma pessoa nela.
              Invertido, o olho pararia no nome e teria que voltar pra achar
              aonde ir.
            */}
            {order.nomeCliente && <span className="text-neutral-700"> · {order.nomeCliente}</span>}
          </span>
          <span
            className={[
              'flex items-center gap-1.5 text-meta tabular',
              atrasado ? 'text-accent-700' : 'text-neutral-600',
            ].join(' ')}
          >
            <Clock size={12} strokeWidth={2} aria-hidden className="shrink-0" />#{order.shortId}
            {tempoLabel && ` · ${tempoLabel}`}
          </span>
        </div>

        <span className="ml-auto shrink-0 flex items-center gap-2">
          {order.paymentRequestedAt && <Chip tone="tint">Fechou conta</Chip>}
          {atrasado ? (
            <Chip tone="solid">Atrasado</Chip>
          ) : order.status === 'novo' ? (
            <Chip tone="outline">Novo</Chip>
          ) : null}
        </span>
      </div>

      {/* ── Proposta pendente ──────────────────────────────────────────── */}
      {aguardando && (
        <div
          className={[
            'border border-accent p-3 flex flex-col gap-2',
            semResposta ? 'bg-accent-200' : 'bg-accent-100',
          ].join(' ')}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-display text-label font-bold uppercase text-accent-800">
              {/* O aviso diz O QUE FAZER, nao o que aconteceu. "Sem resposta"
                  sozinho deixaria a pessoa olhando pro card sem saber que a
                  acao agora e dela. */}
              {semResposta ? `Vá até a mesa ${mesa}` : 'Aguardando o cliente'}
            </span>
            <span className="font-display text-body-lg font-bold text-accent-700 tabular shrink-0">
              {minutosRestantes}:{String(segundosRestantes).padStart(2, '0')}
            </span>
          </div>

          {aguardando.linhas.map((l) => (
            <p key={l.orderItemId} className="text-body-sm text-accent-800 tabular">
              {l.name}: <s>{l.qtyAnterior}×</s> →{' '}
              <strong>{l.qtyProposta === 0 ? 'cancelar' : `${l.qtyProposta}×`}</strong>
            </p>
          ))}

          <p className="text-label text-accent-800 opacity-80 normal-case tracking-normal">
            {semResposta
              ? 'O celular não respondeu. Pergunte na mesa e peça pra pessoa abrir o app e responder — o prazo continua correndo.'
              : `Sem resposta até 0:00, ${
                  aguardando.linhas.length === 1 ? 'o item sai' : 'os itens saem'
                } do pedido.`}
          </p>
        </div>
      )}

      {/* ── Itens ──────────────────────────────────────────────────────── */}
      <ul className="border-y border-divider py-3 flex flex-col gap-2">
        {order.items.map((it) => {
          // Item cancelado precisa estar visivelmente riscado. Sem marca, o
          // operador prepara comida que ninguem vai buscar.
          const cancelado = it.status === 'cancelado';
          return (
            <li key={it.id} className={cancelado ? 'opacity-60' : ''}>
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="min-w-[30px] h-[30px] shrink-0 inline-flex items-center justify-center
                             border border-divider px-1
                             font-display text-body-sm font-bold text-ink tabular"
                >
                  {it.qty}×
                </span>
                <span
                  className={[
                    'text-body-lg font-medium text-ink flex-1 min-w-0',
                    cancelado ? 'line-through' : '',
                  ].join(' ')}
                >
                  {it.name}
                </span>
                {cancelado && (
                  <span className="shrink-0">
                    <Chip tone="neutral">Cancelado</Chip>
                  </span>
                )}
              </div>

              {it.note && !cancelado && (
                <div className="mt-1 ml-[38px] flex items-center gap-2 bg-accent-100 px-3 py-2">
                  <span className="font-display text-label-sm font-bold uppercase text-accent-800 shrink-0">
                    Obs
                  </span>
                  <span className="text-body-sm text-accent-800">{it.note}</span>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* ── Ação primária + secundárias ────────────────────────────────── */}
      {cta && (
        <div className="flex flex-col gap-3">
          <Button
            variant="primary"
            size="xl"
            fullWidth
            loading={isPending}
            disabled={isPending}
            onClick={handleAdvance}
          >
            <span>{cta.label}</span>
            {IconeCta && !isPending && (
              <IconeCta size={18} strokeWidth={2} aria-hidden className="ml-auto" />
            )}
          </Button>

          <div className="flex items-center gap-6">
            {/*
              Alterar vem ANTES de cancelar, e nao so por ordem de leitura:
              reduzir "2 para 1" resolve a falta de ingrediente sem o cliente
              perder o pedido inteiro. Cancelar tudo e a saida de ultimo caso.
            */}
            {/*
              Enquanto ha proposta aberta o botao some: o servidor recusaria
              com 409, e mostrar um botao que so da erro e pior que nao mostrar.
            */}
            {!aguardando && podeAlterar && (
              <button
                type="button"
                onClick={() => setProporAlteracao(true)}
                className="font-display text-label font-bold uppercase text-neutral-600
                           cursor-pointer hover:text-accent transition-colors duration-base ease-out"
              >
                Alterar itens
              </button>
            )}

            {order.status === 'novo' && (
              <button
                type="button"
                onClick={() => setConfirmCancel(true)}
                className="font-display text-label font-bold uppercase text-neutral-600
                           cursor-pointer hover:text-accent transition-colors duration-base ease-out"
              >
                Cancelar
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
