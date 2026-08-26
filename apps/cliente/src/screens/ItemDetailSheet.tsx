import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Chip, Sheet, SheetBody, SheetFooter, SheetHeader } from '@mq/design-system';
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
          <p className="font-display italic text-display-md text-ink py-6">
            Esse item saiu do cardápio.
          </p>
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
    <Sheet open onClose={close} ariaLabel={`Detalhe ${item.name}`}>
      <SheetBody>
        <Galeria fotos={fotosDoItem(item)} nome={item.name} />

        <SheetHeader>
          <div className="flex items-start gap-2">
            <h2 className="font-display text-display-md italic text-ink flex-1 leading-tight">
              {item.name}
            </h2>
            {item.badge === 'novo' && <Chip tone="primary">novo</Chip>}
            {item.badge === 'esgotando' && <Chip tone="warn">últimos</Chip>}
            {item.badge === 'sem-estoque' && <Chip tone="danger">esgotado</Chip>}
          </div>
        </SheetHeader>

        {item.description && (
          <p className="font-sans text-body text-inkMuted leading-relaxed text-pretty">
            {item.description}
          </p>
        )}

        <div className="mt-6">
          <label htmlFor="note" className="block font-mono text-label uppercase tracking-wider text-inkDim mb-2">
            Observação <span className="text-inkDim/70 normal-case tracking-normal">· opcional</span>
          </label>
          <textarea
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="ex: sem cebola, ponto bem-passado"
            rows={2}
            maxLength={140}
            className="w-full px-4 py-3 bg-surface border border-hairline rounded-md
                       font-sans text-body text-ink placeholder:text-inkDim
                       focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primaryWash
                       resize-none"
          />
          <p className="mt-1 font-mono text-mono-sm text-inkDim text-right">{note.length}/140</p>
        </div>
      </SheetBody>

      <SheetFooter>
        <div className="flex items-center gap-4">
          <QtyStepper value={qty} onChange={setQty} min={1} max={20} label={`Quantidade de ${item.name}`} />
          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={unavailable}
            onClick={handleConfirm}
            className="flex-1"
          >
            <span className="flex-1 text-left">{unavailable ? 'Esgotado' : cta}</span>
            {!unavailable && <span className="font-mono">{fmtBRL(totalCents)}</span>}
          </Button>
        </div>
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
 * Os pontos embaixo existem porque, com encaixe, a segunda foto não "espia" na
 * borda — sem eles não há nada dizendo que existe mais.
 */
function Galeria({ fotos, nome }: GaleriaProps) {
  const [atual, setAtual] = useState(0);

  if (fotos.length === 0) {
    return <div className="rounded-lg bg-surface aspect-[4/3] mb-5 -mx-1" />;
  }

  return (
    <div className="mb-5 -mx-1">
      <div
        onScroll={(e) => {
          const el = e.currentTarget;
          // Divide pela largura do container, que é a de uma foto: com
          // `snap-center` e largura total, o índice é a posição inteira.
          setAtual(Math.round(el.scrollLeft / el.clientWidth));
        }}
        className="flex overflow-x-auto snap-x snap-mandatory rounded-lg
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
            className="w-full shrink-0 snap-center aspect-[4/3] object-cover bg-surface"
          />
        ))}
      </div>

      {fotos.length > 1 && (
        <div className="mt-2 flex justify-center gap-1.5" aria-hidden>
          {fotos.map((src, i) => (
            <span
              key={src}
              className={[
                'h-1.5 rounded-full transition-all duration-base ease-out',
                i === atual ? 'w-4 bg-ink' : 'w-1.5 bg-inkDim/40',
              ].join(' ')}
            />
          ))}
        </div>
      )}
    </div>
  );
}
