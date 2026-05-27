interface QtyStepperProps {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  size?: 'sm' | 'md';
  label?: string;
}

/** Stepper - N + horizontal. Botões 44px (44 padrão) ou 36px (sm) com hairline. */
export function QtyStepper({
  value,
  onChange,
  min = 0,
  max = 99,
  size = 'md',
  label = 'quantidade',
}: QtyStepperProps) {
  const dim = size === 'sm' ? 'h-9 min-w-9 text-mono' : 'h-11 min-w-11 text-body';
  const btnBase =
    'flex items-center justify-center font-mono cursor-pointer ' +
    'transition-colors duration-base ease-out ' +
    'hover:bg-primaryWash disabled:opacity-30 disabled:cursor-not-allowed';

  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex items-stretch border border-hairline rounded-md bg-surface"
    >
      <button
        type="button"
        aria-label="Diminuir"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className={`${btnBase} ${dim} rounded-l-md`}
      >
        −
      </button>
      <span
        aria-live="polite"
        className={`${dim} flex items-center justify-center font-mono text-ink px-1 border-x border-hairline tabular-nums`}
      >
        {value}
      </span>
      <button
        type="button"
        aria-label="Aumentar"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className={`${btnBase} ${dim} rounded-r-md`}
      >
        +
      </button>
    </div>
  );
}
