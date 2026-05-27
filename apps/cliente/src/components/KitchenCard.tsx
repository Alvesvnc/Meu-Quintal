import { Link } from 'react-router-dom';
import type { Kitchen } from '../mocks/quintal';

interface KitchenCardProps {
  kitchen: Kitchen;
  index: number;
}

const fmtBRL = (n: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

/**
 * Variante de grade (2 colunas mobile). Mantem identidade editorial:
 * foto 4:5, indice mono primary, nome Fraunces, meta mono.
 */
export function KitchenCard({ kitchen, index }: KitchenCardProps) {
  return (
    <Link
      to={`/k/${kitchen.slug}`}
      className="block group no-underline text-inherit"
    >
      <div className="overflow-hidden rounded-lg bg-surface mb-3 aspect-[4/5]">
        <img
          src={kitchen.photoUrl}
          alt={`Foto da cozinha ${kitchen.name}`}
          loading={index < 4 ? 'eager' : 'lazy'}
          decoding="async"
          className="w-full h-full object-cover transition-opacity duration-base ease-out group-hover:opacity-92"
        />
      </div>

      <div className="flex items-baseline gap-2">
        <span className="font-mono text-mono-sm text-primary">
          {String(index + 1).padStart(2, '0')}.
        </span>
        <h2 className="font-display text-[20px] leading-tight text-ink flex-1">
          {kitchen.name}
        </h2>
      </div>

      <p className="mt-1 font-mono text-mono-sm text-inkDim">
        ~{kitchen.etaMinutes} min · R$ {fmtBRL(kitchen.priceMin)}–{fmtBRL(kitchen.priceMax)}
      </p>

      <p
        className="mt-1.5 font-sans text-body-sm text-inkMuted leading-snug"
        style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
      >
        {kitchen.tagline}
      </p>

      {kitchen.closingNote && (
        <p className="mt-1.5 font-mono text-mono-sm uppercase tracking-wider text-warn">
          {kitchen.closingNote}
        </p>
      )}
    </Link>
  );
}
