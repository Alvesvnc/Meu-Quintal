import { defineConfig, type ProxyOptions } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * O Vite serve a API no MESMO endereco do app, via proxy.
 *
 * Sem isto o front precisa saber o endereco absoluto do servidor
 * (`VITE_API_URL=http://192.168.1.126:3001`) — e ai:
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

const PORTA = 5175;

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

export default defineConfig({
  plugins: [react()],
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
