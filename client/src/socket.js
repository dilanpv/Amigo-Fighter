import { io } from 'socket.io-client';

// Use environment variable for production, fallback to localhost for dev
const URL = import.meta.env.VITE_SOCKET_URL || (import.meta.env.DEV ? 'http://localhost:3001' : null);

if (!URL) {
  throw new Error("Falta VITE_SOCKET_URL en producción");
}
export const socket = io(URL, {
    autoConnect: true
});
