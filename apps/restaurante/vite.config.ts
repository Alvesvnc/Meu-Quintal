import { defineConfig, type ProxyOptions } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * O Vite serve a API no MESMO endereco do app, via proxy.
 *
 * Sem isto o front precisa saber o endereco absoluto do servidor
 * (`VITE_API_URL=http://192.168.0.10:3001`) — e ai:
 *
 *   - testar no celular exige descobrir o IP da maquina e reescrever o .env
 *     toda vez que a rede muda;
 *   - o CORS precisa listar cada origem nova, uma por uma;
 *   - um tunel (ngrok) precisaria de DOIS, um pro app e um pra API, porque
 *     sao portas diferentes.
 *
 * Com o proxy, `VITE_API_URL` fica VAZIO, o axios usa caminho relativo, e tudo
 * — REST, socket e fotos — sai pela mesma origem. Um tunel so cobre o conjunto.
 *
 * Vale SO PRA DESENVOLVIMENTO. Em producao cada app e um build estatico atras
 * do proprio servidor web, e o endereco da API vem do VITE_API_URL do ambiente.
 */

const PORTA = 5174;

function proxyPraApi(): ProxyOptions {
  return {
    target: 'http://localhost:3001',
    changeOrigin: true,
    configure: (proxy) => {
      // O CORS do servidor lista as origens permitidas, e o dominio de um tunel
      // nunca estara nela. Como quem faz a requisicao agora e o proprio Vite —
      // nao o navegador — reescrever a origem aqui mantem o CORS fechado do
      // outro lado, em vez de abrir o servidor pra dominio curinga.
      proxy.on('proxyReq', (proxyReq) => {
        proxyReq.setHeader('origin', `http://localhost:${PORTA}`);
      });
    },
  };
}

/**
 * A COZINHA INSTALA O APP; O CLIENTE NAO.
 *
 * O app do cliente vive de QR: quem escaneia esta no meio de uma refeicao e
 * nunca vai "adicionar a tela de inicio" — por isso ele NAO tem PWA, e a
 * PushScreen ja argumenta isso.
 *
 * A cozinha e o oposto. O tablet do balcao (ou o notebook do escritorio) e
 * aparelho de trabalho, configurado UMA vez no dia da instalacao. Ali a
 * instalacao paga:
 *
 *   - sem barra de endereco na frente de quem opera o turno;
 *   - icone proprio na tela de inicio, na barra de tarefas e no Alt+Tab;
 *   - abre no /fila, sem ninguem digitar URL nem cacar favorito.
 *
 * Vale nos DOIS formatos com o mesmo build: no Chrome/Edge do Windows a PWA
 * instalada ganha janela propria, e no tablet ganha tela cheia. E a mesma
 * escolha que a variante `mouse:` do preset ja faz na interface — o aparelho
 * decide, nao a gente.
 */
