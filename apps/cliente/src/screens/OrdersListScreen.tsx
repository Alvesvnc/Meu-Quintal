import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BarraSegmentada,
  Button,
  Chip,
  ConfirmSheet,
  Pulso,
  useMinutosDesde,
} from '@mq/design-system';
import { Banknote, BellRing, Timer } from 'lucide-react';
import { mensagemDeErro, type OrderItemStatus, type OrderListItem } from '@mq/shared';
import { useOrders, useQuintal, useRequestPayment } from '../api/hooks';
import { ScreenError } from '../components/ScreenError';
import { Foto } from '../components/Foto';
import { fmtBRL, fmtTime } from '../lib/format';

const STATUS_FLOW: OrderItemStatus[] = ['novo', 'preparando', 'pronto', 'retirado'];
const STATUS_LABEL: Record<OrderItemStatus, string> = {
  novo: 'Recebido',
  preparando: 'Preparando',
  pronto: 'Retirar',
  retirado: 'Retirado',
  cancelado: 'Cancelado',
};

/** Quantas miniaturas cabem antes de a fileira virar uma lista de selos. */
const MAX_MINIATURAS = 4;

interface ContaDaCozinha {
  kitchenSlug: string;
  kitchenName: string;
  /** O que vai ser pago: exclui itens cancelados. */
  totalCents: number;
  /** True se TODOS os pedidos dessa cozinha já tiveram cobrança solicitada. */
  cobrancaPedida: boolean;
  /** Quando foi a solicitação mais recente (pra mostrar "há X min"). */
  pedidaEm: string | null;
}

/**
 * Tela 05 — os pedidos da mesa.
 *
 * Era a tela mais textual do app: cada pedido virava três linhas de rótulo e
 * uma timeline de quatro palavras, e o que importava — "o seu está pronto, vai
 * buscar" — chegava por último, em cinza.
 *
 * Agora o estado é o BLOCO. Pedido pronto vira um pôster vermelho sólido que
 * ocupa a largura da tela e diz uma frase; os demais são cards de contorno com
 * uma barra de progresso. Quem olha de longe já sabe se precisa levantar.
 */
export function OrdersListScreen() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useOrders();

  // `data?.orders ?? []` cria um array novo a cada render quando `data` e
  // undefined, o que faria o useMemo abaixo recalcular sempre — anulando o
  // proprio memo.
  const orders = useMemo(() => data?.orders ?? [], [data]);

  /** Prontos primeiro: é o único que pede ação agora. */
  const ordenados = useMemo(
    () =>
      [...orders].sort((a, b) => {
        const aPronto = a.status === 'pronto' ? 0 : 1;
        const bPronto = b.status === 'pronto' ? 0 : 1;
        if (aPronto !== bPronto) return aPronto - bPronto;
        return b.createdAt.localeCompare(a.createdAt);
      }),
    [orders],
  );

  const contas = useMemo<ContaDaCozinha[]>(() => {
    const map = new Map<string, ContaDaCozinha>();
    for (const o of orders) {
      const c = map.get(o.kitchenSlug) ?? {
        kitchenSlug: o.kitchenSlug,
        kitchenName: o.kitchenName,
        totalCents: 0,
        cobrancaPedida: true,
        pedidaEm: null,
      };
      c.totalCents += o.totalAtivosCents;
      if (!o.paymentRequestedAt) c.cobrancaPedida = false;
      else if (!c.pedidaEm || o.paymentRequestedAt > c.pedidaEm) {
        c.pedidaEm = o.paymentRequestedAt;
      }
      map.set(o.kitchenSlug, c);
    }
    return Array.from(map.values()).sort((a, b) => a.kitchenName.localeCompare(b.kitchenName));
  }, [orders]);

  const totalDaMesa = orders.reduce((acc, o) => acc + o.totalAtivosCents, 0);
  const prontos = orders.filter((o) => o.status === 'pronto').length;

  if (isLoading) {
    return (
      <main className="px-4 pt-8">
        <p className="font-display text-display-md text-neutral-600">Buscando seus pedidos…</p>
      </main>
    );
  }

  if (error) {
    return <ScreenError title="Não consegui carregar os pedidos." onRetry={() => refetch()} />;
  }

  if (orders.length === 0) {
    return (
      <main className="px-4 py-8">
        <h1 className="font-display text-display-lg text-ink text-pretty">Sem pedidos ativos.</h1>
        <p className="mt-3 text-body-sm text-neutral-700">
          Quando você mandar um pedido, ele aparece aqui pra acompanhar.
        </p>
        <div className="mt-6">
          <Button variant="primary" size="lg" fullWidth onClick={() => navigate('/')}>
            Ver as cozinhas
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="pb-8">
      <section className="px-4 py-4 flex flex-col gap-2">
        <p className="flex items-center gap-2 font-display text-label font-bold uppercase text-neutral-600">
          <Pulso />
          Ao vivo
        </p>
        <h1 className="font-display text-display-md text-ink">
          {prontos > 0
            ? `${prontos} ${prontos === 1 ? 'pedido pronto' : 'pedidos prontos'}.`
            : `${orders.length} ${orders.length === 1 ? 'pedido' : 'pedidos'} em andamento.`}
        </h1>
      </section>

      <div className="px-4 flex flex-col gap-4">
        {ordenados.map((o) =>
          o.status === 'pronto' ? (
            <PosterPronto key={o.id} order={o} />
          ) : (
            <CardEmAndamento key={o.id} order={o} />
          ),
        )}
      </div>

      <footer className="mt-6 px-4 pt-4 border-t-rule border-divider flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <span className="font-display text-label font-bold uppercase text-neutral-600">
            Total da mesa
          </span>
          <span className="font-display text-mono-lg text-ink tabular">{fmtBRL(totalDaMesa)}</span>
        </div>

        <p className="flex items-center gap-1.5 text-meta text-neutral-600">
          <Banknote size={14} strokeWidth={2} aria-hidden className="shrink-0" />
          Cada cozinha cobra na retirada.
        </p>

        {contas.map((c) => (
          <FecharConta key={c.kitchenSlug} conta={c} />
        ))}
      </footer>
    </main>
  );
}

