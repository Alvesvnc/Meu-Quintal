import { useEffect } from 'react';
import {
  Button,
  Sheet,
  SheetBody,
  SheetFooter,
  SheetHeader,
  useAgora,
} from '@mq/design-system';
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
    <Sheet open onClose={() => {}} ariaLabel="A cozinha precisa alterar seu pedido">
      <SheetHeader>
        <p className="font-mono text-mono-sm uppercase tracking-wider text-primary">
          {alteracao.kitchenName}
        </p>
        <h2 className="mt-1 font-display italic text-display-md text-ink leading-tight text-pretty">
          A cozinha precisa mudar seu pedido.
        </h2>
      </SheetHeader>

      <SheetBody>
        {alteracao.reason && (
          <p className="font-sans text-body text-inkMuted italic">“{alteracao.reason}”</p>
        )}

        <ul className="mt-5 space-y-3">
          {alteracao.linhas.map((l) => {
            const cancelar = l.qtyProposta === 0;
            return (
              <li
                key={l.orderItemId}
                className="flex items-baseline justify-between gap-4 border-b border-hairlineSoft pb-3"
              >
                <span className="font-sans text-body-lg text-ink flex-1">{l.name}</span>
                <span className="font-mono text-body tabular-nums shrink-0">
                  <span className="text-inkDim line-through">{l.qtyAnterior}×</span>
                  <span className="mx-2 text-inkDim">→</span>
                  {cancelar ? (
                    <span className="text-danger uppercase text-mono-sm tracking-wider">
                      cancelar
                    </span>
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
        <p className="mt-5 font-sans text-body text-inkMuted">
          Se você aceitar, o total cai{' '}
          <span className="font-mono text-ink">{fmtBRL(Math.abs(alteracao.deltaCents))}</span>.
        </p>

        <p className="mt-4 font-sans text-body-sm text-inkDim">
          Se recusar, {alteracao.linhas.length === 1 ? 'o item sai' : 'os itens saem'} do pedido
          por completo — a cozinha não tem como entregar o que foi pedido.
        </p>

        {segundosRestantes > 0 ? (
          <p className="mt-4 font-mono text-mono-sm text-inkDim tabular-nums">
            Sem resposta em {minutos}:{String(segundos).padStart(2, '0')}, vale como recusa.
          </p>
        ) : (
          <p className="mt-4 font-mono text-mono-sm text-danger">
            O prazo acabou. Atualize a tela pra ver como ficou.
          </p>
        )}

        {erro && <p className="mt-4 font-mono text-mono-sm text-danger">{erro}</p>}
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
        <Button
          variant="secondary"
          size="lg"
          fullWidth
          disabled={enviando || segundosRestantes === 0}
          onClick={onRecusar}
        >
          Não quero, pode cancelar
        </Button>
      </SheetFooter>
    </Sheet>
  );
}
