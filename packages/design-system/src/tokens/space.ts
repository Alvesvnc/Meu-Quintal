/**
 * Escala de espaço 4/8/12/16/24/32 — a mesma do Tailwind com raiz de 16px,
 * por isso o preset não sobrescreve `theme.spacing`: `p-4` já são 16px.
 */
export const space = {
  0: '0',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  6: '24px',
  8: '32px',
} as const;

/** Raio zero em TUDO. Não é uma escala com um valor pequeno: é ausência. */
export const radius = {
  none: '0',
  sm:   '0',
  md:   '0',
  lg:   '0',
  xl:   '0',
  pill: '0',
} as const;

/**
 * Sombra é o recurso de último caso: a hierarquia vem das réguas de 2px.
 * `lg` existe só pro sheet, que precisa se descolar do que está atrás.
 */
export const shadow = {
  none: 'none',
  sm:   '0 1px 2px rgba(45, 43, 43, 0.14)',
  md:   '0 3px 10px rgba(45, 43, 43, 0.16)',
  lg:   '0 12px 32px rgba(45, 43, 43, 0.22)',
} as const;

export const motion = {
  duration: { fast: '120ms', base: '150ms', slow: '220ms' },
  ease: {
    out:    'cubic-bezier(0.2, 0.8, 0.2, 1)',
    spring: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  },
} as const;

/** Pulso "ao vivo": 1 → 0.3 → 1 em 1.6s. Só em estado atual/ao vivo. */
export const PULSO = '1.6s';
