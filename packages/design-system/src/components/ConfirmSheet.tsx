import { type ReactNode } from 'react';
import { Button } from './Button';
import { Sheet, SheetBody, SheetFooter } from './Sheet';

type ConfirmTone = 'primary' | 'danger';

interface ConfirmSheetProps {
  open: boolean;
  /** Pergunta principal — vai em Fraunces italic display-md */
  title: ReactNode;
  /** Texto explicativo opcional logo abaixo do título */
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** primary = ação positiva (terracota), danger = ação destrutiva (vermelho) */
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
        <h2 className="font-display italic text-display-md text-ink leading-tight text-pretty">
          {title}
        </h2>
        {body && (
          <p className="mt-3 font-sans text-body text-inkMuted text-pretty">
            {body}
          </p>
        )}
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
          className="block w-full mt-3 py-3 cursor-pointer
                     font-mono text-mono-sm uppercase tracking-wider text-inkDim
                     hover:text-ink transition-colors duration-base ease-out
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {cancelLabel}
        </button>
      </SheetFooter>
    </Sheet>
  );
}
