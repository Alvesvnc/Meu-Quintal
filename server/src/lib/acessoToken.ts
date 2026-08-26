import crypto from 'node:crypto';
import { prisma } from './prisma.js';

/**
 * Link de uso único para alguém definir a própria senha.
 *
 * Serve dois casos com prazos diferentes, e a diferença é deliberada:
 *
 *   PRIMEIRO ACESSO — 7 dias. A conta acabou de ser criada e a pessoa talvez
 *   nem saiba que existe; o e-mail pode esperar o fim de semana.
 *
 *   RECUPERAR SENHA — 1 hora. Quem pediu está na frente do computador agora.
 *   Cada hora a mais é uma hora a mais em que um e-mail vazado vira acesso.
 */

export type TipoDeLink = 'primeiro_acesso' | 'recuperar_senha';

const VALIDADE_MS: Record<TipoDeLink, number> = {
  primeiro_acesso: 7 * 24 * 60 * 60 * 1000,
  recuperar_senha: 60 * 60 * 1000,
};

export const hashDeToken = (token: string) =>
  crypto.createHash('sha256').update(token).digest('hex');

export interface LinkCriado {
  /** Texto puro. Só existe aqui e no e-mail — o banco guarda o hash. */
  token: string;
  expiraEm: Date;
}

/**
 * Cria o link e **invalida os anteriores do mesmo usuário**.
 *
 * Sem isso, pedir "esqueci minha senha" três vezes deixaria três links vivos.
 * O terceiro é o que a pessoa vai usar; os dois primeiros ficariam pendurados
 * na caixa de entrada dela, cada um capaz de trocar a senha da conta durante o
 * prazo inteiro.
 */
export async function criarLinkDeAcesso(
  dono: { userId: string } | { kitchenUserId: string },
  tipo: TipoDeLink,
): Promise<LinkCriado> {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiraEm = new Date(Date.now() + VALIDADE_MS[tipo]);

  const where =
    'userId' in dono ? { userId: dono.userId } : { kitchenUserId: dono.kitchenUserId };

  await prisma.$transaction([
    prisma.accessToken.updateMany({
      where: { ...where, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.accessToken.create({
      data: { ...where, tokenHash: hashDeToken(token), kind: tipo, expiresAt: expiraEm },
    }),
  ]);

  return { token, expiraEm };
}
