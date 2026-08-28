import type { OrderItemStatus } from '@mq/shared';

/**
 * Regras da alteração proposta pela cozinha.
 *
 * A cozinha não altera o pedido direto: ela PROPÕE (reduzir quantidade ou
 * cancelar item) e o cliente aceita ou recusa. Este arquivo tem só as decisões,
 * sem banco, para poderem ser testadas isoladamente — é onde mora a regra de
 * quanto o cliente vai pagar.
 */

/** Quanto tempo a proposta fica de pé esperando resposta. */
export const PRAZO_DE_RESPOSTA_MS = 5 * 60 * 1000;

/**
 * O QUE ACONTECE SEM RESPOSTA (decidido em 2026-08-25).
 *
 * Expirar vale o mesmo que recusar: o item é cancelado por inteiro. A cozinha
 * não fica travada esperando — os itens não afetados seguem sendo preparados —
 * e nada é entregue sem o cliente ter concordado com a mudança.
 *
 * Se um dia a operação mostrar que é melhor entregar a quantidade reduzida
 * quando ninguém responde, é AQUI que se muda: trocar para 'aceita' e o resto
 * do sistema segue junto.
 */
export const EFEITO_DA_EXPIRACAO: 'recusada' | 'aceita' = 'recusada';

export interface LinhaProposta {
  orderItemId: string;
  /** Quantidade no momento da proposta. */
  qtyAnterior: number;
  /** 0 = cancelar o item. */
  qtyProposta: number;
}

export interface ItemDoPedido {
  id: string;
  qty: number;
  unitPriceCents: number;
  status: OrderItemStatus;
}

export type ErroDeProposta =
  | { tipo: 'sem-itens' }
  | { tipo: 'item-fora-do-pedido'; orderItemId: string }
  | { tipo: 'item-inativo'; orderItemId: string; status: OrderItemStatus }
  /** Já saiu do fogão. Situação diferente de inativo — ver ALTERAVEIS. */
  | { tipo: 'item-pronto'; orderItemId: string }
  | { tipo: 'qty-negativa'; orderItemId: string }
  | { tipo: 'nao-reduz'; orderItemId: string; qtyAtual: number; qtyProposta: number }
  | { tipo: 'linha-duplicada'; orderItemId: string };

/**
 * Até onde ainda dá pra propor alteração.
 *
 * ─── LISTA DO QUE PODE, NÃO DO QUE NÃO PODE ─────────────────────────────────
 *
 * Antes isto era o contrário: recusava `cancelado` e `retirado`, e liberava o
 * resto. `pronto` não estava na lista de recusa, então passava — a cozinha
 * conseguia propor reduzir de 2 pra 1 um prato que já estava empratado no
 * balcão esperando ser retirado. Comida feita, e a proposta ainda por cima
 * podia cancelá-la.
 *
 * Uma lista do que PODE não tem esse modo de falhar: status novo que apareça
 * um dia nasce bloqueado até alguém decidir conscientemente incluí-lo. Uma
 * lista do que não pode nasce permitindo — que foi exatamente como este furo
 * apareceu.
 *
 * O corte é `preparando` porque é o último momento em que reduzir ainda
 * significa alguma coisa: depois do `pronto` a comida existe, e a conversa
 * deixa de ser "quer menos?" e passa a ser desperdício.
 */
const ALTERAVEIS: readonly OrderItemStatus[] = ['novo', 'preparando'];

/**
 * Valida uma proposta contra os itens que a cozinha realmente tem no pedido.
 *
 * `itensDaCozinha` já vem filtrado por kitchenId pelo chamador — esta função
 * não sabe o que é uma cozinha, e é por isso que o chamador NÃO pode esquecer
 * esse filtro: sem ele, uma cozinha alteraria o item da vizinha.
 */
