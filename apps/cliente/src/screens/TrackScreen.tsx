import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button, Chip, Pulso, useMinutosDesde } from '@mq/design-system';
import {
  BellRing,
  Check,
  Flame,
  ShoppingBasket,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import { mensagemDeErro, type OrderItemStatus, type OrderKitchenGroup } from '@mq/shared';
import { useOrder, useResponderAlteracao } from '../api/hooks';
import { AlteracaoSheet } from '../components/AlteracaoSheet';
import { TelaHeader } from '../components/TelaHeader';
import { Foto } from '../components/Foto';
import { ScreenError } from '../components/ScreenError';
import { fmtBRL, fmtTime } from '../lib/format';

const STATUS_LABEL: Record<OrderItemStatus, string> = {
  novo: 'Recebido',
  preparando: 'Preparando',
  pronto: 'Pronto',
  retirado: 'Retirado',
  cancelado: 'Cancelado',
};
/** As quatro etapas que a tela desenha. `cancelado` nao e etapa: e saida. */
const STATUS_FLOW = ['novo', 'preparando', 'pronto', 'retirado'] as const;
type EtapaStatus = (typeof STATUS_FLOW)[number];

/** Indice da etapa, ou -1 quando o status nao e uma delas (cancelado). */
function indiceDaEtapa(s: OrderItemStatus): number {
  return (STATUS_FLOW as readonly OrderItemStatus[]).indexOf(s);
}

/** Ícone de cada etapa. O concluído troca pelo check — ver `Etapa`. */
const STATUS_ICON: Record<EtapaStatus, LucideIcon> = {
  novo: Check,
  preparando: Flame,
  pronto: BellRing,
  retirado: ShoppingBasket,
};

/** Tela 06 ★ — Acompanhamento ao vivo via Socket.io. */
export function TrackScreen() {
  const { orderId = '' } = useParams<{ orderId: string }>();
  const { data: order, isLoading, error, refetch } = useOrder(orderId);

  const responder = useResponderAlteracao(orderId);
  const [erroResposta, setErroResposta] = useState<string | null>(null);

  // Vibrar 1x quando uma cozinha fica pronta
  const buzzedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!order) return;
    order.kitchens.forEach((k) => {
      if (k.status === 'pronto' && !buzzedRef.current.has(k.kitchenSlug)) {
        buzzedRef.current.add(k.kitchenSlug);
        if ('vibrate' in navigator) navigator.vibrate(50);
      }
    });
  }, [order]);

  if (isLoading) {
    return (
      <main className="px-4 pt-8">
        <p className="font-display text-display-md text-neutral-600">Buscando seu pedido…</p>
      </main>
    );
  }

  if (error || !order) {
    return (
      <ScreenError
        title="Não encontrei esse pedido."
        body="Pode ser que ele tenha sido criado em outra mesa."
        onRetry={() => refetch()}
      />
    );
  }

  const allDone = order.kitchens.every((k) => k.status === 'retirado');
  const alteracao = order.alteracaoPendente;

  return (
    <>
      <TelaHeader
        voltarPara="/pedidos"
        titulo={
          <span className="text-meta uppercase text-neutral-700 tabular">
            #{order.shortId} · Mesa {String(order.mesaNumero).padStart(2, '0')}
          </span>
        }
      />

      <main className="pb-8">
        {/*
          Interrompe tudo: a cozinha propos mudar o pedido e o prazo corre. A
          tela por baixo continua montada, mas o sheet nao deixa sair sem
          responder — ignorar equivale a recusar.
        */}
        {alteracao && (
          <AlteracaoSheet
            alteracao={alteracao}
            enviando={responder.isPending}
            erro={erroResposta}
            onAceitar={() => {
              setErroResposta(null);
              responder.mutate(
                { alteracaoId: alteracao.id, resposta: 'aceitar' },
                { onError: (e) => setErroResposta(mensagemDeErro(e, 'Nao consegui responder.')) },
              );
            }}
            onRecusar={() => {
              setErroResposta(null);
              responder.mutate(
                { alteracaoId: alteracao.id, resposta: 'recusar' },
                { onError: (e) => setErroResposta(mensagemDeErro(e, 'Nao consegui responder.')) },
              );
            }}
          />
        )}

        {order.kitchens.map((k) => (
          <BlocoDaCozinha key={k.kitchenSlug} k={k} />
        ))}

        {/*
          Aviso do corte. O valor a pagar cai quando um item e cancelado, e
          mudar o numero em silencio geraria duvida sobre o que aconteceu.
        */}
        {order.totalAtivosCents !== order.totalCents && (
          <div className="mx-4 mt-4 flex items-center gap-2 bg-accent-100 px-3 py-2">
            <TriangleAlert
              size={15}
              strokeWidth={2}
              aria-hidden
              className="shrink-0 text-accent-700"
            />
            <p className="text-meta text-accent-800 tabular">
              Total ajustado: <s>{fmtBRL(order.totalCents)}</s> →{' '}
              <strong>{fmtBRL(order.totalAtivosCents)}</strong>
            </p>
          </div>
        )}

        {allDone && (
          <div className="px-4 mt-6">
            <Link to={`/pedido/${orderId}/avaliar`} className="no-underline">
              <Button variant="primary" size="lg" fullWidth>
                Como foi?
              </Button>
            </Link>
          </div>
        )}

        <footer className="mt-6 px-4 py-3 border-t border-divider flex items-center gap-2">
          <Pulso size={8} />
          <span className="font-display text-label-sm font-bold uppercase text-neutral-600">
            Atualizando ao vivo
          </span>
        </footer>
      </main>
    </>
  );
}

