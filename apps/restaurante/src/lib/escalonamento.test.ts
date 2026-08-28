import { describe, it, expect } from 'vitest';
import { estadoDaProposta, SEGUNDOS_ATE_ESCALAR } from './escalonamento';

/**
 * Quando parar de esperar o celular e ir até a mesa.
 *
 * A função é pura e recebe `agora` de fora justamente pra isto: testar limite
 * de tempo contra o relógio de verdade dá teste que falha sozinho de madrugada.
 */

const T0 = new Date('2026-08-27T19:00:00Z');
const segundosDepois = (n: number) => T0.getTime() + n * 1000;

describe('estadoDaProposta', () => {
  it('espera enquanto a janela do celular faz sentido', () => {
    expect(estadoDaProposta(T0.toISOString(), segundosDepois(0))).toBe('aguardando');
    expect(estadoDaProposta(T0.toISOString(), segundosDepois(30))).toBe('aguardando');
    expect(estadoDaProposta(T0.toISOString(), segundosDepois(74))).toBe('aguardando');
  });

  it('manda alguem a mesa depois do limite', () => {
    expect(estadoDaProposta(T0.toISOString(), segundosDepois(SEGUNDOS_ATE_ESCALAR))).toBe(
      'ir-na-mesa',
    );
    expect(estadoDaProposta(T0.toISOString(), segundosDepois(120))).toBe('ir-na-mesa');
  });

  /**
   * O limite é inclusivo. Não é preciosismo: com `>` em vez de `>=` o aviso
   * ficaria preso um tique inteiro a mais, e o contador na tela já teria
   * passado — a cozinha veria 75s no relógio e nenhum aviso.
   */
  it('escala exatamente no limite, nao um segundo depois', () => {
    expect(estadoDaProposta(T0.toISOString(), segundosDepois(SEGUNDOS_ATE_ESCALAR - 1))).toBe(
      'aguardando',
    );
    expect(estadoDaProposta(T0.toISOString(), segundosDepois(SEGUNDOS_ATE_ESCALAR))).toBe(
      'ir-na-mesa',
    );
  });

  /**
   * Data torta NÃO pode virar escalonamento. Mandar a cozinha largar o fogão e
   * atravessar o salão por causa de um campo malformado é o pior jeito de
   * errar: custa trabalho de gente e ensina a equipe a ignorar o aviso.
   */
  it('data invalida nao manda ninguem a lugar nenhum', () => {
    expect(estadoDaProposta('nao e data', segundosDepois(600))).toBe('aguardando');
    expect(estadoDaProposta('', segundosDepois(600))).toBe('aguardando');
  });

  it('proposta com data no futuro tambem espera', () => {
    // Relógio do servidor adiantado em relação ao do tablet. Sem isto, a
    // subtração daria negativo e o comportamento dependeria do sinal.
    expect(estadoDaProposta(T0.toISOString(), segundosDepois(-30))).toBe('aguardando');
  });

  it('o limite deixa folga pra caminhada', () => {
    // A proposta vale 5 minutos. Escalar aos 75s deixa quase 4 pra resolver —
    // se este número subir demais, a caminhada não cabe mais.
    expect(SEGUNDOS_ATE_ESCALAR).toBeLessThan(150);
  });
});
