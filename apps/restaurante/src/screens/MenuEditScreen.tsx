import { useState } from 'react';
import { Divider, Button } from '@mq/design-system';
import {
  MENU_ADMIN, fmtBRL, CATEGORY_LABEL,
  type MenuItemAdmin, type MenuCategory,
} from '../mocks/orders';
import { Switch } from '../components/Switch';
import { EditItemSheet } from './EditItemSheet';

const CATEGORIES: MenuCategory[] = ['entradas', 'pratos', 'sobremesas', 'bebidas'];

/**
 * Tela 04 — Editar cardápio.
 * Tap no nome do item abre sheet completo (nome, categoria, descrição, preço, excluir).
 * Tap no switch esgota inline. Tap no preço edita inline (atalho rápido).
 * pages/restaurante.md § "Tela 04 — Editar cardápio".
 */
function blankItem(): MenuItemAdmin {
  return {
    id: 'new-' + Date.now(),
    category: 'pratos',
    name: '',
    description: '',
    priceCents: 0,
    available: true,
  };
}

export function MenuEditScreen() {
  const [items, setItems] = useState<MenuItemAdmin[]>(MENU_ADMIN);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftNew, setDraftNew] = useState<MenuItemAdmin | null>(null);

  const sheetItem = draftNew ?? items.find((i) => i.id === editingId) ?? null;
  const isNew = draftNew != null;

  const toggleAvailable = (id: string) => {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, available: !x.available } : x)));
  };

  const updatePrice = (id: string, cents: number) => {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, priceCents: cents } : x)));
  };

  const saveItem = (updated: MenuItemAdmin) => {
    if (isNew) {
      setItems((xs) => [...xs, updated]);
    } else {
      setItems((xs) => xs.map((x) => (x.id === updated.id ? updated : x)));
    }
  };

  const deleteItem = (id: string) => {
    setItems((xs) => xs.filter((x) => x.id !== id));
  };

  const closeSheet = () => {
    setEditingId(null);
    setDraftNew(null);
  };

  const openNew = () => setDraftNew(blankItem());

  return (
    <main className="px-5 pb-28">
      <section className="pt-6">
        <p className="font-mono text-mono-sm uppercase tracking-wider text-inkDim">
          Cardápio · {items.filter((i) => i.available).length}/{items.length} disponíveis
        </p>
        <h1 className="mt-1 font-display text-display-lg italic text-ink leading-tight">
          Editar cardápio.
        </h1>
        <p className="mt-2 font-sans text-body text-inkMuted">
          Toque no <b>nome</b> pra editar tudo. Toque no <b>switch</b> pra esgotar. Toque no <b>preço</b> pra atualizar rápido.
        </p>
      </section>

      <div className="mt-7 space-y-7">
        {CATEGORIES.map((c) => {
          const inCat = items.filter((i) => i.category === c);
          if (inCat.length === 0) return null;
          return (
            <section key={c}>
              <Divider label={CATEGORY_LABEL[c]} />
              <ul className="mt-2 divide-y divide-hairlineSoft">
                {inCat.map((item) => (
                  <li key={item.id}>
                    <MenuRow
                      item={item}
                      onToggle={() => toggleAvailable(item.id)}
                      onPriceChange={(cents) => updatePrice(item.id, cents)}
                      onEdit={() => setEditingId(item.id)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      {/* FAB Adicionar */}
      <div className="fixed inset-x-0 bottom-16 z-20 pointer-events-none">
        <div className="mx-auto max-w-[480px] px-5 pb-3 pointer-events-auto flex justify-end">
          <Button variant="primary" size="lg" onClick={openNew}>
            + Item
          </Button>
        </div>
      </div>

      <EditItemSheet
        item={sheetItem}
        isNew={isNew}
        onClose={closeSheet}
        onSave={saveItem}
        onDelete={deleteItem}
      />
    </main>
  );
}

interface MenuRowProps {
  item: MenuItemAdmin;
  onToggle: () => void;
  onPriceChange: (cents: number) => void;
  onEdit: () => void;
}

function MenuRow({ item, onToggle, onPriceChange, onEdit }: MenuRowProps) {
  const [editingPrice, setEditingPrice] = useState(false);
  const [draft, setDraft] = useState((item.priceCents / 100).toFixed(2).replace('.', ','));

  const commit = () => {
    const num = parseFloat(draft.replace(',', '.'));
    if (!isNaN(num) && num > 0) {
      onPriceChange(Math.round(num * 100));
    } else {
      setDraft((item.priceCents / 100).toFixed(2).replace('.', ','));
    }
    setEditingPrice(false);
  };

  return (
    <div className={`flex items-center gap-4 py-4 ${item.available ? '' : 'opacity-55'}`}>
      <Switch checked={item.available} onChange={onToggle} ariaLabel={`Disponível: ${item.name}`} />

      <button
        type="button"
        onClick={onEdit}
        aria-label={`Editar ${item.name}`}
        className="flex-1 min-w-0 text-left cursor-pointer
                   transition-colors duration-base ease-out hover:text-primary"
      >
        <p className="font-sans text-body-lg text-ink leading-tight">
          {item.name}
        </p>
        {!item.available && (
          <p className="mt-0.5 font-mono text-mono-sm uppercase tracking-wider text-danger">
            esgotado
          </p>
        )}
      </button>

      <div className="shrink-0">
        {editingPrice ? (
          <input
            type="text"
            inputMode="decimal"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
            className="w-24 h-11 px-2 text-right
                       bg-bg border border-primary rounded-md
                       font-mono text-body text-ink
                       focus:outline-none focus:ring-[3px] focus:ring-primaryWash"
          />
        ) : (
          <button
            type="button"
            onClick={() => { setDraft((item.priceCents / 100).toFixed(2).replace('.', ',')); setEditingPrice(true); }}
            className="h-11 px-3 rounded-md border border-hairline bg-surface
                       font-mono text-body text-ink cursor-pointer tabular-nums
                       hover:border-primary hover:text-primary
                       transition-colors duration-base ease-out"
          >
            {fmtBRL(item.priceCents)}
          </button>
        )}
      </div>
    </div>
  );
}
