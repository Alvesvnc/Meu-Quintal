import { type ReactNode } from 'react';
import { Button } from './Button';
import { Sheet, SheetBody, SheetFooter } from './Sheet';

type ConfirmTone = 'primary' | 'danger';

interface ConfirmSheetProps {
  open: boolean;
  /** Pergunta principal — Archivo 800, alinhada à esquerda. */
  title: ReactNode;
  /** Texto explicativo opcional logo abaixo do título */
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** primary = ação que segue em frente, danger = ação destrutiva */
  tone?: ConfirmTone;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Sheet de confirmação — substitui window.confirm() com identidade do app.
 * Use sempre que precisar de confirmação destrutiva ou ação relevante.
 */
export function ConfirmSheet({
  open,
  title,
  body,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'primary',
  loading = false,
  onConfirm,
  onClose,
}: ConfirmSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} ariaLabel="Confirmação">
      <SheetBody>
        <h2 className="font-display text-display-md text-ink text-pretty">{title}</h2>
        {body && <p className="mt-3 text-body-sm text-neutral-700 text-pretty">{body}</p>}
      </SheetBody>

      <SheetFooter>
        <Button
          variant={tone}
          size="lg"
          fullWidth
          loading={loading}
          disabled={loading}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="block w-full mt-3 py-3 text-left cursor-pointer
                     font-display text-label font-bold uppercase text-neutral-600
                     hover:text-accent transition-colors duration-base ease-out
                     disabled:opacity-45 disabled:cursor-not-allowed"
        >
          {cancelLabel}
        </button>
      </SheetFooter>
    </Sheet>
  );
}
