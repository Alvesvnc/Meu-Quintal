import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';

/**
 * Auth do app do dono. Expoe `app.authDono` e `app.exigePapel(...)`.
 *
 * Chamar DIRETO (sem app.register) pra escapar do encapsulation do Fastify v5 —
 * mesmo motivo de auth-mesa e auth-restaurante.
 *
 * DEPENDE de setupAuthRestaurante ter rodado antes: e la que o @fastify/jwt e
 * registrado. Os dois compartilham o mesmo segredo, e e exatamente por isso que
 * o campo `kind` do payload e conferido aqui.
 */
export function setupAuthDono(fastify: FastifyInstance) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fastify.decorateRequest('conta', null as any);

  fastify.decorate('authDono', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.code(401).send({ error: 'Token invalido ou expirado.' });
    }

    // A trava que impede um JWT de cozinha de virar acesso de dono. Sem ela o
    // token seria assinado corretamente e passaria.
    if (req.user.kind !== 'dono') {
      req.log.warn({ kind: req.user.kind }, 'token de outro tipo usado em rota de dono');
      return reply.code(403).send({ error: 'Este token nao da acesso ao painel do dono.' });
    }

    const { sub, accountId, email } = req.user;

    // Reconferir no banco: o token vive 7 dias e nesse intervalo a conta pode
    // ter sido suspensa por inadimplencia ou o usuario removido da equipe.
    const usuario = await prisma.accountUser.findUnique({
      where: { id: sub },
      select: {
        id: true,
        role: true,
        accountId: true,
        // A cozinha que este dono opera, se operar alguma (restaurante unico,
        // ou dono de praca que tambem toca uma casinha). E o que permite ele
        // ver o PROPRIO faturamento mesmo sem cobrar comissao de si.
        kitchenId: true,
        account: { select: { id: true, slug: true, status: true } },
      },
    });

    if (!usuario || usuario.accountId !== accountId) {
      return reply.code(401).send({ error: 'Usuario nao encontrado.' });
    }

    if (usuario.account.status === 'cancelada') {
      return reply.code(403).send({ error: 'Esta conta foi cancelada.' });
    }

    // Conta suspensa (inadimplente) ainda entra pra ver e regularizar; a
    // escrita e barrada por rota, nao aqui.
    req.conta = {
      userId: usuario.id,
      accountId: usuario.accountId,
      accountSlug: usuario.account.slug,
      email,
      // O papel vem do BANCO, nao do token: rebaixar alguem de owner pra staff
      // precisa valer na hora, sem esperar o token expirar.
      role: usuario.role,
      kitchenId: usuario.kitchenId,
    };
  });

  fastify.decorate(
    'exigePapel',
    (...papeis: Array<'owner' | 'admin' | 'staff'>) =>
      async (req: FastifyRequest, reply: FastifyReply) => {
        const conta = req.conta;
        if (!conta) {
          return reply.code(401).send({ error: 'Nao autenticado.' });
        }
        if (!papeis.includes(conta.role)) {
          return reply
            .code(403)
            .send({ error: `Acao permitida apenas para: ${papeis.join(', ')}.` });
        }
      },
  );
}

/**
 * Bloqueia escrita quando a conta esta suspensa por inadimplencia. Leitura
 * continua liberada pra pessoa conseguir ver o que deve e regularizar.
 */
export async function exigeContaAtiva(req: FastifyRequest, reply: FastifyReply) {
  const conta = req.conta;
  if (!conta) return reply.code(401).send({ error: 'Nao autenticado.' });

  const account = await prisma.account.findUnique({
    where: { id: conta.accountId },
    select: { status: true },
  });

  if (account?.status !== 'ativa') {
    return reply.code(402).send({
      error: 'Conta suspensa. Regularize o pagamento para voltar a editar.',
    });
  }
}
