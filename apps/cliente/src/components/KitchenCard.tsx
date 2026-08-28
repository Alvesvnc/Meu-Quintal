import { Link } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { Chip } from '@mq/design-system';
import type { KitchenSummary } from '@mq/shared';
import { fmtBRLShort } from '../lib/format';
import { Foto } from './Foto';

interface KitchenCardProps {
  kitchen: KitchenSummary;
  index: number;
}

/**
 * Célula da grade de cozinhas: foto 4:5, nome com índice vermelho, meta.
 *
 * A tagline saiu. Numa grade de duas colunas ela virava duas linhas de cinza
 * abaixo de cada card, e o olho passava por seis blocos de texto antes de
 * chegar na quinta cozinha. A foto vende; o número e o tempo situam.
 */
export function KitchenCard({ kitchen, index }: KitchenCardProps) {
  return (
    <Link to={`/k/${kitchen.slug}`} className="flex flex-col gap-2 no-underline text-inherit">
      <Foto
        src={kitchen.photoUrl}
        alt={`Foto da cozinha ${kitchen.name}`}
        eager={index < 4}
        className="aspect-[4/5] w-full"
      />

      <p className="font-display text-body-lg font-bold leading-[1.15] text-ink">
        <span className="text-accent">{String(index + 1).padStart(2, '0')}</span> {kitchen.name}
      </p>

      <p className="flex items-center gap-1.5 text-meta text-neutral-600 tabular">
        <Clock size={13} strokeWidth={2} aria-hidden className="shrink-0" />~{kitchen.slaMinutes}{' '}
        min · {fmtBRLShort(kitchen.priceMinCents)}–
        {fmtBRLShort(kitchen.priceMaxCents).replace('R$', '').trim()}
      </p>

      {kitchen.closingNote && (
        <Chip tone="solid" className="self-start">
          {kitchen.closingNote}
        </Chip>
      )}
    </Link>
  );
}
