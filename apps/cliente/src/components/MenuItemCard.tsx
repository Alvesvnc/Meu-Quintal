import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Chip } from '@mq/design-system';
import type { MenuItem } from '@mq/shared';
import { fmtBRL } from '../lib/format';
import { useCart } from '../stores/cart';
import { QtyStepper } from './QtyStepper';
import { fotosDoItem } from '../lib/fotos';
import { Foto } from './Foto';

interface MenuItemCardProps {
  item: MenuItem;
  kitchen: { slug: string; name: string };
  /** As primeiras da primeira categoria carregam sem esperar a rolagem. */
  eager?: boolean;
}

/**
 * Célula da grade do cardápio: foto quadrada, tag, nome, preço e o botão `+`.
 *
 * Quando o item já está no carrinho o `+` dá lugar ao stepper compacto e o
 * preço encolhe pra caber. A alternativa seria mandar a pessoa até o carrinho
 * pra tirar uma unidade que ela acabou de pôr sem querer — o caminho mais
 * longo possível pro erro mais comum da tela.
 */
export function MenuItemCard({ item, kitchen, eager = false }: MenuItemCardProps) {
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
    <div className={`flex flex-col gap-2 ${unavailable ? 'opacity-45' : ''}`}>
      <Link
        to={`/k/${kitchen.slug}/i/${item.id}`}
        className="flex flex-col gap-2 no-underline text-inherit"
      >
        <Foto src={capa} alt="" eager={eager} className="aspect-square w-full" />

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

        <p className="text-body-sm font-medium leading-[1.2] text-ink">{item.name}</p>
      </Link>

      <div className="mt-auto flex items-center justify-between gap-2">
        <span
          className={[
            'font-display font-bold text-ink tabular',
            inCart ? 'text-body-sm' : 'text-body-lg',
          ].join(' ')}
        >
          {fmtBRL(item.priceCents)}
        </span>

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
            className="w-10 h-10 shrink-0 inline-flex items-center justify-center cursor-pointer
                       bg-accent text-bg transition-colors duration-base ease-out
                       hover:bg-accent-600 active:bg-accent-700
                       disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <Plus size={18} strokeWidth={2} aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
