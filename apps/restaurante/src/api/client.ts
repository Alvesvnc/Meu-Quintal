import axios from 'axios';

export const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
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
