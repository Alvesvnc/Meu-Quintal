import type { Config } from 'tailwindcss';
import { colors, fontSize, radius, motion } from './tokens';

const preset: Partial<Config> = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary:         colors.primary,
        primaryWash:     colors.primaryWash,
        primaryDeep:     colors.primaryDeep,
        accent:          colors.accent,
        accentWash:      colors.accentWash,
        bg:              colors.bg,
        surface:         colors.surface,
        surfaceDeep:     colors.surfaceDeep,
        surfaceDeepCard: colors.surfaceDeepCard,
        ink:             colors.ink,
        inkMuted:        colors.inkMuted,
        inkDim:          colors.inkDim,
        inkInverse:      colors.inkInverse,
        inkInverseDim:   colors.inkInverseDim,
        hairline:        colors.hairline,
        hairlineSoft:    colors.hairlineSoft,
        hairlineDark:    colors.hairlineDark,
        warn:            colors.warn,
        danger:          colors.danger,
        success:         colors.success,
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans:    ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: fontSize as any,
      borderRadius: {
        none: radius.none,
        sm:   radius.sm,
        DEFAULT: radius.md,
        md:   radius.md,
        lg:   radius.lg,
        xl:   radius.xl,
        full: radius.pill,
      },
      boxShadow: {
        hairline: '0 0 0 1px rgba(31,26,20,0.06)',
        soft:     '0 1px 2px rgba(31,26,20,0.04), 0 4px 12px rgba(31,26,20,0.04)',
        sheet:    '0 12px 32px rgba(31,26,20,0.12)',
      },
      transitionTimingFunction: {
        out:    motion.ease.out,
        spring: motion.ease.spring,
      },
      transitionDuration: {
        fast: '120',
        base: '200',
        slow: '320',
      },
    },
  },
};

export default preset;
