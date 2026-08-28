import { useState, useMemo, useCallback } from 'react';
import type { OrderItemStatus } from '@mq/shared';
import { useFila, useKitchenSocket } from '../api/hooks';
import { useAuth } from '../stores/auth';
import { OrderCard } from '../components/OrderCard';
import { StatusTabs } from '../components/StatusTabs';
import { ScreenError } from '../components/ScreenError';
import { playOrderNewSound, buzzShort } from '../lib/sound';
import { useTelaAcesa } from '../lib/useTelaAcesa';

type ActiveStatus = Extract<OrderItemStatus, 'novo' | 'preparando' | 'pronto'>;

/**
 * Tela 07 ★ — Fila de pedidos.
 *
 * O placar no topo alterna entre Novos / Preparando / Prontos e, ao mesmo
 * tempo, responde à pergunta que o operador faz o dia inteiro: quantos tem
 * na frente. Socket.io recebe order:new e toca som + vibra ao chegar pedido.
 */
export function QueueScreen() {
  const [active, setActive] = useState<ActiveStatus>('novo');
  const { data, isLoading, error, refetch } = useFila();
  const me = useAuth((s) => s.me);
  const kitchenSlug = me?.kitchen.slug;

  // Som + vibração quando pedido novo chega
  const onOrderNew = useCallback(() => {
    playOrderNewSound();
    buzzShort();
  }, []);

  useKitchenSocket(kitchenSlug, { onOrderNew });

  // Só AQUI, e não no app inteiro: a fila é a tela que fica na bancada o turno
  // inteiro. Em cardápio ou métricas, o aparelho dormir é o comportamento
  // certo — quem foi editar preço não deixou a tela ligada de propósito.
  useTelaAcesa();

  const buckets = useMemo(() => {
    const orders = data?.orders ?? [];
    return {
      novo: orders.filter((o) => o.status === 'novo'),
      preparando: orders.filter((o) => o.status === 'preparando'),
      pronto: orders.filter((o) => o.status === 'pronto'),
    };
  }, [data]);

  const tabs = [
    { id: 'novo', label: 'Novos', count: buckets.novo.length },
    { id: 'preparando', label: 'Preparando', count: buckets.preparando.length },
    { id: 'pronto', label: 'Prontos', count: buckets.pronto.length },
  ] as const;

  const list = buckets[active];

  // GRADE, NAO COLUNA. Num tablet em paisagem cabem duas fichas lado a lado e
  // num monitor cabem tres — ver a fila inteira de uma vez e justamente o que
  // a cozinha precisa no pico.
  //
  // `items-start` nao e enfeite: sem ele as fichas de uma mesma linha esticam
  // ate a altura da mais alta, e um pedido de um item ganha o corpo de um
  // pedido de dez.
  const GRADE = 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 items-start gap-4 pt-4';

  if (isLoading && !data) {
    return (
      <main className="px-4 pt-8 sm:px-6 lg:px-8">
        <p className="font-display text-display-md text-neutral-600">Buscando a fila…</p>
      </main>
    );
  }

  if (error) {
    return (
      <ScreenError
        title="Não consegui carregar a fila."
        body="Verifique sua conexão e tente de novo."
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <>
      <StatusTabs tabs={tabs} activeId={active} onSelect={setActive} />

      <main className="px-4 pb-28 sm:px-6 lg:px-8">
        {list.length === 0 ? (
          <EmptyState status={active} />
        ) : (
          <ul className={GRADE}>
            {list.map((o) => (
              <li key={o.id}>
                <OrderCard order={o} />
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}

function EmptyState({ status }: { status: ActiveStatus }) {
  const copy = {
    novo: 'Sem pedidos novos. Respira.',
    preparando: 'Nada na chapa agora.',
    pronto: 'Nada esperando no balcão.',
  }[status];
  const agora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  // Centralizado a partir do `sm`: no monitor, a frase sozinha encostada na
  // borda esquerda de uma area de 1400px parece erro de carregamento, nao
  // "esta tudo em dia". No celular continua alinhada a esquerda, que e onde a
  // leitura comeca.
  return (
    <div className="py-16 sm:py-24 sm:text-center">
      <p className="font-display text-display-lg text-ink text-pretty">{copy}</p>
      <p className="mt-3 font-display text-display-md text-neutral-500 tabular">{agora}</p>
    </div>
  );
}
