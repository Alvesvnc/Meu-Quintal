import type { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import argon2 from 'argon2';
import {
  aceitarConviteSchema,
  type ConvitePublicoResponse,
  type AceitarConviteResponse,
} from '@mq/shared';
import { prisma } from '../lib/prisma.js';
import { categoriasPadrao } from '../lib/categoriasPadrao.js';
import { slugLivre } from '../lib/slug.js';
import { podeAdicionarCozinha } from '../lib/planos.js';

/**
 * O outro lado do convite: quem recebeu o email.
 *
 * **Rotas públicas, sem autenticação** — a pessoa ainda não tem conta; é
 * justamente isto que ela está criando. O que autentica é o token do link, que
 * tem 256 bits e vive só no email: o banco guarda o hash.
 *
 * ─── O ACEITE É UMA TRANSAÇÃO SÓ ────────────────────────────────────────────
 *
 * Convite marcado como aceito sem cozinha criada deixa o responsável sem acesso
 * e sem como pedir outro — o link é de uso único. Kitchen, KitchenUser e o
 * carimbo de aceite entram juntos ou não entram.
 */
export async function conviteRoutes(fastify: FastifyInstance) {
  /**
   * Teto próprio, bem abaixo do global.
   *
   * O token está no caminho da URL, o que faz desta rota alvo natural de
   * varredura. Adivinhar 256 bits é inviável, mas sem limite um script
   * transformaria a rota em martelo no banco — cada tentativa é um índice
   * consultado.
   */
  const limite = { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } };

  /** Recusa com codigo e mensagem — o outro lado da uniao devolvida por `buscar`. */
  const recusar = (code: number, msg: string) => ({ ok: false as const, code, msg });

  const hashDe = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

  /**
   * Busca o convite pelo hash e diz por que não serve, se for o caso.
   *
   * A mensagem distingue expirado de já-aceito de propósito: são situações com
   * saídas diferentes — uma pede convite novo, a outra pede login. "Convite
   * inválido" para as duas faria a pessoa ligar para o dono nas duas.
   */
  async function buscar(token: string) {
    const convite = await prisma.invite.findUnique({
      where: { tokenHash: hashDe(token) },
      include: {
        account: { select: { id: true, name: true, status: true, plan: true } },
        space: { select: { id: true, name: true, slug: true } },
      },
    });

    if (!convite) return recusar(404, 'Convite nao encontrado.');
    if (convite.acceptedAt) {
      return recusar(409, 'Este convite ja foi aceito. Tente entrar com sua senha.');
    }
    if (convite.expiresAt < new Date()) {
      return recusar(410, 'Este convite expirou. Peca um novo ao dono do quintal.');
    }
    if (convite.account.status !== 'ativa') {
      return recusar(409, 'A conta que convidou voce nao esta ativa.');
    }
    if (convite.kind !== 'cozinha' || !convite.space || !convite.kitchenName) {
      // Convite de EQUIPE existe no schema mas ninguem cria ainda. Cair aqui
      // significa dado inconsistente — nao vale tentar adivinhar o que fazer.
      return recusar(409, 'Este tipo de convite ainda nao pode ser aceito.');
    }

    return { ok: true as const, convite };
  }

  // ─── GET /api/convite/:token ────────────────────────────────────────────
  //
  // A tela de aceite mostra o que a pessoa esta aceitando ANTES de pedir senha.
  // Aceitar um acordo financeiro sem ler seria assinar em branco.
  fastify.get<{ Params: { token: string } }>(
    '/api/convite/:token',
    limite,
    async (req, reply) => {
      const r = await buscar(req.params.token);
      if (!r.ok) return reply.code(r.code).send({ error: r.msg });

      const c = r.convite;
      const pct = c.commissionPct === null ? null : Number(c.commissionPct);

      const response: ConvitePublicoResponse = {
        email: c.email,
        kitchenName: c.kitchenName!,
        spaceName: c.space!.name,
        accountName: c.account.name,
        expiresAt: c.expiresAt.toISOString(),
        acordo: {
          chargeCommission: c.chargeCommission ?? false,
          commissionPct: pct,
          chargeRent: c.chargeRent ?? false,
          rentCents: c.rentCents ?? 0,
        },
      };
      return reply.send(response);
    },
  );

  // ─── POST /api/convite/:token/aceitar ───────────────────────────────────
  fastify.post<{ Params: { token: string } }>(
    '/api/convite/:token/aceitar',
    // Mais apertado que a leitura: aqui cada tentativa custa um argon2.hash,
    // que e caro de proposito.
    { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const parsed = aceitarConviteSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: 'Dados invalidos.', details: parsed.error.flatten().fieldErrors });
      }

      const r = await buscar(req.params.token);
      if (!r.ok) return reply.code(r.code).send({ error: r.msg });
      const c = r.convite;
      const space = c.space!;

      // O email e unico no sistema inteiro: e assim que o login descobre a que
      // cozinha a pessoa pertence, sem pedir o quintal no formulario.
      const jaExiste = await prisma.kitchenUser.findUnique({
        where: { email: c.email },
        select: { id: true },
      });
      if (jaExiste) {
        return reply.code(409).send({
          error: 'Ja existe um acesso com esse email. Entre com sua senha, ou peca um convite em outro email.',
        });
      }

      // ─── O teto do plano, DE NOVO ────────────────────────────────────────
      //
      // Ja foi conferido na criacao do convite, mas o convite vale 7 dias e
      // nesse intervalo o quintal pode ter enchido. Conferir so na criacao
      // deixaria dois convites de restaurante unico virarem duas cozinhas.
      const cozinhasHoje = await prisma.kitchen.count({ where: { spaceId: space.id } });
      const recusa = podeAdicionarCozinha(c.account.plan, cozinhasHoje);
      if (recusa) {
        return reply.code(409).send({
          error: 'O quintal ja atingiu o limite de cozinhas do plano dele. Fale com o dono.',
        });
      }

      const ocupados = new Set(
        (
          await prisma.kitchen.findMany({
            where: { spaceId: space.id },
            select: { slug: true },
          })
        ).map((k) => k.slug),
      );
      const slug = slugLivre(c.kitchenName!, ocupados);

      const passwordHash = await argon2.hash(parsed.data.password);

      const criado = await prisma.$transaction(async (tx) => {
        // A CONDICAO `acceptedAt: null` E A TRAVA CONTRA DUPLO ACEITE. Dois
        // cliques no botao, ou duas abas abertas, chegariam aqui juntos: o
        // segundo encontra count 0 e desiste, em vez de criar uma cozinha
        // gemea.
        const { count } = await tx.invite.updateMany({
          where: { id: c.id, acceptedAt: null },
          data: { acceptedAt: new Date() },
        });
        if (count === 0) return null;

        const kitchen = await tx.kitchen.create({
          data: {
            spaceId: space.id,
            slug,
            name: c.kitchenName!,
            // Nasce PAUSADA: o cliente nao pode ver uma cozinha sem cardapio.
            // Quem publica e o responsavel, depois de cadastrar os pratos.
            status: 'pausada',
            // Os termos combinados NO CONVITE, nao os padroes do quintal: o
            // acordo foi negociado antes e a pessoa acabou de le-lo na tela.
            chargeCommission: c.chargeCommission ?? true,
            commissionPct: c.commissionPct,
            chargeRent: c.chargeRent ?? false,
            rentCents: c.rentCents ?? 0,
            // As secoes com que o cardapio comeca. Sem elas a primeira coisa
            // que a cozinha encontraria no app seria um "crie uma secao antes
            // de criar o primeiro item" — justo no momento em que ela ainda
            // nao sabe usar nada. Ver lib/categoriasPadrao.ts.
            menuCategorias: { create: categoriasPadrao() },
          },
        });

        const user = await tx.kitchenUser.create({
          data: {
            email: c.email,
            passwordHash,
            name: parsed.data.name?.trim() || null,
            kitchenId: kitchen.id,
            role: 'owner',
          },
        });

        return { kitchen, user };
      });

      if (!criado) {
        return reply.code(409).send({ error: 'Este convite ja foi aceito.' });
      }

      req.log.info(
        { kitchenId: criado.kitchen.id, spaceId: space.id, inviteId: c.id },
        'convite de cozinha aceito',
      );

      // Ja entra logado: a pessoa acabou de provar que tem o link e escolheu a
      // senha. Mandar pra tela de login seria pedir a senha que ela digitou ha
      // dois segundos.
      const token = fastify.jwt.sign({
        kind: 'cozinha' as const,
        sub: criado.user.id,
        kitchenId: criado.kitchen.id,
        kitchenSlug: criado.kitchen.slug,
        email: criado.user.email,
        role: criado.user.role,
        v: criado.user.tokenVersion,
      });

      const response: AceitarConviteResponse = {
        token,
        kitchen: {
          id: criado.kitchen.id,
          slug: criado.kitchen.slug,
          name: criado.kitchen.name,
          status: criado.kitchen.status,
        },
      };
      return reply.code(201).send(response);
    },
  );
}
