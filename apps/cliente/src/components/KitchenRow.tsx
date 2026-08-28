import { Link } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { Chip } from '@mq/design-system';
import type { KitchenSummary } from '@mq/shared';
import { fmtBRLShort } from '../lib/format';
import { Foto } from './Foto';

interface KitchenRowProps {
  kitchen: KitchenSummary;
  index: number;
}

/**
 * Variante em lista — uma cozinha por linha, foto grande.
 *
 * É pra quando o quintal tem duas ou três cozinhas: aí a grade de duas colunas
 * desperdiça metade da largura numa célula vazia. Ver `LandingScreen`, que
 * escolhe entre as duas.
 */
export function KitchenRow({ kitchen, index }: KitchenRowProps) {
  return (
    <Link
      to={`/k/${kitchen.slug}`}
      className="flex flex-col gap-2 py-4 no-underline text-inherit
                 border-b border-divider last:border-b-0"
    >
      <Foto
        src={kitchen.photoUrl}
        alt={`Foto da cozinha ${kitchen.name}`}
        eager={index < 2}
        className="aspect-[4/5] max-h-[420px] w-full"
      />

      <div className="flex items-baseline gap-3">
        <p className="font-display text-display-sm text-ink flex-1">
          <span className="text-accent">{String(index + 1).padStart(2, '0')}</span> {kitchen.name}
        </p>
        {kitchen.closingNote && <Chip tone="solid">{kitchen.closingNote}</Chip>}
      </div>

      <p className="flex items-center gap-1.5 text-meta text-neutral-600 tabular">
        <Clock size={13} strokeWidth={2} aria-hidden className="shrink-0" />~{kitchen.slaMinutes}{' '}
        min · {fmtBRLShort(kitchen.priceMinCents)}–
        {fmtBRLShort(kitchen.priceMaxCents).replace('R$', '').trim()}
      </p>
    </Link>
  );
}
