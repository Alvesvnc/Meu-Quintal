import { describe, it, expect } from 'vitest';
import { dataDeEmissao, ciclosPendentes, ALCANCE_MS } from './fecharCiclo.js';

/**
 * Quando o ciclo fecha.
 *
 * Estas são as regras que erram em fevereiro, em mês de 31 dias e na virada de
 * ano — e nenhuma delas se testa bem contra banco. Por isso são funções puras e
 * por isso este arquivo existe.
 */

const em = (iso: string) => new Date(iso);

describe('dataDeEmissao', () => {
  /**
   * `closingDay` diz quando a conta é EMITIDA, não que período ela cobre. A
   * cobrança de agosto sai no dia 5 de SETEMBRO — a separação existe pra não
   * cair no "o mês fecha dia 5, então o que vendi dia 3 conta pra qual mês?".
   */
  it('emite no mes SEGUINTE ao periodo cobrado', () => {
    expect(dataDeEmissao('2026-08', 5)).toEqual(em('2026-09-05T00:00:00.000Z'));
    expect(dataDeEmissao('2026-01', 10)).toEqual(em('2026-02-10T00:00:00.000Z'));
  });

  it('atravessa a virada de ano', () => {
    // Dezembro fecha em janeiro do ano seguinte.
    expect(dataDeEmissao('2026-12', 5)).toEqual(em('2027-01-05T00:00:00.000Z'));
  });

  /**
   * Sem o limite, `Date.UTC(ano, mes, 31)` num mês de 30 dias rola sozinho pro
   * dia 1º do mês seguinte. O fechamento sairia um ou dois dias depois do
   * combinado, em silêncio, e só em alguns meses do ano — o tipo de bug que
   * some no teste e aparece em abril.
   */
  it('limita o dia ao tamanho do mes de emissao', () => {
    // Setembro tem 30 dias: dia 31 vira 30, não 1º de outubro.
    expect(dataDeEmissao('2026-08', 31)).toEqual(em('2026-09-30T00:00:00.000Z'));
    // Fevereiro de 2026 tem 28.
    expect(dataDeEmissao('2026-01', 31)).toEqual(em('2026-02-28T00:00:00.000Z'));
    // 2028 é bissexto: fevereiro tem 29.
    expect(dataDeEmissao('2028-01', 31)).toEqual(em('2028-02-29T00:00:00.000Z'));
  });

  it('recusa refMonth torto', () => {
    expect(() => dataDeEmissao('2026-8', 5)).toThrow(RangeError);
    expect(() => dataDeEmissao('agosto', 5)).toThrow(RangeError);
  });
});

describe('ciclosPendentes', () => {
  const espaco = (closingDay: number, nascimento: string) => ({
    closingDay,
    createdAt: em(nascimento),
  });

  it('pega o mes que terminou e ja passou do dia de emissao', () => {
    // Hoje é 10/09; agosto terminou e a emissão era dia 05/09.
    const r = ciclosPendentes(espaco(5, '2026-08-01'), em('2026-09-10T12:00:00Z'));
    expect(r.aFechar).toEqual(['2026-08']);
  });

  it('nao fecha o mes que ainda esta correndo', () => {
    // Setembro não terminou: fechá-lo cobraria menos do que o devido.
    const r = ciclosPendentes(espaco(5, '2026-08-01'), em('2026-09-10T12:00:00Z'));
    expect(r.aFechar).not.toContain('2026-09');
  });

  it('espera chegar o dia combinado', () => {
    // Agosto terminou, mas hoje é dia 3 e a emissão é dia 5.
    const r = ciclosPendentes(espaco(5, '2026-08-01'), em('2026-09-03T12:00:00Z'));
    expect(r.aFechar).toEqual([]);
  });

  it('devolve do mais antigo pro mais novo', () => {
    // Servidor fora do ar por dois meses: julho e agosto esperando.
    const r = ciclosPendentes(espaco(5, '2026-07-01'), em('2026-09-10T12:00:00Z'));
    expect(r.aFechar).toEqual(['2026-07', '2026-08']);
  });

  /**
   * O FREIO.
   *
   * Ligar isto num quintal que existe há um ano e nunca fechou ciclo emitiria
   * doze cobranças retroativas de uma vez, sem ninguém pedir — o dono acordaria
   * com um ano de dívida das cozinhas dele inventado por um cron.
   */
  it('nao emite cobranca retroativa de um ano', () => {
    const r = ciclosPendentes(espaco(5, '2025-09-01'), em('2026-09-10T12:00:00Z'));

    // Só o que está dentro do alcance.
    expect(r.aFechar).toEqual(['2026-07', '2026-08']);
    // E o resto NÃO some: fica listado pra virar linha de log.
    expect(r.velhosDemais.length).toBeGreaterThan(5);
    expect(r.velhosDemais).toContain('2025-10');
  });

  it('o que ficou de fora nunca se confunde com o que foi fechado', () => {
    const r = ciclosPendentes(espaco(5, '2025-09-01'), em('2026-09-10T12:00:00Z'));
    for (const m of r.velhosDemais) expect(r.aFechar).not.toContain(m);
  });

  it('quintal recem-criado nao tem nada a fechar', () => {
    // Nasceu esta semana: não houve mês nenhum antes dele.
    const r = ciclosPendentes(espaco(5, '2026-09-08'), em('2026-09-10T12:00:00Z'));
    expect(r).toEqual({ aFechar: [], velhosDemais: [] });
  });

  it('nao inventa mes anterior ao nascimento do quintal', () => {
    // Nasceu em agosto; julho não existiu pra ele.
    const r = ciclosPendentes(espaco(5, '2026-08-15'), em('2026-09-10T12:00:00Z'));
    expect(r.aFechar).not.toContain('2026-07');
  });

  it('closingDay 1 emite no primeiro dia do mes seguinte', () => {
    const r = ciclosPendentes(espaco(1, '2026-08-01'), em('2026-09-01T00:00:01Z'));
    expect(r.aFechar).toEqual(['2026-08']);
  });

  it('atravessa a virada de ano', () => {
    const r = ciclosPendentes(espaco(5, '2026-12-01'), em('2027-01-06T12:00:00Z'));
    expect(r.aFechar).toEqual(['2026-12']);
  });

  it('o alcance cobre o mes corrente e o anterior, com folga', () => {
    // Não é número mágico: 62 dias são dois meses cheios mais folga pra um
    // servidor que ficou dias fora do ar.
    expect(ALCANCE_MS).toBe(62 * 24 * 60 * 60 * 1000);
  });
});
