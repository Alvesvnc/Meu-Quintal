import { useState } from 'react';
import { Button, Sheet, SheetBody, SheetFooter, SheetHeader } from '@mq/design-system';
import { mensagemDeErro, type FilaOrder, type MotivoCancelamento } from '@mq/shared';
import { useCancel } from '../api/hooks';
import { SeletorDeMotivo } from '../components/SeletorDeMotivo';
import { motivoCompleto } from '../lib/motivoCompleto';

interface Props {
  order: FilaOrder;
  onClose: () => void;
}

/**
 * Cancelamento do pedido inteiro nesta cozinha.
 *
 * Substituiu um `ConfirmSheet` de sim/não. O motivo passou a ser obrigatório
 * porque é ele que responde "o que mais me faz cancelar?" — antes o campo era
 * validado e descartado, então a cozinha escrevia achando que servia para
 * alguma coisa.
 *
 * Vale lembrar que **alterar** costuma ser melhor que cancelar: reduzir "2 para
 * 1" resolve a falta de ingrediente sem o cliente perder o pedido todo.
 */
export function CancelarPedidoSheet({ order, onClose }: Props) {
  const cancelar = useCancel();
  const [motivo, setMotivo] = useState<MotivoCancelamento | null>(null);
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const podeEnviar = motivoCompleto(motivo, texto) && !cancelar.isPending;

  const enviar = () => {
    setErro(null);
    if (!motivoCompleto(motivo, texto)) return;

    cancelar.mutate(
      { orderId: order.id, motivo, reason: texto.trim() || undefined },
      {
        onSuccess: onClose,
        onError: (e) => setErro(mensagemDeErro(e, 'Nao consegui cancelar.')),
      },
    );
  };

  return (
    <Sheet open onClose={onClose} ariaLabel="Cancelar pedido">
      <SheetHeader>
        <p className="font-mono text-mono-sm uppercase tracking-wider text-inkDim">
          Pedido #{order.shortId} · Mesa {String(order.mesaNumero).padStart(2, '0')}
        </p>
        <h2 className="mt-1 font-display text-display-md text-ink leading-tight">
          Cancelar o pedido inteiro?
        </h2>
      </SheetHeader>

      <SheetBody>
        <p className="font-sans text-body text-inkMuted">
          O cliente vai ver o pedido como cancelado e não vai pagar por ele. Se você consegue
          entregar parte, use <span className="text-ink">alterar itens</span> — assim ele não perde
          o pedido todo.
        </p>

        <ul className="mt-4 space-y-1">
          {order.items
            .filter((i) => i.status !== 'cancelado')
            .map((i) => (
              <li key={i.id} className="font-sans text-body text-inkMuted">
                <span className="font-mono text-ink mr-2 tabular-nums">{i.qty}×</span>
                {i.name}
              </li>
            ))}
        </ul>

        <div className="mt-6">
          <SeletorDeMotivo
            valor={motivo}
            onChange={setMotivo}
            texto={texto}
            onTextoChange={setTexto}
          />
        </div>

        {erro && <p className="mt-4 font-mono text-mono-sm text-danger">{erro}</p>}
      </SheetBody>

      <SheetFooter>
        <Button variant="danger" size="lg" fullWidth disabled={!podeEnviar} onClick={enviar}>
          {cancelar.isPending ? 'Cancelando…' : 'Sim, cancelar'}
        </Button>
        <Button variant="ghost" size="lg" fullWidth onClick={onClose}>
          Voltar
        </Button>
      </SheetFooter>
    </Sheet>
  );
}
