interface BarraSegmentadaProps {
  /** Quantas células a barra tem. Nos pedidos são 4 = os 4 estágios. */
  total: number;
  /** Índice do estágio ATUAL (0-based). -1 = nenhum em andamento. */
  atual: number;
  /** Sobre fundo vermelho sólido as cores invertem (pôster PRONTO). */
  invertida?: boolean;
  /** Tudo concluído: a barra inteira fica escura e para de pulsar. */
  completa?: boolean;
  className?: string;
  'aria-label'?: string;
}

/**
 * Barra de progresso em células — o que substituiu a timeline de bolinhas
 * com quatro rótulos.
 *
 * Estado sai por preenchimento, não por matiz: feito = tinta escura,
 * atual = acento pulsando, futuro = neutro claro. Quem olha de longe lê a
 * proporção antes de ler qualquer palavra.
 */
export function BarraSegmentada({
  total,
  atual,
  invertida = false,
  completa = false,
  className = '',
  'aria-label': ariaLabel,
}: BarraSegmentadaProps) {
  return (
    <div
      className={`flex gap-[3px] ${className}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={completa ? total : Math.max(0, atual)}
      aria-label={ariaLabel}
    >
      {Array.from({ length: total }, (_, i) => {
        const feito = completa || i < atual;
        const emAndamento = !completa && i === atual;
        return (
          <span
            key={i}
            className={[
              'flex-1 h-1.5',
              invertida
                ? feito
                  ? 'bg-bg'
                  : emAndamento
                    ? 'bg-bg animate-pulse motion-reduce:animate-none'
                    : 'bg-accent-400'
                : feito
                  ? 'bg-neutral-900'
                  : emAndamento
                    ? 'bg-accent animate-pulse motion-reduce:animate-none'
                    : 'bg-neutral-300',
            ].join(' ')}
          />
        );
      })}
    </div>
  );
}
