import { describe, it, expect } from 'vitest';
import { generateShortId } from './shortId.js';

describe('generateShortId', () => {
  it('sempre devolve 5 digitos, sem zero a esquerda', () => {
    for (let i = 0; i < 2000; i++) {
      const id = generateShortId();
      expect(id).toMatch(/^[1-9][0-9]{4}$/);
    }
  });

  it('fica dentro da faixa documentada (10000..99999)', () => {
    for (let i = 0; i < 2000; i++) {
      const n = Number(generateShortId());
      expect(n).toBeGreaterThanOrEqual(10000);
      expect(n).toBeLessThanOrEqual(99999);
    }
  });

  it('espalha o suficiente pra colisao ser rara em volume de MVP', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i++) seen.add(generateShortId());
    // 5k sorteios em ~90k combinacoes: colisao existe, mas o espalhamento
    // precisa ficar acima de 90% de valores unicos.
    expect(seen.size).toBeGreaterThan(4500);
  });
});
