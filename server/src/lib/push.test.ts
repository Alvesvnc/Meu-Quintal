import { describe, it, expect, beforeEach, vi } from 'vitest';
import { criarPrismaMock, type PrismaMock } from '../test/prismaMock.js';

const prismaMock: PrismaMock = criarPrismaMock();
vi.mock('./prisma.js', () => ({ prisma: prismaMock }));

/*
  ESTE ARQUIVO NÃO LIGA O PUSH, e é esse o assunto.

  A suíte roda com VAPID vazio (vitest.setup.ts) — o mesmo estado de toda
  instalação que ainda não configurou push, que hoje são todas. O que se prova
  aqui é que esse estado é INERTE: nada de rede, nada de banco, nada de exceção
  subindo pro caminho de criar pedido.

  As rotas com push ligado estão em modules/push.test.ts, que sobrescreve o env
  antes do import.
*/
const { pushAtivo, chavePublica, avisarCozinha, apagarInscricoesDe } = await import('./push.js');

const AVISO = {
  titulo: 'Pedido novo',
  corpo: 'Mesa 4 · 2 itens',
  tag: 'pedido-A1B2',
  url: '/fila',
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(prismaMock, criarPrismaMock());
});

describe('push desligado (sem par VAPID)', () => {
  it('pushAtivo e falso', () => {
    expect(pushAtivo()).toBe(false);
  });

  it('nao ha chave publica pra oferecer', () => {
    expect(chavePublica()).toBeNull();
  });

  it('avisarCozinha nao faz nada e nao lanca', async () => {
    await expect(avisarCozinha('k1', 'pedido-novo', AVISO)).resolves.toBe(0);
  });

  it('nem chega a consultar o banco', async () => {
    await avisarCozinha('k1', 'pedido-novo', AVISO);

    // A saida antecipada importa: `avisarCozinha` roda em TODA criacao de
    // pedido. Se ela fosse ao banco procurar aparelhos que nao existem, o
    // caminho mais quente do sistema ganharia uma query por pedido em troca
    // de nada.
    expect(prismaMock.pushSubscription.findMany).not.toHaveBeenCalled();
  });
});

describe('apagarInscricoesDe', () => {
  it('apaga por usuario, na transacao que recebeu', async () => {
    const tx = criarPrismaMock();
    tx.pushSubscription.deleteMany.mockResolvedValue({ count: 2 });

    // A assinatura recebe a transacao de proposito: quem chama esta trocando a
    // senha, e as duas coisas precisam valer juntas. Passar o `prisma` global
    // aqui deixaria a pessoa com a senha nova e o push antigo se o commit
    // falhasse depois.
    const apagados = await apagarInscricoesDe(
      tx as unknown as Parameters<typeof apagarInscricoesDe>[0],
      'ku1',
    );

    expect(apagados).toBe(2);
    expect(tx.pushSubscription.deleteMany).toHaveBeenCalledWith({ where: { userId: 'ku1' } });
    // O global NAO pode ter sido tocado — seria fora da transacao.
    expect(prismaMock.pushSubscription.deleteMany).not.toHaveBeenCalled();
  });
});
