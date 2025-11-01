import io from 'socket.io-client';

const URL = process.env.NODE_ENV === 'production' ? undefined : 'http://localhost:4000';

const socket = io(URL || 'http://localhost:4000');

socket.on('connect', () => {
  console.log('[Socket] Connected to server. Socket ID:', socket.id);
});

socket.on('disconnect', (reason: string) => {
  console.log('[Socket] Disconnected:', reason);
});

socket.on('connect_error', (error: Error) => {
  console.error('[Socket] Connection error:', error);
});

export default socket;