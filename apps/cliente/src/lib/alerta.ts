/**
 * Alerta sonoro e tátil para quando a cozinha propõe uma alteração.
 *
 * O cliente está à mesa, conversando, com o celular deitado ao lado. Uma
 * mudança silenciosa na tela passa despercebida — e a proposta expira em 5
 * minutos. Som e vibração são o que fazem alguém olhar.
 *
 * Nada aqui pede permissão ao usuário nem depende de service worker: funciona
 * em qualquer aparelho com a aba aberta. Web Push (que alcançaria a tela
 * apagada) fica para depois — no iOS ele exige instalar o site na tela de
 * início, o que ninguém faz no meio de uma refeição.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const janela = window as Window & { webkitAudioContext?: typeof AudioContext };
    const C = window.AudioContext ?? janela.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  return ctx;
}

/**
 * Dois toques curtos, descendentes. Deliberadamente diferente de um "ok":
 * isto é um pedido de atenção, não uma confirmação.
 */
export function tocarAlerta(): void {
  const audio = getCtx();
  if (!audio) return;

  // O navegador suspende o contexto até haver interação do usuário. Como a
  // pessoa já tocou na tela pra chegar até aqui, normalmente retoma.
  if (audio.state === 'suspended') void audio.resume();

  const agora = audio.currentTime;
  const notas = [
    { hz: 880, em: 0 },
    { hz: 660, em: 0.18 },
  ];

  for (const nota of notas) {
    const osc = audio.createOscillator();
    const ganho = audio.createGain();

    osc.type = 'sine';
    osc.frequency.value = nota.hz;

    // Envelope com ataque e queda: um ganho ligado no talo estala no alto-falante.
    ganho.gain.setValueAtTime(0, agora + nota.em);
    ganho.gain.linearRampToValueAtTime(0.25, agora + nota.em + 0.01);
    ganho.gain.exponentialRampToValueAtTime(0.001, agora + nota.em + 0.15);

    osc.connect(ganho);
    ganho.connect(audio.destination);
    osc.start(agora + nota.em);
    osc.stop(agora + nota.em + 0.16);
  }
}

/**
 * Vibração em padrão curto-pausa-curto.
 *
 * Só o Android responde: o iOS não expõe a Vibration API. É por isso que o som
 * e o visual não podem depender disto.
 */
export function vibrar(): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate([120, 80, 120]);
  } catch {
    // Alguns navegadores lançam quando a aba não está em foco. Silenciar é o
    // certo: falhar a vibração não pode derrubar o alerta visual.
  }
}

/** Som + vibração juntos. */
export function alertar(): void {
  tocarAlerta();
  vibrar();
}
