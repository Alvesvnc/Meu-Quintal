import { describe, it, expect } from 'vitest';
import { podeVerFaturamento, brutoVisivel, somarVisiveis } from './faturamento.js';

/**
 * A regra pura de quem vê quanto cada cozinha vendeu.
 *
 * Os testes de rota provam que a regra foi APLICADA em cada tela; estes provam
 * que a regra em si está certa. Separado de propósito: a regra é curta e as
 * consequências de errá-la são caras, então ela merece exercício direto.
 */

const ninguem = { kitchenId: null };

describe('podeVerFaturamento', () => {
  it('comissao ligada: o bruto e a base do que o dono cobra', () => {
    expect(podeVerFaturamento({ id: 'k1', chargeCommission: true }, ninguem)).toBe(true);
  });

  it('so aluguel: quanto a cozinha vendeu nao muda o que ela deve', () => {
    // R$ 3.000 de aluguel sao R$ 3.000 tendo ela vendido dez pratos ou mil.
    expect(podeVerFaturamento({ id: 'k1', chargeCommission: false }, ninguem)).toBe(false);
  });

  it('a propria cozinha e sempre visivel', () => {
    // Restaurante unico: a comissao nasce desligada de proposito. Esconder do
    // dono o proprio caixa seria absurdo.
    expect(podeVerFaturamento({ id: 'k1', chargeCommission: false }, { kitchenId: 'k1' })).toBe(
      true,
    );
  });

  it('a cozinha DO VIZINHO continua oculta pra quem opera uma casinha', () => {
    // Dono de praca que tambem toca uma cozinha nao ganha acesso as outras por
    // causa disso.
    expect(podeVerFaturamento({ id: 'k2', chargeCommission: false }, { kitchenId: 'k1' })).toBe(
      false,
    );
  });

  it('sem id, so o acordo decide — e nao ha como casar por acidente', () => {
    // Nas somas por item o id da cozinha as vezes nao vem. `undefined` nao pode
    // virar "e a minha" por comparacao frouxa.
    expect(podeVerFaturamento({ chargeCommission: false }, { kitchenId: 'k1' })).toBe(false);
    expect(podeVerFaturamento({ chargeCommission: true }, ninguem)).toBe(true);
  });

  it('espectador sem cozinha nao casa com nada', () => {
    expect(podeVerFaturamento({ id: 'k1', chargeCommission: false }, { kitchenId: null })).toBe(
      false,
    );
  });

  it('o padrao do espectador e "nao opero cozinha nenhuma"', () => {
    // Chamar sem o segundo argumento nao pode abrir acesso por descuido.
    expect(podeVerFaturamento({ id: 'k1', chargeCommission: false })).toBe(false);
  });
});

describe('brutoVisivel', () => {
  it('devolve o numero quando pode ver', () => {
    expect(brutoVisivel(12_345, { id: 'k1', chargeCommission: true }, ninguem)).toBe(12_345);
  });

  it('oculto e null, NUNCA zero', () => {
    // Zero se le como "essa cozinha nao vendeu nada" — o dono concluiria que
    // ela esta morrendo e agiria em cima disso. null diz a verdade.
    expect(brutoVisivel(12_345, { id: 'k1', chargeCommission: false }, ninguem)).toBeNull();
  });

  it('zero de verdade continua zero quando pode ver', () => {
    // O outro lado da moeda: quem PODE ver e nao vendeu nada ve 0, nao null.
    expect(brutoVisivel(0, { id: 'k1', chargeCommission: true }, ninguem)).toBe(0);
  });
});

describe('somarVisiveis', () => {
  it('soma so o que nao esta oculto', () => {
    const t = somarVisiveis([1000, null, 2500]);
    expect(t.grossCents).toBe(3500);
  });

  it('conta e marca as ocultas', () => {
    const t = somarVisiveis([1000, null, null]);
    expect(t.ocultas).toBe(2);
    expect(t.parcial).toBe(true);
  });

  it('sem oculta nenhuma, o total e o do espaco inteiro', () => {
    const t = somarVisiveis([1000, 2000]);
    expect(t).toEqual({ grossCents: 3000, ocultas: 0, parcial: false });
  });

  it('lista vazia nao e parcial', () => {
    // Quintal sem cozinha nenhuma: zero honesto, nao "escondi algo de voce".
    expect(somarVisiveis([])).toEqual({ grossCents: 0, ocultas: 0, parcial: false });
  });

  it('a subtracao nao entrega a oculta', () => {
    // O ataque que a regra existe pra impedir: quatro cozinhas visiveis somando
    // 9.000 e um total do espaco de 15.000 revelariam 6.000 da quinta. Como o
    // total NAO inclui a oculta, a subtracao devolve zero — nada a extrair.
    const linhas = [3000, 2000, 2500, 1500, null];
    const t = somarVisiveis(linhas);
    const visiveis = linhas.filter((l): l is number => l !== null).reduce((a, b) => a + b, 0);
    expect(t.grossCents - visiveis).toBe(0);
  });
});
