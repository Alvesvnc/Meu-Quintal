import type { FastifyInstance } from 'fastify';
import {
  inscreverPushSchema,
  desinscreverPushSchema,
  type ChavePushResponse,
  type InscricaoPushResponse,
} from '@mq/shared';
import { prisma } from '../lib/prisma.js';
import { chavePublica, pushAtivo } from '../lib/push.js';

/**
 * Inscrição de aparelho pra receber aviso com o app fechado. Tudo sob
 * `/api/r/push/*`, e tudo exige operador logado.
 *
 * Separado de `restaurante.ts` (a operação) e de `cozinha.ts` (a cozinha se
 * administrando) porque não é nem uma coisa nem outra: é a ligação entre um
 * APARELHO e uma cozinha, escrita uma vez na instalação e nunca mais tocada.
 */
export async function pushRoutes(fastify: FastifyInstance) {
  // ─── GET /api/r/push/chave ────────────────────────────────────────────────
  //
  // O app pergunta ANTES de pedir permissão ao usuário. Sem isto ele pediria a
  // permissão de notificação, a pessoa aceitaria, e só então descobriríamos que
  // não há chave no servidor — deixando uma permissão concedida à toa. E
  // permissão de notificação negada uma vez é quase impossível de recuperar:
  // o navegador para de perguntar.
  fastify.get(
    '/api/r/push/chave',
    { preHandler: fastify.authRestaurante },
    async (req, reply) => {
      const aparelhos = pushAtivo()
        ? await prisma.pushSubscription.count({ where: { kitchenId: req.kitchen!.kitchenId } })
        : 0;

      const resposta: ChavePushResponse = {
        chavePublica: chavePublica(),
        aparelhos,
      };
      return reply.send(resposta);
    },
  );

  // ─── POST /api/r/push/inscrever ───────────────────────────────────────────
  fastify.post(
    '/api/r/push/inscrever',
    {
      preHandler: fastify.authRestaurante,
      // Teto próprio: inscrever é uma escrita por aparelho, feita uma vez na
      // instalação. Trinta por minuto é folgado pra uso real e fecha a porta
      // pra um laço que encha a tabela.
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      if (!pushAtivo()) {
        // 503 e não 400: o pedido está correto, quem não está pronto é o
        // servidor. A distinção importa pro app saber que não adianta tentar
        // de novo com outro corpo.
        return reply.code(503).send({ error: 'Push nao esta configurado neste servidor.' });
      }

      const parsed = inscreverPushSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Inscricao de push invalida.' });
      }
      const { endpoint, p256dh, auth } = parsed.data;
      const { kitchenId, userId } = req.kitchen!;

      /*
        UPSERT PELO ENDPOINT, e o endpoint é único no sistema inteiro.

        O mesmo aparelho reinscreve sozinho de tempos em tempos — o navegador
        rotaciona as chaves — e reinscreve também quando a pessoa troca de
        cozinha no mesmo tablet. Nos dois casos o certo é ATUALIZAR a linha:
        criar outra faria o aviso chegar duplicado, e no segundo caso mandaria
        pedido da cozinha antiga pra um aparelho que agora é de outra.
      */
      await prisma.pushSubscription.upsert({
        where: { endpoint },
        create: { endpoint, p256dh, auth, kitchenId, userId },
        update: { p256dh, auth, kitchenId, userId, lastOkAt: null },
      });

      const aparelhos = await prisma.pushSubscription.count({ where: { kitchenId } });

      req.log.info({ kitchenId, aparelhos }, 'aparelho inscrito no push');

      const resposta: InscricaoPushResponse = { ok: true, aparelhos };
      return reply.send(resposta);
    },
  );

  // ─── DELETE /api/r/push/inscrever ─────────────────────────────────────────
  fastify.delete(
    '/api/r/push/inscrever',
    { preHandler: fastify.authRestaurante },
    async (req, reply) => {
      const parsed = desinscreverPushSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Endpoint invalido.' });
      }
      const { kitchenId } = req.kitchen!;

      /*
        O `kitchenId` no where NÃO é redundante.

        O endpoint é único no sistema e chega no corpo da requisição — quem
        estiver logado em QUALQUER cozinha poderia mandar o endpoint de um
        aparelho alheio e desligar o aviso dele. Não vaza dado, mas é um
        jeito silencioso de calar a cozinha do vizinho num food-court.
      */
      const { count } = await prisma.pushSubscription.deleteMany({
        where: { endpoint: parsed.data.endpoint, kitchenId },
      });

      const aparelhos = await prisma.pushSubscription.count({ where: { kitchenId } });

      req.log.info({ kitchenId, removidos: count, aparelhos }, 'aparelho saiu do push');

      const resposta: InscricaoPushResponse = { ok: true, aparelhos };
      return reply.send(resposta);
    },
  );
}
