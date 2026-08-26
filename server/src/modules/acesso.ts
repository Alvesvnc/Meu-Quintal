import type { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import argon2 from 'argon2';
import {
  definirSenhaSchema,
  type PrimeiroAcessoResponse,
  type DefinirSenhaResponse,
} from '@mq/shared';
import { prisma } from '../lib/prisma.js';
import { montarMe } from './admin.js';

/**
 * Primeiro acesso: a pessoa define a própria senha.
 *
 * **Rotas públicas.** Quem chega aqui não consegue logar ainda — é exatamente
 * isto que está resolvendo. O que autentica é o token do link, que tem 256 bits
 * e só existe no email; o banco guarda o hash.
 *
 * ─── POR QUE ISTO EXISTE ────────────────────────────────────────────────────
 *
 * A alternativa era o que o `bootstrap` fazia: gerar uma senha, imprimir no
 * terminal e o operador ditar por WhatsApp. A credencial que abre a conta
 * inteira — todo o financeiro, todas as cozinhas — passeando por canal nenhum,
 * e ficando no histórico da conversa para sempre.
 *
 * Um link de uso único que expira resolve isso: a senha nasce no navegador de
 * quem vai usá-la e nunca é transmitida.
 */
export async function acessoRoutes(fastify: FastifyInstance) {
  const hashDe = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

  const recusar = (code: number, msg: string) => ({ ok: false as const, code, msg });

  async function buscar(token: string) {
    const acesso = await prisma.accessToken.findUnique({
      where: { tokenHash: hashDe(token) },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            accountId: true,
            account: { select: { name: true, status: true } },
          },
        },
      },
    });

    if (!acesso) return recusar(404, 'Link nao encontrado.');
    if (acesso.usedAt) {
      // Distinguir de expirado: as saidas sao diferentes — uma pede link novo,
      // a outra e so entrar.
      return recusar(409, 'Este link ja foi usado. Entre com a senha que voce criou.');
    }
    if (acesso.expiresAt < new Date()) {
      return recusar(410, 'Este link expirou. Peca um novo.');
    }
    if (acesso.user.account.status === 'cancelada') {
      return recusar(403, 'Esta conta foi cancelada.');
    }

    return { ok: true as const, acesso };
  }

  // ─── GET /api/acesso/:token ─────────────────────────────────────────────
  //
  // A tela mostra pra QUEM e o link antes de pedir senha: chegar numa tela de
  // "crie sua senha" sem saber de que conta se trata e o formato de todo golpe
  // de phishing.
  fastify.get<{ Params: { token: string } }>(
    '/api/acesso/:token',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const r = await buscar(req.params.token);
      if (!r.ok) return reply.code(r.code).send({ error: r.msg });

      const response: PrimeiroAcessoResponse = {
        email: r.acesso.user.email,
        name: r.acesso.user.name,
        accountName: r.acesso.user.account.name,
        expiresAt: r.acesso.expiresAt.toISOString(),
      };
      return reply.send(response);
    },
  );

  // ─── POST /api/acesso/:token/senha ──────────────────────────────────────
  fastify.post<{ Params: { token: string } }>(
    '/api/acesso/:token/senha',
    // Mais apertado que a leitura: cada tentativa custa um argon2.hash.
    { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const parsed = definirSenhaSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: 'Senha invalida.', details: parsed.error.flatten().fieldErrors });
      }

      const r = await buscar(req.params.token);
      if (!r.ok) return reply.code(r.code).send({ error: r.msg });
      const { acesso } = r;

      const passwordHash = await argon2.hash(parsed.data.password);

      const aplicado = await prisma.$transaction(async (tx) => {
        // A CONDICAO `usedAt: null` E A TRAVA. Dois cliques, ou o link aberto
        // em duas abas, chegariam aqui juntos; o segundo encontra count 0 e
        // desiste, em vez de sobrescrever a senha que a pessoa acabou de criar.
        const { count } = await tx.accessToken.updateMany({
          where: { id: acesso.id, usedAt: null },
          data: { usedAt: new Date() },
        });
        if (count === 0) return false;

        await tx.accountUser.update({
          where: { id: acesso.userId },
          data: { passwordHash },
        });

        // Qualquer outro link pendente do mesmo usuario morre junto: se alguem
        // pediu dois, o antigo nao pode continuar valendo pra trocar a senha
        // que acabou de ser definida.
        await tx.accessToken.updateMany({
          where: { userId: acesso.userId, usedAt: null },
          data: { usedAt: new Date() },
        });

        return true;
      });

      if (!aplicado) {
        return reply.code(409).send({ error: 'Este link ja foi usado.' });
      }

      req.log.info({ userId: acesso.userId }, 'senha definida por link de primeiro acesso');

      // Ja entra logado: a pessoa acabou de provar que tem o link e escolheu a
      // senha. Manda-la pro login seria pedir o que ela digitou ha dois
      // segundos.
      const me = await montarMe(acesso.userId, acesso.user.accountId);
      const token = fastify.jwt.sign({
        kind: 'dono' as const,
        sub: acesso.userId,
        accountId: me.account.id,
        accountSlug: me.account.slug,
        email: me.email,
        role: me.role,
        ...(me.kitchenId ? { kitchenId: me.kitchenId } : {}),
      });

      const response: DefinirSenhaResponse = { token, me };
      return reply.code(201).send(response);
    },
  );
}
