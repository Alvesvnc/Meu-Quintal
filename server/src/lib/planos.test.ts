import { describe, it, expect } from 'vitest';
import { PLANOS, tipoDoPlano, podeAdicionarCozinha } from './planos.js';

/**
 * O plano é o que diferencia restaurante único de praça de alimentação.
 *
 * Não é rótulo comercial em cima de um sistema que faz tudo: é ele que decide o
 * formato do espaço e quantas cozinhas cabem. Estes testes existem para que a
 * diferença não vire um `if` solto em alguma rota.
 */

describe('o que cada plano vende', () => {
  it('Restaurante e uma cozinha, formato restaurante-unico', () => {
    expect(PLANOS.restaurante.maxCozinhas).toBe(1);
    expect(tipoDoPlano('restaurante')).toBe('restaurante-unico');
  });

  it('Praca e sem teto, formato food-court', () => {
    // Sem teto: quem vende praça vende o espaço, e o número de casinhas é
    // problema de metro quadrado, não de software.
    expect(PLANOS.praca.maxCozinhas).toBeNull();
    expect(tipoDoPlano('praca')).toBe('food-court');
  });

  it('nao existe plano sem formato', () => {
    // Um plano que não diga o formato deixaria o espaço nascer indefinido, e
    // toda tela teria que adivinhar.
    for (const plano of Object.values(PLANOS)) {
      expect(['restaurante-unico', 'food-court']).toContain(plano.tipoDeEspaco);
    }
  });
});

describe('teto de cozinhas', () => {
  it('Restaurante aceita a primeira', () => {
    expect(podeAdicionarCozinha('restaurante', 0)).toBeNull();
  });

  it('Restaurante RECUSA a segunda', () => {
    const r = podeAdicionarCozinha('restaurante', 1);
    expect(r).not.toBeNull();
    // A mensagem diz a SAÍDA, não só o limite: "limite atingido" faria o dono
    // abrir chamado pra descobrir que existe outro plano.
    expect(r!.motivo).toMatch(/Praça de alimentação/);
  });

  it('Praca aceita a decima', () => {
    expect(podeAdicionarCozinha('praca', 9)).toBeNull();
  });

  it('Praca aceita a centesima', () => {
    expect(podeAdicionarCozinha('praca', 99)).toBeNull();
  });
});
