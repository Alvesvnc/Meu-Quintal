import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Divider } from '@mq/design-system';
import { useOrder } from '../api/hooks';
import { ScreenError } from '../components/ScreenError';

const SCALE = [
  { value: 1, label: 'ruim' },
  { value: 2, label: 'ok' },
  { value: 3, label: 'bom' },
  { value: 4, label: 'ótimo' },
  { value: 5, label: 'perfeito' },
] as const;

type Rating = (typeof SCALE)[number]['value'];

/** Tela 06 — Avaliação pós-consumo, uma pergunta por cozinha. */
export function ReviewScreen() {
  const { orderId = '' } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { data: order, isLoading, error, refetch } = useOrder(orderId);

  const [ratings, setRatings] = useState<Record<string, Rating | undefined>>({});
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);

  if (isLoading) {
    return (
      <main className="px-5 pt-8 text-center">
        <p className="font-display italic text-display-md text-inkMuted">Carregando…</p>
      </main>
    );
  }

  if (error || !order) {
    return (
      <ScreenError
        title="Pedido não encontrado."
        onRetry={() => refetch()}
      />
    );
  }

  const allRated = order.kitchens.every((k) => ratings[k.kitchenSlug] != null);

  if (sent) {
    return (
      <main className="px-5 py-12 text-center">
        <p className="font-mono text-mono-sm uppercase tracking-wider text-inkDim">
          Pedido #{order.shortId}
        </p>
        <h1 className="mt-3 font-display italic text-display-xl text-ink leading-tight text-pretty">
          Obrigada.
        </h1>
        <p className="mt-4 font-sans text-body-lg text-inkMuted text-pretty">
          O quintal fica melhor com o que você acabou de mandar.
        </p>
        <div className="mt-10">
          <Button variant="ghost" size="lg" onClick={() => navigate('/')}>
            Pedir mais alguma coisa
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="pb-32 px-5">
      <section className="pt-6 pb-2">
        <p className="font-mono text-mono-sm uppercase tracking-wider text-inkDim">
          Pedido #{order.shortId}
        </p>
        <h1 className="mt-1 font-display text-display-lg italic text-ink leading-tight text-pretty">
          Como foi?
        </h1>
        <p className="mt-2 font-sans text-body text-inkMuted">
          Uma palavra por cozinha basta. A nota chega só pra cozinha — só ela vê.
        </p>
      </section>

      <div className="mt-6 space-y-7">
        {order.kitchens.map((k) => (
          <section key={k.kitchenSlug}>
            <Divider label={k.kitchenName} />
            <div className="mt-4 grid grid-cols-5 gap-2">
              {SCALE.map((s) => {
                const active = ratings[k.kitchenSlug] === s.value;
                return (
                  <button
                    key={s.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      setRatings((r) => ({ ...r, [k.kitchenSlug]: s.value }))
                    }
                    className={[
                      'min-h-[64px] px-1 py-2 rounded-md border text-center cursor-pointer',
                      'transition-colors duration-base ease-out',
                      active
                        ? 'border-primary bg-primaryWash'
                        : 'border-hairline bg-surface hover:border-primary/40',
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'block font-mono text-mono tabular-nums',
                        active ? 'text-primary' : 'text-inkDim',
                      ].join(' ')}
                    >
                      {s.value}
                    </span>
                    <span
                      className={[
                        'mt-1 block font-display italic text-body-sm leading-tight',
                        active ? 'text-ink' : 'text-inkMuted',
                      ].join(' ')}
                    >
                      {s.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <section className="mt-8">
        <label
          htmlFor="note"
          className="block font-mono text-label uppercase tracking-wider text-inkDim mb-2"
        >
          Alguma coisa pra contar?{' '}
          <span className="text-inkDim/70 normal-case tracking-normal">· opcional</span>
        </label>
        <textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Algo deu certo? Algo deu errado?"
          rows={3}
          maxLength={280}
          className="w-full px-4 py-3 bg-surface border border-hairline rounded-md
                     font-sans text-body text-ink placeholder:text-inkDim
                     focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primaryWash
                     resize-none"
        />
        <p className="mt-1 font-mono text-mono-sm text-inkDim text-right">{note.length}/280</p>
      </section>

      <div className="fixed inset-x-0 bottom-16 z-30 pointer-events-none">
        <div className="mx-auto max-w-[480px] px-5 py-3 bg-bg/95 backdrop-blur-[2px] border-t border-hairlineSoft pointer-events-auto">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={!allRated}
            onClick={() => setSent(true)}
          >
            {allRated
              ? 'Enviar'
              : `Avalie ${order.kitchens.length - Object.keys(ratings).length} cozinha(s)`}
          </Button>
        </div>
      </div>
    </main>
  );
}