function pwaDaCozinha() {
  return VitePWA({
    /**
     * O SERVICE WORKER E NOSSO, EM src/sw.ts.
     *
     * Ate o web push o plugin gerava tudo (`generateSW`) e nao havia arquivo
     * nenhum. Quem recebe push e o service worker, e isso exige codigo que
     * nenhum gerador escreve por voce.
     *
     * O que era config aqui (precache, fallback de navegacao, skipWaiting)
     * MUDOU DE LUGAR, nao sumiu: virou codigo em src/sw.ts. Procurar por
     * `navigateFallback` neste arquivo e nao achar nao significa que nao ha.
     */
    strategies: 'injectManifest',
    srcDir: 'src',
    filename: 'sw.ts',

    /**
     * `autoUpdate`: versao nova assume sozinha, sem perguntar.
     *
     * A alternativa (`prompt`) mostra um aviso e espera a pessoa aceitar. Numa
     * cozinha isso e pior: no pico ninguem le aviso, e o app fica rodando
     * codigo velho por dias — com o risco de a fila divergir do servidor.
     *
     * O custo e um recarregamento de ~1s quando sai deploy. Nada se perde: o
     * login mora no localStorage e a fila e refetch do servidor.
     */
    registerType: 'autoUpdate',

    // Quem registra e o main.tsx, na mao. Sem isto o plugin injetaria um
    // segundo registro no index.html e os dois disputariam a atualizacao.
    injectRegister: null,

    /**
     * SERVICE WORKER LIGADO TAMBEM EM DESENVOLVIMENTO.
     *
     * O padrao do plugin e desligar, e por muito tempo isso nao incomodou: o
     * SW so servia pra cache, que ninguem precisa exercitar em dev.
     *
     * Com o web push isso deixou de valer. Quem RECEBE o push e o service
     * worker, e `navigator.serviceWorker.ready` — que o fluxo de inscricao
     * espera — nunca resolve quando nao ha nenhum registrado. O sintoma nao e
     * um erro: e o botao de "ligar o aviso" girando pra sempre, depois de a
     * pessoa ja ter concedido a permissao de notificacao.
     *
     * `type: module` porque em dev o SW e servido como modulo ES, sem bundle.
     */
    devOptions: {
      enabled: true,
      type: 'module',
    },

    // INSTALAR o app (o icone, a janela propria) continua exigindo build:
    // `pnpm build && pnpm preview`, ou o tunel, que ja entrega HTTPS.
    // Navegador nenhum instala PWA em http:// que nao seja localhost.

    manifest: {
      id: '/',
      name: 'QRO · Cozinha',
      // Cabe embaixo do icone sem virar reticencias — e na tela de inicio o
      // contexto ja e o aparelho da cozinha, entao "QRO" seria redundante.
      short_name: 'Cozinha',
      description: 'Fila de pedidos, cardapio e metricas da sua cozinha.',
      lang: 'pt-BR',
      scope: '/',
      // Direto na fila: e o que a cozinha abre pra trabalhar. O `/` so
      // redirecionaria pra ca de qualquer jeito (ver App.tsx).
      start_url: '/fila',
      display: 'standalone',
      // `any`: o tablet do balcao vive em paisagem e o celular em retrato, e
      // travar um dos dois quebraria o outro.
      orientation: 'any',
      background_color: '#f3f2f2',
      // Mesmo `bg` do design system: a barra do sistema encosta no AppHeader
      // sem emenda visivel.
      theme_color: '#f3f2f2',
      icons: [
        { src: '/logo/qro-app-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/logo/qro-app-512.png', sizes: '512x512', type: 'image/png' },
        // O Android recorta o icone num circulo. Esta variante tem a mesma
        // geometria com folga de 25% — sem ela os cantos do quadro somem no
        // corte. Gerada de logos/qro-favicon.svg; ver logos/LEIA-ME.md.
        {
          src: '/logo/qro-app-maskable-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    },

    injectManifest: {
      // O shell e SO isto: o bundle, o CSS, os icones e a fonte. Tudo com hash
      // no nome, entao trocar de versao invalida sozinho.
      //
      // O `woff2` entrou junto com a Archivo hospedada localmente (ver
      // packages/design-system/src/fonts.css): fonte de terceiro nao daria pra
      // precachear, e o app instalado abriria com a tipografia do sistema.
      globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],

      /*
        CONTINUA SEM CACHE DE /api, e continua sendo de proposito.

        Antes isso era a AUSENCIA de `runtimeCaching` nesta config; agora e a
        ausencia de qualquer `registerRoute` de dados em src/sw.ts. A regra e
        a mesma: fila cacheada mostra pedido que ja saiu e a cozinha monta o
        prato de novo. Tela vazia a cozinha sabe resolver; tela mentindo, nao.
      */
    },
  });
}

export default defineConfig({
  plugins: [react(), pwaDaCozinha()],
  server: {
    port: PORTA,
    host: true,
    /**
     * Aceita qualquer Host no header.
     *
     * O Vite recusa hosts desconhecidos por padrao (protecao contra DNS
     * rebinding). Um tunel chega com dominio aleatorio (`algo.ngrok-free.app`),
     * que nunca estaria numa lista. Como este servidor so roda na maquina de
     * quem programa, e so enquanto ela quiser, liberar aqui e aceitavel — em
     * producao nao ha Vite nenhum.
     */
    allowedHosts: true,
    proxy: {
      '/api': proxyPraApi(),
      // `ws: true` e obrigatorio: sem ele o upgrade pra WebSocket nao acontece
      // e a fila da cozinha para de atualizar sozinha.
      '/socket.io': { ...proxyPraApi(), ws: true },
    },
  },
});
