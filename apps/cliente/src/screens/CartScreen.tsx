import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Divider } from '@mq/design-system';
import { KITCHENS } from '../mocks/quintal';
import { fmtBRL } from '../mocks/menu';
import { useCart, groupByKitchen, selectItemCount, selectTotalCents } from '../stores/cart';
import { QtyStepper } from '../components/QtyStepper';

/**
 * Tela 04 ★ — Carrinho multi-restaurante.
 * Agrupa por cozinha (label uppercase mono entre grupos), sumario sticky bottom.
 * pages/cliente.md § "Carrinho multi-restaurante".
 */
export function CartScreen() {
  const navigate = useNavigate();
  const lines = useCart((s) => s.lines);
  const groups = useMemo(() => groupByKitchen(lines), [lines]);
  const itemCount = useCart(selectItemCount);
  const total = useCart(selectTotalCents);
  const setQty = useCart((s) => s.setQty);

  // Tempo estimado = maior ETA das cozinhas presentes no carrinho
  const maxEta = groups.reduce((acc, g) => {
    const k = KITCHENS.find((x) => x.slug === g.kitchenSlug);
    return Math.max(acc, k?.etaMinutes ?? 0);
  }, 0);

  // ─── Vazio ──────────────────────────────────────────────────────────────
  if (itemCount === 0) {
    return (
      <main className="px-5 py-10">
        <h1 className="font-display italic text-display-lg text-ink leading-tight text-pretty">
          O carrinho está pronto.
        </h1>
        <p className="mt-3 font-sans text-body text-inkMuted">
          Adicione itens de qualquer cozinha do quintal. Você paga uma vez só e
          retira em cada balcão.
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
    <>
      <main className="pb-56 px-5">
        <section className="pt-6 pb-2">
          <p className="font-mono text-mono-sm uppercase tracking-wider text-inkDim">
            Mesa 12 · Seu pedido
          </p>
          <h1 className="mt-1 font-display text-display-lg italic text-ink leading-tight text-pretty">
            {groups.length === 1 ? 'Uma cozinha' : `${groups.length} cozinhas`},{' '}
            <span className="text-primary">um pedido só.</span>
          </h1>
        </section>

        {groups.map((g) => {
          const kitchen = KITCHENS.find((k) => k.slug === g.kitchenSlug);
          return (
            <section key={g.kitchenSlug} className="mt-6">
              <Divider
                label={`${kitchen?.name ?? g.kitchenSlug} · ~${kitchen?.etaMinutes ?? '?'} min`}
              />
              <ul className="divide-y divide-hairlineSoft">
                {g.lines.map(({ line, item }) => (
                  <li key={line.menuItemId} className="py-4 flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-sans text-body-lg text-ink leading-tight">
                        {item.name}
                      </p>
                      {line.note && (
                        <p className="mt-1 font-sans text-body-sm italic text-inkMuted">
                          “{line.note}”
                        </p>
                      )}
                      <p className="mt-1 font-mono text-mono text-inkDim">
                        {fmtBRL(item.priceCents)} · un
                      </p>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-2">
                      <QtyStepper
                        value={line.qty}
                        onChange={(n) => setQty(line.menuItemId, n)}
                        size="sm"
                        label={`Quantidade de ${item.name}`}
                      />
                      <p className="font-mono text-body text-ink">
                        {fmtBRL(item.priceCents * line.qty)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-1 font-mono text-mono text-inkDim text-right">
                Subtotal · {fmtBRL(g.subtotalCents)}
              </p>
            </section>
          );
        })}

        <div className="mt-8">
          <Button variant="ghost" size="md" onClick={() => navigate('/')}>
            ← Adicionar mais
          </Button>
        </div>
      </main>

      {/* Sumário sticky bottom — acima das tabs (bottom-16) */}
      <div className="fixed inset-x-0 bottom-16 z-30 pointer-events-none">
        <div className="mx-auto max-w-[480px] px-5 py-4 bg-bg/95 backdrop-blur-[2px] border-t border-hairline pointer-events-auto">
          <div className="flex items-baseline justify-between mb-2">
            <span className="font-mono text-label uppercase tracking-wider text-inkDim">
              Total
            </span>
            <span className="font-mono text-mono-lg text-primary">
              {fmtBRL(total)}
            </span>
          </div>
          <p className="mb-3 font-mono text-mono-sm text-inkMuted">
            {itemCount} {itemCount === 1 ? 'item' : 'itens'} · {groups.length}{' '}
            {groups.length === 1 ? 'cozinha' : 'cozinhas'} · tempo estimado{' '}
            <span className="text-ink">~{maxEta} min</span>
          </p>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => {
              const id = useCart.getState().checkout();
              navigate(`/pedido/${id}`);
            }}
          >
            <span className="flex-1 text-left">Pagar e enviar</span>
            <span className="font-mono">{fmtBRL(total)}</span>
          </Button>
        </div>
      </div>
    </>
  );
}