/** Fileira de miniaturas + resumo. É o que substituiu "2 itens" em texto. */
function Miniaturas({
  order: o,
  invertida = false,
}: {
  order: OrderListItem;
  invertida?: boolean;
}) {
  const visiveis = o.itens.slice(0, MAX_MINIATURAS);
  const restantes = o.itens.length - visiveis.length;

  return (
    <div className="flex items-center gap-2">
      {visiveis.map((it) => (
        <Foto key={it.id} src={it.foto} alt={it.name} className="w-11 h-11 shrink-0" />
      ))}
      {restantes > 0 && (
        <span
          className={[
            'w-11 h-11 shrink-0 inline-flex items-center justify-center',
            'font-display text-meta font-bold tabular',
            invertida ? 'bg-accent-600 text-bg' : 'bg-neutral-200 text-neutral-700',
          ].join(' ')}
        >
          +{restantes}
        </span>
      )}
      <span
        className={[
          'ml-auto font-display text-meta font-bold uppercase tabular',
          invertida ? 'text-bg' : 'text-neutral-600',
        ].join(' ')}
      >
        {o.itemCount} {o.itemCount === 1 ? 'item' : 'itens'} · {fmtBRL(o.totalAtivosCents)}
      </span>
    </div>
  );
}

/**
 * Pedido pronto: bloco vermelho sólido com uma frase.
 *
 * Não é um card com destaque — é o bloco inteiro invertido. Esta é a única
 * informação da tela que pede movimento do corpo, e num salão barulhento ela
 * precisa ser lida de relance, sem foco.
 */
function PosterPronto({ order: o }: { order: OrderListItem }) {
  return (
    <Link
      to={`/pedido/${o.id}`}
      className="bg-accent text-bg no-underline p-4 flex flex-col gap-3
                 transition-colors duration-base ease-out hover:bg-accent-600"
    >
      <div className="flex items-center justify-between">
        <BellRing size={28} strokeWidth={2} aria-hidden />
        <span className="font-display text-body-sm font-bold tabular">{fmtTime(o.createdAt)}</span>
      </div>

      <p className="font-display text-label font-bold uppercase opacity-85">
        {o.kitchenName} · #{o.shortId}
      </p>

      <p className="font-display text-display-md">Retire no balcão.</p>

      <Miniaturas order={o} invertida />

      <BarraSegmentada
        total={STATUS_FLOW.length}
        atual={STATUS_FLOW.indexOf(o.status)}
        invertida
        aria-label={`Status: ${STATUS_LABEL[o.status]}`}
      />
    </Link>
  );
}

