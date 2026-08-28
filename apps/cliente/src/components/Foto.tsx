import { urlDaFoto } from '../lib/fotos';

interface FotoProps {
  /** Caminho vindo da API (relativo ou absoluto) ou `null`/`undefined`. */
  src?: string | null;
  /** Vazio quando a foto é decorativa e o nome já está escrito ao lado. */
  alt: string;
  /** Geometria: `aspect-[4/5]`, `w-11 h-11`, `h-[170px] w-full`… */
  className?: string;
  /** Só pras fotos que já estão na primeira dobra. */
  eager?: boolean;
}

/**
 * Toda foto de conteúdo do app passa por aqui.
 *
 * Existe em vez de um `<img>` solto porque o lugar da foto é reservado mesmo
 * quando não há foto, num bloco neutro. Sem o bloco, a grade de cozinhas
 * colapsava de altura no meio do carregamento e a tela pulava.
 *
 * **A foto sai como a cozinha enviou.** O handoff pedia P&B em tudo
 * (`grayscale(1) contrast(1.08)`) pra que só o vermelho carregasse estado; em
 * teste, ficou claro que prato é vendido pela cor — em cinza, comida some.
 * Nada de filtro, tingimento ou sobreposição aqui: a única cor da INTERFACE
 * continua sendo o acento, e a cor da foto é da comida.
 */
export function Foto({ src, alt, className = '', eager = false }: FotoProps) {
  return (
    <div className={`overflow-hidden bg-neutral-200 ${className}`}>
      {src && (
        <img
          src={urlDaFoto(src)}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          className="w-full h-full object-cover"
        />
      )}
    </div>
  );
}
