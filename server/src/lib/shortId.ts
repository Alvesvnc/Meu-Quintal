/**
 * Gera shortId de 5 digitos (10000..99999) pra exibir pro cliente/restaurante.
 * Em caso de colisao (UNIQUE constraint), tenta novamente — taxa de colisao
 * em MVP eh baixissima (90k combinacoes vs pedidos por dia).
 */
export function generateShortId(): string {
  return String(Math.floor(10000 + Math.random() * 89999));
}
