import { useEffect, useRef } from 'react';
import { porLinha } from '../lib/gradeDeSecoes';

interface Tab {
  id: string;
  label: string;
}

interface TabBarProps {
  tabs: Tab[];
  /** id da seção atualmente visível na tela (controlado externamente via IntersectionObserver). */
  activeId: string;
  onSelect: (id: string) => void;
}

/**
 * Seções do cardápio: células IGUAIS, divididas por 1px.
 *
 * Grade e não rolagem horizontal. Com rolagem, a última seção ficava fora da
 * tela e a pessoa precisava descobrir que a linha arrasta. Célula ativa = bloco
 * vermelho sólido.
 *
 * QUEBRA LINHA desde 2026-08-27, quando as seções passaram a ser escritas pela
 * cozinha: antes eram quatro, fixas, e cabiam numa linha por construção. Agora
 * são até doze, e espremer doze células numa linha só deixaria cada rótulo com
 * quatro letras. A última linha estica pra fechar a largura — buraco no fim da
 * grade se leria como célula desligada.
 */
export function TabBar({ tabs, activeId, onSelect }: TabBarProps) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    refs.current[activeId]?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [activeId]);

  const base = `${100 / porLinha(tabs.length)}%`;

  return (
    <div
      role="tablist"
      className="sticky top-14 z-10 bg-bg border-b-rule border-divider overflow-hidden"
    >
      {/* O -1px puxa pra fora as divisórias da borda esquerda e do topo, que o
          `overflow-hidden` do pai corta. Sem isso, a primeira célula de cada
          linha ganharia um traço solto encostado na moldura. */}
      <div className="flex flex-wrap -ml-px -mt-px">
        {tabs.map((t) => {
          const active = t.id === activeId;
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[t.id] = el;
              }}
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(t.id)}
              // `flex-1` com base fracionária: a linha incompleta estica pra
              // fechar a largura em vez de deixar vão.
              style={{ flexBasis: base }}
              className={[
                'flex-1 min-w-0 px-3 py-2.5 min-h-11 text-left truncate cursor-pointer',
                'border-l border-t border-divider',
                'font-display text-label font-bold uppercase',
                'transition-colors duration-base ease-out',
                active ? 'bg-accent text-bg' : 'text-neutral-700 hover:text-ink',
              ].join(' ')}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
