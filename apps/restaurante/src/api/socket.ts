import { io, type Socket } from 'socket.io-client';
import { API_BASE, getToken } from './client';

let socket: Socket | null = null;

/**
 * Socket autenticado como cozinha. O servidor confere o JWT no handshake e so
 * permite entrar na sala da propria cozinha.
 */
export function getSocket(): Socket | null {
  const token = getToken();
  if (!token) return null;

  if (!socket) {
    socket = io(API_BASE, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      auth: { kind: 'cozinha', token },
    });
  }
  return socket;
}

/** Chamar no logout: o handshake antigo carrega o JWT antigo. */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
