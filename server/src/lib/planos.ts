import type { AccountPlan } from '@prisma/client';
import type { TipoDeEspaco } from '@mq/shared';

/**
 * O plano é o que diferencia restaurante único de praça de alimentação.
 *
 * Não é rótulo comercial em cima de um sistema que faz tudo: é o plano que
 * decide o formato do espaço e quantas cozinhas cabem nele. Por isso as travas
 * moram aqui, num lugar só, e não espalhadas em `if` por rota.
 *
 * ─── O QUE ISSO SUBSTITUIU ──────────────────────────────────────────────────
 *
 * Houve, por algumas horas em 2026-08-25, um botão no app do dono que convertia
 * praça <-> restaurante único de graça. Foi retirado: converter é mudar de
 * plano, e mudar de plano é decisão comercial — não um interruptor em
 * "configurações". O botão deixaria qualquer assinante do plano mais barato
 * virar praça e sair convidando cozinhas.
 *
 * ─── E O TRIAL? ─────────────────────────────────────────────────────────────
 *
 * Não é plano. Quem testa já escolheu um formato; até quando testa vive em
 * `Account.trialEndsAt`. Quando `trial` era um valor do enum, um trial expirado
 * virava plano nenhum — e nada no sistema sabia o que fazer com isso.
 */

export interface Plano {
  /** Como aparece pra quem assina. */
  nome: string;
  /** O formato que este plano vende. Todo espaço da conta nasce assim. */
  tipoDeEspaco: TipoDeEspaco;
  /** Teto de cozinhas por espaço. `null` = sem teto. */
  maxCozinhas: number | null;
}

export const PLANOS: Record<AccountPlan, Plano> = {
  restaurante: {
    nome: 'Restaurante',
    tipoDeEspaco: 'restaurante-unico',
    // Uma. É a definição do plano, não um limite arbitrário: com duas, o
    // cliente precisaria escolher entre elas, e isso é uma praça.
    maxCozinhas: 1,
  },
  praca: {
    nome: 'Praça de alimentação',
    tipoDeEspaco: 'food-court',
    // Sem teto: quem vende praça vende o espaço, e o número de casinhas é
    // problema de metro quadrado, não de software.
    maxCozinhas: null,
  },
};

/** O formato que este plano impõe aos espaços da conta. */
export function tipoDoPlano(plano: AccountPlan): TipoDeEspaco {
  return PLANOS[plano].tipoDeEspaco;
}

/** Como o Prisma guarda o tipo (o enum não aceita hífen no identificador). */
export function tipoNoPrisma(tipo: TipoDeEspaco): 'food_court' | 'restaurante_unico' {
  return tipo === 'restaurante-unico' ? 'restaurante_unico' : 'food_court';
}

export interface Recusa {
  /** Mensagem pra quem assinou — diz o limite E a saída. */
  motivo: string;
}

/**
 * Este plano aceita mais uma cozinha neste espaço?
 *
 * Devolve `null` quando aceita, ou o motivo da recusa. O texto é escrito para o
 * dono ler: dizer só "limite atingido" faria ele abrir chamado para descobrir
 * que existe outro plano.
 */
export function podeAdicionarCozinha(plano: AccountPlan, cozinhasHoje: number): Recusa | null {
  const teto = PLANOS[plano].maxCozinhas;
  if (teto === null || cozinhasHoje < teto) return null;

  return {
    motivo:
      teto === 1
        ? 'O plano Restaurante é de uma cozinha só. Para ter mais de uma no mesmo espaço, é o plano Praça de alimentação.'
        : `O plano ${PLANOS[plano].nome} permite ${teto} cozinhas.`,
  };
}
