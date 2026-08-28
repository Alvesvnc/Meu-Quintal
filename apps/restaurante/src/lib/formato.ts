import { API_BASE } from '../api/client';

/** R$ 1.234,56 */
export function fmtBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  });
}

/** "20:14" a partir de um ISO do servidor. */
export function fmtHora(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Endereço completo de uma foto do cardápio.
 *
 * O servidor devolve caminho relativo (`/api/fotos/…`) porque não sabe em que
 * domínio ele está publicado. Em desenvolvimento o app roda na 5173 e a API na
 * 3001, então sem este prefixo o `<img>` procuraria a foto no próprio app e
 * receberia o `index.html` de volta.
 */
export function urlDaFoto(caminho: string): string {
  return caminho.startsWith('http') ? caminho : `${API_BASE}${caminho}`;
}
