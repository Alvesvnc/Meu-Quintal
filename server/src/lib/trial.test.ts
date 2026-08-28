import { describe, it, expect, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { varrerTrialsVencidos, fimDoTrial, trialLigado } from './trial.js';

/**
 * Varredura de teste grátis vencido.
 *
 * Boa parte do que importa aqui está no `where` da consulta — quem NÃO pode ser
 * suspenso é mais importante que quem pode. Por isso os testes olham o filtro
 * que a função monta, e não só o resultado: é o mesmo motivo pelo qual o
 * `prismaMock` existe (ver o cabeçalho dele).
 *
 * O comportamento do Postgres com NULL é conferido separado, contra banco de
 * verdade — mock nenhum prova isso.
 */

const CONTA = { id: 'acc-1', slug: 'quintal-teste', trialEndsAt: new Date('2026-07-01') };

function fake(contas = [CONTA], count = 1) {
  const findMany = vi.fn().mockResolvedValue(contas);
  const updateMany = vi.fn().mockResolvedValue({ count });
  const prisma = { account: { findMany, updateMany } } as unknown as PrismaClient;
  return { prisma, findMany, updateMany };
}

const filtro = (findMany: ReturnType<typeof vi.fn>) => findMany.mock.calls[0][0].where;

describe('varrerTrialsVencidos', () => {
  it('suspende quem passou do prazo sem assinar', async () => {
    const { prisma, updateMany } = fake();

    const r = await varrerTrialsVencidos(prisma, new Date('2026-08-26'));

    expect(r).toEqual({ encontradas: 1, suspensas: 1 });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'acc-1', status: 'ativa' },
      data: { status: 'suspensa' },
    });
  });

  /**
   * `trialEndsAt` é nullable, e null quer dizer "esta conta não tem teste" — o
   * caso de quem foi cadastrado direto como pagante. Sem o `not: null`, basta
   * alguém remontar o filtro pra "sem trial" virar "venceu em 1970", e o
   * primeiro a ser suspenso seria justamente quem paga.
   */
  it('exige trialEndsAt PREENCHIDO, nao so vencido', async () => {
    const { prisma, findMany } = fake();

    await varrerTrialsVencidos(prisma, new Date('2026-08-26'));

    expect(filtro(findMany).trialEndsAt).toEqual({
      not: null,
      lt: new Date('2026-08-26'),
    });
  });

  /**
   * Cancelar é decisão humana deliberada. Tarefa de fundo não escreve por cima
   * dela — nem aqui, nem no webhook do provedor.
   */
  it('so olha conta ATIVA: nao toca em suspensa nem em cancelada', async () => {
    const { prisma, findMany } = fake();

    await varrerTrialsVencidos(prisma, new Date('2026-08-26'));

    expect(filtro(findMany).status).toBe('ativa');
  });

  it('quem tem assinatura em dia fica de fora', async () => {
    const { prisma, findMany } = fake();

    await varrerTrialsVencidos(prisma, new Date('2026-08-26'));

    // Só entra quem não tem assinatura, ou tem uma que não está pagando.
    expect(filtro(findMany).OR).toEqual([
      { assinatura: { is: null } },
      { assinatura: { status: { not: 'ativa' } } },
    ]);
  });

  /**
   * Entre a leitura e a escrita, o webhook do provedor pode ter confirmado um
   * pagamento. A condição no `where` do update é o que impede suspender quem
   * acabou de pagar — e é a mesma trava que faz a varredura ser segura rodando
   * em várias réplicas.
   */
  it('nao conta como suspensa quando alguem chegou antes', async () => {
    const { prisma } = fake([CONTA], 0);

    const r = await varrerTrialsVencidos(prisma, new Date('2026-08-26'));

    expect(r).toEqual({ encontradas: 1, suspensas: 0 });
  });

  it('sem ninguem vencido, nao escreve nada', async () => {
    const { prisma, updateMany } = fake([]);

    const r = await varrerTrialsVencidos(prisma, new Date('2026-08-26'));

    expect(r).toEqual({ encontradas: 0, suspensas: 0 });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('tem teto por rodada, pra represamento nao travar o processo', async () => {
    const { prisma, findMany } = fake();

    await varrerTrialsVencidos(prisma, new Date('2026-08-26'));

    expect(findMany.mock.calls[0][0].take).toBe(200);
  });
});

// ─── Ligar e desligar o teste ───────────────────────────────────────────────

describe('fimDoTrial', () => {
  const AGORA = new Date('2026-08-26T12:00:00Z');

  it('devolve a data N dias a frente', () => {
    expect(fimDoTrial(AGORA, 7)).toEqual(new Date('2026-09-02T12:00:00Z'));
    expect(fimDoTrial(AGORA, 14)).toEqual(new Date('2026-09-09T12:00:00Z'));
  });

  /**
   * TRIAL_DIAS=0 e o desligamento. A conta nasce com o teste JA VENCIDO, entao
   * a primeira varredura a suspende e a pessoa precisa assinar pra alterar
   * qualquer coisa — o modelo "paga pra comecar".
   *
   * Repare que isto NAO devolve null: null na coluna quer dizer outra coisa
   * ("nunca e suspensa por teste"), e confundir os dois daria acesso vitalicio
   * de graca justamente quando o teste estivesse desligado.
   */
  it('zero dias = teste ja vencido no instante da criacao', () => {
    expect(fimDoTrial(AGORA, 0)).toEqual(AGORA);
    expect(fimDoTrial(AGORA, 0)).not.toBeNull();
  });

  it('a data nasce dentro da janela que a varredura pega', async () => {
    // Amarra as duas pontas: com o teste desligado, a conta criada agora tem
    // que casar com o filtro da varredura um minuto depois.
    const nascimento = fimDoTrial(AGORA, 0);
    const umMinutoDepois = new Date(AGORA.getTime() + 60_000);
    expect(nascimento.getTime()).toBeLessThan(umMinutoDepois.getTime());
  });
});

describe('trialLigado', () => {
  it('zero desliga, qualquer positivo liga', () => {
    expect(trialLigado(0)).toBe(false);
    expect(trialLigado(1)).toBe(true);
    expect(trialLigado(7)).toBe(true);
  });
});
