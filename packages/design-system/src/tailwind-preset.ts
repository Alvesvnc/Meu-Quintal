import type { Config } from 'tailwindcss';
import plugin from 'tailwindcss/plugin';
import { colors, neutral, accentRamp, fontSize, fonts, radius, shadow, motion } from './tokens';

/**
 * Preset Modernist.
 *
 * Duas coisas nele não são "extend" comum e merecem aviso:
 *
 * 1. `borderRadius` zera TODAS as chaves, inclusive `full`. Ponto pulsante,
 *    bolinha de timeline e avatar viram quadrados — que é o desenho. Sobrou
 *    `round` pro caso raro de precisar de um círculo de verdade.
 * 2. `animation.pulse` é redefinido. As telas antigas escrevem `animate-pulse`
 *    esperando o pulso do sistema (1 → 0.3 → 1 em 1.6s); o do Tailwind é mais
 *    rápido e nunca fecha em opacidade cheia.
 */
const preset: Partial<Config> = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: colors.bg,
        surface: colors.surface,
        ink: colors.ink,
        divider: colors.divider,

        accent: { DEFAULT: colors.accent, ...accentRamp },
        primary: { DEFAULT: colors.accent, ...accentRamp },
        neutral: { ...neutral },

        // Apelidos planos da identidade anterior — ver `tokens/colors.ts`.
        primaryWash: colors.primaryWash,
        primaryDeep: colors.primaryDeep,
        accentWash: colors.accentWash,
        surfaceDeep: colors.surfaceDeep,
        surfaceDeepCard: colors.surfaceDeepCard,
        inkMuted: colors.inkMuted,
        inkDim: colors.inkDim,
        inkInverse: colors.inkInverse,
        inkInverseDim: colors.inkInverseDim,
        hairline: colors.hairline,
        hairlineSoft: colors.hairlineSoft,
        hairlineDark: colors.hairlineDark,
        warn: colors.warn,
        danger: colors.danger,
        success: colors.success,
      },
      fontFamily: {
        display: [fonts.display],
        sans: [fonts.sans],
        mono: [fonts.mono],
      },
      fontSize,
      fontWeight: {
        normal: '400',
        medium: '600',
        semibold: '600',
        bold: '800',
      },
      borderRadius: {
        none: radius.none,
        sm: radius.sm,
        DEFAULT: radius.md,
        md: radius.md,
        lg: radius.lg,
        xl: radius.xl,
        '2xl': radius.xl,
        '3xl': radius.xl,
        full: radius.pill,
        /** Escape hatch: o único círculo que ainda faz sentido é um de verdade. */
        round: '9999px',
      },
      borderWidth: {
        /** Régua de seção. `border-rule` e `border-t-rule` em vez de `border-2`. */
        rule: '2px',
      },
      boxShadow: {
        sm: shadow.sm,
        md: shadow.md,
        lg: shadow.lg,
        // Apelidos anteriores.
        hairline: shadow.sm,
        soft: shadow.sm,
        sheet: shadow.lg,
      },
      transitionTimingFunction: {
        out: motion.ease.out,
        spring: motion.ease.spring,
      },
      transitionDuration: {
        fast: '120',
        base: '150',
        slow: '220',
      },
      keyframes: {
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.3' },
        },
      },
      animation: {
        pulse: 'pulse 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [
    plugin(({ addVariant }) => {
      /**
       * `mouse:` — quem aponta com o mouse, nao com o dedo.
       *
       * O QUE DECIDE E O APONTADOR, NAO A LARGURA. Um iPad em paisagem tem
       * exatamente 1024px, o mesmo do `lg`: cortar por tamanho mandaria o
       * tablet da cozinha — onde o dedo trabalha — pra versao de mouse, e ele
       * perderia os alvos grandes. E um monitor pequeno de 1280 tem mouse e
       * nao precisa deles.
       *
       * `(pointer: fine)` responde a pergunta certa: o apontador principal
       * deste aparelho e preciso? Mouse e trackpad sim; dedo nao.
       *
       * Aparelho hibrido (notebook com tela sensivel ao toque) declara
       * `fine` como principal, entao cai na versao de mouse — que e o
       * comportamento desejado: quem tem teclado e trackpad na frente usa o
       * trackpad.
       */
      addVariant('mouse', '@media (pointer: fine)');
    }),
    plugin(({ addUtilities }) => {
      addUtilities({
        /**
         * Dígitos de largura fixa — preço, hora, contador, countdown.
         *
         * Aqui morava também um `.grayscale-photo`, que o handoff pedia em toda
         * foto de conteúdo. Saiu: prato é vendido pela cor — o dourado da
         * brasa, o verde da salada —, e em P&B a comida some. O acento continua
         * sendo a única cor da INTERFACE; a cor da foto é da comida.
         */
        '.tabular': {
          fontVariantNumeric: 'tabular-nums',
        },
      });
    }),
  ],
};

export default preset;
