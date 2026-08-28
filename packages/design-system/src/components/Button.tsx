import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg' | 'xl';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  children: ReactNode;
}

/**
 * Botão-bloco do sistema Modernist.
 *
 * Duas decisões que não são estética solta:
 *
 * - **Largura cheia alinha à esquerda.** O rótulo começa na mesma coluna do
 *   texto da tela, e valor ou ícone vão pro fim com `ml-auto`. Centralizar
 *   deixaria o botão largo com o texto flutuando longe das duas margens.
 * - **`danger` não é outra cor.** Vermelho aqui significa "ação primária"; se
 *   destrutivo também fosse vermelho, os dois deixariam de se distinguir. O
 *   destrutivo é o bloco neutro escuro — grave, e claramente não é o caminho
 *   principal.
 */
const baseClasses =
  'inline-flex items-center gap-2.5 cursor-pointer rounded-none ' +
  'font-display text-body font-bold uppercase tracking-[0.06em] leading-none ' +
  'transition-colors duration-base ease-out outline-none ' +
  'disabled:opacity-45 disabled:cursor-not-allowed';

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-accent text-bg border border-transparent hover:bg-accent-600 active:bg-accent-700',
  secondary:
    'bg-transparent text-ink border border-divider hover:bg-ink/[0.07] active:bg-ink/[0.14]',
  ghost:
    'bg-transparent text-accent-700 border border-transparent hover:bg-accent/10 active:bg-accent/20',
  danger:
    'bg-neutral-900 text-bg border border-transparent hover:bg-ink active:bg-neutral-800',
};

/** Alturas em pixel: os apps têm raízes de fonte diferentes, `h-11` não. */
const sizeClasses: Record<Size, string> = {
  sm: 'h-10 px-3 text-label',
  md: 'h-11 px-4 text-body-sm',
  lg: 'h-[52px] px-4',
  xl: 'h-14 px-4 text-body-lg',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = 'primary', size = 'md', loading, fullWidth, className = '', children, disabled, ...rest },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        type={rest.type ?? 'button'}
        disabled={disabled || loading}
        className={[
          baseClasses,
          variantClasses[variant],
          sizeClasses[size],
          fullWidth ? 'w-full justify-start text-left' : 'justify-center',
          className,
        ].join(' ')}
        {...rest}
      >
        {/* Sem spinner novo: um quadrado que pulsa no mesmo ritmo do "ao vivo". */}
        {loading && (
          <span
            aria-hidden
            className="w-2.5 h-2.5 shrink-0 bg-current animate-pulse motion-reduce:animate-none"
          />
        )}
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';
