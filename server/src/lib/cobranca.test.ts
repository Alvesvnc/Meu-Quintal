import { describe, it, expect } from 'vitest';
import {
  calcularCobranca,
  janelaDoCiclo,
  refMonthDe,
  type AcordoCozinha,
} from './cobranca.js';

const acordo = (over: Partial<AcordoCozinha> = {}): AcordoCozinha => ({
  chargeCommission: true,
  commissionPct: null,
  chargeRent: false,
  rentCents: 0,
  ...over,
});

describe('calcularCobranca — comissao', () => {
  it('aplica o padrao do quintal quando a cozinha nao tem percentual proprio', () => {
    const r = calcularCobranca(100_000, acordo(), 15);
    expect(r.commissionPct).toBe(15);
    expect(r.commissionCents).toBe(15_000);
    expect(r.totalDueCents).toBe(15_000);
  });

  it('percentual da cozinha tem prioridade sobre o padrao do quintal', () => {
    const r = calcularCobranca(100_000, acordo({ commissionPct: 8 }), 15);
    expect(r.commissionPct).toBe(8);
    expect(r.commissionCents).toBe(8_000);
  });

  it('0% e um acordo valido, nao "sem acordo"', () => {
    const r = calcularCobranca(100_000, acordo({ commissionPct: 0 }), 15);
    expect(r.commissionPct).toBe(0);
    expect(r.commissionCents).toBe(0);
  });

  it('chargeCommission=false zera a comissao mesmo com percentual cadastrado', () => {
    const r = calcularCobranca(100_000, acordo({ chargeCommission: false, commissionPct: 20 }), 15);
    expect(r.commissionPct).toBe(0);
    expect(r.commissionCents).toBe(0);
  });

  it('arredonda pro centavo mais proximo, sem viesar pra nenhum dos lados', () => {
    // 12,5 centavos -> 13 (pra cima)
    expect(calcularCobranca(250, acordo({ commissionPct: 5 }), 15).commissionCents).toBe(13);
    // 12,4 centavos -> 12 (pra baixo)
    expect(calcularCobranca(248, acordo({ commissionPct: 5 }), 15).commissionCents).toBe(12);
  });

  it('bruto zero gera cobranca zero, nao erro', () => {
    const r = calcularCobranca(0, acordo(), 15);
    expect(r.commissionCents).toBe(0);
    expect(r.totalDueCents).toBe(0);
  });
});

describe('calcularCobranca — aluguel', () => {
  it('soma aluguel quando ligado', () => {
    const r = calcularCobranca(100_000, acordo({ chargeRent: true, rentCents: 80_000 }), 15);
    expect(r.rentCents).toBe(80_000);
    expect(r.totalDueCents).toBe(15_000 + 80_000);
  });

  it('chargeRent=false ignora rentCents residual no cadastro', () => {
    const r = calcularCobranca(100_000, acordo({ chargeRent: false, rentCents: 80_000 }), 15);
    expect(r.rentCents).toBe(0);
    expect(r.totalDueCents).toBe(15_000);
  });

  it('so aluguel, sem comissao — caso da cozinha ancora', () => {
    const r = calcularCobranca(
      500_000,
      acordo({ chargeCommission: false, chargeRent: true, rentCents: 120_000 }),
      15,
    );
    expect(r.commissionCents).toBe(0);
    expect(r.totalDueCents).toBe(120_000);
  });

  it('sem comissao e sem aluguel: a cozinha nao deve nada', () => {
    const r = calcularCobranca(999_999, acordo({ chargeCommission: false }), 15);
    expect(r.totalDueCents).toBe(0);
  });

  it('mesmo vendendo zero, o aluguel continua devido', () => {
    const r = calcularCobranca(0, acordo({ chargeRent: true, rentCents: 80_000 }), 15);
    expect(r.totalDueCents).toBe(80_000);
  });
});

describe('calcularCobranca — entradas invalidas', () => {
  it('recusa bruto negativo', () => {
    expect(() => calcularCobranca(-1, acordo(), 15)).toThrow(RangeError);
  });

  it('recusa percentual fora de 0..100', () => {
    expect(() => calcularCobranca(1000, acordo({ commissionPct: 101 }), 15)).toThrow(RangeError);
    expect(() => calcularCobranca(1000, acordo({ commissionPct: -1 }), 15)).toThrow(RangeError);
  });

  it('recusa aluguel negativo', () => {
    expect(() =>
      calcularCobranca(1000, acordo({ chargeRent: true, rentCents: -1 }), 15),
    ).toThrow(RangeError);
  });

  it('total sempre bate com a soma das partes', () => {
    for (const gross of [0, 1, 999, 123_456, 9_999_999]) {
      for (const pct of [0, 7.5, 15, 100]) {
        for (const rent of [0, 80_000]) {
          const r = calcularCobranca(
            gross,
            acordo({ commissionPct: pct, chargeRent: rent > 0, rentCents: rent }),
            15,
          );
          expect(r.totalDueCents).toBe(r.commissionCents + r.rentCents);
        }
      }
    }
  });
});

describe('janelaDoCiclo', () => {
  it('cobre o mes inteiro', () => {
    const { startsAt, endsAt } = janelaDoCiclo('2026-06');
    expect(startsAt.toISOString()).toBe('2026-06-01T00:00:00.000Z');
    expect(endsAt.toISOString()).toBe('2026-06-30T23:59:59.999Z');
  });

  it('acerta fevereiro em ano comum e em bissexto', () => {
    expect(janelaDoCiclo('2026-02').endsAt.toISOString()).toBe('2026-02-28T23:59:59.999Z');
    expect(janelaDoCiclo('2028-02').endsAt.toISOString()).toBe('2028-02-29T23:59:59.999Z');
  });

  it('acerta dezembro sem vazar pro ano seguinte', () => {
    const { startsAt, endsAt } = janelaDoCiclo('2026-12');
    expect(startsAt.toISOString()).toBe('2026-12-01T00:00:00.000Z');
    expect(endsAt.toISOString()).toBe('2026-12-31T23:59:59.999Z');
  });

  it('recusa formato invalido', () => {
    for (const ruim of ['2026', '2026-6', '06-2026', 'junho', '2026-13', '2026-00', '']) {
      expect(() => janelaDoCiclo(ruim), `deveria recusar "${ruim}"`).toThrow(RangeError);
    }
  });

  it('janelas de meses consecutivos nao tem buraco nem sobreposicao', () => {
    const junho = janelaDoCiclo('2026-06');
    const julho = janelaDoCiclo('2026-07');
    expect(julho.startsAt.getTime() - junho.endsAt.getTime()).toBe(1);
  });
});

describe('refMonthDe', () => {
  it('formata com zero a esquerda', () => {
    expect(refMonthDe(new Date('2026-06-15T12:00:00Z'))).toBe('2026-06');
    expect(refMonthDe(new Date('2026-01-01T00:00:00Z'))).toBe('2026-01');
    expect(refMonthDe(new Date('2026-12-31T23:59:59Z'))).toBe('2026-12');
  });

  it('e o inverso de janelaDoCiclo nas duas pontas', () => {
    for (const ref of ['2026-01', '2026-02', '2026-06', '2026-12', '2028-02']) {
      const { startsAt, endsAt } = janelaDoCiclo(ref);
      expect(refMonthDe(startsAt)).toBe(ref);
      expect(refMonthDe(endsAt)).toBe(ref);
    }
  });
});
