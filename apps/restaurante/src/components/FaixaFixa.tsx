import type { ReactNode } from 'react';

interface FaixaFixaProps {
  children: ReactNode;
}

/** Régua de 2px + `py-3` (12 em cima, 12 embaixo) + botão `size="lg"` (52px). */
const ALTURA_DA_FAIXA = 2 + 12 + 52 + 12;

/**
 * O que a tela precisa reservar embaixo pra nada ficar atrás da faixa.
 *
 * Sai daqui, e não de um `pb-28` chutado na tela: são duas barras empilhadas
 * (abas + faixa) e um número escrito à mão erra assim que uma delas muda de
 * altura — foi o que escondeu metade do preço do último item da lista.
 *
 * `env(safe-area-inset-bottom)` entra na conta porque a barra de abas também o
 * soma à própria altura: no aparelho com faixa de gesto, ignorar isso devolve o
 * mesmo bug alguns pixels adiante.
 */
export const ESPACO_DA_FAIXA = `calc(var(--barra-inferior) + ${
  ALTURA_DA_FAIXA + 24
}px)`;

/**
 * A faixa colada acima da barra de abas — onde mora a ação principal da tela.
 *
 * FUNDO OPACO E LARGURA CHEIA, e não um botão solto flutuando no canto: solto,
 * ele pousava em cima da lista e escondia o preço da última linha visível. Um
 * preço meio tapado numa tela de edição de cardápio é pior que ocupar a faixa —
 * a pessoa não sabe se está lendo 14,00 ou 4,00.
 *
 * Mesmos 720px e mesma goteira das telas: a faixa é o rodapé DELAS, e um bloco
 * mais estreito que a lista que ele encerra se leria como outro elemento.
 */
export function FaixaFixa({ children }: FaixaFixaProps) {
  return (
    <div
      className="fixed inset-x-0 z-30 pointer-events-none"
      // Se apoia na barra de abas — e quando ela nao existe (mouse), desce pro
      // chao sozinha. Ver `--barra-inferior` no index.css.
      style={{ bottom: 'var(--barra-inferior)' }}
    >
      <div
        className="mx-auto w-full max-w-[720px] bg-surface border-t-rule border-divider
                   px-5 sm:px-6 py-3 pointer-events-auto"
      >
        {children}
      </div>
    </div>
  );
}
