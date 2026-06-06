import { Link } from 'react-router-dom';
import type { KitchenSummary } from '@mq/shared';
import { fmtBRLShort } from '../lib/format';

interface KitchenRowProps {
  kitchen: KitchenSummary;
  index: number;
}

/** Variante vertical (lista) — mantida pra ter alternativa visual. */
export function KitchenRow({ kitchen, index }: KitchenRowProps) {
  return (
    <Link to={`/k/${kitchen.slug}`} className="block py-7 first:pt-2 group no-underline text-inherit">
      <div className="overflow-hidden rounded-lg bg-surface mb-5 aspect-[4/5] max-h-[440px]">
        {kitchen.photoUrl && (
          <img
            src={kitchen.photoUrl}
            alt={`Foto da cozinha ${kitchen.name}`}
            loading={index < 2 ? 'eager' : 'lazy'}
            decoding="async"
            className="w-full h-full object-cover transition-opacity duration-base ease-out group-hover:opacity-92"
          />
        )}
      </div>

      <div className="flex items-baseline justify-between gap-4">
        <span className="font-mono text-mono text-primary">
          {String(index + 1).padStart(2, '0')}.
        </span>
        <h2 className="font-display text-display-md text-ink flex-1 leading-tight">
          {kitchen.name}
        </h2>
        <span className="font-mono text-body-sm text-inkMuted whitespace-nowrap">
          ~{kitchen.slaMinutes} min · {fmtBRLShort(kitchen.priceMinCents)}–{fmtBRLShort(kitchen.priceMaxCents).replace('R$', '').trim()}
        </span>
      </div>

      {kitchen.tagline && (
        <p className="mt-2 ml-8 font-sans text-body text-inkMuted text-pretty">
          {kitchen.tagline}
        </p>
      )}

      {kitchen.closingNote && (
        <p className="mt-2 ml-8 font-mono text-mono-sm uppercase tracking-wider text-warn">
          {kitchen.closingNote}
        </p>
      )}
    </Link>
  );
}
