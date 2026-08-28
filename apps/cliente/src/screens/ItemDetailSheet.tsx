import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Chip, Sheet, SheetBody, SheetFooter } from '@mq/design-system';
import { useKitchenMenu } from '../api/hooks';
import { useCart } from '../stores/cart';
import { QtyStepper } from '../components/QtyStepper';
import { fmtBRL } from '../lib/format';
import { fotosDoItem } from '../lib/fotos';

/**
 * Tela 03 — Detalhe do item. Sheet sobre MenuScreen.
 *
 * O `key` remonta o formulario quando o item muda, e o estado volta a ser lido
 * das props. A alternativa — um useEffect chamando setQty/setNote — pinta o
 * item novo com a quantidade do anterior por um frame antes de corrigir.
 */
export function ItemDetailSheet() {
  const { itemId = '' } = useParams<{ itemId: string }>();
  return <DetalheDoItem key={itemId} />;
}

function DetalheDoItem() {
  const { slug = '', itemId = '' } = useParams<{ slug: string; itemId: string }>();
  const navigate = useNavigate();
  const { data } = useKitchenMenu(slug);
  const item = data?.items.find((i) => i.id === itemId);
  const lines = useCart((s) => s.lines);
  const addLine = useCart((s) => s.addLine);
  const existing = lines.find((l) => l.menuItemId === itemId);

  const [qty, setQty] = useState(existing?.qty ?? 1);
  const [note, setNote] = useState(existing?.note ?? '');

  const close = () => navigate(`/k/${slug}`);

  if (!item || !data) {
    return (
      <Sheet open onClose={close} ariaLabel="Item não encontrado">
        <SheetBody>
          <h2 className="font-display text-display-md text-ink py-6">
            Esse item saiu do cardápio.
          </h2>
        </SheetBody>
        <SheetFooter>
          <Button variant="secondary" size="lg" fullWidth onClick={close}>
            Voltar pro cardápio
          </Button>
        </SheetFooter>
      </Sheet>
    );
  }

  const unavailable = !item.available;
  const totalCents = item.priceCents * qty;
  const cta = existing ? 'Atualizar pedido' : 'Adicionar';

  const handleConfirm = () => {
    if (unavailable) return;
    const kitchen = { slug: data.kitchen.slug, name: data.kitchen.name };
    if (existing) {
      useCart.getState().setQty(item.id, qty);
      if (note !== existing.note) {
        const next = useCart.getState().lines.map((l) =>
          l.menuItemId === item.id ? { ...l, note } : l,
        );
        useCart.setState({ lines: next });
      }
    } else {
      addLine(item, kitchen, qty, note || undefined);
    }
    close();
  };

  return (
    <Sheet
      open
      onClose={close}
      ariaLabel={`Detalhe ${item.name}`}
      topo={
        <span className="font-display text-meta font-bold uppercase text-neutral-700">
          {data.kitchen.name}
        </span>
      }
    >
      <SheetBody>
        <Galeria fotos={fotosDoItem(item)} nome={item.name} />

        <div className="flex flex-col gap-3 pt-4">
          {item.badge === 'novo' && (
            <Chip tone="solid" className="self-start">
              Novo
            </Chip>
          )}
          {item.badge === 'esgotando' && (
            <Chip tone="outline" className="self-start">
              Últimos
            </Chip>
          )}
          {(item.badge === 'sem-estoque' || unavailable) && (
            <Chip tone="neutral" className="self-start">
              Esgotado
            </Chip>
          )}

          <h2 className="font-display text-display-sm text-ink text-pretty">{item.name}</h2>

          {item.description && (
            <p className="text-body-sm text-neutral-700 text-pretty">{item.description}</p>
          )}

          <p className="font-display text-display-md text-ink tabular">
            {fmtBRL(item.priceCents)}
          </p>

          <div className="h-[2px] w-full bg-divider my-1" />

          <div className="flex items-center justify-between gap-3">
            <span className="font-display text-label font-bold uppercase text-neutral-600">
              Quantidade
            </span>
            <QtyStepper
              value={qty}
              onChange={setQty}
              min={1}
              max={20}
              label={`Quantidade de ${item.name}`}
            />
          </div>

          <div className="mt-1">
            <label
              htmlFor="note"
              className="block font-display text-label font-bold uppercase text-ink mb-1.5"
            >
              Observações
            </label>
            <textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="ex: sem chimichurri"
              rows={2}
              maxLength={140}
              className="w-full px-3 py-2 bg-surface border border-divider rounded-none
                         text-body-sm text-ink placeholder:text-neutral-500
                         caret-accent resize-none
                         focus-visible:border-accent focus-visible:outline-offset-0"
            />
            <p className="mt-1 text-label-sm text-neutral-600 tabular text-right">
              {note.length}/140
            </p>
          </div>
        </div>
      </SheetBody>

      <SheetFooter>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={unavailable}
          onClick={handleConfirm}
        >
          <span>{unavailable ? 'Esgotado' : cta}</span>
          {!unavailable && <span className="ml-auto tabular">{fmtBRL(totalCents)}</span>}
        </Button>
      </SheetFooter>
    </Sheet>
  );
}

interface GaleriaProps {
  fotos: string[];
  nome: string;
}

/**
 * As fotos do prato.
 *
 * Rolagem horizontal com encaixe (`snap`), não carrossel com setas: o gesto de
 * arrastar já é o esperado num celular, e setas ocupariam área de toque em cima
 * da própria imagem.
 *
 * A linha de quadradinhos embaixo existe porque, com encaixe, a segunda foto
 * não "espia" na borda — sem ela não há nada dizendo que existe mais. O `1 / 3`
 * à direita diz quantas, que os quadradinhos sozinhos não dizem quando são
 * muitos.
 */
function Galeria({ fotos, nome }: GaleriaProps) {
  const [atual, setAtual] = useState(0);

  if (fotos.length === 0) {
    return <div className="-mx-4 aspect-[4/3] bg-neutral-200 border-b-rule border-divider" />;
  }

  return (
    <div className="-mx-4">
      <div
        onScroll={(e) => {
          const el = e.currentTarget;
          // Divide pela largura do container, que é a de uma foto: com
          // `snap-center` e largura total, o índice é a posição inteira.
          setAtual(Math.round(el.scrollLeft / el.clientWidth));
        }}
        className="flex overflow-x-auto snap-x snap-mandatory
                   [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {fotos.map((src, i) => (
          <img
            key={src}
            src={src}
            alt={fotos.length > 1 ? `${nome} — foto ${i + 1} de ${fotos.length}` : nome}
            // A primeira carrega logo: é a que já está na tela quando o sheet
            // abre. As outras só quando o cliente arrastar.
            loading={i === 0 ? 'eager' : 'lazy'}
            decoding="async"
            className="w-full shrink-0 snap-center aspect-[4/3] object-cover bg-neutral-200"
          />
        ))}
      </div>

      <div className="flex items-center gap-1.5 px-4 py-2 border-b-rule border-divider">
        {fotos.length > 1 && (
          <>
            {fotos.map((src, i) => (
              <span
                key={src}
                aria-hidden
                className={`w-2.5 h-2.5 ${i === atual ? 'bg-accent' : 'bg-neutral-300'}`}
              />
            ))}
            <span className="ml-auto text-label-sm text-neutral-600 tabular">
              {atual + 1} / {fotos.length}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
