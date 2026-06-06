import axios from 'axios';

export const TABLE_TOKEN_KEY = 'mq:tableToken';

export function getTableToken(): string | null {
  try {
    return localStorage.getItem(TABLE_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setTableToken(token: string): void {
  localStorage.setItem(TABLE_TOKEN_KEY, token);
}

export function clearTableToken(): void {
  localStorage.removeItem(TABLE_TOKEN_KEY);
}

export const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 10_000,
});

api.interceptors.request.use((config) => {
  const token = getTableToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
