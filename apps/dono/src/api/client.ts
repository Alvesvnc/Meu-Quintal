import axios from 'axios';

export const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

/**
 * Chave própria (`:a:`), separada da do app do restaurante (`mq:r:token`).
 *
 * Não é detalhe: no restaurante único a mesma pessoa abre os dois apps, e no
 * navegador de mesa os dois podem estar abertos lado a lado. Uma chave só faria
 * o login de um derrubar o do outro.
 */
export const TOKEN_KEY = 'mq:a:token';

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
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // 401 = token invalido ou expirado. Limpa e avisa quem estiver ouvindo.
    // Evento em vez de import do react-router: este arquivo nao deve saber que
    // existe roteador.
    if (err.response?.status === 401) {
      clearToken();
      window.dispatchEvent(new CustomEvent('mq:auth:invalid'));
    }
    return Promise.reject(err);
  },
);
