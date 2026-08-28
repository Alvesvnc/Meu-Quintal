import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** Conteúdo do sheet. Pode usar SheetHeader / SheetBody / SheetFooter. */
  children: ReactNode;
  ariaLabel: string;
  /**
   * Contexto na MESMA faixa do botão de fechar, alinhado à esquerda — o nome
   * da cozinha, no detalhe do item. Numa faixa própria seriam duas linhas de
   * chrome antes da foto, que é o que a tela veio mostrar.
   */
  topo?: ReactNode;
}

/**
 * Bottom sheet acessivel: backdrop tap fecha, ESC fecha, body trava scroll.
 * Slide-up via transform; backdrop fade. Respeita prefers-reduced-motion.
 *
 * É o único lugar do sistema que usa `shadow-lg`: o sheet precisa se descolar
 * da tela por baixo, e ali a régua não resolve — não há borda entre os dois.
 */
export function Sheet({ open, onClose, children, ariaLabel, topo }: SheetProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  return (
    <div
      aria-hidden={!open}
      className={[
        'fixed inset-0 z-40 transition-opacity duration-base ease-out',
        open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
      ].join(' ')}
    >
      <div onClick={onClose} className="absolute inset-0 bg-neutral-900/50" aria-hidden />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        className={[
          'absolute inset-x-0 bottom-0 mx-auto max-w-[480px]',
          'bg-bg rounded-none shadow-lg outline-none border-t-rule border-divider',
          'max-h-[92dvh] flex flex-col',
          'transition-transform duration-slow ease-out',
          open ? 'translate-y-0' : 'translate-y-full',
        ].join(' ')}
      >
        <div className="h-11 shrink-0 flex items-center gap-2 px-3">
          {topo && <span className="min-w-0 truncate">{topo}</span>}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="ml-auto w-10 h-10 shrink-0 flex items-center justify-center
                       border border-divider text-ink cursor-pointer
                       transition-colors duration-base ease-out hover:bg-ink/[0.07]"
          >
            <X size={18} strokeWidth={2} aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function SheetHeader({ children }: { children: ReactNode }) {
  return <div className="px-4 pb-3">{children}</div>;
}

export function SheetBody({ children }: { children: ReactNode }) {
  return <div className="px-4 pb-4 overflow-y-auto flex-1">{children}</div>;
}

export function SheetFooter({ children }: { children: ReactNode }) {
  return <div className="px-4 pt-3 pb-5 border-t-rule border-divider bg-bg">{children}</div>;
}
