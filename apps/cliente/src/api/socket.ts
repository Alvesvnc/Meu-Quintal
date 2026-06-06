import { io, type Socket } from 'socket.io-client';
import { API_BASE } from './client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(API_BASE, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });
  }
  return socket;
}
