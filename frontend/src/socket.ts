import io from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// Create a singleton socket instance
const socket = io(SOCKET_URL, {
  autoConnect: false, // Don't auto-connect on import
  transports: ['websocket', 'polling'], // Try WebSocket first, fallback to polling
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
});

// Debug logging
socket.on('connect', () => {
  console.log('[Socket.io] Connected:', socket.id);
});

socket.on('disconnect', (reason: string) => {
  console.log('[Socket.io] Disconnected:', reason);
});

socket.on('connect_error', (error: Error) => {
  console.error('[Socket.io] Connection error:', error.message);
});

socket.on('reconnect', (attemptNumber: number) => {
  console.log('[Socket.io] Reconnected after', attemptNumber, 'attempts');
});

socket.on('reconnect_attempt', (attemptNumber: number) => {
  console.log('[Socket.io] Reconnection attempt', attemptNumber);
});

socket.on('reconnect_error', (error: Error) => {
  console.error('[Socket.io] Reconnection error:', error.message);
});

socket.on('reconnect_failed', () => {
  console.error('[Socket.io] Reconnection failed - max attempts reached');
});

export default socket;
