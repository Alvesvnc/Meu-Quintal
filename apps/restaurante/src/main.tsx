import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import './index.css';

/**
 * Service worker — o que faz o app ser instalavel. Config em vite.config.ts.
 *
 * `immediate: true` registra no carregamento, sem esperar o `load`: a tela do
 * balcao pode ficar dias aberta, e adiar o registro so atrasa a primeira
 * instalacao.
 */
registerSW({
  immediate: true,

  /**
   * O TABLET DA COZINHA NAO RECARREGA SOZINHO.
   *
   * O navegador so procura service worker novo quando ha navegacao ou reload —
   * e aqui nao ha nenhum dos dois: o aparelho fica no /fila o turno inteiro,
   * as vezes por dias. Sem esta checagem periodica o `autoUpdate` nunca
   * dispararia, e o deploy so chegaria quando alguem lembrasse de recarregar.
   *
   * De hora em hora: barato (uma requisicao condicional ao sw.js) e bem mais
   * curto que o turno.
   */
  onRegisteredSW(_url, registro) {
    if (!registro) return;
    setInterval(() => void registro.update(), 60 * 60 * 1000);
  },

  /**
   * FALHA DE REGISTRO NAO PODE SER MUDA.
   *
   * Sem isto, um service worker que nao registra nao deixa rastro nenhum: o
   * app abre normal, tudo funciona, e o unico sintoma aparece la na frente —
   * o botao de ligar o aviso batendo no prazo de 10s de lib/push.ts, sem
   * dizer o motivo. O console e o lugar certo pro motivo.
   */
  onRegisterError(erro) {
    console.error(
      '[QRO] o service worker nao registrou. Aviso com o app fechado nao vai funcionar.',
      erro,
    );
  },
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
