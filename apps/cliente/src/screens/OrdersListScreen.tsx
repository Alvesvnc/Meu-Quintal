import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Chip, ConfirmSheet, Divider } from '@mq/design-system';
import { mensagemDeErro, type OrderItemStatus, type OrderListItem } from '@mq/shared';
import { useOrders, useRequestPayment } from '../api/hooks';
import { ScreenError } from '../components/ScreenError';
import { fmtBRL, fmtTime } from '../lib/format';

const STATUS_FLOW: OrderItemStatus[] = ['novo', 'preparando', 'pronto', 'retirado'];
const STATUS_LABEL: Record<OrderItemStatus, string> = {
  novo:       'Recebido',
  preparando: 'Preparando',
  pronto:     'Retirar',
  retirado:   'Retirado',
  cancelado:  'Cancelado',
};

interface KitchenGroup {
  kitchenSlug: string;
  kitchenName: string;
  orders: OrderListItem[];
  /** O que foi pedido. So aparece riscado, quando difere do de baixo. */
  totalPedidoCents: number;
  /** O que vai chegar — exclui itens cancelados. E o valor que se paga. */
  totalCents: number;
  itemCount: number;
  hasReady: boolean;
  /** True se TODOS os pedidos dessa cozinha já tiveram cobrança solicitada. */
  allPaymentRequested: boolean;
  /** Quando foi a solicitação mais recente (pra mostrar "há X min"). */
  paymentRequestedAt: string | null;
}

/**
 * Lista de pedidos ativos agrupados por cozinha.
 * Cada grupo tem header com nome + total + count, e mostra cada pedido como
 * row compacta com timeline mini.
 */
export function OrdersListScreen() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useOrders();

  // `data?.orders ?? []` cria um array novo a cada render quando `data` e
  // undefined, o que faria o useMemo abaixo recalcular sempre — anulando o
  // proprio memo.
  const orders = useMemo(() => data?.orders ?? [], [data]);

  const groups = useMemo<KitchenGroup[]>(() => {
    const map = new Map<string, KitchenGroup>();
    for (const o of orders) {
      const g = map.get(o.kitchenSlug) ?? {
        kitchenSlug: o.kitchenSlug,
        kitchenName: o.kitchenName,
        orders: [],
        totalPedidoCents: 0,
        totalCents: 0,
        itemCount: 0,
        hasReady: false,
        allPaymentRequested: true,
        paymentRequestedAt: null,
      };
      g.orders.push(o);
      g.totalPedidoCents += o.totalCents;
      // O que a pessoa vai pagar no balcao: item cancelado nao entra.
      g.totalCents += o.totalAtivosCents;
      g.itemCount += o.itemCount;
      if (o.status === 'pronto') g.hasReady = true;
      if (!o.paymentRequestedAt) g.allPaymentRequested = false;
      else if (!g.paymentRequestedAt || o.paymentRequestedAt > g.paymentRequestedAt) {
        g.paymentRequestedAt = o.paymentRequestedAt;
      }
      map.set(o.kitchenSlug, g);
    }
    // Ordena cozinhas com items prontos primeiro
    return Array.from(map.values()).sort((a, b) => {
      if (a.hasReady !== b.hasReady) return a.hasReady ? -1 : 1;
      return a.kitchenName.localeCompare(b.kitchenName);
    });
  }, [orders]);

  const grandTotal = orders.reduce((acc, o) => acc + o.totalCents, 0);
  const readyCount = orders.filter((o) => o.status === 'pronto').length;

  if (isLoading) {
    return (
      <main className="px-5 pt-8 text-center">
        <p className="font-display italic text-display-md text-inkMuted">
          Buscando seus pedidos…
        </p>
      </main>
    );
  }

  if (error) {
    return <ScreenError title="Não consegui carregar os pedidos." onRetry={() => refetch()} />;
  }

  if (orders.length === 0) {
    return (
      <main className="px-5 py-10">
        <h1 className="font-display italic text-display-lg text-ink leading-tight text-pretty">
          Sem pedidos ativos.
        </h1>
        <p className="mt-3 font-sans text-body text-inkMuted">
          Quando você mandar um pedido, ele aparece aqui pra acompanhar.
        </p>
        <div className="mt-7">
          <Button variant="primary" size="lg" fullWidth onClick={() => navigate('/')}>
            Ver as cozinhas
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="pb-24 px-5">
      <section className="pt-6 pb-2">
        <p className="font-mono text-mono-sm uppercase tracking-wider text-inkDim">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" aria-hidden />
            Acompanhando ao vivo
          </span>
        </p>
        <h1 className="mt-1 font-display text-display-lg italic text-ink leading-tight text-pretty">
          {readyCount > 0 ? (
            <>{readyCount} {readyCount === 1 ? 'pedido pronto' : 'pedidos prontos'} <span className="text-primary">no balcão.</span></>
          ) : (
            <>{orders.length} {orders.length === 1 ? 'pedido' : 'pedidos'} <span className="text-primary">em andamento.</span></>
          )}
        </h1>
      </section>

      <div className="mt-6 space-y-7">
        {groups.map((g) => (
          <KitchenSection key={g.kitchenSlug} group={g} />
        ))}
      </div>

      {/* Total da mesa */}
      <section className="mt-10">
        <Divider />
        <div className="mt-4 flex items-baseline justify-between">
          <span className="font-mono text-label uppercase tracking-wider text-inkDim">
            Total da mesa
          </span>
          <span className="font-mono text-mono-lg text-primary">{fmtBRL(grandTotal)}</span>
        </div>
        <p className="mt-2 font-sans text-body-sm italic text-inkDim">
          Cada cozinha cobra direto quando você retirar.
        </p>
      </section>

    </main>
  );
}

