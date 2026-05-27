import { useState, useEffect, useRef } from 'react';
import {
  Button, Sheet, SheetBody, SheetFooter, SheetHeader,
} from '@mq/design-system';
import { CATEGORY_LABEL, type MenuItemAdmin, type MenuCategory } from '../mocks/orders';

interface EditItemSheetProps {
  item: MenuItemAdmin | null;
  /** Modo criação — esconde "excluir", muda título, foca o nome. */
  isNew?: boolean;
  onClose: () => void;
  onSave: (updated: MenuItemAdmin) => void;
  onDelete: (id: string) => void;
}

/**
 * Sheet de edição/criação de item de cardápio.
 * Campos: foto, nome, categoria, descrição, preço, disponível.
 * Ações: salvar (primary), excluir (só edição).
 */
export function EditItemSheet({ item, isNew = false, onClose, onSave, onDelete }: EditItemSheetProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<MenuCategory>('pratos');
  const [description, setDescription] = useState('');
  const [priceStr, setPriceStr] = useState('');
  const [available, setAvailable] = useState(true);
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Mantém objectURL pra revogar ao fechar (evita leak)
  const lastObjectUrlRef = useRef<string | null>(null);

  // Reset on item change
  useEffect(() => {
    if (!item) return;
    setName(item.name);
    setCategory(item.category);
    setDescription(item.description);
    setPriceStr((item.priceCents / 100).toFixed(2).replace('.', ','));
    setAvailable(item.available);
    setPhotoUrl(item.photoUrl);
  }, [item?.id]);

  // Limpa objectURL ao desmontar
  useEffect(() => {
    return () => {
      if (lastObjectUrlRef.current) URL.revokeObjectURL(lastObjectUrlRef.current);
    };
  }, []);

  const open = item != null;

  const handlePickFile = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Revoga URL anterior se houver
    if (lastObjectUrlRef.current) URL.revokeObjectURL(lastObjectUrlRef.current);
    const url = URL.createObjectURL(file);
    lastObjectUrlRef.current = url;
    setPhotoUrl(url);
    e.target.value = ''; // permite re-selecionar o mesmo arquivo
  };

  const handleRemovePhoto = () => {
    if (lastObjectUrlRef.current) {
      URL.revokeObjectURL(lastObjectUrlRef.current);
      lastObjectUrlRef.current = null;
    }
    setPhotoUrl(undefined);
  };

  const handleSave = () => {
    if (!item) return;
    const num = parseFloat(priceStr.replace(',', '.'));
    const priceCents = !isNaN(num) && num > 0 ? Math.round(num * 100) : item.priceCents;
    onSave({
      ...item,
      name: name.trim() || item.name,
      category,
      description: description.trim(),
      priceCents,
      available,
      photoUrl,
    });
    onClose();
  };

  const handleDelete = () => {
    if (!item) return;
    if (window.confirm(`Excluir "${item.name}" do cardápio?`)) {
      onDelete(item.id);
      onClose();
    }
  };

  return (
    <Sheet open={open} onClose={onClose} ariaLabel={item ? `Editar ${item.name}` : 'Editar item'}>
      <SheetHeader>
        <p className="font-mono text-mono-sm uppercase tracking-wider text-inkDim">
          {isNew ? 'Novo item' : `Editar item · #${item?.id}`}
        </p>
        <h2 className="mt-1 font-display text-display-md italic text-ink leading-tight">
          {isNew
            ? (name.trim() || 'Sem nome ainda')
            : item?.name}
        </h2>
      </SheetHeader>

      <SheetBody>
        <div className="space-y-5">
          <Field label="Foto">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            {photoUrl ? (
              <div className="relative rounded-md overflow-hidden bg-surface aspect-[4/3]">
                <img
                  src={photoUrl}
                  alt={name || 'Foto do item'}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 p-2 flex gap-2 bg-gradient-to-t from-ink/60 to-transparent">
                  <button
                    type="button"
                    onClick={handlePickFile}
                    className="flex-1 h-10 px-3 rounded-md bg-bg/95 border border-hairline
                               font-sans text-body-sm text-ink cursor-pointer
                               hover:bg-primaryWash transition-colors duration-base ease-out"
                  >
                    Trocar
                  </button>
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    aria-label="Remover foto"
                    className="h-10 px-3 rounded-md bg-bg/95 border border-hairline
                               font-mono text-mono-sm uppercase tracking-wider text-inkDim cursor-pointer
                               hover:text-danger transition-colors duration-base ease-out"
                  >
                    Remover
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={handlePickFile}
                className="w-full aspect-[4/3] rounded-md border border-dashed border-hairline
                           bg-surface flex flex-col items-center justify-center gap-1 cursor-pointer
                           hover:border-primary hover:bg-primaryWash transition-colors duration-base ease-out"
              >
                <span className="font-display italic text-display-md text-inkMuted">
                  Adicionar foto
                </span>
                <span className="font-mono text-mono-sm text-inkDim">
                  4:3 · JPG ou PNG
                </span>
              </button>
            )}
          </Field>

          <Field label="Nome">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              autoFocus={isNew}
              placeholder={isNew ? 'ex: Smash duplo bacon' : undefined}
              className={fieldClasses}
            />
          </Field>

          <Field label="Categoria">
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(CATEGORY_LABEL) as MenuCategory[]).map((c) => {
                const active = category === c;
                return (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setCategory(c)}
                    className={[
                      'h-12 px-3 rounded-md border cursor-pointer',
                      'font-sans text-body text-center',
                      'transition-colors duration-base ease-out',
                      active
                        ? 'border-primary bg-primaryWash text-primary'
                        : 'border-hairline bg-surface text-inkMuted hover:border-primary/40',
                    ].join(' ')}
                  >
                    {CATEGORY_LABEL[c]}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Descrição" hint={`${description.length}/200`}>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              rows={3}
              className={`${fieldClasses} resize-none`}
            />
          </Field>

          <Field label="Preço">
            <div className="flex items-center gap-3">
              <span className="font-mono text-body-lg text-inkMuted">R$</span>
              <input
                type="text"
                inputMode="decimal"
                value={priceStr}
                onChange={(e) => setPriceStr(e.target.value)}
                className={`${fieldClasses} font-mono text-body-lg w-32 tabular-nums`}
              />
            </div>
          </Field>

          <Field label="Disponibilidade">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={available}
                onChange={(e) => setAvailable(e.target.checked)}
                className="w-5 h-5 accent-accent cursor-pointer"
              />
              <span className="font-sans text-body text-ink">
                {available ? 'Disponível pra pedir' : 'Esgotado — não aparece pro cliente'}
              </span>
            </label>
          </Field>
        </div>
      </SheetBody>

      <SheetFooter>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={handleSave}
          disabled={isNew && !name.trim()}
        >
          {isNew ? 'Adicionar ao cardápio' : 'Salvar'}
        </Button>
        {!isNew && (
          <button
            type="button"
            onClick={handleDelete}
            className="block mx-auto mt-3 px-3 py-1 cursor-pointer
                       font-mono text-mono-sm uppercase tracking-wider text-inkDim
                       hover:text-danger transition-colors duration-base ease-out"
          >
            Excluir do cardápio
          </button>
        )}
      </SheetFooter>
    </Sheet>
  );
}

const fieldClasses =
  'w-full px-4 py-3 bg-surface border border-hairline rounded-md ' +
  'font-sans text-body text-ink placeholder:text-inkDim ' +
  'focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primaryWash';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <label className="font-mono text-label uppercase tracking-wider text-inkDim">
          {label}
        </label>
        {hint && <span className="font-mono text-mono-sm text-inkDim">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
