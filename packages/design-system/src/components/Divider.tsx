import type { ReactNode } from 'react';

interface DividerProps {
  label?: ReactNode;
  /** `rule` = 2px, separa seções. `line` = 1px, separa linhas de lista. */
  weight?: 'rule' | 'line';
  className?: string;
}

/**
 * A régua. É ela que carrega a hierarquia no lugar da sombra e do card.
 *
 * Com label, o rótulo fica ACIMA da linha e alinhado à esquerda — não no meio
 * dela. Centralizar quebraria a única coluna de texto da tela, que é o que
 * mantém títulos, corpo e rótulos na mesma margem.
 */
export function Divider({ label, weight = 'rule', className = '' }: DividerProps) {
  const altura = weight === 'rule' ? 'h-[2px]' : 'h-px';

  if (!label) {
    return <div role="separator" className={`${altura} w-full bg-divider ${className}`} />;
  }

  return (
    <div className={className}>
      <p className="font-display text-label font-bold uppercase text-ink mb-1">{label}</p>
      <div role="separator" className={`${altura} w-full bg-divider`} />
    </div>
  );
}
