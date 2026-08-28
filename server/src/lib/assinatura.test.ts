import { describe, it, expect } from 'vitest';
import type { AssinaturaStatus } from '@mq/shared';
import { efeitoDoEvento, aplicarEfeito, aoAbrirCheckout, contaDeveVirar } from './assinatura.js';

/**
 * As regras da assinatura, sem banco e sem rede.
 *
 * Cada bloco abaixo cobre um jeito concreto de perder dinheiro ou de trancar
 * cliente do lado de fora — não é varredura de enum por completude.
 */

describe('efeitoDoEvento', () => {
  it('dinheiro entrando ativa', () => {
    expect(efeitoDoEvento('PAYMENT_CONFIRMED').tipo).toBe('ativar');
    expect(efeitoDoEvento('PAYMENT_RECEIVED').tipo).toBe('ativar');
    expect(efeitoDoEvento('CHECKOUT_PAID').tipo).toBe('ativar');
  });

  it('vencimento, estorno e chargeback atrasam', () => {
    expect(efeitoDoEvento('PAYMENT_OVERDUE').tipo).toBe('atrasar');
    expect(efeitoDoEvento('PAYMENT_REFUNDED').tipo).toBe('atrasar');
    expect(efeitoDoEvento('PAYMENT_REVERSED').tipo).toBe('atrasar');
    expect(efeitoDoEvento('PAYMENT_CHARGEBACK_REQUESTED').tipo).toBe('atrasar');
  });

  /**
   * O FALSO POSITIVO MAIS CARO DO SISTEMA.
   *
   * PAYMENT_CREATED dispara quando o Asaas GERA a mensalidade do mês seguinte,
   * antes de qualquer vencimento. Se um dia alguém "melhorar" isto pra
   * `atrasar`, todo cliente adimplente é suspenso no dia em que a próxima
   * fatura nasce — todos de uma vez, e por estar tudo certo.
   */
  it('cobranca GERADA nao suspende ninguem', () => {
    expect(efeitoDoEvento('PAYMENT_CREATED').tipo).toBe('ignorar');
  });

  it('assinatura criada ainda nao e assinatura paga', () => {
    // Quem ativa é o pagamento. Ativar aqui daria acesso a quem preencheu o
    // checkout e abandonou na tela do cartão.
    expect(efeitoDoEvento('SUBSCRIPTION_CREATED').tipo).toBe('ignorar');
  });

  it('assinatura apagada ou inativada encerra', () => {
    expect(efeitoDoEvento('SUBSCRIPTION_DELETED').tipo).toBe('encerrar');
    expect(efeitoDoEvento('SUBSCRIPTION_INACTIVATED').tipo).toBe('encerrar');
  });

  /**
   * A fila do Asaas para depois de 15 falhas seguidas, e os eventos somem em
   * 14 dias. Lançar num evento novo derrubaria a cobrança inteira, calada.
   */
  it('evento desconhecido e ignorado, nao lancado', () => {
    const efeito = efeitoDoEvento('PAYMENT_INVENTADO_EM_2027');
    expect(efeito.tipo).toBe('ignorar');
    // O motivo é gravado: evento ignorado em silêncio vira dúvida no suporte.
    expect(efeito).toHaveProperty('motivo', expect.stringContaining('desconhecido'));
  });
});

describe('aplicarEfeito', () => {
  const ativar = { tipo: 'ativar' } as const;
  const atrasar = { tipo: 'atrasar' } as const;
  const encerrar = { tipo: 'encerrar' } as const;
  const desistir = { tipo: 'desistir' } as const;

  it('pagamento ativa venha de onde vier', () => {
    const partidas: AssinaturaStatus[] = ['nenhuma', 'aguardando', 'atrasada', 'encerrada'];
    for (const de of partidas) {
      expect(aplicarEfeito(de, ativar)).toBe('ativa');
    }
  });

  it('encerrada nao ressuscita como atrasada', () => {
    // Cobrança velha de assinatura encerrada ainda gera OVERDUE. Voltar pra
    // `atrasada` faria a tela oferecer "regularize" pra quem já saiu.
    expect(aplicarEfeito('encerrada', atrasar)).toBe('encerrada');
    expect(aplicarEfeito('ativa', atrasar)).toBe('atrasada');
  });

  it('encerrar vale de qualquer estado', () => {
    expect(aplicarEfeito('ativa', encerrar)).toBe('encerrada');
    expect(aplicarEfeito('atrasada', encerrar)).toBe('encerrada');
  });

  /**
   * O checkout expirado só desfaz uma ESPERA. Deixá-lo cair pra `nenhuma` a
   * partir de `atrasada` apagaria a inadimplência: bastaria abrir um checkout,
   * não pagar, esperar uma hora e a conta voltaria a escrever.
   */
  it('checkout expirado nao limpa inadimplencia', () => {
    expect(aplicarEfeito('aguardando', desistir)).toBe('nenhuma');
    expect(aplicarEfeito('atrasada', desistir)).toBe('atrasada');
    expect(aplicarEfeito('encerrada', desistir)).toBe('encerrada');
    expect(aplicarEfeito('ativa', desistir)).toBe('ativa');
  });

  it('ignorar nao mexe em nada', () => {
    const efeito = { tipo: 'ignorar', motivo: 'qualquer' } as const;
    expect(aplicarEfeito('ativa', efeito)).toBe('ativa');
    expect(aplicarEfeito('atrasada', efeito)).toBe('atrasada');
  });
});

describe('aoAbrirCheckout', () => {
  it('so marca espera quem nao tinha nada', () => {
    expect(aoAbrirCheckout('nenhuma')).toBe('aguardando');
  });

  it('inadimplente continua inadimplente ate o pagamento cair', () => {
    // O estado tem que refletir o que está PAGO, não o que foi tentado.
    expect(aoAbrirCheckout('atrasada')).toBe('atrasada');
    expect(aoAbrirCheckout('encerrada')).toBe('encerrada');
  });
});

describe('contaDeveVirar', () => {
  it('pagando em dia libera a conta', () => {
    expect(contaDeveVirar('ativa')).toBe('ativa');
  });

  /**
   * A regra que evita a armadilha: `cancelada` faz o auth-dono responder 403 no
   * LOGIN. Quem cancelasse a assinatura ficaria trancado do lado de fora — sem
   * ver o que tinha e, pior, sem conseguir assinar de novo.
   */
  it('cancelar suspende, NUNCA cancela a conta', () => {
    expect(contaDeveVirar('encerrada')).toBe('suspensa');
    expect(contaDeveVirar('atrasada')).toBe('suspensa');
    expect(contaDeveVirar('encerrada')).not.toBe('cancelada');
  });

  /**
   * Conta em trial e conta criada na mão vivem `ativa` sem assinatura nenhuma.
   * Derrubá-las por isso seria cortar justamente quem ainda está sendo
   * conquistado.
   */
  it('quem nunca assinou nao e tocado', () => {
    expect(contaDeveVirar('nenhuma')).toBeNull();
    expect(contaDeveVirar('aguardando')).toBeNull();
  });
});
