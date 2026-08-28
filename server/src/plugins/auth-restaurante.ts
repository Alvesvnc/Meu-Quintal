import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { prisma } from '../lib/prisma.js';
import { env } from '../lib/env.js';

/**
 * Setup do JWT + decorator `app.authRestaurante` que valida token e popula
 * `req.kitchen` com info da cozinha do usuario logado.
 *
 * Chamar DIRETO (sem app.register) pra escapar do encapsulation do Fastify v5.
 */
export async function setupAuthRestaurante(fastify: FastifyInstance) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fastify.decorateRequest('kitchen', null as any);

  // Registra o plugin JWT (esse SIM via register, e standalone — nao precisa
  // ser visivel fora da chamada async aqui pois ele decora `fastify.jwt`
  // que e shared, e o jwt verify e usado dentro do nosso decorator)
  await fastify.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: '7d' },
  });

  // Decorator preHandler que valida JWT e carrega contexto do kitchen
  fastify.decorate('authRestaurante', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.code(401).send({ error: 'Token invalido ou expirado.' });
    }

    // ─── Qual identidade este token carrega ─────────────────────────────
    //
    // Dois caminhos entram aqui, e a assimetria e proposital:
    //
    //   kind 'cozinha' -> o operador. Caminho de sempre.
    //   kind 'dono'    -> SO no restaurante unico, onde o dono E a cozinha.
    //                     Exige `kitchenId` no token E confirmacao no banco de
    //                     que aquele AccountUser esta mesmo vinculado aquela
    //                     cozinha.
    //
    // O contrario NAO existe: um token de cozinha nunca abre /api/a/*. Descer
    // de privilegio dentro da propria conta e seguro; subir nao seria.
    let sub: string;
    let kitchenId: string;
    let email: string;
    let role: string;

    if (req.user.kind === 'cozinha') {
      ({ sub, kitchenId, email, role } = req.user);
    } else if (req.user.kind === 'dono') {
      const vinculo = req.user.kitchenId;
      if (!vinculo) {
        req.log.warn({ sub: req.user.sub }, 'dono sem vinculo tentou rota de cozinha');
        return reply.code(403).send({ error: 'Este token nao da acesso ao app do restaurante.' });
      }

      // NUNCA confiar so no token: o vinculo pode ter sido removido depois de
      // ele ser emitido, e o token vale 7 dias.
      const dono = await prisma.accountUser.findUnique({
        where: { id: req.user.sub },
        select: { id: true, email: true, role: true, kitchenId: true },
      });

      if (!dono || dono.kitchenId !== vinculo) {
        req.log.warn({ sub: req.user.sub }, 'vinculo dono-cozinha nao confere no banco');
        return reply.code(403).send({ error: 'Este token nao da acesso ao app do restaurante.' });
      }

      sub = dono.id;
      kitchenId = vinculo;
      email = dono.email;
      role = dono.role;
    } else {
      // Inalcancavel pelo tipo, mas nao em runtime: token emitido ANTES de o
      // campo `kind` existir chega aqui sem ele. Vale 7 dias, entao pode
      // aparecer por uma semana depois de um deploy.
      const desconhecido = (req.user as { kind?: string }).kind;
      req.log.warn({ kind: desconhecido }, 'token sem tipo reconhecido em rota de cozinha');
      return reply.code(403).send({ error: 'Este token nao da acesso ao app do restaurante.' });
    }

    // Confirma que a cozinha ainda existe. NAO se checa `status` aqui:
    // `pausada` significa "o cliente nao me ve agora", nao "o operador nao
    // entra". Bloquear aqui trancava a cozinha fora do proprio app — depois de
    // pausar, ela nao conseguia nem despausar. Quem filtra por `ativa` e o lado
    // do cliente (quintal.ts, kitchen.ts) e a criacao de pedido (order.ts).
    const kitchen = await prisma.kitchen.findUnique({
      where: { id: kitchenId },
      select: { id: true, slug: true, name: true, status: true, spaceId: true },
    });

    if (!kitchen) {
      return reply.code(401).send({ error: 'Cozinha nao encontrada.' });
    }

    // ─── O USUARIO DA COZINHA, RELIDO ────────────────────────────────────
    //
    // Antes disto so a COZINHA era reconferida, nunca a pessoa. Duas
    // consequencias, as duas ruins:
    //
    //   Remover um funcionario nao revogava o acesso dele — o token seguia
    //   valendo ate expirar, por ate sete dias.
    //
    //   Trocar a senha nao expulsava ninguem, pelo mesmo motivo.
    //
    // O token de DONO nao passa por aqui: quem valida a versao dele e o
    // auth-dono, e este ramo so e alcancado por `kind === 'cozinha'`.
    if (req.user.kind === 'cozinha') {
      const operador = await prisma.kitchenUser.findUnique({
        where: { id: sub },
        select: { id: true, kitchenId: true, tokenVersion: true },
      });

      if (!operador || operador.kitchenId !== kitchen.id) {
        return reply.code(401).send({ error: 'Usuario nao encontrado.' });
      }
      // Token sem `v` (emitido antes do campo existir) conta como versao 0.
      if ((req.user.v ?? 0) !== operador.tokenVersion) {
        return reply.code(401).send({ error: 'Sua sessao expirou. Entre de novo.' });
      }
    }

    req.kitchen = {
      userId: sub,
      kitchenId: kitchen.id,
      kitchenSlug: kitchen.slug,
      kitchenName: kitchen.name,
      spaceId: kitchen.spaceId,
      email,
      role,
    };
  });
}
