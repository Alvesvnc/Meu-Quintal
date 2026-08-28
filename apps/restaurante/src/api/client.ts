import axios from 'axios';

/**
 * Onde fica a API. VAZIO = mesma origem do app.
 *
 * O padrao e string vazia, nao `http://localhost:3001`, e a diferenca importa:
 * em desenvolvimento o Vite faz proxy de `/api` e `/socket.io` pro servidor
 * (ver vite.config.ts), entao caminho relativo funciona em localhost, no IP da
 * rede, num tunel — em qualquer endereco, sem configurar nada.
 *
 * Chumbar `localhost` como padrao criava uma armadilha silenciosa: abrir o app
 * de OUTRO aparelho fazia o navegador tentar falar consigo mesmo, e a
 * requisicao morria sem nem sair — sem erro de rede, sem log no servidor, so
 * uma tela vazia.
 *
 * Em producao o valor e obrigatorio e vem do ambiente no momento do build.
 */
export const API_BASE = import.meta.env.VITE_API_URL ?? '';
export const TOKEN_KEY = 'mq:r:token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // ─── Tunel de desenvolvimento (ngrok) ───────────────────────────────────
  //
  // O ngrok gratuito devolve uma PAGINA HTML de aviso no lugar da resposta
  // quando acha que a requisicao veio de um navegador. Isso quebra toda
  // chamada de API feita por tunel: o app pede JSON e recebe `<!DOCTYPE html>`,
  // e a tela mostra "nao consegui carregar" sem nenhuma pista do motivo.
  //
  // Este header pula o aviso. A condicao pelo hostname mantem a coisa restrita
  // ao que ela e — muleta de teste em celular. Em producao o dominio nunca
  // casa, e o header nunca e enviado.
  if (typeof location !== 'undefined' && location.hostname.includes('ngrok')) {
    config.headers['ngrok-skip-browser-warning'] = '1';
  }

  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // 401 -> token invalido/expirado, limpa pra forcar relogin
    if (err.response?.status === 401) {
      clearToken();
      // navega pra /login via custom event (sem dep do react-router aqui)
      window.dispatchEvent(new CustomEvent('mq:auth:invalid'));
    }
    return Promise.reject(err);
  },
);
