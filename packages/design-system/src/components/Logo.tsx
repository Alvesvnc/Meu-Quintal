/**
 * A marca QRO.
 *
 * O wordmark é HTML de verdade, não imagem: "QR" em Archivo 800 mais um
 * quadrado vazado que faz as vezes do "O". Isso é de propósito — o texto
 * escala, herda cor e continua selecionável/legível por leitor de tela.
 *
 * Tudo dimensiona por `size` (o font-size): o quadrado é medido em `em`, então
 * muda junto. Não há variante "logo + ícone lado a lado" — o quadrado do
 * wordmark JÁ É o ícone; repetir os dois é erro de uso da marca.
 */

interface LogoProps {
  /**
   * font-size em px. O mínimo da marca é 16 — abaixo disso o quadrado fecha e
   * vira um borrão, então a regra é não usar a marca, e não encolher mais.
   */
  size?: number;
  /** Sobre campo vermelho ou escuro: tinta e quadrado viram claros. */
  clara?: boolean;
  /** Passe pra marca virar link (header, e-mail, login). */
  href?: string;
  className?: string;
}

export function Logo({ size = 32, clara = false, href, className = '' }: LogoProps) {
  const conteudo = (
    <>
      QR
      <span
        aria-hidden
        className={`w-[0.72em] h-[0.72em] shrink-0 border-[0.17em] ${
          clara ? 'border-bg' : 'border-accent'
        }`}
      />
    </>
  );

  const classes = [
    'inline-flex items-center gap-[0.14em] select-none',
    'font-display font-bold tracking-[-0.03em] leading-[0.9]',
    clara ? 'text-bg' : 'text-ink',
    className,
  ].join(' ');

  if (href) {
    return (
      <a
        href={href}
        aria-label="QRO"
        className={`${classes} no-underline`}
        style={{ fontSize: size }}
      >
        {conteudo}
      </a>
    );
  }

  return (
    <span role="img" aria-label="QRO" className={classes} style={{ fontSize: size }}>
      {conteudo}
    </span>
  );
}

interface LogoIconeProps {
  /** Lado do ícone em px. Mínimo 12. */
  size?: number;
  className?: string;
}

/**
 * O olho de QR sozinho, sem o wordmark — pra onde o nome já está dito ou não
 * cabe: marca d'água, loading, avatar. Serve o SVG de `public/logo`, que os
 * três apps têm.
 */
export function LogoIcone({ size = 22, className = '' }: LogoIconeProps) {
  return (
    <img
      src="/logo/qro-icone-claro.svg"
      alt=""
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
    />
  );
}
