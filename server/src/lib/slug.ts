/**
 * Slug de cozinha a partir do nome que o dono digitou.
 *
 * O slug é o endereço da cozinha dentro do quintal — entra em URL e em QR
 * impresso. Por isso é gerado uma vez, no aceite do convite, e não muda depois
 * (o perfil da cozinha nem oferece o campo).
 */

/** "Cantina da Rosa" -> "cantina-da-rosa" */
export function slugificar(texto: string): string {
  const base = texto
    .normalize('NFD')
    // Tira acento sem tirar a letra: "Açaí" vira "acai", não "aa".
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');

  // Nome só de emoji ou só de pontuação sobraria vazio, e slug vazio faria a
  // URL da cozinha ser a do quintal.
  return base || 'cozinha';
}

/**
 * Primeiro slug livre da lista, testando `nome`, `nome-2`, `nome-3`…
 *
 * `Kitchen.slug` é único POR ESPAÇO, então duas cozinhas homônimas em quintais
 * diferentes convivem — mas duas no mesmo não.
 */
export function slugLivre(desejado: string, ocupados: Set<string>): string {
  const base = slugificar(desejado);
  if (!ocupados.has(base)) return base;

  for (let i = 2; i < 100; i++) {
    const tentativa = `${base}-${i}`;
    if (!ocupados.has(tentativa)) return tentativa;
  }
  // Cem "Pastelaria" no mesmo quintal é cenário que não existe; ainda assim,
  // devolver algo único é melhor que estourar no aceite do convite.
  return `${base}-${Date.now().toString(36)}`;
}
