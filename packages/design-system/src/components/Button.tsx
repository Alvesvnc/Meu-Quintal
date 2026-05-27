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

const baseClasses =
  'inline-flex items-center justify-center gap-2 rounded-md font-sans font-medium ' +
  'transition-colors duration-base ease-out outline-none ' +
  'focus-visible:ring-[3px] focus-visible:ring-primaryWash focus-visible:ring-offset-0 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ' +
  'active:scale-[0.98] motion-reduce:active:scale-100';

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-primary text-white hover:bg-primaryDeep focus-visible:border-primary border border-transparent',
  secondary:
    'bg-surface text-ink border border-hairline hover:bg-primaryWash focus-visible:border-primary ' +
    'dark:bg-surfaceDeepCard dark:text-inkInverse dark:border-hairlineDark dark:hover:bg-primaryWash',
  ghost:
    'bg-transparent text-ink hover:bg-primaryWash border border-transparent focus-visible:border-primary ' +
    'dark:text-inkInverse dark:hover:bg-primaryWash',
  danger:
    'bg-danger text-white hover:bg-[#9A2B16] focus-visible:border-danger border border-transparent',
};

const sizeClasses: Record<Size, string> = {
  sm: 'h-9 px-3 text-body-sm',
  md: 'h-11 px-4 text-body',
  lg: 'h-[52px] px-5 text-body-lg',
  xl: 'h-16 px-6 text-body-lg',
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
          fullWidth ? 'w-full' : '',
          className,
        ].join(' ')}
        {...rest}
      >
        {loading && (
          <span
            aria-hidden
            className="font-mono text-mono-sm tracking-wider"
          >
            ●●●
          </span>
        )}
        <span>{children}</span>
      </button>
    );
  },
);
Button.displayName = 'Button';
