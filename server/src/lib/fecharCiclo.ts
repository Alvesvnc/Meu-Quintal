import type { PrismaClient } from '@prisma/client';
import { calcularCobranca, janelaDoCiclo, refMonthDe } from './cobranca.js';

/**
 * Fechamento do ciclo de cobrança — a operação, num lugar só.
 *
 * Fechar congela: calcula o que cada cozinha deve com o acordo VIGENTE naquele
 * momento e grava os valores. Depois disso, renegociar comissão não mexe no que
 * já foi cobrado.
 *
 * ─── POR QUE ISTO NÃO MORA NA ROTA ──────────────────────────────────────────
 *
 * Porque agora tem DOIS chamadores: o botão do dono (POST
 * /api/a/financeiro/fechar) e o cron, que fecha sozinho no dia. Copiar o
 * cálculo pro cron faria as duas versões divergirem no primeiro ajuste — foi
 * exatamente assim que o `aggregateStatus` passou a responder duas coisas
 * diferentes pra mesma pergunta. A regra fica aqui; os dois chamam.
 *
 * O que fica FORA daqui é o que é de cada chamador: a rota traduz o resultado
 * em código HTTP, o cron traduz em log. Nenhum dos dois recalcula nada.
 */

/** Decimal do Prisma chega como objeto; a conta é com number. */
const paraNumero = (d: unknown): number => Number(d);

export interface CicloFechado {
  ok: true;
  cicloId: string;
  refMonth: string;
  cobrancas: number;
  totalDueCents: number;
}

export interface CicloRecusado {
  ok: false;
  /** `em-andamento`: o mês ainda corre. `ja-fechado`: alguém chegou antes. */
  motivo: 'em-andamento' | 'ja-fechado';
  mensagem: string;
}

export type ResultadoFechamento = CicloFechado | CicloRecusado;

/**
 * Fecha um ciclo, se ele puder ser fechado.
 *
 * As duas recusas são estados legítimos, não erros: quem chama decide se isso
 * vira 409 pro dono ou uma linha de log pro cron.
 */
export async function fecharCiclo(
  prisma: PrismaClient,
  space: { id: string; defaultCommissionPct: unknown },
  refMonth: string,
  agora: Date = new Date(),
): Promise<ResultadoFechamento> {
  const { startsAt, endsAt } = janelaDoCiclo(refMonth);

  // Fechar um mês que ainda corre cobraria menos do que o devido — e o ciclo
  // fechado é imutável, então o erro não teria conserto sem apagar registro.
  if (endsAt.getTime() > agora.getTime()) {
    return {
      ok: false,
      motivo: 'em-andamento',
      mensagem: `O ciclo ${refMonth} ainda nao terminou. So da pra fechar depois de ${endsAt.toISOString().slice(0, 10)}.`,
    };
  }

  const jaExiste = await prisma.billingCycle.findUnique({
    where: { spaceId_refMonth: { spaceId: space.id, refMonth } },
    select: { status: true },
  });
  if (jaExiste?.status === 'fechado') {
    return { ok: false, motivo: 'ja-fechado', mensagem: `O ciclo ${refMonth} ja foi fechado.` };
  }

  const cozinhas = await prisma.kitchen.findMany({
    where: { spaceId: space.id },
    include: {
      orderItems: {
        where: { createdAt: { gte: startsAt, lte: endsAt }, status: { not: 'cancelado' } },
        select: { qty: true, unitPriceCents: true },
      },
    },
  });

  const padrao = paraNumero(space.defaultCommissionPct);

  const cobrancas = cozinhas.map((k) => {
    const grossCents = k.orderItems.reduce((a, i) => a + i.qty * i.unitPriceCents, 0);
    const calc = calcularCobranca(
      grossCents,
      {
        chargeCommission: k.chargeCommission,
        commissionPct: k.commissionPct === null ? null : paraNumero(k.commissionPct),
        chargeRent: k.chargeRent,
        rentCents: k.rentCents,
      },
      padrao,
    );
    // `chargeCommission` vai junto: é o que decide, dali em diante, se o dono
    // pode ver este `grossCents`. Ver KitchenCharge no schema.
    return { kitchenId: k.id, grossCents, chargeCommission: k.chargeCommission, ...calc };
  });

  // Transação: ciclo fechado sem as cobranças dentro seria um mês que aparece
  // como cobrado e não cobra ninguém.
  const ciclo = await prisma.$transaction(async (tx) => {
    const c = await tx.billingCycle.upsert({
      where: { spaceId_refMonth: { spaceId: space.id, refMonth } },
      create: {
        spaceId: space.id,
        refMonth,
        startsAt,
        endsAt,
        status: 'fechado',
        closedAt: agora,
      },
      update: { status: 'fechado', closedAt: agora },
    });

    await tx.kitchenCharge.deleteMany({ where: { cycleId: c.id } });
    await tx.kitchenCharge.createMany({
      data: cobrancas.map((cb) => ({
        cycleId: c.id,
        kitchenId: cb.kitchenId,
        grossCents: cb.grossCents,
        chargeCommission: cb.chargeCommission,
        commissionPct: cb.commissionPct,
        commissionCents: cb.commissionCents,
        rentCents: cb.rentCents,
        totalDueCents: cb.totalDueCents,
        status: 'fechada' as const,
      })),
    });

    return c;
  });

  return {
    ok: true,
    cicloId: ciclo.id,
    refMonth,
    cobrancas: cobrancas.length,
    totalDueCents: cobrancas.reduce((a, c) => a + c.totalDueCents, 0),
  };
}

