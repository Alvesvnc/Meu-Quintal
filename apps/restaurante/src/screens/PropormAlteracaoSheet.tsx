import { useState } from 'react';
import { Button, Sheet, SheetBody, SheetFooter, SheetHeader } from '@mq/design-system';
import { mensagemDeErro, type FilaOrder, type MotivoCancelamento } from '@mq/shared';
import { usePropormAlteracao } from '../api/hooks';
import { SeletorDeMotivo } from '../components/SeletorDeMotivo';
import { motivoCompleto } from '../lib/motivoCompleto';

interface Props {
  order: FilaOrder;
  onClose: () => void;
}

/**
 * A cozinha propõe reduzir quantidade ou cancelar itens.
 *
 * Não aplica direto: o cliente recebe a proposta na tela dele e decide. Só
 * REDUZ — aumentar seria vender o que ninguém pediu, e o servidor recusa.
 *
 * A fila não trava esperando: os itens não afetados seguem sendo preparados
 * normalmente enquanto a resposta não vem.
 */
export function PropormAlteracaoSheet({ order, onClose }: Props) {
  const propor = usePropormAlteracao();
  const [motivo, setMotivo] = useState<MotivoCancelamento | null>(null);
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  // Item já cancelado ou retirado não entra: um foi entregue, o outro não
  // existe mais.
  const alteraveis = order.items.filter(
    (i) => i.status !== 'cancelado' && i.status !== 'retirado',
  );

  /** orderItemId -> nova quantidade. Ausente = sem alteração. */
  const [novasQtds, setNovasQtds] = useState<Record<string, number>>({});

  const definir = (id: string, qty: number) =>
    setNovasQtds((prev) => ({ ...prev, [id]: qty }));

  const linhasAlteradas = alteraveis
    .filter((i) => novasQtds[i.id] !== undefined && novasQtds[i.id] < i.qty)
    .map((i) => ({ orderItemId: i.id, qtyProposta: novasQtds[i.id] }));

  const podeEnviar =
    linhasAlteradas.length > 0 && motivoCompleto(motivo, texto) && !propor.isPending;

  const enviar = () => {
    setErro(null);
    if (!motivoCompleto(motivo, texto)) return;

    propor.mutate(
      {
        orderId: order.id,
        motivo,
        reason: texto.trim() || undefined,
        itens: linhasAlteradas,
      },
      {
        onSuccess: onClose,
        onError: (e) => setErro(mensagemDeErro(e, 'Nao consegui enviar a alteracao.')),
      },
    );
  };

  return (
    <Sheet open onClose={onClose} ariaLabel="Alterar pedido">
      <SheetHeader>
        <p className="font-mono text-mono-sm uppercase tracking-wider text-inkDim">
          Pedido #{order.shortId} · Mesa {String(order.mesaNumero).padStart(2, '0')}
        </p>
        <h2 className="mt-1 font-display text-display-md text-ink leading-tight">
          O que você não consegue entregar?
        </h2>
      </SheetHeader>

      <SheetBody>
        <ul className="space-y-4">
          {alteraveis.map((item) => {
            const atual = novasQtds[item.id] ?? item.qty;
            return (
              <li key={item.id} className="border-b border-hairline pb-4">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-sans text-body-lg text-ink flex-1">
                    {item.name}
                  </span>
                  <span className="font-mono text-mono-sm text-inkDim shrink-0">
                    pedido: {item.qty}×
                  </span>
                </div>

                {/*
                  Botões por quantidade, não um campo de digitar: o operador está
                  com a mão ocupada e a tela pode estar engordurada. De `item.qty`
                  até 0, onde 0 é cancelar.
                */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {Array.from({ length: item.qty + 1 }, (_, n) => n)
                    .reverse()
                    .map((n) => {
                      const selecionado = atual === n;
                      const cancelar = n === 0;
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => definir(item.id, n)}
                          className={[
                            'min-w-11 h-11 px-3 font-mono text-body tabular-nums',
                            'border transition-colors duration-base ease-out',
                            selecionado && cancelar
                              ? 'border-danger bg-danger text-bg'
                              : selecionado
                                ? 'border-primary bg-primary text-bg'
                                : 'border-hairline text-inkDim',
                          ].join(' ')}
                        >
                          {cancelar ? 'cancelar' : `${n}×`}
                        </button>
                      );
                    })}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="mt-6">
          <SeletorDeMotivo
            valor={motivo}
            onChange={setMotivo}
            texto={texto}
            onTextoChange={setTexto}
          />
        </div>

        {linhasAlteradas.length === 0 ? (
          <p className="mt-5 font-sans text-body-sm text-inkMuted">
            Escolha uma quantidade menor em algum item para propor a mudança.
          </p>
        ) : (
          <p className="mt-5 font-sans text-body-sm text-inkMuted">
            O cliente tem 5 minutos para responder. Sem resposta,{' '}
            {linhasAlteradas.length === 1 ? 'o item é cancelado' : 'os itens são cancelados'} por
            completo.
          </p>
        )}

        {erro && <p className="mt-4 font-mono text-mono-sm text-danger">{erro}</p>}
      </SheetBody>

      <SheetFooter>
        <Button variant="primary" size="lg" fullWidth disabled={!podeEnviar} onClick={enviar}>
          {propor.isPending ? 'Enviando…' : 'Enviar pro cliente'}
        </Button>
        <Button variant="ghost" size="lg" fullWidth onClick={onClose}>
          Voltar
        </Button>
      </SheetFooter>
    </Sheet>
  );
}
