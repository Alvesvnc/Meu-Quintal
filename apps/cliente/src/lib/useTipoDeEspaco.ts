import { useQuintal } from '../api/hooks';

/**
 * Praça de alimentação ou restaurante único?
 *
 * Muda a linguagem e a navegação: num restaurante único não existe "quintal"
 * para onde voltar — a lista de cozinhas é pulada, então um botão "voltar pro
 * quintal" levaria a uma tela que redireciona de volta, e nada aconteceria.
 *
 * Usa a mesma query da tela inicial, que o react-query já tem em cache. Não
 * custa requisição nova.
 */
export function useRestauranteUnico(): boolean {
  const { data } = useQuintal();
  return data?.space.tipo === 'restaurante-unico';
}
