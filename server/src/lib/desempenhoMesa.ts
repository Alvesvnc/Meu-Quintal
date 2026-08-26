/**
 * Quais mesas rendem mais.
 *
 * A pergunta do dono é "qual mesa dá mais retorno", e o ranking cru por valor
 * NÃO responde isso — responde "onde ficam as mesas grandes". Uma mesa de seis
 * lugares gasta mais por natureza. O que informa decisão é:
 *
 *   - o valor COMPARADO À MÉDIA das outras mesas do mesmo salão;
 *   - o GIRO, quantas vezes ela foi usada;
 *   - em quantos DIAS distintos ela teve movimento, que separa a mesa boa da
 *     mesa que pegou uma noite cheia.
 *
 * ─── QUEM ENTRA NA MÉDIA ────────────────────────────────────────────────────
 *
 * Só mesa ATIVA que existia no começo do período. Duas exclusões, duas razões:
 *
 *   Mesa desativada no meio do mês somaria dias parados a uma média que deve
 *   descrever o salão em operação.
 *
 *   Mesa CRIADA no dia 28 teve três dias para faturar. Ela puxa a média para
 *   baixo e faz todas as outras parecerem melhores do que são — o oposto do que
 *   a tela promete. Ela continua no ranking, marcada como nova, para o dono ver
 *   que a comparação dela ainda não vale.
 *
 * Mesa ativa que vendeu ZERO entra na média normalmente: esse é o sinal, não o
 * ruído. Uma mesa parada é exatamente o que o dono quer descobrir.
 */

export interface MesaParaRanquear {
  id: string;
  numero: number;
  isActive: boolean;
  /** Quando a mesa foi cadastrada — decide se ela teve o período inteiro. */
  criadaEm: Date;
  /** Um item por pedido feito na mesa dentro do período. */
  pedidos: Array<{ em: Date; grossCents: number }>;
}

export interface MesaDesempenho {
  id: string;
  numero: number;
  isActive: boolean;
  /** Cadastrada depois do início do período — comparação ainda não vale. */
  novaNoPeriodo: boolean;
  pedidos: number;
  grossCents: number;
  ticketMedioCents: number;
  /** Em quantos dias distintos a mesa teve ao menos um pedido. */
  diasComMovimento: number;
  /**
   * Quanto ela rende acima/abaixo da média, em %. `null` quando não há média
   * com que comparar (salão sem faturamento no período).
   */
  vsMediaPct: number | null;
}

export interface MediaDoSalao {
  /** Faturamento médio por mesa no período. */
  grossCents: number;
  /** Pedidos médios por mesa. */
  pedidos: number;
  /** Quanto cada grupo gasta, em média, em qualquer mesa. */
  ticketMedioCents: number;
  /** Quantas mesas entraram na média. */
  mesasNaBase: number;
}

export interface Ranking {
  mesas: MesaDesempenho[];
  media: MediaDoSalao;
}

/** Dia da data, para contar dias distintos. UTC, igual à janela do ciclo. */
function diaDe(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function ranquearMesas(entradas: MesaParaRanquear[], inicioDoPeriodo: Date): Ranking {
  const computadas: MesaDesempenho[] = entradas.map((m) => {
    const grossCents = m.pedidos.reduce((a, p) => a + p.grossCents, 0);
    const dias = new Set(m.pedidos.map((p) => diaDe(p.em)));

    return {
      id: m.id,
      numero: m.numero,
      isActive: m.isActive,
      novaNoPeriodo: m.criadaEm > inicioDoPeriodo,
      pedidos: m.pedidos.length,
      grossCents,
      ticketMedioCents: m.pedidos.length > 0 ? Math.round(grossCents / m.pedidos.length) : 0,
      diasComMovimento: dias.size,
      // Preenchido abaixo: depende da média, que depende de todas as mesas.
      vsMediaPct: null,
    };
  });

  const base = computadas.filter((m) => m.isActive && !m.novaNoPeriodo);

  const media: MediaDoSalao =
    base.length > 0
      ? {
          grossCents: Math.round(base.reduce((a, m) => a + m.grossCents, 0) / base.length),
          pedidos: Math.round(base.reduce((a, m) => a + m.pedidos, 0) / base.length),
          ticketMedioCents: (() => {
            // Ticket médio do SALÃO: faturamento total sobre pedidos totais.
            // Média das médias por mesa daria peso igual a uma mesa com 1
            // pedido e a outra com 40, e o número deixaria de descrever o
            // salão.
            const g = base.reduce((a, m) => a + m.grossCents, 0);
            const p = base.reduce((a, m) => a + m.pedidos, 0);
            return p > 0 ? Math.round(g / p) : 0;
          })(),
          mesasNaBase: base.length,
        }
      : { grossCents: 0, pedidos: 0, ticketMedioCents: 0, mesasNaBase: 0 };

  for (const m of computadas) {
    // Sem média não há comparação. Devolver 0% diria "está na média", que é
    // uma afirmação — e não há dado para afirmá-la.
    m.vsMediaPct =
      media.grossCents > 0
        ? Math.round(((m.grossCents - media.grossCents) / media.grossCents) * 100)
        : null;
  }

  // Maior faturamento primeiro; empate desempata pelo número da mesa para a
  // ordem não dançar entre dois carregamentos iguais.
  computadas.sort((a, b) => b.grossCents - a.grossCents || a.numero - b.numero);

  return { mesas: computadas, media };
}
