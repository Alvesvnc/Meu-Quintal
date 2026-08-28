interface PulsoProps {
  /** Lado do quadrado em pixel. 8 na régua de rodapé, 10 no cabeçalho. */
  size?: number;
  className?: string;
}

/**
 * O quadrado vermelho que pisca.
 *
 * Só duas coisas o usam: a linha "ao vivo" e o estágio ATUAL de um pedido.
 * Fora disso o sistema é parado — se tudo pulsasse, nada chamaria atenção.
 */
export function Pulso({ size = 10, className = '' }: PulsoProps) {
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 bg-accent animate-pulse motion-reduce:animate-none ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
