import type { ReactNode } from 'react';

/**
 * As quatro variantes de tag do sistema. Os quatro nomes seguintes
 * (`primary`, `accent`, `warn`, `danger`) são a nomenclatura anterior,
 * mantida porque as telas do dono e as secundárias do restaurante ainda a
 * escrevem — cada um aponta pra variante que corresponde ao seu papel.
 */
type ChipTone =
  | 'solid'
  | 'outline'
  | 'tint'
  | 'neutral'
  | 'primary'
  | 'accent'
  | 'warn'
  | 'danger';

interface ChipProps {
  tone?: ChipTone;
  children: ReactNode;
  className?: string;
}

const toneClasses: Record<ChipTone, string> = {
  /** Ênfase máxima — "FECHA 22H", "ATRASADO", "NOVO" no item. */
  solid:   'bg-accent text-bg',
  /** Contexto — "MESA 07", "NOVO" no card da fila. */
  outline: 'border border-accent text-accent',
  /** Informação de apoio sobre fundo lavado — "~4 MIN", "OBS". */
  tint:    'bg-accent-100 text-accent-800',
  /** Fim de linha — "CANCELADO", "ESGOTADO". Sem vermelho: não é ação. */
  neutral: 'bg-neutral-900 text-bg',

  primary: 'bg-accent text-bg',
  accent:  'bg-accent-100 text-accent-800',
  warn:    'border border-accent text-accent',
  danger:  'bg-neutral-900 text-bg',
};

/** Tag 9–11px Archivo 800 uppercase, sem raio. */
export function Chip({ tone = 'outline', children, className = '' }: ChipProps) {
  return (
    <span
      className={[
        'inline-flex items-center px-2 py-[2px] rounded-none',
        'font-display text-label font-bold uppercase',
        toneClasses[tone],
        className,
      ].join(' ')}
    >
      {children}
    </span>
  );
}