/** Pedido em andamento: contorno de 2px, chip de tempo e barra de progresso. */
function CardEmAndamento({ order: o }: { order: OrderListItem }) {
  const { data: quintal } = useQuintal();
  const sla = quintal?.kitchens.find((k) => k.slug === o.kitchenSlug)?.slaMinutes;

  /**
   * Estimativa a partir de quando o pedido ENTROU, não de quando a cozinha
   * aceitou: a lista não carrega `acceptedAt` — carrega só o status agregado.
   * O número certo, contado do aceite, está na tela de acompanhar. Aqui ele
   * serve pra dizer "falta pouco" ou "ainda demora", e para isso basta.
   */
  const decorridos = useMinutosDesde(o.createdAt);
  const faltam = sla != null && decorridos != null ? Math.max(0, sla - decorridos) : null;

  const cancelado = o.status === 'cancelado';

  return (
    <Link
      to={`/pedido/${o.id}`}
      className={[
        'border-rule border-divider no-underline text-inherit p-4 flex flex-col gap-3',
        'transition-colors duration-base ease-out hover:border-accent',
        cancelado ? 'opacity-70' : '',
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={[
            'font-display font-bold text-ink min-w-0 truncate uppercase',
            cancelado ? 'line-through' : '',
          ].join(' ')}
        >
          {o.kitchenName} · #{o.shortId}
        </span>

        {cancelado ? (
          <Chip tone="neutral">Cancelado</Chip>
        ) : faltam != null ? (
          <Chip tone="tint" className="gap-1.5 shrink-0 tabular">
            <Timer size={12} strokeWidth={2} aria-hidden />~{faltam} min
          </Chip>
        ) : null}
      </div>

      <Miniaturas order={o} />

      {!cancelado && (
        <div className="flex flex-col gap-1">
          <BarraSegmentada
            total={STATUS_FLOW.length}
            atual={STATUS_FLOW.indexOf(o.status)}
            aria-label={`Status: ${STATUS_LABEL[o.status]}`}
          />
          <div className="flex items-center justify-between">
            <span className="font-display text-label font-bold uppercase text-accent-700">
              {STATUS_LABEL[o.status]}
            </span>
            <span className="text-label-sm text-neutral-600 tabular">{fmtTime(o.createdAt)}</span>
          </div>
        </div>
      )}
    </Link>
  );
}

function FecharConta({ conta: c }: { conta: ContaDaCozinha }) {
  const requestPayment = useRequestPayment();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const confirmar = () => {
    setErrorMsg(null);
    requestPayment.mutate(
      { kitchenSlug: c.kitchenSlug },
      {
        onSuccess: () => setConfirmOpen(false),
        onError: (e) => {
          setConfirmOpen(false);
          setErrorMsg(mensagemDeErro(e, 'Não rolou pedir cobrança.'));
        },
      },
    );
  };

  if (c.cobrancaPedida) {
    return (
      <div className="bg-accent-100 px-4 py-3 flex items-baseline justify-between gap-3">
        <span className="font-display text-label font-bold uppercase text-accent-800">
          Aguardando cobrança{c.pedidaEm ? ` · ${tempoRelativo(c.pedidaEm)}` : ''}
        </span>
        <span className="font-display text-label font-bold text-accent-800 tabular shrink-0">
          {fmtBRL(c.totalCents)}
        </span>
      </div>
    );
  }

  return (
    <>
      <Button variant="secondary" size="md" fullWidth onClick={() => setConfirmOpen(true)}>
        <Banknote size={16} strokeWidth={2} aria-hidden className="shrink-0" />
        <span className="min-w-0 truncate">Fechar conta · {c.kitchenName}</span>
        <span className="ml-auto tabular shrink-0">{fmtBRL(c.totalCents)}</span>
      </Button>

      {errorMsg && <p className="text-meta text-accent-700">{errorMsg}</p>}

      <ConfirmSheet
        open={confirmOpen}
        title={<>Pedir cobrança pra {c.kitchenName}?</>}
        body={`Eles vão até a mesa cobrar o valor total dos pedidos abertos (${fmtBRL(
          c.totalCents,
        )}). Você ainda pode pedir mais itens dessa cozinha depois.`}
        confirmLabel="Pedir cobrança"
        cancelLabel="Voltar"
        loading={requestPayment.isPending}
        onConfirm={confirmar}
        onClose={() => setConfirmOpen(false)}
      />
    </>
  );
}

/** "há 3 min", "agora há pouco" — formato leve. */
function tempoRelativo(iso: string): string {
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (diffMin < 1) return 'agora há pouco';
  if (diffMin === 1) return 'há 1 min';
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffHr = Math.floor(diffMin / 60);
  return diffHr === 1 ? 'há 1 h' : `há ${diffHr} h`;
}
