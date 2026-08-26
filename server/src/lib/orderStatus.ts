import type { OrderItemStatus } from '@mq/shared';

/**
 * Progressão de um item, na ordem em que acontece.
 *
 * `cancelado` NÃO está aqui de propósito: não é uma etapa do caminho, é uma
 * saída dele. Um item cancelado não está "atrasado" — ele não existe mais.
 */
export const STATUS_FLOW = ['novo', 'preparando', 'pronto', 'retirado'] as const;

/** Posição na progressão. `cancelado` fica fora da escala. */
export const STATUS_RANK: Record<(typeof STATUS_FLOW)[number], number> = {
  novo: 0,
  preparando: 1,
  pronto: 2,
  retirado: 3,
};

/**
 * Status agregado de uma cozinha dentro de um pedido.
 *
 * REGRA: o grupo só está cancelado quando TODOS os itens estão. Havendo
 * qualquer item ativo, o agregado é o mais atrasado entre eles — os cancelados
 * são ignorados.
 *
 * POR QUE ASSIM (decidido em 2026-08-24): até esta data havia DUAS
 * implementações desta função, e elas discordavam. A do cliente dava a
 * `cancelado` o menor rank, então um único item cancelado contaminava o grupo
 * inteiro; a da cozinha filtrava os cancelados. Resultado: cancelar um item de
 * um pedido de dois fazia o cliente ler "cancelado" e ir embora achando que
 * perdeu tudo, enquanto a cozinha entregava o outro item no balcão para
 * ninguém.
 *
 * Venceu a semântica da cozinha porque ela já era a do resto do sistema: o
 * financeiro do dono também exclui item cancelado do bruto
 * (`status: { not: 'cancelado' }` em modules/admin.ts). Cancelado significa
 * "não aconteceu" em todo lugar.
 *
 * CONTRAPARTIDA: o cliente precisa ver QUAIS itens foram cancelados, senão o
 * pedido apenas encolhe sem explicação. O contrato já manda `status` por item
 * em `OrderLineItem` — a tela mostra os cancelados riscados.
 */
export function aggregateStatus(statuses: OrderItemStatus[]): OrderItemStatus {
  if (statuses.length === 0) return 'novo';

  const ativos = statuses.filter((s) => s !== 'cancelado');
  if (ativos.length === 0) return 'cancelado';

  return ativos.reduce((maisAtrasado, s) =>
    STATUS_RANK[s as (typeof STATUS_FLOW)[number]] <
    STATUS_RANK[maisAtrasado as (typeof STATUS_FLOW)[number]]
      ? s
      : maisAtrasado,
  );
}

/** Próximo status na progressão, ou null se não há (retirado / cancelado). */
export function nextStatus(current: OrderItemStatus): OrderItemStatus | null {
  switch (current) {
    case 'novo':
      return 'preparando';
    case 'preparando':
      return 'pronto';
    case 'pronto':
      return 'retirado';
    default:
      return null;
  }
}

/**
 * Soma dos itens que ainda vão chegar — ignora cancelados.
 *
 * `Order.totalCents` é o snapshot do que foi PEDIDO e não muda quando um item
 * é cancelado (é registro histórico, não pode ser reescrito). Mas o número que
 * interessa ao cliente é o que ele vai pagar no balcão, e é este.
 */
export function totalAtivoCents(
  itens: Array<{ qty: number; unitPriceCents: number; status: OrderItemStatus }>,
): number {
  return itens
    .filter((i) => i.status !== 'cancelado')
    .reduce((acc, i) => acc + i.qty * i.unitPriceCents, 0);
}
