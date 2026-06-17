import { io } from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://botverse-r3ex.onrender.com';

export const socket = io(BACKEND_URL, {
  autoConnect: false, // We connect manually after auth
  reconnectionDelay: 1000,
  reconnectionAttempts: 5,
});
