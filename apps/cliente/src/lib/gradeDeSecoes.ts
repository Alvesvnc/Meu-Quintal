/**
 * A geometria da linha de seções do cardápio.
 *
 * Mora fora do `TabBar` porque a tela também precisa dela: o cardápio rola até
 * uma seção descontando o que está grudado no topo, e esse desconto depende de
 * quantas LINHAS a grade tem. Os dois números têm que sair da mesma conta —
 * separados, a rolagem passaria a parar alguns pixels fora do lugar toda vez que
 * a grade mudasse, sem ninguém notar.
 */

/** Altura de uma célula: `min-h-11` (44px) mais o 1px de divisória de cima. */
const ALTURA_DA_LINHA = 45;

/**
 * Quantas células cabem numa linha.
 *
 * Até três, tudo numa linha só. Quatro viram 2×2 — em linha de três sobraria
 * uma sozinha embaixo, ocupando a largura inteira, o que faz a quarta seção
 * parecer mais importante que as outras. De cinco pra cima, linhas de três: é o
 * ponto em que o rótulo ainda cabe num celular estreito.
 */
export function porLinha(quantas: number): number {
  if (quantas <= 3) return Math.max(quantas, 1);
  if (quantas === 4) return 2;
  return 3;
}

/** Altura total da linha de seções, pra quem precisa descontar o topo grudado. */
export function alturaDasSecoes(quantas: number): number {
  return Math.ceil(quantas / porLinha(quantas)) * ALTURA_DA_LINHA;
}
