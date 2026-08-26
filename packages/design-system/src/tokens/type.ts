export const fonts = {
  display: '"Fraunces", Georgia, serif',
  sans:    '"DM Sans", system-ui, sans-serif',
  mono:    '"JetBrains Mono", ui-monospace, monospace',
} as const;

export const fontFeatures = {
  fraunces:        "'liga' 1, 'ss01' 1",
  fraunces_italic: "'liga' 1, 'ss01' 1, 'ss02' 1",
} as const;

/**
 * Formato que o Tailwind espera em `theme.fontSize`: uma TUPLA de
 * [tamanho, ajustes]. Sem esta anotacao o TypeScript infere
 * `(string | objeto)[]` — array comum, nao tupla — e o preset precisava de um
 * `as any` pra passar. Declarar o tipo resolve na origem.
 */
export type TokenDeFonte = [
  tamanho: string,
  ajustes: { lineHeight: string; letterSpacing?: string },
];

export const fontSize: Record<string, TokenDeFonte> = {
  'display-xl': ['clamp(40px, 5vw, 56px)', { lineHeight: '1.05', letterSpacing: '-0.02em' }],
  'display-lg': ['32px', { lineHeight: '1.1',  letterSpacing: '-0.015em' }],
  'display-md': ['24px', { lineHeight: '1.2',  letterSpacing: '-0.01em' }],
  'body-lg':    ['17px', { lineHeight: '1.5' }],
  'body':       ['15px', { lineHeight: '1.5' }],
  'body-sm':    ['13px', { lineHeight: '1.5' }],
  'label':      ['11px', { lineHeight: '1.4', letterSpacing: '0.08em' }],
  'mono-lg':    ['22px', { lineHeight: '1.2' }],
  'mono':       ['14px', { lineHeight: '1.4' }],
  'mono-sm':    ['11px', { lineHeight: '1.4' }],
} as const;