function KitchenSection({ group: g }: { group: KitchenGroup }) {
  const requestPayment = useRequestPayment();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleConfirmClose = () => {
    setErrorMsg(null);
    requestPayment.mutate(
      { kitchenSlug: g.kitchenSlug },
      {
        onSuccess: () => setConfirmOpen(false),
        onError: (e) => {
          setConfirmOpen(false);
          setErrorMsg(mensagemDeErro(e, 'Não rolou pedir cobrança.'));
        },
      },
    );
  };

  return (
    <section>
      {/* Header editorial: nome + total + count */}
      <header className="flex items-end justify-between gap-3 mb-3 pb-2 border-b border-hairline">
        <div className="min-w-0">
          <h2 className="font-display text-display-md italic text-ink leading-tight truncate">
            {g.kitchenName}
          </h2>
          <p className="mt-1 font-mono text-mono-sm uppercase tracking-wider text-inkDim">
            {g.orders.length} {g.orders.length === 1 ? 'pedido' : 'pedidos'} · {g.itemCount} {g.itemCount === 1 ? 'item' : 'itens'}
          </p>
        </div>
        <p className="shrink-0 font-mono text-mono-lg text-ink tabular-nums">
          {g.totalPedidoCents !== g.totalCents && (
            // Riscado deixa claro que o valor caiu por causa de cancelamento,
            // em vez de o numero simplesmente mudar sem explicacao.
            <span className="mr-2 text-body text-inkDim line-through">
              {fmtBRL(g.totalPedidoCents)}
            </span>
          )}
          {fmtBRL(g.totalCents)}
        </p>
      </header>

      <ul className="space-y-2">
        {g.orders.map((o) => (
          <li key={o.id}>
            <OrderRow order={o} />
          </li>
        ))}
      </ul>

      {/* Fechar conta / status de cobrança */}
      <footer className="mt-4">
        {g.allPaymentRequested ? (
          <div className="rounded-md border border-accent/40 bg-accentWash px-4 py-3 text-center">
            <p className="font-mono text-label uppercase tracking-wider text-accent">
              Aguardando cobrança
            </p>
            <p className="mt-1 font-sans text-body-sm text-inkMuted">
              {g.kitchenName} foi avisada{g.paymentRequestedAt ? ` ${relativeTime(g.paymentRequestedAt)}` : ''}.
            </p>
          </div>
        ) : (
          <>
            <Button
              variant="secondary"
              size="md"
              fullWidth
              onClick={() => setConfirmOpen(true)}
            >
              <span className="flex-1 text-left">Fechar conta dessa cozinha</span>
              <span className="font-mono">{fmtBRL(g.totalCents)}</span>
            </Button>
            {errorMsg && (
              <p className="mt-2 font-mono text-mono-sm text-danger text-center">
                {errorMsg}
              </p>
            )}
          </>
        )}
      </footer>

      <ConfirmSheet
        open={confirmOpen}
        title={<>Pedir cobrança pra <em>{g.kitchenName}</em>?</>}
        body={`Eles vão até a mesa cobrar o valor total dos pedidos abertos (${fmtBRL(g.totalCents)}). Você ainda pode pedir mais itens dessa cozinha depois.`}
        confirmLabel="Pedir cobrança"
        cancelLabel="Voltar"
        loading={requestPayment.isPending}
        onConfirm={handleConfirmClose}
        onClose={() => setConfirmOpen(false)}
      />
    </section>
  );
}

