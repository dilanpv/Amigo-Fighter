import { io } from 'socket.io-client';

// Use environment variable for production, fallback to local IP for dev
const URL = import.meta.env.VITE_SOCKET_URL || 'http://192.168.128.4:3001';

export const socket = io(URL, {
    autoConnect: true
});
