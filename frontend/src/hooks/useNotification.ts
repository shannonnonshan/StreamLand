import { useEffect, useState, useCallback } from 'react';
import io from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  content: string;
  data?: {
    requesterId?: string;
    requesterName?: string;
    requesterAvatar?: string;
    friendRequestId?: string;
    accepterId?: string;
    accepterName?: string;
    accepterAvatar?: string;
    studentId?: string;
    studentName?: string;
    studentAvatar?: string;
    teacherId?: string;
    teacherName?: string;
    livestreamId?: string;
    livestreamTitle?: string;
    videoId?: string;
    videoTitle?: string;
    type?: string;
  };
  read: boolean;
  createdAt: string;
}

export const useNotification = (userId: string | null) => {
  const [socket, setSocket] = useState<ReturnType<typeof io> | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);

  // Fetch initial notifications
  const fetchNotifications = useCallback(async () => {
    if (!userId) return;

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_URL}/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  }, [userId]);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    if (!userId) return;

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_URL}/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.count);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  }, [userId]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_URL}/notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((notif) =>
            notif.id === notificationId ? { ...notif, read: true } : notif
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_URL}/notifications/mark-all-read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        setNotifications((prev) => prev.map((notif) => ({ ...notif, read: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }, []);

  // Delete notification
  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_URL}/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        setNotifications((prev) => prev.filter((notif) => notif.id !== notificationId));
        const deletedNotif = notifications.find((n) => n.id === notificationId);
        if (deletedNotif && !deletedNotif.read) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  }, [notifications]);

  // Setup WebSocket connection
  useEffect(() => {
    if (!userId) return;

    const token = localStorage.getItem('accessToken');
    if (!token) return;
    const newSocket = io(`${API_URL}/notifications`, {
      auth: { token },
      transports: ['websocket'],
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      newSocket.emit('register', { userId });
    });

    newSocket.on('connect_error', (error: Error) => {
      console.error('❌ Socket connection error:', error);
      console.error('🔐 Token exists:', !!token);
      setIsConnected(false);
    });

    newSocket.on('error', (error: Error) => {
      console.error('⚠️ Socket error:', error);
    });

    newSocket.on('registered', (data: { success: boolean; userId?: string; error?: string }) => {
      if (!data.success) {
        console.error('❌ Registration failed:', data.error);
      }
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('newNotification', (notification: Notification) => {
      setNotifications((prev) => [notification, ...prev]);
      setUnreadCount((prev) => prev + 1);

      // Show browser notification if permission granted
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(notification.title, {
          body: notification.content,
          icon: '/logo.png',
        });
      }
    });

    setSocket(newSocket);

    // Fetch initial data
    fetchNotifications();
    fetchUnreadCount();

    return () => {
      newSocket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]); // Only depend on userId, not on fetchNotifications/fetchUnreadCount

  return {
    socket,
    isConnected,
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refetch: fetchNotifications,
  };
};
