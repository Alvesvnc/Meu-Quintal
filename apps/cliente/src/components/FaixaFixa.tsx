import type { ReactNode } from 'react';
import { TABS_HEIGHT } from './BottomTabs';

interface FaixaFixaProps {
  children: ReactNode;
}

/**
 * A faixa que fica colada acima da barra de abas — carrinho, total, enviar.
 *
 * Fundo `surface` opaco e régua de 2px em cima. Opaco de propósito: a versão
 * translúcida com blur deixava a foto do prato aparecer por baixo e o preço
 * ficava ilegível justamente sobre as fotos mais claras.
 *
 * A distância até a base vem de `TABS_HEIGHT` em pixel, e não de `bottom-16`:
 * é o mesmo número que o `App` reserva de padding, e dois números que
 * precisam ser iguais não podem morar em unidades diferentes.
 */
export function FaixaFixa({ children }: FaixaFixaProps) {
  return (
    <div className="fixed inset-x-0 z-30 pointer-events-none" style={{ bottom: TABS_HEIGHT }}>
      <div
        className="mx-auto max-w-[480px] bg-surface border-t-rule border-divider
                   px-4 py-3 pointer-events-auto"
      >
        {children}
      </div>
    </div>
  );
}
