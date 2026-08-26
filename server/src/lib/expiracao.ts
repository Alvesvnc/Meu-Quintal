import type { PrismaClient } from '@prisma/client';
import type { Server as SocketIOServer } from 'socket.io';
import type { OrderAlteracaoRespondidaEvent } from '@mq/shared';
import { salaDaCozinha, salaDoPedido } from './salas.js';
import { efeitosDaResposta, EFEITO_DA_EXPIRACAO, type LinhaProposta } from './alteracao.js';

/**
 * Encerramento das propostas que passaram do prazo.
 *
 * Antes disto a expiração só era avaliada quando alguém LIA o pedido. Na
 * prática quase sempre acontecia — as duas telas fazem poll — mas um pedido que
 * ninguém abre ficava com a proposta pendente no banco para sempre, e nem o
 * cliente nem a cozinha eram avisados de que o prazo acabou.
 *
 * SEGURANÇA COM VÁRIAS INSTÂNCIAS: rodar isto em cada réplica é o esperado. O
 * que impede trabalho duplicado é o `updateMany` condicional em
 * `expirarUmaProposta`: quem chegar primeiro muda o status e leva `count: 1`;
 * quem chegar depois leva `count: 0` e para. Não há lock distribuído nem
 * necessidade dele.
 */

export interface ResultadoDaVarredura {
  encontradas: number;
  expiradas: number;
}

/**
 * Aplica a expiração de UMA proposta, se ninguém tiver chegado antes.
 *
 * Devolve false quando outra instância (ou uma resposta do cliente no mesmo
 * instante) já resolveu esta proposta.
 */
async function expirarUmaProposta(
  prisma: PrismaClient,
  proposta: {
    id: string;
    orderId: string;
    kitchenId: string;
    items: Array<{ orderItemId: string; qtyAnterior: number; qtyProposta: number }>;
  },
): Promise<boolean> {
  const efeitos = efeitosDaResposta(proposta.items as LinhaProposta[], EFEITO_DA_EXPIRACAO);
  const agora = new Date();

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      // A CONDIÇÃO É A TRAVA: `status: 'pendente'` no where. Se outra instância
      // já marcou, o count vem 0 e nada mais acontece — inclusive os itens não
      // são tocados duas vezes.
      const { count } = await tx.orderChange.updateMany({
        where: { id: proposta.id, status: 'pendente' },
        data: { status: 'expirada', respondedAt: agora },
      });

      if (count === 0) return false;

      for (const efeito of efeitos) {
        await tx.orderItem.update({
          where: { id: efeito.orderItemId },
          data: {
            ...(efeito.novaQty !== null ? { qty: efeito.novaQty } : {}),
            ...(efeito.novoStatus !== null ? { status: efeito.novoStatus } : {}),
          },
        });
      }

      return true;
    });

    return resultado;
  } catch {
    // Uma proposta que falhou não pode derrubar a varredura inteira: as outras
    // continuam. O erro é logado pelo chamador.
    return false;
  }
}

/**
 * Varre e encerra as propostas vencidas.
 *
 * Separada do agendador para poder ser chamada em teste e, se preciso, à mão.
 */
export async function varrerExpiradas(
  prisma: PrismaClient,
  io: SocketIOServer | null,
  agora: Date = new Date(),
): Promise<ResultadoDaVarredura> {
  const vencidas = await prisma.orderChange.findMany({
    where: { status: 'pendente', expiresAt: { lte: agora } },
    include: {
      items: { select: { orderItemId: true, qtyAnterior: true, qtyProposta: true } },
      kitchen: { select: { id: true, slug: true } },
    },
    // Teto por rodada: se algo represar (banco fora por horas), a volta não
    // tenta processar tudo de uma vez e travar o event loop.
    take: 200,
  });

  let expiradas = 0;

  for (const proposta of vencidas) {
    const aplicou = await expirarUmaProposta(prisma, {
      id: proposta.id,
      orderId: proposta.orderId,
      kitchenId: proposta.kitchenId,
      items: proposta.items,
    });

    if (!aplicou) continue;
    expiradas++;

    // As duas telas precisam saber: o cliente para de ver o sheet aberto e a
    // cozinha para de esperar uma resposta que não vem mais.
    if (io) {
      const evento: OrderAlteracaoRespondidaEvent = {
        orderId: proposta.orderId,
        alteracaoId: proposta.id,
        kitchenSlug: proposta.kitchen.slug,
        resposta: 'expirada',
        at: agora.toISOString(),
      };
      io.to(salaDoPedido(proposta.orderId)).emit('order:alteracao-respondida', evento);
      io.to(salaDaCozinha(proposta.kitchen.id)).emit('order:alteracao-respondida', evento);
    }
  }

  return { encontradas: vencidas.length, expiradas };
}