/** "há 3 min", "agora há pouco" — formato leve. */
function relativeTime(iso: string): string {
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (diffMin < 1) return 'agora há pouco';
  if (diffMin === 1) return 'há 1 min';
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffHr = Math.floor(diffMin / 60);
  return diffHr === 1 ? 'há 1 h' : `há ${diffHr} h`;
}

function OrderRow({ order: o }: { order: OrderListItem }) {
  const isReady = o.status === 'pronto';
  const statusChip = (() => {
    if (o.status === 'pronto')     return <Chip tone="primary">retire</Chip>;
    if (o.status === 'preparando') return <Chip tone="accent">preparando</Chip>;
    if (o.status === 'novo')       return <Chip tone="neutral">recebido</Chip>;
    if (o.status === 'cancelado')  return <Chip tone="danger">cancelado</Chip>;
    return null;
  })();

  return (
    <Link
      to={`/pedido/${o.id}`}
      className={[
        'block rounded-lg border p-4 no-underline text-inherit',
        'transition-colors duration-base ease-out',
        isReady
          ? 'border-primary bg-primaryWash hover:bg-primaryWash/70'
          : 'border-hairline bg-surface hover:border-primary/40',
      ].join(' ')}
    >
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <p className="font-mono text-mono text-inkDim">
          #{o.shortId} · {fmtTime(o.createdAt)}
        </p>
        {statusChip}
      </div>

      <MiniTimeline status={o.status} />

      <div className="flex items-baseline justify-between mt-3">
        <span className="font-mono text-mono-sm text-inkDim">
          {o.itemCount} {o.itemCount === 1 ? 'item' : 'itens'}
        </span>
        <span className="font-mono text-mono text-ink tabular-nums">
          {fmtBRL(o.totalCents)}
        </span>
      </div>
    </Link>
  );
}

function MiniTimeline({ status }: { status: OrderItemStatus }) {
  if (status === 'cancelado') {
    return (
      <p className="font-sans text-body-sm italic text-inkMuted">
        Pedido cancelado.
      </p>
    );
  }

  const currentIdx = STATUS_FLOW.indexOf(status);

  return (
    <ol className="flex items-center gap-1.5" aria-label={`Status: ${STATUS_LABEL[status]}`}>
      {STATUS_FLOW.map((s, i) => {
        const done = i < currentIdx;
        const current = i === currentIdx;
        const isLast = i === STATUS_FLOW.length - 1;
        return (
          <li key={s} className={`flex items-center gap-1.5 ${isLast ? '' : 'flex-1'}`}>
            <div className="flex flex-col items-center gap-1 shrink-0">
              <span
                className={[
                  'w-3 h-3 rounded-full transition-colors duration-base ease-out',
                  done
                    ? 'bg-accent'
                    : current
                      ? 'bg-primary ring-2 ring-primaryWash'
                      : 'bg-hairline',
                ].join(' ')}
                aria-hidden
              />
              <span
                className={[
                  'font-mono text-[10px] uppercase tracking-wider',
                  done
                    ? 'text-accent'
                    : current
                      ? 'text-primary font-semibold'
                      : 'text-inkDim',
                ].join(' ')}
              >
                {STATUS_LABEL[s]}
              </span>
            </div>
            {!isLast && (
              <span
                aria-hidden
                className={[
                  'flex-1 h-[2px] rounded-full -mt-3',
                  done ? 'bg-accent' : 'bg-hairline',
                ].join(' ')}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
