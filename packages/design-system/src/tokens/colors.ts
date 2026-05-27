export const colors = {
  primary:        '#C9532E',
  primaryWash:    '#C9532E15',
  primaryDeep:    '#A8451E',

  accent:         '#3F7A4B',
  accentWash:     '#3F7A4B12',

  bg:             '#EFECE5',
  surface:        '#FAF7F0',
  surfaceDeep:    '#1C1814',
  surfaceDeepCard:'#272320',

  ink:            '#1F1A14',
  inkMuted:       '#5B5347',
  inkDim:         '#8A7F70',
  inkInverse:     '#F4EFE6',
  inkInverseDim:  '#B9AE9C',

  hairline:       '#D9D2C3',
  hairlineSoft:   '#E8E2D2',
  hairlineDark:   '#3A322B',

  warn:           '#C68A1A',
  danger:         '#B8341A',
  success:        '#3F7A4B',
} as const;

export type ColorToken = keyof typeof colors;
