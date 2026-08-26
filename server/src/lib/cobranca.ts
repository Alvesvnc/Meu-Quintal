/**
 * Calculo do que uma cozinha DEVE ao dono do quintal num ciclo.
 *
 * O dinheiro nao passa pelo app: a cozinha ja recebeu do cliente no proprio
 * caixa. O que se apura aqui e a divida dela com o espaco — comissao sobre o
 * bruto vendido, mais aluguel fixo da casinha. Nao e repasse.
 *
 * Comissao e aluguel sao independentes: da pra cobrar so um, os dois, ou
 * nenhum (cozinha ancora que entra sem comissao, por exemplo).
 */

/** Acordo vigente entre o quintal e uma cozinha. */
export interface AcordoCozinha {
  chargeCommission: boolean;
  /** null = herda o padrao do quintal */
  commissionPct: number | null;
  chargeRent: boolean;
  rentCents: number;
}

export interface CobrancaCalculada {
  /** Percentual efetivamente aplicado — vai gravado como snapshot */
  commissionPct: number;
  commissionCents: number;
  rentCents: number;
  totalDueCents: number;
}

/**
 * Arredondamento da comissao.
 *
 * `Math.round` de propósito, não `floor`/`ceil`: floor favorece sempre a
 * cozinha e ceil sempre o dono. Em centavos a diferença é de no maximo 1
 * centavo por cobranca, mas ao longo de meses e dezenas de cozinhas um vies
 * sistematico vira discussao com cliente.
 */
function comissaoEmCentavos(grossCents: number, pct: number): number {
  return Math.round(grossCents * (pct / 100));
}

export function calcularCobranca(
  grossCents: number,
  acordo: AcordoCozinha,
  defaultCommissionPct: number,
): CobrancaCalculada {
  if (!Number.isFinite(grossCents) || grossCents < 0) {
    throw new RangeError(`grossCents invalido: ${grossCents}`);
  }

  const pctVigente = acordo.commissionPct ?? defaultCommissionPct;

  if (pctVigente < 0 || pctVigente > 100) {
    throw new RangeError(`Percentual de comissao fora de 0..100: ${pctVigente}`);
  }

  const commissionPct = acordo.chargeCommission ? pctVigente : 0;
  const commissionCents = acordo.chargeCommission
    ? comissaoEmCentavos(grossCents, pctVigente)
    : 0;

  // Aluguel desligado nao vira zero por acaso: e uma decisao do acordo. Um
  // rentCents residual no cadastro nao pode virar cobranca se chargeRent=false.
  const rentCents = acordo.chargeRent ? acordo.rentCents : 0;

  if (rentCents < 0) {
    throw new RangeError(`rentCents negativo: ${rentCents}`);
  }

  return {
    commissionPct,
    commissionCents,
    rentCents,
    totalDueCents: commissionCents + rentCents,
  };
}

/**
 * Janela do ciclo de um mes de referencia.
 *
 * `refMonth` no formato "2026-06". O ciclo cobre o mes inteiro em UTC; o
 * `closingDay` do quintal diz quando a cobranca e EMITIDA, nao o periodo que
 * ela cobre — separar os dois evita o classico "o mes fecha dia 5, entao o que
 * vendi dia 3 conta pra qual mes?".
 */
export function janelaDoCiclo(refMonth: string): { startsAt: Date; endsAt: Date } {
  const m = /^(\d{4})-(\d{2})$/.exec(refMonth);
  if (!m) {
    throw new RangeError(`refMonth deve ser "YYYY-MM", recebido: ${refMonth}`);
  }

  const ano = Number(m[1]);
  const mes = Number(m[2]);
  if (mes < 1 || mes > 12) {
    throw new RangeError(`Mes fora de 1..12 em refMonth: ${refMonth}`);
  }

  return {
    startsAt: new Date(Date.UTC(ano, mes - 1, 1, 0, 0, 0, 0)),
    // Dia 0 do mes seguinte = ultimo dia deste mes. Resolve fevereiro e
    // bissexto sem tabela de dias.
    endsAt: new Date(Date.UTC(ano, mes, 0, 23, 59, 59, 999)),
  };
}

/** "2026-06" a partir de uma data. */
export function refMonthDe(data: Date): string {
  const ano = data.getUTCFullYear();
  const mes = String(data.getUTCMonth() + 1).padStart(2, '0');
  return `${ano}-${mes}`;
}
