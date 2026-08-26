import type { MotivoCancelamento } from '@mq/shared';

/**
 * A escolha do motivo está completa? Usado para habilitar o botão de enviar.
 *
 * Arquivo próprio, e não junto do SeletorDeMotivo: exportar função ao lado de
 * componente quebra o Fast Refresh — cada salvamento remonta a tela e o
 * formulário meio preenchido se perde.
 *
 * Espelha a mesma regra do servidor (`cancelOrderSchema`): "outro" exige texto.
 * A validação de verdade é a do servidor; esta existe só para não deixar o
 * operador clicar num botão que vai dar 400.
 */
export function motivoCompleto(
  motivo: MotivoCancelamento | null,
  texto: string,
): motivo is MotivoCancelamento {
  if (!motivo) return false;
  if (motivo === 'outro') return texto.trim().length >= 3;
  return true;
}
