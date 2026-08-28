import type { OrderItemStatus } from '@mq/shared';

/**
 * Status vem do contrato da API (@mq/shared), nao de mocks/orders. A tela ja le
 * dados reais; manter o tipo preso ao mock faria a compilacao quebrar no dia em
 * que os mocks forem apagados — sem que nada de errado tenha sido feito.
 */
interface StatusTab {
  id: Exclude<OrderItemStatus, 'retirado' | 'cancelado'>;
  label: string;
  count: number;
}

interface StatusTabsProps {
  /**
   * `readonly` de proposito: o chamador monta a lista com `as const`, e um
   * array mutavel aqui obrigaria um cast do lado de la — que era exatamente o
   * `tabs as any` que existia antes.
   */
  tabs: readonly StatusTab[];
  activeId: StatusTab['id'];
  onSelect: (id: StatusTab['id']) => void;
}

/**
 * O placar da cozinha: três células iguais com a CONTAGEM em 26px sobre o
 * rótulo.
 *
 * Antes eram abas de texto com o número pequeno embaixo, e a pergunta que o
 * operador faz o tempo todo — "quantos tem na minha frente?" — era a
 * informação menor da linha. Agora o número é o que se lê de longe, e trocar
 * de aba é o efeito colateral de olhar pro placar.
 */
export function StatusTabs({ tabs, activeId, onSelect }: StatusTabsProps) {
  return (
    // A BARRA e larga, o PLACAR nao.
    //
    // Antes o grid ficava no mesmo elemento da faixa grudenta, entao as tres
    // celulas se esticavam por toda a largura do app: num monitor cada aba
    // virava um bloco de quase meio metro de tela, e a ativa um retangulo
    // vermelho gigante.
    //
    // Agora a faixa segue cheia (o fundo e a regua precisam encostar nas
    // bordas, senao a lista aparece por tras ao rolar) e o placar recebe a
    // MESMA goteira da fila. O efeito e que cada celula fica exatamente sobre
    // uma coluna de fichas: o numero de "Preparando" alinha com a pilha que ele
    // conta.
    <div className="sticky top-14 z-10 bg-bg border-b-rule border-divider">
      <div role="tablist" className="grid grid-cols-3 px-4 sm:px-6 lg:px-8">
      {tabs.map((t, i) => {
        const active = activeId === t.id;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(t.id)}
            className={[
              'flex flex-col gap-0.5 px-4 py-3 text-left cursor-pointer',
              'transition-colors duration-base ease-out',
              i > 0 ? 'border-l border-divider' : '',
              active ? 'bg-accent text-bg' : 'text-neutral-700 hover:text-ink',
            ].join(' ')}
          >
            <span className="font-display text-counter font-bold tabular">{t.count}</span>
            <span className="font-display text-label font-bold uppercase">{t.label}</span>
          </button>
        );
      })}
      </div>
    </div>
  );
}
