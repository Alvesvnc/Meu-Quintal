/**
 * Beep curto sintetizado via Web Audio API.
 * Sem necessidade de arquivo de audio.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    // Safari antigo so expoe o construtor com prefixo. Declarar a forma e
    // melhor que `as any`: o resto do arquivo continua checado.
    const janela = window as Window & { webkitAudioContext?: typeof AudioContext };
    const C = window.AudioContext ?? janela.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  // Resume se foi suspended (browsers exigem user gesture)
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

/** Beep curto "ping" — som de pedido novo. */
export function playOrderNewSound() {
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;

  // Dois tons (ding-dong) curtos
  [880, 660].forEach((freq, i) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;

    const start = now + i * 0.18;
    const end = start + 0.16;

    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.18, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, end);

    osc.connect(gain).connect(c.destination);
    osc.start(start);
    osc.stop(end);
  });
}

/** Vibracao curta (Android). iOS Safari ignora. */
export function buzzShort() {
  if ('vibrate' in navigator) navigator.vibrate(50);
}
