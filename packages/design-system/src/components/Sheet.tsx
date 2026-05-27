import { useEffect, useRef, type ReactNode } from 'react';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** Conteúdo do sheet. Pode usar SheetHeader / SheetBody / SheetFooter. */
  children: ReactNode;
  ariaLabel: string;
}

/**
 * Bottom sheet acessivel: backdrop tap fecha, ESC fecha, body trava scroll.
 * Slide-up via transform; backdrop fade. Respeita prefers-reduced-motion.
 */
export function Sheet({ open, onClose, children, ariaLabel }: SheetProps) {
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
      <div
        onClick={onClose}
        className="absolute inset-0 bg-ink/40"
        aria-hidden
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        className={[
          'absolute inset-x-0 bottom-0 mx-auto max-w-[480px]',
          'bg-bg rounded-t-xl shadow-sheet outline-none',
          'max-h-[92dvh] flex flex-col',
          'transition-transform duration-slow ease-out',
          open ? 'translate-y-0' : 'translate-y-full',
        ].join(' ')}
      >
        {/* drag handle + close */}
        <div className="relative pt-3 pb-1">
          <div className="flex justify-center" aria-hidden>
            <div className="w-10 h-1 bg-hairline rounded-full" />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="absolute top-1.5 right-3 w-9 h-9 flex items-center justify-center
                       rounded-full font-mono text-body text-inkDim cursor-pointer
                       transition-colors duration-base ease-out
                       hover:bg-hairlineSoft hover:text-ink"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function SheetHeader({ children }: { children: ReactNode }) {
  return <div className="px-5 pt-2 pb-3">{children}</div>;
}

export function SheetBody({ children }: { children: ReactNode }) {
  return <div className="px-5 pb-4 overflow-y-auto flex-1">{children}</div>;
}

export function SheetFooter({ children }: { children: ReactNode }) {
  return (
    <div className="px-5 pt-3 pb-5 border-t border-hairlineSoft bg-bg">
      {children}
    </div>
  );
}
