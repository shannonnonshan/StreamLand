import io from 'socket.io-client';

const URL = process.env.NODE_ENV === 'production' 
  ? undefined 
  : (process.env.NEXT_PUBLIC_SOCKET_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000');

const socket = io(URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000', {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 10,
});

socket.on('connect', () => {
  // Socket connected
});

socket.on('disconnect', (reason: string) => {
  if (reason === 'io server disconnect') {
    socket.connect();
  }
});

socket.on('connect_error', (error: Error) => {
  console.error('[Socket] Connection error:', error.message);
});

socket.on('reconnect_failed', () => {
  console.error('[Socket] Reconnection failed');
});

export default socket;