import { io, type Socket } from 'socket.io-client';
import { API_BASE, getTableToken } from './client';

let socket: Socket | null = null;

/**
 * Socket autenticado como mesa. O servidor exige `auth` no handshake e so
 * deixa entrar na sala de pedidos que pertencem a esta mesa.
 */
export function getSocket(): Socket | null {
  const token = getTableToken();
  // Sem token de mesa nao ha o que assinar — o handshake seria recusado.
  if (!token) return null;

  if (!socket) {
    socket = io(API_BASE, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      auth: { kind: 'mesa', token },
    });
  }
  return socket;
}

/** Chamar ao trocar de mesa: o handshake antigo carrega o token antigo. */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