// ─── Quando fechar, e o quê ─────────────────────────────────────────────────

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Em que dia a cobrança do mês `refMonth` é EMITIDA.
 *
 * `closingDay` diz quando a conta é emitida, não que período ela cobre — a
 * separação existe pra não cair no clássico "o mês fecha dia 5, então o que
 * vendi dia 3 conta pra qual mês?". A cobrança de agosto sai no `closingDay` de
 * SETEMBRO.
 *
 * O dia é limitado ao tamanho do mês: `closingDay = 31` num mês de 30 dias
 * emite no dia 30. Sem isso o JavaScript rolaria pro mês seguinte sozinho, e o
 * fechamento sairia um ou dois dias depois do combinado — silenciosamente, e só
 * em alguns meses do ano.
 */
export function dataDeEmissao(refMonth: string, closingDay: number): Date {
  const m = /^(\d{4})-(\d{2})$/.exec(refMonth);
  if (!m) throw new RangeError(`refMonth deve ser "YYYY-MM", recebido: ${refMonth}`);

  const ano = Number(m[1]);
  const mes = Number(m[2]); // 1..12; a emissão é no mês seguinte

  // Dia 0 do mês depois do seguinte = último dia do mês seguinte.
  const diasNoMesSeguinte = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  const dia = Math.min(Math.max(closingDay, 1), diasNoMesSeguinte);

  return new Date(Date.UTC(ano, mes, dia, 0, 0, 0, 0));
}

/**
 * Quanto tempo pra trás o fechamento automático alcança.
 *
 * ─── ISTO É UM FREIO, E ELE IMPORTA ─────────────────────────────────────────
 *
 * Sem limite, ligar esta varredura num quintal que existe há um ano e nunca
 * fechou ciclo nenhum emitiria DOZE cobranças de uma vez, retroativas, sem
 * ninguém pedir. O dono acordaria com um ano de dívida das cozinhas dele
 * inventado por um cron.
 *
 * Sessenta e dois dias cobrem o que esta tarefa existe pra cobrir: o mês
 * corrente e o anterior, mais folga pra um servidor que ficou dias fora do ar.
 * Ciclo mais velho que isso é decisão do dono, pelo botão — e a varredura
 * registra no log que deixou passar, em vez de fingir que não viu.
 */
export const ALCANCE_MS = 62 * DIA_MS;

export interface CiclosPendentes {
  /** Dentro do alcance: o cron fecha sozinho. */
  aFechar: string[];
  /** Passaram do alcance — ficam pro botão do dono. Ver ALCANCE_MS. */
  velhosDemais: string[];
}

