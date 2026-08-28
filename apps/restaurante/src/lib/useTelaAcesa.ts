import { useEffect } from 'react';

/**
 * Segura a tela acesa enquanto a fila estiver na frente.
 *
 * A PushScreen mandava fazer isso NA MÃO: "deixe o aparelho ligado na fila,
 * com a tela acesa". Instrução que depende de alguém lembrar não sobrevive a
 * um turno cheio — e quando a tela apaga, o pedido novo toca o sino num
 * aparelho que ninguém está olhando.
 *
 * O Wake Lock resolve sem pedir permissão nenhuma: não há prompt, não há
 * ajuste de sistema, e some se a aba sair da frente.
 *
 * ONDE NÃO FUNCIONA, NÃO QUEBRA NADA. Precisa de HTTPS (ou localhost) e de
 * suporte do navegador — Chrome no Android, Safari do iOS 16.4 pra cima,
 * Chrome/Edge no desktop. Fora disso o `if` de baixo sai calado e o
 * comportamento é o de antes. Em `vite dev` por IP da rede (http://) também
 * não vale: contexto inseguro.
 */
export function useTelaAcesa() {
  useEffect(() => {
    if (!('wakeLock' in navigator)) return;

    let atual: WakeLockSentinel | null = null;
    // O efeito pode ser desmontado enquanto o `request` ainda está no ar — no
    // StrictMode isso acontece SEMPRE, já na primeira montagem. Sem esta
    // marca, o lock concedido depois da limpeza ficaria pendurado sem ninguém
    // pra soltar.
    let vivo = true;

    async function segurar() {
      if (!vivo || document.visibilityState !== 'visible') return;
      try {
        const sentinela = await navigator.wakeLock.request('screen');
        if (!vivo) {
          void sentinela.release();
          return;
        }
        atual = sentinela;
      } catch {
        // Recusa é normal e não é erro: bateria baixa, economia de energia,
        // política do aparelho. Não há o que tentar de novo nem o que avisar —
        // a tela volta a apagar sozinha, que é o mundo de antes.
      }
    }

    /*
      O NAVEGADOR SOLTA O LOCK SOZINHO quando a aba deixa de estar visível, e
      NÃO devolve na volta. Sem este ouvinte, bastava alguém trocar de app uma
      vez — ou o aparelho bloquear — pra fila voltar a apagar pelo resto do
      turno, sem nenhum sinal de que parou de funcionar.
    */
    function aoMudarVisibilidade() {
      if (document.visibilityState === 'visible') void segurar();
    }

    void segurar();
    document.addEventListener('visibilitychange', aoMudarVisibilidade);

    return () => {
      vivo = false;
      document.removeEventListener('visibilitychange', aoMudarVisibilidade);
      void atual?.release();
      atual = null;
    };
  }, []);
}