function BlocoDaCozinha({ k }: { k: OrderKitchenGroup }) {
  const pronto = k.status === 'pronto';
  const retirado = k.status === 'retirado';

  // Conta regressiva do SLA. Precisa andar sozinha: e a tela que o cliente
  // deixa aberta esperando o pedido ficar pronto.
  const decorridos = useMinutosDesde(k.acceptedAt ?? null);
  const faltam = decorridos === null ? null : Math.max(0, k.slaMinutes - decorridos);

  /** Quanto do prazo já passou, em %. Trava em 100 pra barra não vazar. */
  const percorrido =
    decorridos === null ? 0 : Math.min(100, Math.round((decorridos / k.slaMinutes) * 100));

  return (
    <section className="border-b-rule border-divider last:border-b-0">
      {/* ── Herói do tempo ──────────────────────────────────────────────── */}
      {pronto ? (
        <div className="bg-accent text-bg px-4 py-5 flex flex-col gap-2">
          <p className="font-display text-label font-bold uppercase opacity-85">{k.kitchenName}</p>
          <div className="flex items-center gap-3">
            <BellRing size={28} strokeWidth={2} aria-hidden />
            <p className="font-display text-display-md">Retire no balcão.</p>
          </div>
        </div>
      ) : (
        <div className="px-4 py-4 flex flex-col gap-2">
          <p className="font-display text-label font-bold uppercase text-accent">{k.kitchenName}</p>

          {retirado ? (
            <p className="font-display text-display-md text-ink">Pedido completo.</p>
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="font-display text-display-xl text-ink tabular">
                {faltam === null ? '—' : `~${faltam}`}
              </span>
              <span className="font-display text-display-sm text-ink">MIN</span>
              <span className="ml-auto text-meta text-neutral-600">
                {faltam === null ? 'aguardando a cozinha' : 'para ficar pronto'}
              </span>
            </div>
          )}

          <div className="h-2.5 w-full bg-neutral-200 mt-1">
            <div
              className={`h-full ${retirado ? 'bg-neutral-900' : 'bg-accent'}`}
              style={{ width: retirado ? '100%' : `${percorrido}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Etapas ─────────────────────────────────────────────────────── */}
      <div className="px-4">
        {STATUS_FLOW.map((s, i) => (
          <Etapa
            key={s}
            status={s}
            label={STATUS_LABEL[s]}
            feito={etapaAlcancada(k.status, s)}
            atual={k.status === s}
            hora={
              s === 'novo'
                ? null
                : s === 'preparando'
                  ? k.acceptedAt
                  : s === 'pronto'
                    ? k.readyAt
                    : k.pickedAt
            }
            ultima={i === STATUS_FLOW.length - 1}
          />
        ))}
      </div>

      {/* ── Itens ──────────────────────────────────────────────────────── */}
      <div className="px-4 py-4 border-t-rule border-divider flex flex-col gap-2">
        <p className="font-display text-label font-bold uppercase text-neutral-600 mb-1">Itens</p>
        {k.items.map((it) => {
          // Item cancelado precisa APARECER, riscado. Some-lo faria o pedido
          // encolher sem explicacao: a pessoa lembra de ter pedido tres coisas
          // e ve duas na tela.
          const cancelado = it.status === 'cancelado';
          return (
            <div key={it.id} className={`flex items-center gap-3 ${cancelado ? 'opacity-70' : ''}`}>
              <Foto src={it.foto} alt="" className="w-10 h-10 shrink-0" />
              <span className="font-display text-body-sm font-bold text-ink tabular shrink-0">
                {it.qty}×
              </span>
              <span className={`text-body-sm text-ink min-w-0 ${cancelado ? 'line-through' : ''}`}>
                {it.name}
                {it.note && !cancelado && <span className="text-neutral-600"> — {it.note}</span>}
              </span>
              {cancelado && (
                <span className="ml-auto shrink-0">
                  <Chip tone="neutral">Cancelado</Chip>
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

interface EtapaProps {
  status: EtapaStatus;
  label: string;
  feito: boolean;
  atual: boolean;
  hora: string | null;
  ultima: boolean;
}

/**
 * Uma etapa: quadrado 30×30, rótulo, hora à direita.
 *
 * O quadrado carrega o estado sozinho — cheio de tinta quando passou, vermelho
 * pulsando quando é agora, só contorno quando ainda vem. É a mesma gramática da
 * barra segmentada da lista, e por isso as duas telas se leem igual.
 */
function Etapa({ status, label, feito, atual, hora, ultima }: EtapaProps) {
  const Icone = feito ? Check : STATUS_ICON[status];

  return (
    <div className={`flex items-center gap-3 py-3 ${ultima ? '' : 'border-b border-divider'}`}>
      <span
        aria-hidden
        className={[
          'w-[30px] h-[30px] shrink-0 inline-flex items-center justify-center',
          feito
            ? 'bg-neutral-900 text-bg'
            : atual
              ? 'bg-accent text-bg animate-pulse motion-reduce:animate-none'
              : 'border border-divider text-neutral-500',
        ].join(' ')}
      >
        <Icone size={16} strokeWidth={2} />
      </span>

      <span
        className={[
          'text-body-sm',
          feito
            ? 'font-medium text-ink'
            : atual
              ? 'font-medium text-accent-700'
              : 'text-neutral-500',
        ].join(' ')}
      >
        {label}
      </span>

      <span
        className={`ml-auto text-meta tabular ${hora ? 'text-neutral-600' : 'text-neutral-400'}`}
      >
        {hora ? fmtTime(hora) : '—'}
      </span>
    </div>
  );
}

function etapaAlcancada(atual: OrderItemStatus, alvo: EtapaStatus): boolean {
  return indiceDaEtapa(alvo) < indiceDaEtapa(atual);
}
