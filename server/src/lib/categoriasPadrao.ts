/**
 * As secoes com que um cardapio novo comeca.
 *
 * Sao um PONTO DE PARTIDA, nao a verdade: a cozinha renomeia, reordena, apaga e
 * cria as dela. Existem porque cardapio comeca vazio e "crie uma secao antes de
 * criar o primeiro item" e um degrau a mais entre a pessoa e o primeiro prato
 * no ar — logo no unico momento em que ela ainda nao sabe usar o app.
 *
 * Sao as mesmas quatro que eram enum ate 2026-08-27, e por isso toda cozinha
 * que ja existia continuou com o cardapio exatamente como estava.
 */
export const CATEGORIAS_PADRAO = ['Entradas', 'Pratos', 'Sobremesas', 'Bebidas'] as const;

/** `{ name, sortOrder }` pronto pro `createMany`/`create` aninhado do Prisma. */
export function categoriasPadrao(): Array<{ name: string; sortOrder: number }> {
  return CATEGORIAS_PADRAO.map((name, i) => ({ name, sortOrder: i }));
}
