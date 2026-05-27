import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Chip, Sheet, SheetBody, SheetFooter, SheetHeader } from '@mq/design-system';
import { getItemById, fmtBRL } from '../mocks/menu';
import { useCart } from '../stores/cart';
import { QtyStepper } from '../components/QtyStepper';

/**
 * Tela 03 — Detalhe do item.
 * Renderizado como sheet sobre MenuScreen (route aninhada). Fecha = volta pra /k/:slug.
 * pages/cliente.md § "Cardápio" / sheet vs tela cheia.
 */
export function ItemDetailSheet() {
  const { slug = '', itemId = '' } = useParams<{ slug: string; itemId: string }>();
  const navigate = useNavigate();
  const item = getItemById(itemId);
  const lines = useCart((s) => s.lines);
  const addLine = useCart((s) => s.addLine);
  const existing = lines.find((l) => l.menuItemId === itemId);

  const [qty, setQty] = useState(existing?.qty ?? 1);
  const [note, setNote] = useState(existing?.note ?? '');

  // Resync se trocar de item sem fechar
  useEffect(() => {
    setQty(existing?.qty ?? 1);
    setNote(existing?.note ?? '');
  }, [itemId]);

  const close = () => navigate(`/k/${slug}`);

  if (!item) {
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
    if (existing) {
      // setQty deletaria se qty=0; aqui é Atualizar com novo qty (delta = qty - existing.qty)
      useCart.getState().setQty(item.id, qty);
      if (note !== existing.note) {
        const next = useCart.getState().lines.map((l) =>
          l.menuItemId === item.id ? { ...l, note } : l,
        );
        useCart.setState({ lines: next });
      }
    } else {
      addLine(item, qty, note || undefined);
    }
    close();
  };

  return (
    <Sheet open onClose={close} ariaLabel={`Detalhe ${item.name}`}>
      <SheetBody>
        <div className="rounded-lg overflow-hidden bg-surface aspect-[4/3] mb-5 -mx-1">
          <img
            src={item.photoUrl}
            alt={item.name}
            className="w-full h-full object-cover"
          />
        </div>

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

        <p className="font-sans text-body text-inkMuted leading-relaxed text-pretty">
          {item.description}
        </p>

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
          <p className="mt-1 font-mono text-mono-sm text-inkDim text-right">
            {note.length}/140
          </p>
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
            {!unavailable && (
              <span className="font-mono">{fmtBRL(totalCents)}</span>
            )}
          </Button>
        </div>
      </SheetFooter>
    </Sheet>
  );
}
