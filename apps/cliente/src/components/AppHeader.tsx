import { Link } from 'react-router-dom';

interface AppHeaderProps {
  mesaNumero: number;
  cartCount?: number;
  /** Quando definido, mostra "← back-label" em vez de "Mesa N" */
  backTo?: { to: string; label: string };
}

/**
 * Header sticky 56px conforme pages/cliente.md §"Header sticky minimal".
 * Sempre mostra contexto (Mesa N ou origem); carrinho como chip mono.
 */
export function AppHeader({ mesaNumero, cartCount = 0, backTo }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-20 h-14 bg-bg border-b border-hairlineSoft">
      <div className="h-full px-5 flex items-center justify-between gap-3">
        {backTo ? (
          <Link
            to={backTo.to}
            className="font-sans text-body text-ink no-underline flex items-center gap-2 -ml-1 px-2 h-11 rounded-md hover:bg-primaryWash"
          >
            <span aria-hidden>←</span>
            <span>{backTo.label}</span>
          </Link>
        ) : (
          <span className="font-sans text-body text-ink flex items-center gap-2">
            <span className="text-label uppercase text-inkDim">Mesa</span>
            <span className="font-mono text-body">{String(mesaNumero).padStart(2, '0')}</span>
          </span>
        )}

        <Link
          to="/carrinho"
          aria-label={`Carrinho com ${cartCount} ${cartCount === 1 ? 'item' : 'itens'}`}
          className="inline-flex items-center gap-2 h-11 px-3 -mr-1 rounded-md hover:bg-primaryWash"
        >
          <span className="text-label uppercase text-inkDim">Carrinho</span>
          <span
            className={[
              'font-mono text-mono px-2 py-0.5 rounded-sm border',
              cartCount > 0
                ? 'text-primary border-primary/30 bg-primaryWash'
                : 'text-inkDim border-hairline',
            ].join(' ')}
          >
            {cartCount}
          </span>
        </Link>
      </div>
    </header>
  );
}
