/**
 * Paleta Modernist — vermelho sobre fundo claro, sem verde nem amarelo.
 *
 * Estado NÃO se comunica por matiz (não existe "verde = pronto"): comunica-se
 * por preenchimento — feito = `neutral.900`, atual = `accent` pulsando,
 * futuro = `neutral.300`. Por isso os antigos `success`/`warn` viraram apelidos
 * de tons desta mesma paleta, e não cores próprias.
 */

/** Rampa neutra — mesma escala de luminosidade da rampa de acento. */
export const neutral = {
  100: '#f8f4f4',
  200: '#eae7e7',
  300: '#d7d3d3',
  400: '#bab6b6',
  500: '#9b9797',
  600: '#7d7979',
  700: '#605d5d',
  800: '#444141',
  900: '#2d2b2b',
} as const;

/**
 * Rampa do acento. 100–300 são fundos (tints), 600 é hover de sólido,
 * 700–800 são texto legível sobre tint — vermelho em tamanho de parágrafo usa
 * `700` pra cima, nunca o `accent` puro, que não passa contraste em 13px.
 */
export const accentRamp = {
  100: '#fff2ef',
  200: '#ffe0d9',
  300: '#ffc4b8',
  400: '#ff9783',
  500: '#ff563c',
  600: '#dd2b0f',
  700: '#ae1800',
  800: '#7c1405',
  900: '#4d170e',
} as const;

/**
 * Régua e borda: a MESMA cor nos dois pesos. O que separa uma seção de uma
 * linha de lista é a espessura (2px vs 1px), não o tom — foi assim que a
 * hierarquia deixou de depender de sombra.
 *
 * Em `rgba` e não em `color-mix()` porque este valor também entra no preset do
 * Tailwind, que o concatena em gradientes e sombras.
 */
const DIVIDER = 'rgba(32, 30, 29, 0.40)';

export const colors = {
  // ─── Sistema ────────────────────────────────────────────────────────────
  bg:      '#f3f2f2',
  surface: '#eae9e9',
  ink:     '#201e1d',
  accent:  '#ec3013',
  divider: DIVIDER,

  // ─── Apelidos da identidade anterior ────────────────────────────────────
  //
  // Continuam existindo, apontando pros tons novos: as telas do dono e as
  // secundárias do restaurante ainda escrevem `text-primary` / `bg-surface`, e
  // apagar os nomes trocaria um redesign por uma quebra de compilação em
  // dezenas de arquivos que este pacote não precisa tocar.
  primary:         '#ec3013',
  primaryWash:     accentRamp[100],
  primaryDeep:     accentRamp[700],
  accentWash:      accentRamp[100],
  surfaceDeep:     neutral[900],
  surfaceDeepCard: neutral[800],
  inkMuted:        neutral[700],
  inkDim:          neutral[600],
  inkInverse:      '#f3f2f2',
  inkInverseDim:   neutral[400],
  hairline:        DIVIDER,
  hairlineSoft:    DIVIDER,
  hairlineDark:    neutral[800],
  warn:            accentRamp[700],
  danger:          accentRamp[700],
  success:         neutral[900],
} as const;

export type ColorToken = keyof typeof colors;
