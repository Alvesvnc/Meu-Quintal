import { Flame, UtensilsCrossed, UserRound, type LucideIcon } from 'lucide-react';
import { useFila } from '../api/hooks';

/**
 * As abas da cozinha, num lugar só.
 *
 * Existem DUAS navegações que mostram esta mesma lista: a barra de baixo, para
 * quem usa o dedo, e a linha no cabeçalho, para quem usa mouse (ver a variante
 * `mouse:` no preset do Tailwind). Nunca aparecem juntas — o CSS mostra uma ou
 * a outra conforme o apontador.
 *
 * Duas listas escritas à mão divergiriam na primeira aba nova: alguém adiciona
 * em uma, esquece a outra, e metade dos aparelhos não enxerga a tela. Como
 * hook, as duas leem a mesma coisa e o contador da fila também não pode
 * discordar entre elas.
 */

export interface Aba {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Número no canto, ou `null` quando não há o que avisar. */
  badge: string | null;
}

export function useAbas(): Aba[] {
  // Mesma fonte da tela da fila: o badge não pode discordar do que ela mostra.
  const { data } = useFila();
  const ativos =
    data?.orders.filter((o) => o.status === 'novo' || o.status === 'preparando').length ?? 0;

  return [
    {
      to: '/fila',
      label: 'Fila',
      icon: Flame,
      badge: ativos > 0 ? String(ativos) : null,
    },
    { to: '/cardapio', label: 'Cardápio', icon: UtensilsCrossed, badge: null },
    { to: '/eu', label: 'Eu', icon: UserRound, badge: null },
  ];
}
