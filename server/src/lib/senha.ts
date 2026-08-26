import argon2 from 'argon2';

/**
 * Confere a senha sem estourar quando o hash não é um hash.
 *
 * `argon2.verify` LANÇA — não devolve `false` — se a string guardada não for um
 * hash argon2 válido. Isso vira 500 no login, que é errado em dois sentidos:
 * responde erro de sistema para uma tentativa de credencial, e vira alerta no
 * Sentry para algo que não é falha nenhuma.
 *
 * Acontece de verdade: uma conta recém-criada guarda um marcador de "sem senha
 * utilizável" até a pessoa definir a dela pelo link de primeiro acesso. Tentar
 * entrar antes disso é exatamente uma credencial inválida — 401, não 500.
 */
export async function senhaConfere(hashGuardado: string, senha: string): Promise<boolean> {
  try {
    return await argon2.verify(hashGuardado, senha);
  } catch {
    return false;
  }
}