export function validarProposta(
  linhas: LinhaProposta[],
  itensDaCozinha: ItemDoPedido[],
): ErroDeProposta[] {
  const erros: ErroDeProposta[] = [];

  if (linhas.length === 0) {
    return [{ tipo: 'sem-itens' }];
  }

  const porId = new Map(itensDaCozinha.map((i) => [i.id, i]));
  const vistos = new Set<string>();

  for (const linha of linhas) {
    if (vistos.has(linha.orderItemId)) {
      erros.push({ tipo: 'linha-duplicada', orderItemId: linha.orderItemId });
      continue;
    }
    vistos.add(linha.orderItemId);

    const item = porId.get(linha.orderItemId);
    if (!item) {
      // Ou o item não existe, ou é de outra cozinha. A resposta é a mesma de
      // propósito: dizer "esse item é de outra cozinha" confirmaria a
      // existência de um id que não é de quem perguntou.
      erros.push({ tipo: 'item-fora-do-pedido', orderItemId: linha.orderItemId });
      continue;
    }

    if (!ALTERAVEIS.includes(item.status)) {
      // Dois erros diferentes de propósito: `pronto` é comida que existe e
      // está esperando alguém buscar; `retirado` já foi entregue e `cancelado`
      // não existe mais. Quem lê a recusa precisa saber qual dos dois é, senão
      // a mensagem na tela mente.
      erros.push(
        item.status === 'pronto'
          ? { tipo: 'item-pronto', orderItemId: item.id }
          : { tipo: 'item-inativo', orderItemId: item.id, status: item.status },
      );
      continue;
    }

    if (!Number.isInteger(linha.qtyProposta) || linha.qtyProposta < 0) {
      erros.push({ tipo: 'qty-negativa', orderItemId: item.id });
      continue;
    }

    if (linha.qtyProposta >= item.qty) {
      // Só reduz. Aumentar seria a cozinha vendendo o que o cliente não pediu,
      // e "propor a mesma quantidade" é uma proposta sem conteúdo.
      erros.push({
        tipo: 'nao-reduz',
        orderItemId: item.id,
        qtyAtual: item.qty,
        qtyProposta: linha.qtyProposta,
      });
    }
  }

  return erros;
}

export interface EfeitoNoItem {
  orderItemId: string;
  /** null quando o item é cancelado em vez de ter a quantidade reduzida. */
  novaQty: number | null;
  novoStatus: OrderItemStatus | null;
}

/**
 * O que aplicar no banco para uma resposta.
 *
 * Aceita   → reduz a quantidade; quantidade 0 vira cancelamento.
 * Recusada → cancela o item INTEIRO, mesmo que a proposta fosse só reduzir.
 *            "Não aceito a versão reduzida" só pode significar "então não
 *            quero" — a cozinha não tem o ingrediente para entregar o original.
 */
export function efeitosDaResposta(
  linhas: LinhaProposta[],
  resposta: 'aceita' | 'recusada',
): EfeitoNoItem[] {
  return linhas.map((linha) => {
    if (resposta === 'recusada') {
      return { orderItemId: linha.orderItemId, novaQty: null, novoStatus: 'cancelado' };
    }
    if (linha.qtyProposta === 0) {
      return { orderItemId: linha.orderItemId, novaQty: null, novoStatus: 'cancelado' };
    }
    return { orderItemId: linha.orderItemId, novaQty: linha.qtyProposta, novoStatus: null };
  });
}

/** Uma proposta pendente já passou do prazo? */
export function expirou(expiresAt: Date, agora: Date = new Date()): boolean {
  return expiresAt.getTime() <= agora.getTime();
}

/**
 * Diferença de valor que a proposta representa, em centavos.
 *
 * Sempre negativa ou zero: a proposta só reduz. Serve para a tela do cliente
 * dizer "o total cai R$ 18,00" antes de ele decidir — decidir sem saber o
 * impacto no valor não é decidir.
 */
export function deltaDaProposta(
  linhas: LinhaProposta[],
  itensDaCozinha: ItemDoPedido[],
): number {
  const porId = new Map(itensDaCozinha.map((i) => [i.id, i]));
  return linhas.reduce((acc, linha) => {
    const item = porId.get(linha.orderItemId);
    if (!item) return acc;
    return acc + (linha.qtyProposta - item.qty) * item.unitPriceCents;
  }, 0);
}
