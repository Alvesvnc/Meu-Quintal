import { describe, it, expect, beforeEach } from 'vitest';
import type { MenuItem } from '@mq/shared';
import { useCart, selectItemCount, selectTotalCents, groupByKitchen } from './cart';

/**
 * `fotos` vai explicito mesmo vazio: `addLine` LE esse campo pra guardar a
 * capa na linha, e um fixture sem ele quebraria por falta de dado — nao por
 * regra de carrinho, que e o que estes testes cobrem.
 */
const item = (
  id: string,
  priceCents: number,
  name = `item-${id}`,
  extra: Partial<MenuItem> = {},
) => ({ id, name, priceCents, fotos: [], photoUrl: null, ...extra }) as MenuItem;

const nagoya = { slug: 'nagoya', name: 'Nagoya' };
const forno = { slug: 'forno', name: 'Forno de Barro' };

const reset = () => useCart.setState({ lines: [], activeOrders: [] });

describe('carrinho — linhas', () => {
  beforeEach(reset);

  it('adiciona linha nova', () => {
    useCart.getState().addLine(item('a', 1500), nagoya);
    expect(useCart.getState().lines).toHaveLength(1);
    expect(useCart.getState().lines[0].qty).toBe(1);
  });

  it('somar o mesmo item incrementa a qty em vez de duplicar a linha', () => {
    useCart.getState().addLine(item('a', 1500), nagoya, 2);
    useCart.getState().addLine(item('a', 1500), nagoya, 3);
    expect(useCart.getState().lines).toHaveLength(1);
    expect(useCart.getState().lines[0].qty).toBe(5);
  });

  it('guarda snapshot de preco e cozinha na linha', () => {
    useCart.getState().addLine(item('a', 1500), nagoya);
    const line = useCart.getState().lines[0];
    expect(line.priceCents).toBe(1500);
    expect(line.kitchenSlug).toBe('nagoya');
    expect(line.kitchenName).toBe('Nagoya');
  });

  it('guarda a capa do item na linha, e nao a URL pronta', () => {
    useCart.getState().addLine(
      item('a', 1500, 'item-a', {
        fotos: [{ id: 'f1', url: '/api/fotos/abc.webp', width: 800, height: 800 }],
      }),
      nagoya,
    );
    // Caminho relativo: o carrinho sobrevive em localStorage a uma troca de
    // VITE_API_URL, e o endereco absoluto congelaria o host antigo na linha.
    expect(useCart.getState().lines[0].foto).toBe('/api/fotos/abc.webp');
  });

  it('cai na photoUrl externa quando a cozinha nao enviou foto', () => {
    useCart
      .getState()
      .addLine(item('a', 1500, 'item-a', { photoUrl: 'https://exemplo/x.jpg' }), nagoya);
    expect(useCart.getState().lines[0].foto).toBe('https://exemplo/x.jpg');
  });

  it('sem foto nenhuma, a linha fica sem capa', () => {
    useCart.getState().addLine(item('a', 1500), nagoya);
    expect(useCart.getState().lines[0].foto).toBeUndefined();
  });

  it('setQty com 0 ou negativo remove a linha', () => {
    useCart.getState().addLine(item('a', 1500), nagoya);
    useCart.getState().setQty('a', 0);
    expect(useCart.getState().lines).toHaveLength(0);
  });

  it('clearKitchen tira so a cozinha alvo', () => {
    useCart.getState().addLine(item('a', 1000), nagoya);
    useCart.getState().addLine(item('b', 2000), forno);
    useCart.getState().clearKitchen('nagoya');
    const lines = useCart.getState().lines;
    expect(lines).toHaveLength(1);
    expect(lines[0].kitchenSlug).toBe('forno');
  });
});

describe('carrinho — totais', () => {
  beforeEach(reset);

  it('conta itens somando qty, nao linhas', () => {
    useCart.getState().addLine(item('a', 1000), nagoya, 3);
    useCart.getState().addLine(item('b', 2000), forno, 2);
    expect(selectItemCount(useCart.getState())).toBe(5);
  });

  it('total multiplica preco por qty em centavos', () => {
    useCart.getState().addLine(item('a', 1990), nagoya, 3);
    useCart.getState().addLine(item('b', 550), forno, 2);
    expect(selectTotalCents(useCart.getState())).toBe(1990 * 3 + 550 * 2);
  });

  it('carrinho vazio tem total zero', () => {
    expect(selectTotalCents(useCart.getState())).toBe(0);
    expect(selectItemCount(useCart.getState())).toBe(0);
  });
});

describe('groupByKitchen', () => {
  it('agrupa por cozinha e soma subtotal de cada uma', () => {
    const groups = groupByKitchen([
      { menuItemId: 'a', name: 'A', priceCents: 1000, kitchenSlug: 'nagoya', kitchenName: 'Nagoya', qty: 2 },
      { menuItemId: 'b', name: 'B', priceCents: 500, kitchenSlug: 'forno', kitchenName: 'Forno de Barro', qty: 1 },
      { menuItemId: 'c', name: 'C', priceCents: 250, kitchenSlug: 'nagoya', kitchenName: 'Nagoya', qty: 4 },
    ]);

    expect(groups).toHaveLength(2);
    const nag = groups.find((g) => g.kitchenSlug === 'nagoya')!;
    expect(nag.lines).toHaveLength(2);
    expect(nag.subtotalCents).toBe(1000 * 2 + 250 * 4);
    expect(groups.find((g) => g.kitchenSlug === 'forno')!.subtotalCents).toBe(500);
  });

  it('soma dos subtotais bate com o total do carrinho', () => {
    reset();
    useCart.getState().addLine(item('a', 1990), nagoya, 3);
    useCart.getState().addLine(item('b', 550), forno, 2);
    const lines = useCart.getState().lines;
    const soma = groupByKitchen(lines).reduce((acc, g) => acc + g.subtotalCents, 0);
    expect(soma).toBe(selectTotalCents(useCart.getState()));
  });

  it('lista vazia devolve zero grupos', () => {
    expect(groupByKitchen([])).toEqual([]);
  });
});