/**
 * Os meses que este quintal já deveria ter fechado e não fechou.
 *
 * Pura de propósito: "quando fecha" é a regra que mais fácil se erra — em
 * fevereiro, em mês de 31 dias, na virada de ano — e nada disso se testa bem
 * contra banco.
 *
 * Devolve do mais antigo pro mais novo. Fechar fora de ordem deixaria o
 * histórico do dono contando a história ao contrário.
 */
export function ciclosPendentes(
  espaco: { closingDay: number; createdAt: Date },
  agora: Date = new Date(),
): CiclosPendentes {
  const aFechar: string[] = [];
  const velhosDemais: string[] = [];
  const limite = agora.getTime() - ALCANCE_MS;

  // Começa no mês em que o quintal nasceu: antes disso não houve venda nenhuma.
  const cursor = new Date(
    Date.UTC(espaco.createdAt.getUTCFullYear(), espaco.createdAt.getUTCMonth(), 1),
  );

  while (cursor.getTime() <= agora.getTime()) {
    const refMonth = refMonthDe(cursor);
    const { endsAt } = janelaDoCiclo(refMonth);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);

    // Mês que ainda corre não fecha: cobraria menos do que o devido.
    if (endsAt.getTime() > agora.getTime()) continue;

    const emissao = dataDeEmissao(refMonth, espaco.closingDay).getTime();

    // Ainda não chegou o dia combinado.
    if (emissao > agora.getTime()) continue;

    if (emissao < limite) velhosDemais.push(refMonth);
    else aFechar.push(refMonth);
  }

  return { aFechar, velhosDemais };
}

export interface ResultadoDaVarreduraDeCiclos {
  fechados: number;
  /** Já estavam fechados — o caso normal de toda rodada depois da primeira. */
  jaFechados: number;
  /**
   * Ciclos antigos que a varredura NÃO fechou, por quintal.
   *
   * Existe pra aparecer no log. Um limite que corta em silêncio é indistinguível
   * de um sistema que cobriu tudo — e aqui a diferença é dinheiro que o dono
   * acha que foi cobrado e não foi.
   */
  velhosDemais: Array<{ espaco: string; refMonths: string[] }>;
}

/**
 * Varre todos os quintais e fecha o que já passou do dia de emissão.
 *
 * SEGURANÇA COM VÁRIAS RÉPLICAS: o `findUnique` + `status: 'fechado'` dentro de
 * `fecharCiclo` faz a segunda tentativa devolver `ja-fechado` em vez de cobrar
 * duas vezes. Mesma disciplina do `lib/expiracao.ts` e do `lib/trial.ts`.
 */
export async function varrerCiclosParaFechar(
  prisma: PrismaClient,
  agora: Date = new Date(),
): Promise<ResultadoDaVarreduraDeCiclos> {
  const espacos = await prisma.space.findMany({
    where: {
      // Conta cancelada não tem operação pra cobrar. Suspensa SIM: ela deixou
      // de nos pagar, mas as cozinhas dela continuam devendo a ela, e esse
      // registro é dela, não nosso.
      account: { status: { not: 'cancelada' } },
    },
    select: { id: true, slug: true, closingDay: true, createdAt: true, defaultCommissionPct: true },
  });

  let fechados = 0;
  let jaFechados = 0;
  const velhosDemais: Array<{ espaco: string; refMonths: string[] }> = [];

  for (const espaco of espacos) {
    const pendentes = ciclosPendentes(espaco, agora);

    if (pendentes.velhosDemais.length > 0) {
      velhosDemais.push({ espaco: espaco.slug, refMonths: pendentes.velhosDemais });
    }

    for (const refMonth of pendentes.aFechar) {
      const r = await fecharCiclo(prisma, espaco, refMonth, agora);
      if (r.ok) fechados++;
      else if (r.motivo === 'ja-fechado') jaFechados++;
      // `em-andamento` não acontece: `ciclosPendentes` já filtrou. Se o mês
      // virar entre a lista e a execução, a recusa é a resposta certa mesmo.
    }
  }

  return { fechados, jaFechados, velhosDemais };
}
