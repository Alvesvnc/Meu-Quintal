import { useSyncExternalStore } from 'react';

/**
 * "Agora" que re-renderiza sozinho.
 *
 * O PROBLEMA QUE ISTO RESOLVE: chamar `Date.now()` no corpo do componente é
 * render impuro. O React não sabe que o valor mudou, então o "há 3 min" fica
 * congelado até que outra coisa qualquer force um re-render — e some por
 * completo sob render concorrente, em que o mesmo render pode ser executado
 * duas vezes e descartado. Numa fila de cozinha, um cronômetro que não anda é
 * pior que nenhum: passa confiança falsa.
 *
 * UM TIMER PARA TODO MUNDO: a fila do restaurante mostra dezenas de cards ao
 * mesmo tempo. Um `setInterval` por card seriam dezenas de timers acordando o
 * dispositivo fora de sincronia. Aqui há um único intervalo no módulo, e todos
 * os componentes se inscrevem nele — quando o último se desinscreve, o timer
 * morre.
 */

/**
 * De quanto em quanto tempo o relógio anda.
 *
 * 20s e não 60s porque o valor exibido é em minutos: com um tick de 1 min, a
 * virada de "2 min" para "3 min" atrasaria até 59 segundos.
 */
const INTERVALO_MS = 20_000;

let agora = Date.now();
const ouvintes = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function avisarTodos() {
  agora = Date.now();
  for (const ouvinte of ouvintes) ouvinte();
}

/**
 * Navegador em aba oculta estrangula timers (chega a 1x/min ou menos). Ao
 * voltar, o relógio estaria atrasado — o tablet da cozinha ficaria mostrando o
 * tempo de quando alguém saiu da aba. Este resync corrige na hora.
 */
function aoVoltarPraAba() {
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
    avisarTodos();
  }
}

function inscrever(aoMudar: () => void): () => void {
  ouvintes.add(aoMudar);

  if (timer === null) {
    // Ressincroniza ao acordar. `agora` foi fixado quando o MÓDULO carregou;
    // sem isto, um componente montado bem depois (rota aberta mais tarde, ou
    // depois de todos desmontarem) começaria calculando a partir de um
    // instante velho, e só corrigiria no primeiro tique — até 20s de atraso
    // logo no primeiro quadro.
    agora = Date.now();
    timer = setInterval(avisarTodos, INTERVALO_MS);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', aoVoltarPraAba);
    }
  }

  return () => {
    ouvintes.delete(aoMudar);
    if (ouvintes.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', aoVoltarPraAba);
      }
    }
  };
}

/**
 * PRECISA devolver o valor guardado, nunca `Date.now()` direto: o React compara
 * snapshots por identidade e um valor novo a cada chamada vira loop infinito de
 * render.
 */
function lerAgora(): number {
  return agora;
}

/** Timestamp atual, atualizado a cada 20s. */
export function useAgora(): number {
  return useSyncExternalStore(inscrever, lerAgora, lerAgora);
}

/**
 * Minutos inteiros decorridos desde `inicio`. `null` se não houver início.
 *
 * Nunca devolve negativo: relógio do cliente adiantado em relação ao servidor
 * produziria "há -2 min", que é pior do que arredondar para zero.
 */
export function useMinutosDesde(inicio: string | number | Date | null | undefined): number | null {
  const agoraMs = useAgora();
  if (inicio == null) return null;

  const inicioMs = inicio instanceof Date ? inicio.getTime() : new Date(inicio).getTime();
  if (Number.isNaN(inicioMs)) return null;

  return Math.max(0, Math.floor((agoraMs - inicioMs) / 60_000));
}
