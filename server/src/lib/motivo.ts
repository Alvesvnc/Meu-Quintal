import type { MotivoCancelamento as MotivoDaAPI } from '@mq/shared';
import type { MotivoCancelamento as MotivoDoPrisma } from '@prisma/client';

/**
 * Tradução entre o motivo como o Prisma o nomeia e como a API o expõe.
 *
 * POR QUE EXISTEM DOIS NOMES: identificador de enum no Prisma não aceita hífen,
 * então o schema declara `sem_ingrediente @map("sem-ingrediente")` — a coluna
 * guarda o hífen, o tipo gerado usa underscore. A API usa a forma com hífen,
 * igual ao resto do projeto (`sem-estoque`, `precisa-limpar`).
 *
 * O projeto já resolvia isso com ternários espalhados
 * (`i.badge === 'sem_estoque' ? 'sem-estoque' : i.badge`). Aqui é uma tabela só:
 * acrescentar um motivo novo e esquecer de traduzir vira erro de compilação,
 * porque os dois Records são exaustivos.
 */

const PARA_PRISMA: Record<MotivoDaAPI, MotivoDoPrisma> = {
  'sem-ingrediente': 'sem_ingrediente',
  equipamento: 'equipamento',
  'demanda-alta': 'demanda_alta',
  'fim-de-expediente': 'fim_de_expediente',
  'item-errado-no-cardapio': 'item_errado_no_cardapio',
  'cliente-desistiu': 'cliente_desistiu',
  outro: 'outro',
};

const PARA_API: Record<MotivoDoPrisma, MotivoDaAPI> = {
  sem_ingrediente: 'sem-ingrediente',
  equipamento: 'equipamento',
  demanda_alta: 'demanda-alta',
  fim_de_expediente: 'fim-de-expediente',
  item_errado_no_cardapio: 'item-errado-no-cardapio',
  cliente_desistiu: 'cliente-desistiu',
  outro: 'outro',
};

export const motivoParaPrisma = (m: MotivoDaAPI): MotivoDoPrisma => PARA_PRISMA[m];

export const motivoParaAPI = (m: MotivoDoPrisma): MotivoDaAPI => PARA_API[m];
