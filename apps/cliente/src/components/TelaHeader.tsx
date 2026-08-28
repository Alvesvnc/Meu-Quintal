import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

interface TelaHeaderProps {
  /**
   * Para onde o chevron leva. Omitido, o botão some — num restaurante único
   * `/` redireciona pro próprio cardápio, e o voltar cairia aqui de novo.
   */
  voltarPara?: string;
  /** Contexto da tela: nome da cozinha, `#A2F4 · MESA 07`. */
  titulo: ReactNode;
  /** Tag opcional à direita — a mesa, no cardápio. */
  direita?: ReactNode;
}

/**
 * Cabeçalho das telas de dentro: voltar 40×40 + contexto, régua de 2px.
 *
 * O botão tem borda de 1px e não é um ícone solto: 40×40 com moldura é alvo
 * de toque visível, e num app que se usa em pé segurando o celular isso conta
 * mais que a limpeza de um chevron sem caixa.
 */
export function TelaHeader({ voltarPara, titulo, direita }: TelaHeaderProps) {
  return (
    <header className="sticky top-0 z-20 h-14 bg-bg border-b-rule border-divider">
      <div className={`h-full flex items-center gap-2 ${voltarPara ? 'px-3' : 'px-4'}`}>
        {voltarPara && (
          <Link
            to={voltarPara}
            aria-label="Voltar"
            className="w-10 h-10 shrink-0 inline-flex items-center justify-center
                       border border-divider text-ink no-underline
                       transition-colors duration-base ease-out hover:bg-ink/[0.07]"
          >
            <ChevronLeft size={18} strokeWidth={2} aria-hidden />
          </Link>
        )}
        <span className="font-display font-bold text-ink min-w-0 truncate">{titulo}</span>
        {direita && <span className="ml-auto shrink-0">{direita}</span>}
      </div>
    </header>
  );
}
