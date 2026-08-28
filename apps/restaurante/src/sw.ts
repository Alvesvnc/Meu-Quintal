/// <reference lib="webworker" />
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import type { AvisoPushPayload } from '@mq/shared';

/**
 * Service worker do app da cozinha.
 *
 * ─── POR QUE ESTE ARQUIVO EXISTE ────────────────────────────────────────────
 *
 * Até o push, o plugin GERAVA o service worker sozinho (`generateSW`) e não
 * havia o que escrever. Aviso com o app fechado mudou isso: quem recebe o push
 * é o service worker, e ele precisa de código nosso pra decidir o que fazer.
 *
 * O preço de escrever à mão é ter que repetir aqui o que o plugin fazia de
 * graça — o precache e o fallback de navegação, logo abaixo. Some qualquer um
 * dos dois e o app instalado para de abrir offline, sem nada avisar.
 *
 * ─── ISTO NÃO É O NAVEGADOR ─────────────────────────────────────────────────
 *
 * Não há `window`, `document` nem React aqui. É outro contexto de execução, com
 * outra biblioteca de tipos — por isso o `tsconfig.sw.json` separado: `DOM` e
 * `WebWorker` declaram os mesmos nomes com formas diferentes e não convivem no
 * mesmo programa.
 */

declare const self: ServiceWorkerGlobalScope;

// ─── O shell, precacheado ───────────────────────────────────────────────────
// `self.__WB_MANIFEST` é substituído no build pela lista de arquivos com hash.
// Sem esta linha o plugin recusa o build, e é bom que recuse.
const manifesto = self.__WB_MANIFEST;
precacheAndRoute(manifesto);

/*
  Navegação responde com o index.html: as rotas são do React Router, não do
  disco. A denylist tira dessa regra o que NÃO é tela — em desenvolvimento a
  API e o socket chegam pela mesma origem via proxy do Vite, e sem isto o
  handshake do Socket.io receberia HTML no lugar do upgrade.

  Continua NÃO havendo cache de /api em lugar nenhum, e isso é deliberado: fila
  cacheada mostra pedido que já saiu e a cozinha monta o prato de novo.

  ─── O `if` NÃO É DEFENSIVA SOLTA ─────────────────────────────────────────

  Em desenvolvimento o manifesto vem VAZIO: não há build, então não há nada
  com hash pra precachear. E `createHandlerBoundToURL` LANÇA quando a URL
  pedida não está no precache — no meio da avaliação do script, o que derruba
  o service worker inteiro antes de ele registrar.

  O sintoma disso é cruel: nenhum erro de registro, nenhum service worker, e
  `navigator.serviceWorker.ready` pendurado pra sempre — que aparece lá na
  frente como o botão de ligar o aviso batendo no prazo de lib/push.ts.

  Sem precache, quem serve a navegação é o próprio Vite, que é o certo em dev.
*/
if (manifesto.length > 0) {
  registerRoute(
    new NavigationRoute(createHandlerBoundToURL('index.html'), {
      denylist: [/^\/api\//, /^\/socket\.io\//, /^\/uploads\//],
    }),
  );
}

// ─── Assumir o controle sem esperar ─────────────────────────────────────────
// Equivale ao que o `registerType: 'autoUpdate'` fazia pela gente. Sem os dois,
// a versão nova só assumiria quando TODA aba do app fosse fechada — num tablet
// que fica aberto o turno inteiro, isso é "nunca".
self.addEventListener('install', () => void self.skipWaiting());
self.addEventListener('activate', (evento) => evento.waitUntil(self.clients.claim()));

/**
 * Alguém está com o app na frente?
 *
 * Se está, o socket já entregou o `order:new` e a fila já tocou o sino — somar
 * uma notificação do sistema em cima disso avisa duas vezes do mesmo pedido, e
 * a segunda ainda tapa a tela que a pessoa está usando.
 */
async function appEstaVisivel(): Promise<boolean> {
  const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  return janelas.some((c) => c.visibilityState === 'visible');
}

self.addEventListener('push', (evento) => {
  /*
    `waitUntil` não é opcional: sem ele o navegador pode encerrar o service
    worker antes de a promessa terminar, e o aviso simplesmente não aparece —
    de forma intermitente, que é o pior jeito de falhar.
  */
  evento.waitUntil(
    (async () => {
      let aviso: AvisoPushPayload;
      try {
        aviso = (await evento.data?.json()) as AvisoPushPayload;
      } catch {
        // Payload que não é o nosso. Não inventar notificação genérica: alarme
        // sem conteúdo faz a cozinha ir olhar uma fila que não mudou.
        return;
      }
      if (!aviso?.titulo) return;

      if (await appEstaVisivel()) return;

      await self.registration.showNotification(aviso.titulo, {
        body: aviso.corpo,
        // O ícone da marca, o mesmo do manifest. Sem ele o Android desenha um
        // quadrado cinza genérico.
        icon: '/logo/qro-app-192.png',
        badge: '/logo/qro-app-192.png',
        tag: aviso.tag,
        /*
          `vibrate` e `renotify` NÃO estão aqui, e não é esquecimento: as duas
          saíram do padrão e o TypeScript não as declara mais. Nenhuma faria
          falta — no Android quem decide vibração é o canal de notificação do
          sistema, o iOS nunca implementou nada disso, e `renotify` já é falso
          por omissão. A vibração DENTRO do app, essa sim nossa, continua em
          lib/sound.ts.
        */
        data: { url: aviso.url },
      });
    })(),
  );
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const destino = (evento.notification.data as { url?: string } | undefined)?.url ?? '/fila';

  evento.waitUntil(
    (async () => {
      const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

      /*
        REAPROVEITAR A ABA ABERTA, não abrir outra.

        O tablet da cozinha vive com o app aberto. Abrir uma segunda janela a
        cada notificação deixaria meia dúzia empilhadas até o fim do turno — e
        a pessoa voltaria pra uma delas sem saber qual está atualizada.
      */
      const existente = janelas[0];
      if (existente) {
        await existente.focus();
        // `navigate` falha se a aba estiver em outra origem ou o navegador não
        // permitir; focar já resolveu o essencial, então o erro é ignorável.
        await existente.navigate(destino).catch(() => {});
        return;
      }

      await self.clients.openWindow(destino);
    })(),
  );
});
