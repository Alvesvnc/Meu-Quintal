import type { InscreverPushBody } from '@mq/shared';

/**
 * O lado do navegador do aviso com o app fechado.
 *
 * Aqui só se conversa com o navegador — pedir permissão, inscrever no serviço
 * de push, cancelar. Quem fala com a nossa API são os hooks em `api/hooks.ts`;
 * quem RECEBE o aviso é o service worker, em `src/sw.ts`. Três arquivos porque
 * são três contextos de execução diferentes, não por gosto de dividir.
 */

/**
 * Três coisas precisam existir, e nem sempre existem juntas.
 *
 * `Notification` some em contexto inseguro (http:// que não seja localhost) e
 * `PushManager` não existe no iOS enquanto o app não estiver instalado na tela
 * de início — no Safari de aba comum ele simplesmente não é declarado. Por isso
 * a checagem é por capacidade, nunca por navegador.
 */
export function pushSuportado(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** O que o navegador já decidiu. `denied` é ponto sem retorno pela tela. */
export function permissaoAtual(): NotificationPermission | null {
  return pushSuportado() ? Notification.permission : null;
}

/** A inscrição deste aparelho, se já houver. */
export async function inscricaoAtual(): Promise<PushSubscription | null> {
  if (!pushSuportado()) return null;
  // Aqui o erro é engolido de propósito: esta função só responde "este aparelho
  // já está inscrito?" pra tela decidir qual botão mostrar. Sem service worker,
  // a resposta honesta é "não" — e quem explica o porquê é o `inscrever`, que
  // roda no clique e pode falar com a pessoa.
  try {
    const registro = await servicoRegistrado();
    return registro.pushManager.getSubscription();
  } catch {
    return null;
  }
}

/**
 * A chave VAPID viaja em base64url e o `subscribe` exige bytes.
 *
 * Não é conversão decorativa: passar a string direto faz o navegador recusar
 * com "InvalidCharacterError", que não diz nada sobre o que está errado.
 */
function chaveParaBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const preenchimento = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + preenchimento).replace(/-/g, '+').replace(/_/g, '/');
  const cru = atob(base64);
  // O ArrayBuffer explicito nao e enfeite: `new Uint8Array(n)` tem tipo
  // `Uint8Array<ArrayBufferLike>`, que inclui SharedArrayBuffer e por isso nao
  // serve como `BufferSource` no `subscribe`.
  const bytes = new Uint8Array(new ArrayBuffer(cru.length));
  for (let i = 0; i < cru.length; i++) bytes[i] = cru.charCodeAt(i);
  return bytes;
}

/** Erro com mensagem já escrita pra tela — a UI não traduz nada. */
export class PushRecusado extends Error {}

/**
 * O service worker, ou um erro — nunca uma espera infinita.
 *
 * `navigator.serviceWorker.ready` é uma promessa que resolve quando existe um
 * worker ativo. Quando NÃO existe, ela não rejeita e não expira: fica pendurada
 * calada, para sempre.
 *
 * Isso já custou tempo. Em `vite dev` o SW não era registrado, e o efeito era o
 * botão de "ligar o aviso" girando eternamente — DEPOIS de a pessoa já ter
 * concedido a permissão de notificação, que é o pior momento pra falhar sem
 * dizer nada. O `devOptions` do vite.config.ts resolveu aquele caso; o prazo
 * aqui cobre todos os outros (registro que falhou, worker que morreu, aparelho
 * que bloqueia service worker).
 */
async function servicoRegistrado(): Promise<ServiceWorkerRegistration> {
  const PRAZO_MS = 10_000;

  let expirar: ReturnType<typeof setTimeout> | undefined;
  const prazo = new Promise<never>((_, rejeitar) => {
    expirar = setTimeout(
      () =>
        rejeitar(
          new PushRecusado(
            'O app não terminou de se preparar pra receber avisos. Recarregue a página e tente de novo.',
          ),
        ),
      PRAZO_MS,
    );
  });

  try {
    return await Promise.race([navigator.serviceWorker.ready, prazo]);
  } finally {
    clearTimeout(expirar);
  }
}

/**
 * Pede a permissão e inscreve este aparelho. Devolve o corpo pro servidor.
 *
 * A ORDEM IMPORTA: a permissão vem primeiro e precisa sair de um clique. O
 * navegador só mostra o pedido se houver gesto do usuário na pilha; chamar isto
 * dentro de um `useEffect` faz a permissão ser negada sem nada aparecer.
 */
export async function inscrever(chavePublica: string): Promise<InscreverPushBody> {
  if (!pushSuportado()) {
    throw new PushRecusado('Este aparelho não aceita aviso com o app fechado.');
  }

  const permissao = await Notification.requestPermission();
  if (permissao !== 'granted') {
    throw new PushRecusado(
      'O navegador bloqueou o aviso. Libere as notificações deste site nos ajustes e tente de novo.',
    );
  }

  const registro = await servicoRegistrado();

  /*
    Reaproveitar a inscrição existente, se houver.

    `subscribe` com uma chave DIFERENTE da inscrição atual lança
    `InvalidStateError` em vez de trocar. Acontece de verdade quando o par VAPID
    do servidor muda: sem isto, o botão passaria a dar erro pra sempre e a única
    saída seria limpar os dados do site.
  */
  const existente = await registro.pushManager.getSubscription();
  if (existente) await existente.unsubscribe();

  const inscricao = await registro.pushManager.subscribe({
    // Obrigatório em todos os navegadores atuais: nada de push silencioso.
    userVisibleOnly: true,
    applicationServerKey: chaveParaBytes(chavePublica),
  });

  const json = inscricao.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!json.endpoint || !p256dh || !auth) {
    throw new PushRecusado('O navegador devolveu uma inscrição incompleta.');
  }

  return { endpoint: json.endpoint, p256dh, auth };
}

/**
 * Cancela no navegador. Devolve o endpoint pra apagar no servidor.
 *
 * `null` quando não havia inscrição — não é erro, é o estado que a pessoa
 * queria alcançar.
 */
export async function desinscrever(): Promise<string | null> {
  const inscricao = await inscricaoAtual();
  if (!inscricao) return null;
  const { endpoint } = inscricao;
  await inscricao.unsubscribe();
  return endpoint;
}
