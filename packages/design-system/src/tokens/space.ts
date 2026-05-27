export const space = {
  0: '0',
  1: '2px',
  2: '4px',
  3: '8px',
  4: '12px',
  5: '16px',
  6: '20px',
  7: '24px',
  8: '32px',
  9: '40px',
  10: '48px',
  11: '64px',
} as const;

export const radius = {
  none: '0',
  sm:   '4px',
  md:   '8px',
  lg:   '12px',
  xl:   '16px',
  pill: '999px',
} as const;

export const shadow = {
  none:     'none',
  hairline: '0 0 0 1px rgba(31,26,20,0.06)',
  soft:     '0 1px 2px rgba(31,26,20,0.04), 0 4px 12px rgba(31,26,20,0.04)',
  sheet:    '0 12px 32px rgba(31,26,20,0.12)',
} as const;

export const motion = {
  duration: { fast: '120ms', base: '200ms', slow: '320ms' },
  ease:     {
    out:    'cubic-bezier(0.2, 0.8, 0.2, 1)',
    spring: 'cubic-bezier(0.34, 1.3, 0.64, 1)',
  },
} as const;
