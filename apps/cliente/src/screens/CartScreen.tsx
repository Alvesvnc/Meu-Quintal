import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@mq/design-system';
import { useCreateOrder, useQuintal } from '../api/hooks';
import {
  useCart,
  groupByKitchen,
  selectItemCount,
  selectTotalCents,
  type CartGroup,
} from '../stores/cart';
import { QtyStepper } from '../components/QtyStepper';
import { fmtBRL } from '../lib/format';

/**
 * Tela 04 ★ — Carrinho multi-restaurante.
 *
 * Cada cozinha = um card independente com botão "Mandar pedido" próprio.
 * Quando há 2+ cozinhas, aparece atalho "Mandar todos os pedidos" no rodapé.
 * Pagamento é direto em cada cozinha quando retirar (não pelo app).
 */
export function CartScreen() {
  const navigate = useNavigate();
  const lines = useCart((s) => s.lines);
  const setQty = useCart((s) => s.setQty);
  const clearKitchen = useCart((s) => s.clearKitchen);
  const addActiveOrder = useCart((s) => s.addActiveOrder);
  const itemCount = useCart(selectItemCount);
  const total = useCart(selectTotalCents);

  const groups = useMemo(() => groupByKitchen(lines), [lines]);
  const { data: quintal } = useQuintal();
  const createOrder = useCreateOrder();

  // Slugs sendo enviados agora (loading state por card)
  const [sendingSlugs, setSendingSlugs] = useState<Set<string>>(new Set());
  const [errorBySlug, setErrorBySlug] = useState<Record<string, string>>({});

  const mesaNumero = quintal?.table.numero;

  const sendOne = async (g: CartGroup, onDone?: (id: string) => void) => {
    setSendingSlugs((prev) => new Set(prev).add(g.kitchenSlug));
    setErrorBySlug((prev) => {
      const next = { ...prev };
      delete next[g.kitchenSlug];
      return next;
    });
    try {
      const res = await createOrder.mutateAsync({
        items: g.lines.map((l) => ({
          menuItemId: l.menuItemId,
          qty: l.qty,
          note: l.note,
        })),
      });
      addActiveOrder({
        id: res.id,
        shortId: res.shortId,
        kitchenSlug: g.kitchenSlug,
        kitchenName: g.kitchenName,
      });
      clearKitchen(g.kitchenSlug);
      onDone?.(res.id);
    } catch (e: any) {
      setErrorBySlug((prev) => ({
        ...prev,
        [g.kitchenSlug]: e?.response?.data?.error ?? 'Não rolou enviar.',
      }));
    } finally {
      setSendingSlugs((prev) => {
        const next = new Set(prev);
        next.delete(g.kitchenSlug);
        return next;
      });
    }
  };

  const sendAll = async () => {
    const ids: string[] = [];
    await Promise.all(
      groups.map((g) => sendOne(g, (id) => ids.push(id))),
    );
    // Se todos foram enviados, navega pra lista
    if (ids.length === groups.length) {
      navigate('/pedidos');
    }
  };

  // ─── Vazio ──────────────────────────────────────────────────────────────
  if (itemCount === 0) {
    return (
      <main className="px-5 py-10">
        <h1 className="font-display italic text-display-lg text-ink leading-tight text-pretty">
          O carrinho está pronto.
        </h1>
        <p className="mt-3 font-sans text-body text-inkMuted">
          Adicione itens de qualquer cozinha do quintal. Cada cozinha recebe seu
          pedido separado — e cobra direto quando você retirar.
        </p>
        <div className="mt-7">
          <Button variant="primary" size="lg" fullWidth onClick={() => navigate('/')}>
            Ver as cozinhas
          </Button>
        </div>
      </main>
    );
  }

  const hasMultiple = groups.length > 1;

  return (
    <>
      <main className={hasMultiple ? 'pb-64 px-5' : 'pb-24 px-5'}>
        <section className="pt-6 pb-4">
          <p className="font-mono text-mono-sm uppercase tracking-wider text-inkDim">
            {mesaNumero ? `Mesa ${String(mesaNumero).padStart(2, '0')} · ` : ''}Seus carrinhos
          </p>
          <h1 className="mt-1 font-display text-display-lg italic text-ink leading-tight text-pretty">
            {hasMultiple
              ? <>{groups.length} cozinhas, <span className="text-primary">{groups.length} pedidos.</span></>
              : <>Um pedido <span className="text-primary">pronto pra mandar.</span></>}
          </h1>
        </section>

        <div className="space-y-5">
          {groups.map((g) => {
            const sla = quintal?.kitchens.find((k) => k.slug === g.kitchenSlug)?.slaMinutes;
            const isSending = sendingSlugs.has(g.kitchenSlug);
            const error = errorBySlug[g.kitchenSlug];

            return (
              <article
                key={g.kitchenSlug}
                className="rounded-lg border border-hairline bg-surface overflow-hidden"
              >
                {/* Header do card */}
                <header className="px-5 pt-5 pb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="font-display text-display-md italic text-ink leading-tight truncate">
                      {g.kitchenName}
                    </h2>
                    {sla && (
                      <p className="mt-1 font-mono text-mono-sm uppercase tracking-wider text-inkDim">
                        ~{sla} min · pagamento na cozinha
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (g.lines.length === 1 || window.confirm(`Esvaziar o carrinho de ${g.kitchenName}?`)) {
                        clearKitchen(g.kitchenSlug);
                      }
                    }}
                    aria-label={`Esvaziar carrinho de ${g.kitchenName}`}
                    className="shrink-0 -mt-1 -mr-2 w-10 h-10 rounded-md flex items-center justify-center
                               font-mono text-mono text-inkDim cursor-pointer
                               hover:bg-bg hover:text-danger
                               transition-colors duration-base ease-out"
                  >
                    ×
                  </button>
                </header>

                {/* Items */}
                <ul className="divide-y divide-hairlineSoft px-5">
                  {g.lines.map((line) => (
                    <li key={line.menuItemId} className="py-3 flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-sans text-body-lg text-ink leading-tight">
                          {line.name}
                        </p>
                        {line.note && (
                          <p className="mt-0.5 font-sans text-body-sm italic text-inkMuted">
                            “{line.note}”
                          </p>
                        )}
                        <p className="mt-1 font-mono text-mono-sm text-inkDim">
                          {fmtBRL(line.priceCents)} · un
                        </p>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-2">
                        <QtyStepper
                          value={line.qty}
                          onChange={(n) => setQty(line.menuItemId, n)}
                          size="sm"
                          label={`Quantidade de ${line.name}`}
                        />
                        <p className="font-mono text-body text-ink">
                          {fmtBRL(line.priceCents * line.qty)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>

                {/* Footer do card: subtotal + ação */}
                <footer className="px-5 pt-3 pb-5 border-t border-hairlineSoft bg-bg/40">
                  <div className="flex items-baseline justify-between mb-3">
                    <span className="font-mono text-label uppercase tracking-wider text-inkDim">
                      Subtotal
                    </span>
                    <span className="font-mono text-mono-lg text-ink">
                      {fmtBRL(g.subtotalCents)}
                    </span>
                  </div>
                  <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    loading={isSending}
                    disabled={isSending}
                    onClick={() => sendOne(g, () => navigate('/pedidos'))}
                  >
                    <span className="flex-1 text-left">
                      {isSending ? 'Enviando…' : `Mandar pra ${g.kitchenName}`}
                    </span>
                  </Button>
                  {error && (
                    <p className="mt-2 font-mono text-mono-sm text-danger">
                      {error}
                    </p>
                  )}
                </footer>
              </article>
            );
          })}
        </div>

      </main>

      {/* Rodapé: "Mandar todos" só se 2+ cozinhas */}
      {hasMultiple && (
        <div className="fixed inset-x-0 bottom-16 z-30 pointer-events-none">
          <div className="mx-auto max-w-[480px] px-5 py-3 bg-bg/95 backdrop-blur-[2px] border-t border-hairline pointer-events-auto">
            <div className="flex items-baseline justify-between mb-1">
              <span className="font-mono text-label uppercase tracking-wider text-inkDim">
                Total ({groups.length} pedidos)
              </span>
              <span className="font-mono text-mono-lg text-primary">{fmtBRL(total)}</span>
            </div>
            <p className="mb-3 font-sans text-body-sm italic text-inkDim">
              Cada cozinha recebe seu pedido separado.
            </p>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              loading={sendingSlugs.size > 0}
              disabled={sendingSlugs.size > 0}
              onClick={sendAll}
            >
              <span className="flex-1 text-left">
                {sendingSlugs.size > 0 ? 'Enviando todos…' : `Mandar todos (${groups.length})`}
              </span>
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
