interface SwitchProps {
  checked: boolean;
  onChange: () => void;
  ariaLabel: string;
}

/**
 * Switch toggle dark-mode-friendly e responsivo ao font-size do app.
 *
 * Usamos PIXELS EXPLÍCITOS (não rem-based como w-14) porque o app restaurante
 * sobreescreve html font-size pra 18px, o que escala TODAS as classes Tailwind
 * baseadas em rem proporcionalmente — e isso visualmente borrava o switch.
 * Pixels = layout absoluto, previsível.
 */
export function Switch({ checked, onChange, ariaLabel }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={onChange}
      className={[
        'shrink-0 relative rounded-full cursor-pointer',
        'transition-colors duration-base ease-out',
        'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primaryWash',
        checked ? 'bg-accent/30' : 'bg-hairline',
      ].join(' ')}
      style={{ width: '52px', height: '28px' }}
    >
      <span
        aria-hidden
        className={[
          'absolute rounded-full block',
          'transition-all duration-base ease-out',
          checked ? 'bg-accent' : 'bg-inkDim',
        ].join(' ')}
        style={{
          width:  '20px',
          height: '20px',
          top:    '4px',
          left:   checked ? '28px' : '4px',
        }}
      />
    </button>
  );
}
