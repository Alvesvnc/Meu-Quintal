import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Chip } from '@mq/design-system';
import type { MenuItem } from '@mq/shared';
import { fmtBRL } from '../lib/format';
import { useCart } from '../stores/cart';
import { QtyStepper } from './QtyStepper';
import { fotosDoItem } from '../lib/fotos';
import { Foto } from './Foto';

interface MenuItemRowProps {
  item: MenuItem;
  kitchen: { slug: string; name: string };
}

/**
 * Linha compacta: miniatura 64px, nome, preço e ação.
 *
 * É o cardápio de uma cozinha SEM fotos — na grade, esse cardápio vira uma
 * parede de blocos cinzas iguais, e a lista lê melhor. Ver `MenuScreen`, que
 * escolhe entre as duas.
 */
export function MenuItemRow({ item, kitchen }: MenuItemRowProps) {
  const lines = useCart((s) => s.lines);
  const addLine = useCart((s) => s.addLine);
  const setQty = useCart((s) => s.setQty);
  const inCart = lines.find((l) => l.menuItemId === item.id);
  const unavailable = !item.available;
  const capa = fotosDoItem(item)[0];

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!unavailable) addLine(item, kitchen, 1);
  };

  return (
    <div
      className={`flex items-center gap-3 py-3 border-b border-divider last:border-b-0 ${
        unavailable ? 'opacity-45' : ''
      }`}
    >
      <Link
        to={`/k/${kitchen.slug}/i/${item.id}`}
        className="flex flex-1 min-w-0 items-center gap-3 no-underline text-inherit"
      >
        <Foto src={capa} alt="" className="w-16 h-16 shrink-0" />

        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-body-sm font-medium text-ink truncate">{item.name}</p>
            {item.badge === 'novo' && <Chip tone="solid">Novo</Chip>}
            {item.badge === 'esgotando' && <Chip tone="outline">Últimos</Chip>}
            {(item.badge === 'sem-estoque' || unavailable) && (
              <Chip tone="neutral">Esgotado</Chip>
            )}
          </div>
          <span className="font-display font-bold text-ink tabular">
            {fmtBRL(item.priceCents)}
          </span>
        </div>
      </Link>

      {inCart ? (
        <QtyStepper
          value={inCart.qty}
          onChange={(n) => setQty(item.id, n)}
          size="sm"
          label={`Quantidade de ${item.name}`}
        />
      ) : (
        <button
          type="button"
          onClick={handleAdd}
          disabled={unavailable}
          aria-label={`Adicionar ${item.name}`}
          className="w-11 h-11 shrink-0 inline-flex items-center justify-center cursor-pointer
                     bg-accent text-bg transition-colors duration-base ease-out
                     hover:bg-accent-600 active:bg-accent-700
                     disabled:opacity-45 disabled:cursor-not-allowed"
        >
          <Plus size={18} strokeWidth={2} aria-hidden />
        </button>
      )}
    </div>
  );
}
