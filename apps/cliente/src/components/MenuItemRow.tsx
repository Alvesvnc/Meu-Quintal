import { Link } from 'react-router-dom';
import { Chip } from '@mq/design-system';
import type { MenuItem } from '@mq/shared';
import { fmtBRL } from '../lib/format';
import { useCart } from '../stores/cart';
import { QtyStepper } from './QtyStepper';

interface MenuItemRowProps {
  item: MenuItem;
  kitchen: { slug: string; name: string };
}

/** Row horizontal: foto 88x88, conteúdo+preço, botão + (44x44) ou stepper. */
export function MenuItemRow({ item, kitchen }: MenuItemRowProps) {
  const lines = useCart((s) => s.lines);
  const addLine = useCart((s) => s.addLine);
  const setQty = useCart((s) => s.setQty);
  const inCart = lines.find((l) => l.menuItemId === item.id);
  const unavailable = !item.available;

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!unavailable) addLine(item, kitchen, 1);
  };

  return (
    <div className={`flex gap-4 py-4 ${unavailable ? 'opacity-55' : ''}`}>
      <Link
        to={`/k/${kitchen.slug}/i/${item.id}`}
        className="flex-1 flex gap-4 no-underline text-inherit min-w-0"
      >
        <div className="shrink-0 w-[88px] h-[88px] rounded-md overflow-hidden bg-surface">
          {item.photoUrl && (
            <img
              src={item.photoUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover"
            />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <h3 className="font-sans text-body-lg font-medium text-ink leading-tight flex-1">
              {item.name}
            </h3>
            {item.badge === 'novo' && <Chip tone="primary">novo</Chip>}
            {item.badge === 'esgotando' && <Chip tone="warn">últimos</Chip>}
            {item.badge === 'sem-estoque' && <Chip tone="danger">esgotado</Chip>}
          </div>
          {item.description && (
            <p
              className="mt-1 font-sans text-body-sm text-inkMuted leading-snug"
              style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
            >
              {item.description}
            </p>
          )}
          <p className="mt-2 font-mono text-body text-ink">
            {fmtBRL(item.priceCents)}
          </p>
        </div>
      </Link>

      <div className="shrink-0 flex items-center">
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
            className="w-11 h-11 rounded-md border border-hairline bg-surface
                       text-primary font-mono text-body-lg cursor-pointer
                       transition-colors duration-base ease-out
                       hover:bg-primaryWash hover:border-primary
                       disabled:opacity-30 disabled:cursor-not-allowed"
          >
            +
          </button>
        )}
      </div>
    </div>
  );
}
