/**
 * Tipografia Modernist: uma família só, Archivo, em três pesos.
 *
 * `display`, `sans` e `mono` apontam pro mesmo lugar de propósito — os apps
 * antigos escrevem `font-mono` em preço e contador, e o que aqueles trechos
 * realmente pediam era alinhamento de dígitos, não outra família. Isso agora
 * vem de `tabular-nums` (ver `global.css`), então trocar a família seria
 * trocar a identidade sem necessidade.
 */
export const fonts = {
  display: '"Archivo", system-ui, sans-serif',
  sans:    '"Archivo", system-ui, sans-serif',
  mono:    '"Archivo", system-ui, sans-serif',
} as const;

export const weights = {
  body:  400,
  name:  600,
  bold:  800,
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

/**
 * Tamanhos em PIXEL, nunca em rem.
 *
 * Cada app define seu próprio `html { font-size }`, e um token em rem faria a
 * mesma régua de 11px sair com três alturas diferentes em cliente, restaurante
 * e dono — que foi exatamente o que aconteceu antes com a barra de abas.
 */
export const fontSize: Record<string, TokenDeFonte> = {
  // Números-pôster: o "~8" da tela de acompanhar, o contador da fila.
  'display-xl': ['56px', { lineHeight: '1',    letterSpacing: '-0.02em' }],
  // Título de tela — "5 cozinhas abertas."
  'display-lg': ['30px', { lineHeight: '1.05', letterSpacing: '-0.02em' }],
  // Título de bloco — "Seu pedido.", "Retire no balcão.", totais.
  'display-md': ['26px', { lineHeight: '1.05', letterSpacing: '-0.015em' }],
  // Título de item aberto no detalhe.
  'display-sm': ['24px', { lineHeight: '1.1',  letterSpacing: '-0.015em' }],
  // Contagem do placar da fila (3 células de status).
  'counter':    ['26px', { lineHeight: '1' }],

  'body-lg':    ['16px', { lineHeight: '1.35' }],
  'body':       ['15px', { lineHeight: '1.5' }],
  'body-sm':    ['13px', { lineHeight: '1.5' }],
  'meta':       ['12px', { lineHeight: '1.4' }],

  // Labels e kickers: sempre 800 + uppercase + tracking positivo.
  'label':      ['11px', { lineHeight: '1.2', letterSpacing: '0.08em' }],
  'label-sm':   ['10px', { lineHeight: '1.2', letterSpacing: '0.08em' }],
  'tag':        ['9px',  { lineHeight: '1.2', letterSpacing: '0.08em' }],

  // Apelidos da escala anterior — ver a nota em `colors.ts`.
  'mono-lg':    ['28px', { lineHeight: '1.1', letterSpacing: '-0.015em' }],
  'mono':       ['14px', { lineHeight: '1.35' }],
  'mono-sm':    ['11px', { lineHeight: '1.3', letterSpacing: '0.06em' }],
} as const;
