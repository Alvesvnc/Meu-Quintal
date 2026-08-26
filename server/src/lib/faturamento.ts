/**
 * Quem pode ver quanto cada cozinha vendeu.
 *
 * A REGRA: o dono vê o faturamento de uma cozinha **apenas quando ele é a base
 * do que ele cobra** — ou seja, quando o acordo tem comissão.
 *
 * Comissão é uma porcentagem do bruto: sem ver o bruto, a cozinha não teria
 * como conferir a conta, e o dono não teria como emiti-la. Aceitar um convite
 * com comissão já é o consentimento — não existe checkbox separado, e não deve
 * existir.
 *
 * Aluguel é valor fixo e não depende de venda nenhuma. Uma cozinha que paga
 * R$ 3.000 por mês deve exatamente R$ 3.000, tenha ela vendido dez pratos ou
 * mil. Quanto ela vendeu é assunto dela.
 *
 * ─── A EXCECAO: A PROPRIA COZINHA ───────────────────────────────────────────
 *
 * Quem opera a cozinha sempre ve o faturamento dela. Vale no restaurante unico,
 * onde o dono E a cozinha e a comissao nasce desligada de proposito — esconder
 * dele o proprio caixa seria absurdo. E vale tambem no food-court em que o dono
 * do espaco tambem toca uma das casinhas.
 *
 * Por isso a decisao e por cozinha e nao por tipo de espaco: `AccountUser
 * .kitchenId` responde "esta cozinha e minha?" nos dois casos, sem caso
 * especial.
 *
 * ─── ONDE A REGRA VALE, E ONDE NAO ─────────────────────────────────────────
 *
 * A linha nao e "dinheiro se esconde". E: **nunca se identifica quanto e de
 * cada restaurante**. Agregado do espaco inteiro e outra coisa — o salao e do
 * dono, e ele precisa dele pra decidir layout, numero de mesas, horario.
 *
 *   QUEBRA POR COZINHA -> a regra vale
 *     /api/a/cozinhas    (movimento do dia: so a propria cozinha)
 *     /api/a/financeiro  (bruto do ciclo: so com comissao; total soma so o
 *                         visivel, senao a subtracao entrega a oculta NA
 *                         MESMA TELA)
 *
 *   AGREGADO DO ESPACO -> conta tudo, inclusive cozinha so-aluguel
 *     /api/a/overview           (faturamento do dia do quintal)
 *     /api/a/mesas              (consumo por mesa)
 *     /api/a/mesas/desempenho   (quanto cada mesa rende)
 *
 *   O que segura o agregado: essas tres respostas NAO tem campo nenhum por
 *   cozinha. Nao ha o que quebrar. Se algum dia alguem acrescentar um
 *   `porCozinha` em qualquer uma delas, a regra volta a valer ali — e ha teste
 *   guardando exatamente isso.
 *
 * ─── DUAS ARMADILHAS ONDE A REGRA VALE ──────────────────────────────────────
 *
 * 1. OCULTO E `null`, NUNCA `0`. Zero e uma mentira que se le como "essa
 *    cozinha nao vendeu nada" — o dono concluiria que ela esta morrendo e agiria
 *    em cima disso. `null` diz a verdade: "voce nao ve este numero".
 *
 * 2. TOTAL DE TELA QUE QUEBRA POR COZINHA EXCLUI O OCULTO. Esconder linha por
 *    linha e somar todo mundo no rodape e teatro: com cinco cozinhas, quatro
 *    com comissao, o dono subtrai e acha a quinta na hora. Por isso
 *    `somarVisiveis` existe — e por isso ele NAO e usado nos agregados de
 *    espaco, que somam tudo de proposito.
 *
 * ─── O QUE ISSO CUSTA, ASSUMIDO CONSCIENTEMENTE ────────────────────────────
 *
 * Somando as mesas chega-se ao bruto do espaco; subtraindo o financeiro
 * visivel chega-se a SOMA das cozinhas ocultas. Com duas ou mais ocultas isso
 * nao identifica nenhuma. Com exatamente UMA, identifica ela.
 *
 * Decisao de produto tomada em 2026-08-25: o dono precisa do desempenho do
 * salao mais do que esse caso vale. Nao "reforcar" isso mutilando a tela de
 * mesas sem falar com quem decidiu.
 */

/** O que se precisa saber de uma cozinha para decidir a visibilidade. */
export interface CozinhaVisibilidade {
  /** Ausente nas somas por item, onde só o acordo importa. */
  id?: string;
  chargeCommission: boolean;
}

/**
 * Quem está olhando. `kitchenId` é a cozinha que essa pessoa opera, se operar
 * alguma — vem de `AccountUser.kitchenId`, sempre relido do banco.
 */
export interface Espectador {
  kitchenId: string | null;
}

/**
 * O dono pode ver o bruto desta cozinha?
 *
 * Uma função desse tamanho tem razão de existir: a regra precisa morar em UM
 * lugar. Quando `aggregateStatus` foi reescrito solto em duas rotas, cliente e
 * cozinha passaram a mostrar status diferentes do mesmo pedido. Aqui o preço de
 * divergir seria mostrar dinheiro que o dono não tem direito de ver.
 */
export function podeVerFaturamento(
  cozinha: CozinhaVisibilidade,
  espectador: Espectador = { kitchenId: null },
): boolean {
  if (cozinha.chargeCommission) return true;
  // A própria cozinha. `id` indefinido nunca casa com um `kitchenId` real, e
  // `kitchenId` nulo nunca casa com nada — as duas pontas falham fechado.
  return cozinha.id !== undefined && cozinha.id === espectador.kitchenId;
}

/** Bruto da cozinha como ele deve sair na API: o número, ou `null`. */
export function brutoVisivel(
  grossCents: number,
  cozinha: CozinhaVisibilidade,
  espectador: Espectador = { kitchenId: null },
): number | null {
  return podeVerFaturamento(cozinha, espectador) ? grossCents : null;
}

export interface TotalVisivel {
  /** Soma apenas do que o dono pode ver. */
  grossCents: number;
  /** Quantas cozinhas ficaram de fora da soma. */
  ocultas: number;
  /** `true` se ao menos uma cozinha ficou de fora — o número não é o do espaço. */
  parcial: boolean;
}

/**
 * Soma brutos deixando de fora o que está oculto.
 *
 * Recebe a lista já mascarada (`number | null`), e não os valores crus com um
 * flag ao lado, justamente para que não exista caminho em que o número
 * verdadeiro chegue perto do rodapé.
 */
export function somarVisiveis(brutos: Array<number | null>): TotalVisivel {
  let grossCents = 0;
  let ocultas = 0;

  for (const b of brutos) {
    if (b === null) ocultas += 1;
    else grossCents += b;
  }

  return { grossCents, ocultas, parcial: ocultas > 0 };
}
