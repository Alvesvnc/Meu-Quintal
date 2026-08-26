import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import argon2 from 'argon2';
import {
  definirSenhaSchema,
  recuperarSenhaSchema,
  type PrimeiroAcessoResponse,
  type DefinirSenhaResponse,
} from '@mq/shared';
import { prisma } from '../lib/prisma.js';
import { hashDeToken, criarLinkDeAcesso } from '../lib/acessoToken.js';
import { enviar, recuperarSenha as emailDeRecuperacao, boasVindas } from '../lib/email.js';
import { env } from '../lib/env.js';
import { montarMe } from './admin.js';

/**
 * Definir senha: primeiro acesso e "esqueci minha senha".
 *
 * **Rotas públicas.** Quem chega aqui não consegue entrar — é exatamente isto
 * que está resolvendo. O que autentica é o token do link, que tem 256 bits e só
 * existe no e-mail; o banco guarda o hash.
 *
 * Serve os dois tipos de usuário: dono de conta e operador de cozinha. O link
 * sabe de quem é, e a tela de destino muda junto — o dono vai para o app de
 * administração, a cozinha vai para o app onde ela trabalha.
 */
export async function acessoRoutes(fastify: FastifyInstance) {
  /**
   * Pedir recuperação é caro e é alvo: cada tentativa dispara um e-mail e uma
   * escrita. 3 por minuto por IP é o suficiente para quem errou o endereço e
   * quer tentar de novo.
   */
  const limitePedido = { config: { rateLimit: { max: 3, timeWindow: '1 minute' } } };

  const recusar = (code: number, msg: string) => ({ ok: false as const, code, msg });

  async function buscar(token: string) {
    const acesso = await prisma.accessToken.findUnique({
      where: { tokenHash: hashDeToken(token) },
      include: {
        user: { select: { id: true, email: true, name: true, accountId: true, account: { select: { name: true, status: true } } } },
        kitchenUser: { select: { id: true, email: true, name: true, kitchen: { select: { name: true } } } },
      },
    });

    if (!acesso) return recusar(404, 'Link nao encontrado.');
    if (acesso.usedAt) {
      // Distinguir de expirado e proposital: sao saidas diferentes — uma pede
      // link novo, a outra e so entrar.
      return recusar(409, 'Este link ja foi usado. Entre com a senha que voce criou.');
    }
    if (acesso.expiresAt < new Date()) {
      return recusar(410, 'Este link expirou. Peca um novo.');
    }
    if (acesso.user && acesso.user.account.status === 'cancelada') {
      return recusar(403, 'Esta conta foi cancelada.');
    }
    if (!acesso.user && !acesso.kitchenUser) {
      // O CHECK do banco impede isso; cair aqui e dado corrompido, nao um
      // caso a tratar com jeitinho.
      return recusar(409, 'Link invalido.');
    }

    return { ok: true as const, acesso };
  }

  // ─── POST /api/a/auth/recuperar  e  /api/r/auth/recuperar ───────────────
  //
  // A RESPOSTA E SEMPRE A MESMA, exista o email ou nao. Responder "email nao
  // encontrado" transformaria a rota num oraculo: um script descobriria quais
  // enderecos tem conta aqui, e isso e material de phishing dirigido.
  const pedirRecuperacao =
    (tipo: 'dono' | 'cozinha') => async (req: FastifyRequest, reply: FastifyReply) => {
      const parsed = recuperarSenhaSchema.safeParse(req.body);
      // Ate email malformado responde igual: dizer "email invalido" so pra um
      // subconjunto ja e informacao.
      if (!parsed.success) return reply.send({ ok: true });

      const email = parsed.data.email.toLowerCase().trim();

      if (tipo === 'dono') {
        const user = await prisma.accountUser.findUnique({
          where: { email },
          select: { id: true, name: true, account: { select: { name: true, status: true } } },
        });
        // Conta cancelada nao recebe link: seria devolver acesso a algo que
        // deixou de existir.
        if (user && user.account.status !== 'cancelada') {
          const { token, expiraEm } = await criarLinkDeAcesso({ userId: user.id }, 'recuperar_senha');
          const envio = await enviar(
            emailDeRecuperacao({
              para: email,
              nome: user.name,
              ondeEntra: user.account.name,
              link: `${env.APP_DONO_URL}/senha/${token}`,
              expiraEm,
            }),
          );
          if (!envio.enviado) {
            req.log.error({ erro: envio.erro }, 'falha ao enviar recuperacao de senha (dono)');
          }
        }
      } else {
        const user = await prisma.kitchenUser.findUnique({
          where: { email },
          select: { id: true, name: true, kitchen: { select: { name: true } } },
        });
        if (user) {
          const { token, expiraEm } = await criarLinkDeAcesso(
            { kitchenUserId: user.id },
            'recuperar_senha',
          );
          const envio = await enviar(
            emailDeRecuperacao({
              para: email,
              nome: user.name,
              ondeEntra: user.kitchen.name,
              link: `${env.APP_RESTAURANTE_URL}/senha/${token}`,
              expiraEm,
            }),
          );
          if (!envio.enviado) {
            req.log.error({ erro: envio.erro }, 'falha ao enviar recuperacao de senha (cozinha)');
          }
        }
      }

      return reply.send({ ok: true });
    };

  fastify.post('/api/a/auth/recuperar', limitePedido, pedirRecuperacao('dono'));
  fastify.post('/api/r/auth/recuperar', limitePedido, pedirRecuperacao('cozinha'));

  // ─── GET /api/acesso/:token ─────────────────────────────────────────────
  //
  // A tela diz DE QUEM e o link antes de pedir a senha. Chegar numa tela de
  // "crie sua senha" sem saber de que se trata e o formato de todo phishing.
  fastify.get<{ Params: { token: string } }>(
    '/api/acesso/:token',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const r = await buscar(req.params.token);
      if (!r.ok) return reply.code(r.code).send({ error: r.msg });
      const a = r.acesso;

      const response: PrimeiroAcessoResponse = {
        tipo: a.kind === 'recuperar_senha' ? 'recuperar-senha' : 'primeiro-acesso',
        email: a.user?.email ?? a.kitchenUser!.email,
        name: a.user?.name ?? a.kitchenUser!.name,
        accountName: a.user?.account.name ?? a.kitchenUser!.kitchen.name,
        expiresAt: a.expiresAt.toISOString(),
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
      const a = r.acesso;

      const passwordHash = await argon2.hash(parsed.data.password);
      const eDono = a.user !== null;

      const aplicado = await prisma.$transaction(async (tx) => {
        // A CONDICAO `usedAt: null` E A TRAVA. Dois cliques, ou o link aberto
        // em duas abas, chegariam aqui juntos; o segundo encontra count 0 e
        // desiste, em vez de sobrescrever a senha recem-criada.
        const { count } = await tx.accessToken.updateMany({
          where: { id: a.id, usedAt: null },
          data: { usedAt: new Date() },
        });
        if (count === 0) return false;

        // `tokenVersion` sobe JUNTO com a senha: e o que derruba todo JWT
        // emitido antes. Quem troca a senha por desconfiar de invasao precisa
        // que o invasor caia na hora, nao daqui a sete dias.
        if (eDono) {
          await tx.accountUser.update({
            where: { id: a.userId! },
            data: { passwordHash, tokenVersion: { increment: 1 } },
          });
          await tx.accessToken.updateMany({
            where: { userId: a.userId!, usedAt: null },
            data: { usedAt: new Date() },
          });
        } else {
          await tx.kitchenUser.update({
            where: { id: a.kitchenUserId! },
            data: { passwordHash, tokenVersion: { increment: 1 } },
          });
          await tx.accessToken.updateMany({
            where: { kitchenUserId: a.kitchenUserId!, usedAt: null },
            data: { usedAt: new Date() },
          });
        }

        return true;
      });

      if (!aplicado) return reply.code(409).send({ error: 'Este link ja foi usado.' });

      req.log.info(
        { tipo: a.kind, dono: eDono ? a.userId : a.kitchenUserId },
        'senha definida por link',
      );

      // Ja entra logado: a pessoa acabou de provar que tem o link e escolheu a
      // senha. Manda-la pro login seria pedir o que ela digitou ha dois
      // segundos.
      if (eDono) {
        const me = await montarMe(a.userId!, a.user!.accountId);
        const atualizado = await prisma.accountUser.findUniqueOrThrow({
          where: { id: a.userId! },
          select: { tokenVersion: true },
        });
        const token = fastify.jwt.sign({
          kind: 'dono' as const,
          sub: a.userId!,
          accountId: me.account.id,
          accountSlug: me.account.slug,
          email: me.email,
          role: me.role,
          v: atualizado.tokenVersion,
          ...(me.kitchenId ? { kitchenId: me.kitchenId } : {}),
        });
        const response: DefinirSenhaResponse = { app: 'dono', token, me };
        return reply.code(201).send(response);
      }

      const ku = await prisma.kitchenUser.findUniqueOrThrow({
        where: { id: a.kitchenUserId! },
        select: {
          id: true,
          email: true,
          role: true,
          tokenVersion: true,
          kitchen: { select: { id: true, slug: true, name: true, status: true } },
        },
      });
      const token = fastify.jwt.sign({
        kind: 'cozinha' as const,
        sub: ku.id,
        kitchenId: ku.kitchen.id,
        kitchenSlug: ku.kitchen.slug,
        email: ku.email,
        role: ku.role,
        v: ku.tokenVersion,
      });

      const response: DefinirSenhaResponse = {
        app: 'cozinha',
        token,
        kitchen: {
          id: ku.kitchen.id,
          slug: ku.kitchen.slug,
          name: ku.kitchen.name,
          status: ku.kitchen.status,
        },
      };
      return reply.code(201).send(response);
    },
  );
}

/** Reexportado para o bootstrap montar o link de boas-vindas. */
export { boasVindas };
