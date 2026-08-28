import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@mq/design-system';
import { Banknote, ChevronRight } from 'lucide-react';
import { mensagemDeErro } from '@mq/shared';
import { useCreateOrder, useQuintal } from '../api/hooks';
import {
  useCart,
  groupByKitchen,
  selectItemCount,
  selectTotalCents,
  type CartGroup,
} from '../stores/cart';
import { QtyStepper } from '../components/QtyStepper';
import { Foto } from '../components/Foto';
import { fmtBRL } from '../lib/format';

/**
 * Tela 04 ★ — Carrinho multi-restaurante.
 *
 * Uma lista só, agrupada por cozinha, e UM botão no rodapé. Antes cada cozinha
 * era um card com botão próprio e havia um "mandar todos" embaixo: com duas
 * cozinhas a tela tinha três botões primários vermelhos disputando o mesmo
 * gesto.
 *
 * O envio continua sendo um pedido POR COZINHA — isso é do servidor e não
 * mudou. Mandar só uma delas virou ação secundária em texto, que é onde ela
 * pertence: é a exceção, não o caminho.
 *
 * Pagamento é direto em cada cozinha quando retirar (não pelo app).
 */
export function CartScreen() {
  const navigate = useNavigate();
  const lines = useCart((s) => s.lines);
  const setQty = useCart((s) => s.setQty);
  const clearKitchen = useCart((s) => s.clearKitchen);
  const nome = useCart((s) => s.nome);
  const setNome = useCart((s) => s.setNome);
  const addActiveOrder = useCart((s) => s.addActiveOrder);
  const itemCount = useCart(selectItemCount);
  const total = useCart(selectTotalCents);

  const groups = useMemo(() => groupByKitchen(lines), [lines]);
  const { data: quintal } = useQuintal();
  const createOrder = useCreateOrder();

  // Slugs sendo enviados agora (loading state por cozinha)
  const [sendingSlugs, setSendingSlugs] = useState<Set<string>>(new Set());
  const [errorBySlug, setErrorBySlug] = useState<Record<string, string>>({});

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
    } catch (e) {
      setErrorBySlug((prev) => ({
        ...prev,
        [g.kitchenSlug]: mensagemDeErro(e, 'Não rolou enviar.'),
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
    await Promise.all(groups.map((g) => sendOne(g, (id) => ids.push(id))));
    // Se todos foram enviados, navega pra lista
    if (ids.length === groups.length) {
      navigate('/pedidos');
    }
  };

  // ─── Vazio ──────────────────────────────────────────────────────────────
  if (itemCount === 0) {
    return (
      <main className="px-4 py-8">
        <h1 className="font-display text-display-lg text-ink text-pretty">Carrinho vazio.</h1>
        <p className="mt-3 text-body-sm text-neutral-700 text-pretty">
          Junte itens de quantas cozinhas quiser. Cada uma recebe seu pedido separado — e cobra
          direto quando você retirar.
        </p>
        <div className="mt-6">
          <Button variant="primary" size="lg" fullWidth onClick={() => navigate('/')}>
            <span>Ver as cozinhas</span>
            <ChevronRight size={18} strokeWidth={2} aria-hidden className="ml-auto" />
          </Button>
        </div>
      </main>
    );
  }

  const enviando = sendingSlugs.size > 0;
  const varias = groups.length > 1;

  return (
    <main className="pb-8">
      <section className="px-4 py-4">
        <h1 className="font-display text-display-md text-ink">Seu pedido.</h1>
        <p className="mt-1 text-meta text-neutral-600 tabular">
          {itemCount} {itemCount === 1 ? 'item' : 'itens'} · {groups.length}{' '}
          {groups.length === 1 ? 'cozinha' : 'cozinhas'}
        </p>
      </section>

      <div className="px-4 flex flex-col gap-6">
        {groups.map((g) => {
          const enviandoEsta = sendingSlugs.has(g.kitchenSlug);
          const erro = errorBySlug[g.kitchenSlug];

          return (
            <section key={g.kitchenSlug}>
              <h2
                className="font-display text-meta font-bold uppercase text-ink
                           pb-1 mb-2 border-b-rule border-divider"
              >
                {g.kitchenName}
              </h2>

              <ul>
                {g.lines.map((line) => (
                  <li
                    key={line.menuItemId}
                    className="flex items-center gap-3 py-3 border-b border-divider last:border-b-0"
                  >
                    <Foto src={line.foto} alt="" className="w-[52px] h-[52px] shrink-0" />

                    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <p className="text-body-sm font-medium text-ink truncate">{line.name}</p>
                      <span className="text-meta text-neutral-600 tabular">
                        {line.qty > 1 ? `${line.qty} × ` : ''}
                        {fmtBRL(line.priceCents)}
                      </span>
                      {line.note && (
                        <span className="text-meta text-neutral-600 truncate">“{line.note}”</span>
                      )}
                    </div>

                    <QtyStepper
                      value={line.qty}
                      onChange={(n) => setQty(line.menuItemId, n)}
                      size="sm"
                      label={`Quantidade de ${line.name}`}
                    />
                  </li>
                ))}
              </ul>

              <div className="mt-2 flex items-center gap-6">
                {varias && (
                  <button
                    type="button"
                    disabled={enviando}
                    onClick={() => sendOne(g, () => navigate('/pedidos'))}
                    className="font-display text-label font-bold uppercase text-neutral-600
                               cursor-pointer hover:text-accent transition-colors duration-base ease-out
                               disabled:opacity-45 disabled:cursor-not-allowed"
                  >
                    {enviandoEsta ? 'Enviando…' : `Mandar só pra ${g.kitchenName}`}
                  </button>
                )}
                <button
                  type="button"
                  disabled={enviando}
                  onClick={() => clearKitchen(g.kitchenSlug)}
                  aria-label={`Esvaziar carrinho de ${g.kitchenName}`}
                  className="font-display text-label font-bold uppercase text-neutral-600
                             cursor-pointer hover:text-accent transition-colors duration-base ease-out
                             disabled:opacity-45 disabled:cursor-not-allowed"
                >
                  Esvaziar
                </button>
              </div>

              {erro && <p className="mt-2 text-meta text-accent-700">{erro}</p>}
            </section>
          );
        })}
      </div>

      <footer className="mt-6 px-4 pt-4 border-t-rule border-divider flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <span className="font-display text-label font-bold uppercase text-neutral-600">
            Total
          </span>
          <span className="font-display text-mono-lg text-ink tabular">{fmtBRL(total)}</span>
        </div>

        <p className="flex items-center gap-1.5 text-meta text-neutral-600">
          <Banknote size={14} strokeWidth={2} aria-hidden className="shrink-0" />
          Cada cozinha cobra na retirada.
        </p>

        {/*
          O NOME É PEDIDO AQUI, E NÃO NA ENTRADA.

          Na porta seria mais uma tela entre a pessoa e o cardápio, e atrito
          antes de ver o preço derruba quem ia comprar. Aqui ela já decidiu — e
          o campo tem propósito visível: é o que faz a comida chegar na pessoa
          certa numa mesa com várias.

          OPCIONAL de verdade. Quem pular cai na conta da mesa, que é como
          funcionava antes. Obrigatório, ele devolveria o atrito que existe pra
          evitar.
        */}
        <div className="mt-1">
          <label
            htmlFor="nome-cliente"
            className="block font-display text-label font-bold uppercase text-neutral-600 mb-1.5"
          >
            Seu nome <span className="normal-case font-normal">(opcional)</span>
          </label>
          <input
            id="nome-cliente"
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            maxLength={40}
            autoComplete="given-name"
            placeholder="Pra cozinha saber de quem é"
            className="w-full px-3 py-2.5 bg-bg border-rule border-divider
                       text-body text-ink placeholder:text-neutral-500
                       focus:outline-none focus:border-accent"
          />
          <p className="mt-1.5 text-meta text-neutral-600">
            Separa a sua conta da de quem está na mesma mesa.
          </p>
        </div>

        <div className="mt-1">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={enviando}
            disabled={enviando}
            onClick={sendAll}
          >
            <span>{enviando ? 'Enviando…' : 'Mandar pedido'}</span>
            {!enviando && (
              <ChevronRight size={18} strokeWidth={2} aria-hidden className="ml-auto" />
            )}
          </Button>
        </div>

        {quintal && (
          <p className="mt-1 text-label-sm text-neutral-600 uppercase font-display font-bold">
            {quintal.space.name}
          </p>
        )}
      </footer>
    </main>
  );
}
