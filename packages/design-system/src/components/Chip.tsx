import type { ReactNode } from 'react';

type ChipTone = 'neutral' | 'primary' | 'accent' | 'warn' | 'danger';

interface ChipProps {
  tone?: ChipTone;
  children: ReactNode;
  className?: string;
}

const toneClasses: Record<ChipTone, string> = {
  neutral: 'bg-surface text-inkMuted border-hairline ' +
           'dark:bg-surfaceDeepCard dark:text-inkInverseDim dark:border-hairlineDark',
  primary: 'bg-primaryWash text-primary border-primary/20',
  accent:  'bg-accentWash text-accent border-accent/20',
  warn:    'bg-warn/10 text-warn border-warn/20',
  danger:  'bg-danger/10 text-danger border-danger/20',
};

/** Chip mono uppercase — usado para status, contadores, badges. */
export function Chip({ tone = 'neutral', children, className = '' }: ChipProps) {
  return (
    <span
      className={[
        'inline-flex items-center px-2 py-0.5 rounded-sm border',
        'font-mono text-mono-sm uppercase tracking-wider',
        toneClasses[tone],
        className,
      ].join(' ')}
    >
      {children}
    </span>
  );
}
