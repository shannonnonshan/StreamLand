import { useEffect, useState, useCallback } from 'react';
import io from 'socket.io-client';

type SocketType = ReturnType<typeof io>;

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface ChatMessage {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'FILE' | 'VOICE';
  attachments?: string[];
  readAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TypingStatus {
  userId: string;
  isTyping: boolean;
}

export const useChat = (userId: string | null) => {
  const [socket, setSocket] = useState<SocketType | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

  useEffect(() => {
    if (!userId) return;

    const token = localStorage.getItem('accessToken');
    if (!token) return;

    // Create socket connection
    const newSocket = io(`${SOCKET_URL}/chat`, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      // Register user with their socket
      newSocket.emit('register', { userId });
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('connect_error', () => {
      // Socket connection error
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [userId]);

  const sendMessage = useCallback(
    (data: {
      receiverId: string;
      content: string;
      type?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'FILE' | 'VOICE';
      attachments?: string[];
    }) => {
      if (!socket || !userId) return;

      socket.emit('sendMessage', {
        senderId: userId,
        ...data,
      });
    },
    [socket, userId]
  );

  const markAsRead = useCallback(
    (messageId: string) => {
      if (!socket || !userId) return;

      socket.emit('markAsRead', { messageId, userId });
    },
    [socket, userId]
  );

  const sendTyping = useCallback(
    (receiverId: string, isTyping: boolean) => {
      if (!socket || !userId) return;

      socket.emit('typing', { senderId: userId, receiverId, isTyping });
    },
    [socket, userId]
  );

  const getOnlineStatus = useCallback(
    (userIds: string[]) => {
      if (!socket) return;

      socket.emit('getOnlineStatus', { userIds });
    },
    [socket]
  );

  const onNewMessage = useCallback((callback: (message: ChatMessage) => void) => {
    if (!socket) return;

    socket.on('newMessage', callback);
    return () => {
      socket.off('newMessage', callback);
    };
  }, [socket]);

  const onMessageSent = useCallback((callback: (message: ChatMessage) => void) => {
    if (!socket) return;

    socket.on('messageSent', callback);
    return () => {
      socket.off('messageSent', callback);
    };
  }, [socket]);

  const onMessageRead = useCallback(
    (callback: (data: { messageId: string; readAt: Date }) => void) => {
      if (!socket) return;

      socket.on('messageRead', callback);
      return () => {
        socket.off('messageRead', callback);
      };
    },
    [socket]
  );

  const onUserTyping = useCallback(
    (callback: (data: TypingStatus) => void) => {
      if (!socket) return;

      socket.on('userTyping', callback);
      return () => {
        socket.off('userTyping', callback);
      };
    },
    [socket]
  );

  const onOnlineStatus = useCallback(
    (callback: (data: { onlineUsers: string[] }) => void) => {
      if (!socket) return;

      socket.on('onlineStatus', (data: { onlineUsers: string[] }) => {
        setOnlineUsers(data.onlineUsers);
        callback(data);
      });
      return () => {
        socket.off('onlineStatus');
      };
    },
    [socket]
  );

  return {
    socket,
    isConnected,
    onlineUsers,
    sendMessage,
    markAsRead,
    sendTyping,
    getOnlineStatus,
    onNewMessage,
    onMessageSent,
    onMessageRead,
    onUserTyping,
    onOnlineStatus,
  };
};
