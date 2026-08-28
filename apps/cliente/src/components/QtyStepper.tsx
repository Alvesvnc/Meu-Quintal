import { Minus, Plus } from 'lucide-react';

interface QtyStepperProps {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  size?: 'sm' | 'md';
  label?: string;
}

/**
 * Stepper − N +, coladinho, sem raio.
 *
 * As três caixas se tocam de propósito — sem `gap`, sem borda dupla entre
 * elas: o valor tem borda só em cima e embaixo, então as linhas verticais dos
 * botões continuam a moldura sem engrossar no encontro.
 *
 * O `+` é sólido vermelho e o `−` é só contorno. Não é decoração: somar é o
 * gesto comum e o que a mão procura primeiro; tirar é exceção.
 */
export function QtyStepper({
  value,
  onChange,
  min = 0,
  max = 99,
  size = 'md',
  label = 'quantidade',
}: QtyStepperProps) {
  // Pixel e não classe rem: o stepper aparece em três telas com contextos de
  // fonte diferentes, e 44px de alvo de toque é 44px em todas.
  const lado = size === 'sm' ? 34 : 44;
  const largura = size === 'sm' ? 36 : 48;
  const icone = size === 'sm' ? 14 : 18;
  const btn =
    'inline-flex items-center justify-center shrink-0 cursor-pointer ' +
    'transition-colors duration-base ease-out ' +
    'disabled:opacity-45 disabled:cursor-not-allowed';

  return (
    <div role="group" aria-label={label} className="inline-flex items-center">
      <button
        type="button"
        aria-label="Diminuir"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className={`${btn} border border-divider text-ink hover:bg-ink/[0.07]`}
        style={{ width: lado, height: lado }}
      >
        <Minus size={icone} strokeWidth={2} aria-hidden />
      </button>

      <span
        aria-live="polite"
        className="inline-flex items-center justify-center shrink-0 border-y border-divider
                   font-display font-bold text-ink tabular"
        style={{ width: largura, height: lado, fontSize: size === 'sm' ? 14 : 17 }}
      >
        {value}
      </span>

      <button
        type="button"
        aria-label="Aumentar"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className={`${btn} bg-accent text-bg hover:bg-accent-600 active:bg-accent-700`}
        style={{ width: lado, height: lado }}
      >
        <Plus size={icone} strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}
