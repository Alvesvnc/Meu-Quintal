import { describe, it, expect } from 'vitest';
import { createOrderSchema } from './order.js';

const uuid = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const ok = { items: [{ menuItemId: uuid, qty: 2 }] };

describe('createOrderSchema', () => {
  it('aceita pedido minimo valido', () => {
    expect(createOrderSchema.safeParse(ok).success).toBe(true);
  });

  it('aceita nota de ate 140 chars', () => {
    const r = createOrderSchema.safeParse({
      items: [{ menuItemId: uuid, qty: 1, note: 'x'.repeat(140) }],
    });
    expect(r.success).toBe(true);
  });

  it('recusa carrinho vazio', () => {
    expect(createOrderSchema.safeParse({ items: [] }).success).toBe(false);
  });

  it('recusa menuItemId que nao e uuid', () => {
    expect(createOrderSchema.safeParse({ items: [{ menuItemId: 'abc', qty: 1 }] }).success).toBe(
      false,
    );
  });

  it.each([0, -1, 21, 1.5])('recusa qty invalida: %s', (qty) => {
    expect(createOrderSchema.safeParse({ items: [{ menuItemId: uuid, qty }] }).success).toBe(false);
  });

  it('recusa nota acima de 140 chars', () => {
    const r = createOrderSchema.safeParse({
      items: [{ menuItemId: uuid, qty: 1, note: 'x'.repeat(141) }],
    });
    expect(r.success).toBe(false);
  });

  it('recusa mais de 50 linhas — limite anti-abuso', () => {
    const items = Array.from({ length: 51 }, () => ({ menuItemId: uuid, qty: 1 }));
    expect(createOrderSchema.safeParse({ items }).success).toBe(false);
  });

  it('recusa body sem items', () => {
    expect(createOrderSchema.safeParse({}).success).toBe(false);
  });
});
