import { describe, it, expect } from 'vitest';
import type { OrderItemStatus } from '@mq/shared';
import { aggregateStatus, nextStatus, totalAtivoCents } from './orderStatus.js';

describe('aggregateStatus', () => {
  it('lista vazia cai em "novo"', () => {
    expect(aggregateStatus([])).toBe('novo');
  });

  it('item unico devolve o proprio status', () => {
    expect(aggregateStatus(['pronto'])).toBe('pronto');
  });

  it('devolve o item MAIS ATRASADO — a cozinha so avanca quando todos avancam', () => {
    expect(aggregateStatus(['pronto', 'preparando', 'pronto'])).toBe('preparando');
    expect(aggregateStatus(['retirado', 'novo'])).toBe('novo');
    expect(aggregateStatus(['retirado', 'retirado'])).toBe('retirado');
  });

  it('nao depende da ordem da lista', () => {
    const statuses: OrderItemStatus[] = ['pronto', 'novo', 'preparando'];
    expect(aggregateStatus(statuses)).toBe(aggregateStatus([...statuses].reverse()));
  });

  // ── Cancelamento (decidido em 2026-08-24) ────────────────────────────────
  // Antes desta data, um item cancelado contaminava o grupo inteiro nas rotas
  // do cliente, enquanto a fila da cozinha o filtrava. Cancelar um item de um
  // pedido de dois fazia o cliente ler "cancelado" e ir embora achando que
  // perdeu tudo, enquanto a cozinha entregava o outro item no balcao.
  it('item cancelado NAO contamina o grupo', () => {
    expect(aggregateStatus(['pronto', 'cancelado'])).toBe('pronto');
    expect(aggregateStatus(['preparando', 'cancelado'])).toBe('preparando');
    expect(aggregateStatus(['retirado', 'retirado', 'cancelado'])).toBe('retirado');
  });

  it('so e cancelado quando TODOS os itens estao', () => {
    expect(aggregateStatus(['cancelado'])).toBe('cancelado');
    expect(aggregateStatus(['cancelado', 'cancelado'])).toBe('cancelado');
  });

  it('com cancelados no meio, o agregado continua sendo o mais atrasado', () => {
    expect(aggregateStatus(['pronto', 'cancelado', 'novo'])).toBe('novo');
    expect(aggregateStatus(['cancelado', 'retirado', 'preparando'])).toBe('preparando');
  });

  it('a mesma semantica do financeiro do dono: cancelado = nao aconteceu', () => {
    // modules/admin.ts exclui item cancelado do bruto com
    // `status: { not: 'cancelado' }`. Se esta regra divergir daquela, o dono
    // cobra sobre um conjunto de itens e o cliente ve outro.
    const comCancelado = aggregateStatus(['pronto', 'cancelado']);
    const semOCancelado = aggregateStatus(['pronto']);
    expect(comCancelado).toBe(semOCancelado);
  });
});

describe('nextStatus', () => {
  it('anda a progressao normal', () => {
    expect(nextStatus('novo')).toBe('preparando');
    expect(nextStatus('preparando')).toBe('pronto');
    expect(nextStatus('pronto')).toBe('retirado');
  });

  it('estados terminais nao avancam', () => {
    expect(nextStatus('retirado')).toBeNull();
    expect(nextStatus('cancelado')).toBeNull();
  });
});

describe('totalAtivoCents', () => {
  const item = (qty: number, unitPriceCents: number, status: OrderItemStatus = 'novo') => ({
    qty,
    unitPriceCents,
    status,
  });

  it('soma quantidade x preco', () => {
    expect(totalAtivoCents([item(2, 1800), item(1, 3200)])).toBe(1800 * 2 + 3200);
  });

  it('ignora item cancelado', () => {
    // E o numero que a pessoa paga no balcao. Cobrar por item cancelado seria
    // cobrar por comida que nao saiu.
    expect(totalAtivoCents([item(2, 1800), item(1, 3200, 'cancelado')])).toBe(3600);
  });

  it('tudo cancelado da zero', () => {
    expect(totalAtivoCents([item(2, 1800, 'cancelado')])).toBe(0);
  });

  it('lista vazia da zero', () => {
    expect(totalAtivoCents([])).toBe(0);
  });

  it('item retirado ainda conta — ja foi entregue e sera pago', () => {
    expect(totalAtivoCents([item(1, 5000, 'retirado')])).toBe(5000);
  });
});
