import { io } from 'socket.io-client';

// Use environment variable for production, fallback to localhost for dev
const URL = import.meta.env.VITE_SOCKET_URL || (import.meta.env.DEV ? 'http://localhost:3001' : null);

if (!URL) {
  throw new Error("Falta VITE_SOCKET_URL en producción");
}

export const socket = io(URL, {
    autoConnect: true,
    transports: ['websocket'],       // Skip long-polling, connect via WebSocket directly
    upgrade: false,                   // No upgrade dance — saves ~200-500ms initial latency
    reconnectionDelay: 500,           // Faster reconnection attempts
    reconnectionDelayMax: 2000,       // Cap reconnection backoff at 2s
    timeout: 8000,                    // Connection timeout
    forceNew: false,
});
