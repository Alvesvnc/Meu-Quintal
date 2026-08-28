/**
 * Motivo de cancelamento — categoria fechada, para virar métrica.
 *
 * Texto livre não agrega: "acabou o pão", "sem pão" e "pao acabou" são a mesma
 * causa escrita de três jeitos. A categoria é o que soma; o texto livre continua
 * existindo separado, para o cliente ler o caso específico.
 */
export type MotivoCancelamento =
  | 'sem-ingrediente'
  | 'equipamento'
  | 'demanda-alta'
  | 'fim-de-expediente'
  | 'item-errado-no-cardapio'
  | 'cliente-desistiu'
  | 'outro';

/** Ordem em que aparecem na tela — da causa mais comum para a menos. */
export const MOTIVOS_CANCELAMENTO: MotivoCancelamento[] = [
  'sem-ingrediente',
  'demanda-alta',
  'equipamento',
  'fim-de-expediente',
  'item-errado-no-cardapio',
  'cliente-desistiu',
  'outro',
];

/** Rótulo curto, para o botão da cozinha. */
export const MOTIVO_LABEL: Record<MotivoCancelamento, string> = {
  'sem-ingrediente': 'Acabou o ingrediente',
  'demanda-alta': 'Não dou conta no tempo',
  equipamento: 'Equipamento quebrou',
  'fim-de-expediente': 'Fim de expediente',
  'item-errado-no-cardapio': 'Item errado no cardápio',
  'cliente-desistiu': 'Cliente desistiu',
  outro: 'Outro motivo',
};

export interface CancelamentoPorMotivo {
  motivo: MotivoCancelamento;
  /** Quantos ITENS foram cancelados por esta causa. */
  itens: number;
  /** Quanto deixou de ser vendido, em centavos. */
  perdaCents: number;
}

/** Resposta de GET /api/r/metricas/cancelamentos */
export interface MetricasCancelamentoResponse {
  /** Janela consultada. */
  dias: number;
  desde: string;
  totalItens: number;
  /** Soma do que deixou de ser vendido no período. */
  perdaTotalCents: number;
  porMotivo: CancelamentoPorMotivo[];
  /** Os itens que mais são cancelados — onde olhar primeiro. */
  itensMaisCancelados: Array<{ name: string; itens: number; perdaCents: number }>;
  /**
   * Quanto dos totais acima veio de REDUÇÃO aceita, não de cancelamento cheio.
   *
   * Os dois entram no mesmo total de propósito: a pergunta que a métrica
   * responde é "quanto deixei de vender", e reduzir de 3 pra 1 perde duas
   * unidades exatamente como cancelar perderia.
   *
   * Mas a tela precisa poder dizer isso em voz alta. Um número rotulado só
   * "cancelamentos" que na verdade inclui reduções é um número que mente — e
   * quem for conferir contando os itens cancelados na mão não vai fechar.
   */
  reducoes: { itens: number; perdaCents: number };
}
