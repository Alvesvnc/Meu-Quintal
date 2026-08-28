import { useEffect } from 'react';
import { Button, Sheet, SheetBody, SheetFooter, useAgora } from '@mq/design-system';
import type { AlteracaoPendente } from '@mq/shared';
import { fmtBRL } from '../lib/format';
import { alertar } from '../lib/alerta';

interface AlteracaoSheetProps {
  alteracao: AlteracaoPendente;
  onAceitar: () => void;
  onRecusar: () => void;
  enviando: boolean;
  erro: string | null;
}

/**
 * A cozinha propôs reduzir ou cancelar algo, e o cliente precisa decidir.
 *
 * Toma a tela de propósito: isto muda o que vai chegar e o que vai ser pago.
 * Não tem botão de fechar nem fecha ao tocar fora — sair sem responder deixaria
 * a proposta expirando em silêncio, e expirar equivale a recusar (o item é
 * cancelado por inteiro).
 */
export function AlteracaoSheet({
  alteracao,
  onAceitar,
  onRecusar,
  enviando,
  erro,
}: AlteracaoSheetProps) {
  // Som e vibração uma única vez, quando a proposta chega. Repetir a cada
  // render irritaria mais do que ajudaria.
  useEffect(() => {
    alertar();
  }, [alteracao.id]);

  const agora = useAgora();
  const segundosRestantes = Math.max(
    0,
    Math.floor((new Date(alteracao.expiresAt).getTime() - agora) / 1000),
  );
  const minutos = Math.floor(segundosRestantes / 60);
  const segundos = segundosRestantes % 60;

  return (
    <Sheet
      open
      onClose={() => {}}
      ariaLabel="A cozinha precisa alterar seu pedido"
      topo={
        <span className="font-display text-meta font-bold uppercase text-accent">
          {alteracao.kitchenName}
        </span>
      }
    >
      <SheetBody>
        <h2 className="font-display text-display-md text-ink text-pretty">
          A cozinha precisa mudar seu pedido.
        </h2>

        {alteracao.reason && (
          <p className="mt-3 text-body-sm text-neutral-700">“{alteracao.reason}”</p>
        )}

        <ul className="mt-4">
          {alteracao.linhas.map((l) => {
            const cancelar = l.qtyProposta === 0;
            return (
              <li
                key={l.orderItemId}
                className="flex items-baseline justify-between gap-4 py-3 border-b border-divider"
              >
                <span className="text-body-sm font-medium text-ink flex-1">{l.name}</span>
                <span className="font-display font-bold tabular shrink-0">
                  <s className="text-neutral-500">{l.qtyAnterior}×</s>
                  <span className="mx-2 text-neutral-500">→</span>
                  {cancelar ? (
                    <span className="text-accent-700 uppercase text-label">cancelar</span>
                  ) : (
                    <span className="text-ink">{l.qtyProposta}×</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>

        {/*
          O valor precisa aparecer ANTES da decisão. Decidir sem saber o impacto
          no que se vai pagar não é decidir.
        */}
        <div className="mt-4 bg-accent-100 px-3 py-2">
          <p className="text-body-sm text-accent-800 tabular">
            Aceitando, o total cai <strong>{fmtBRL(Math.abs(alteracao.deltaCents))}</strong>.
          </p>
        </div>

        <p className="mt-3 text-meta text-neutral-700">
          Se recusar, {alteracao.linhas.length === 1 ? 'o item sai' : 'os itens saem'} do pedido por
          completo — a cozinha não tem como entregar o que foi pedido.
        </p>

        {segundosRestantes > 0 ? (
          <div className="mt-4 flex items-baseline justify-between gap-3">
            <span className="font-display text-label font-bold uppercase text-neutral-600">
              Sem resposta, vale como recusa
            </span>
            <span className="font-display text-body-lg font-bold text-accent-700 tabular">
              {minutos}:{String(segundos).padStart(2, '0')}
            </span>
          </div>
        ) : (
          <p className="mt-4 font-display text-label font-bold uppercase text-accent-700">
            O prazo acabou. Atualize a tela pra ver como ficou.
          </p>
        )}

        {erro && <p className="mt-3 text-meta text-accent-700">{erro}</p>}
      </SheetBody>

      <SheetFooter>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={enviando || segundosRestantes === 0}
          onClick={onAceitar}
        >
          {enviando ? 'Enviando…' : 'Aceitar a mudança'}
        </Button>
        <button
          type="button"
          onClick={onRecusar}
          disabled={enviando || segundosRestantes === 0}
          className="block w-full mt-3 py-3 text-left cursor-pointer
                     font-display text-label font-bold uppercase text-neutral-600
                     hover:text-accent transition-colors duration-base ease-out
                     disabled:opacity-45 disabled:cursor-not-allowed"
        >
          Não quero, pode cancelar
        </button>
      </SheetFooter>
    </Sheet>
  );
}
