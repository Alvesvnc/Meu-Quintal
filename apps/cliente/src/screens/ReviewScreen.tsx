import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@mq/design-system';
import { useOrder } from '../api/hooks';
import { TelaHeader } from '../components/TelaHeader';
import { FaixaFixa } from '../components/FaixaFixa';
import { ScreenError } from '../components/ScreenError';

const SCALE = [
  { value: 1, label: 'ruim' },
  { value: 2, label: 'ok' },
  { value: 3, label: 'bom' },
  { value: 4, label: 'ótimo' },
  { value: 5, label: 'perfeito' },
] as const;

type Rating = (typeof SCALE)[number]['value'];

/** Tela — Avaliação pós-consumo, uma pergunta por cozinha. */
export function ReviewScreen() {
  const { orderId = '' } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { data: order, isLoading, error, refetch } = useOrder(orderId);

  const [ratings, setRatings] = useState<Record<string, Rating | undefined>>({});
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);

  if (isLoading) {
    return (
      <main className="px-4 pt-8">
        <p className="font-display text-display-md text-neutral-600">Carregando…</p>
      </main>
    );
  }

  if (error || !order) {
    return <ScreenError title="Pedido não encontrado." onRetry={() => refetch()} />;
  }

  const allRated = order.kitchens.every((k) => ratings[k.kitchenSlug] != null);

  if (sent) {
    return (
      <main className="px-4 py-10">
        <p className="font-display text-label font-bold uppercase text-neutral-600 tabular">
          Pedido #{order.shortId}
        </p>
        <h1 className="mt-3 font-display text-display-lg text-ink">Obrigada.</h1>
        <p className="mt-3 text-body-sm text-neutral-700 text-pretty">
          O quintal fica melhor com o que você acabou de mandar.
        </p>
        <div className="mt-6">
          <Button variant="secondary" size="lg" fullWidth onClick={() => navigate('/')}>
            Pedir mais alguma coisa
          </Button>
        </div>
      </main>
    );
  }

  return (
    <>
      <TelaHeader
        voltarPara={`/pedido/${orderId}`}
        titulo={
          <span className="text-meta uppercase text-neutral-700 tabular">
            #{order.shortId} · Avaliar
          </span>
        }
      />

      <main className="pb-28">
        <section className="px-4 py-4">
          <h1 className="font-display text-display-md text-ink">Como foi?</h1>
          <p className="mt-1 text-meta text-neutral-600">
            Uma palavra por cozinha. A nota chega só pra cozinha — só ela vê.
          </p>
        </section>

        <div className="px-4 flex flex-col gap-6">
          {order.kitchens.map((k) => (
            <section key={k.kitchenSlug}>
              <h2
                className="font-display text-meta font-bold uppercase text-ink
                           pb-1 mb-2 border-b-rule border-divider"
              >
                {k.kitchenName}
              </h2>

              {/* Sem gap: as cinco células se tocam e formam uma régua só. */}
              <div className="grid grid-cols-5">
                {SCALE.map((s, i) => {
                  const active = ratings[k.kitchenSlug] === s.value;
                  return (
                    <button
                      key={s.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setRatings((r) => ({ ...r, [k.kitchenSlug]: s.value }))}
                      className={[
                        'min-h-[60px] px-1 py-2 flex flex-col items-start justify-center gap-0.5',
                        'border border-divider cursor-pointer transition-colors duration-base ease-out',
                        i > 0 ? 'border-l-0' : '',
                        active ? 'bg-accent text-bg' : 'text-neutral-700 hover:bg-ink/[0.07]',
                      ].join(' ')}
                    >
                      <span className="font-display text-body-lg font-bold tabular px-1">
                        {s.value}
                      </span>
                      <span className="font-display text-label-sm font-bold uppercase px-1 truncate max-w-full">
                        {s.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <section className="px-4 mt-6">
          <label
            htmlFor="note"
            className="block font-display text-label font-bold uppercase text-ink mb-1.5"
          >
            Alguma coisa pra contar?
          </label>
          <textarea
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Algo deu certo? Algo deu errado?"
            rows={3}
            maxLength={280}
            className="w-full px-3 py-2 bg-surface border border-divider rounded-none
                       text-body-sm text-ink placeholder:text-neutral-500
                       caret-accent resize-none
                       focus-visible:border-accent focus-visible:outline-offset-0"
          />
          <p className="mt-1 text-label-sm text-neutral-600 tabular text-right">
            {note.length}/280
          </p>
        </section>
      </main>

      <FaixaFixa>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={!allRated}
          onClick={() => setSent(true)}
        >
          {allRated
            ? 'Enviar'
            : `Falta avaliar ${order.kitchens.length - Object.keys(ratings).length}`}
        </Button>
      </FaixaFixa>
    </>
  );
}
