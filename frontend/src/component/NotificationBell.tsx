"use client";

import { useState, useRef, useEffect } from 'react';
import { BellIcon, CheckIcon, TrashIcon } from '@heroicons/react/24/outline';
import { BellAlertIcon } from '@heroicons/react/24/solid';
import { useNotification, type Notification } from '@/hooks/useNotification';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

interface NotificationBellProps {
  userId: string;
}

export default function NotificationBell({ userId }: NotificationBellProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [processedRequests, setProcessedRequests] = useState<Set<string>>(new Set());

  console.log('🔔 NotificationBell rendered with userId:', userId);

  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotification(userId);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Request browser notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    if (!notification.read) {
      await markAsRead(notification.id);
    }

    // Navigate based on notification type
    const data = notification.data;
    if (!data) return;

    setIsOpen(false);

    switch (data.type) {
      case 'friend_request':
        // Navigate to requester's profile - don't navigate for friend requests, just open/close dropdown
        // User should use Accept/Reject buttons instead
        break;
      case 'friend_request_accepted':
        // Navigate to accepter's profile
        router.push(`/student/profile/${data.accepterId}`);
        break;
      case 'new_follower':
        // Navigate to student's profile
        router.push(`/teacher/${userId}/profile/${data.studentId}`);
        break;
      case 'livestream_start':
        // Navigate to livestream
        router.push(`/viewer/${data.teacherId}/${data.livestreamId}`);
        break;
      case 'new_video':
        // Navigate to video or teacher's recordings
        router.push(`/teacher/${data.teacherId}/recordings`);
        break;
      default:
        break;
    }
  };

  const handleAcceptFriendRequest = async (e: React.MouseEvent, notification: Notification) => {
    e.stopPropagation();
    
    console.log('Accept button clicked');
    console.log('Notification data:', notification.data);
    console.log('friendRequestId:', notification.data?.friendRequestId);
    
    if (!notification.data?.friendRequestId) {
      console.error('No friendRequestId in notification data');
      alert('Lỗi: Không tìm thấy ID yêu cầu kết bạn');
      return;
    }

    try {
      const token = localStorage.getItem('accessToken');
      console.log('Token exists:', !!token);
      
      const url = `${process.env.NEXT_PUBLIC_API_URL}/student/friends/request/${notification.data.friendRequestId}`;
      console.log('API URL:', url);
      
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: 'ACCEPTED' }),
      });

      console.log('Response status:', response.status);
      const responseData = await response.json();
      console.log('Response data:', responseData);

      if (response.ok) {
        // Mark as read instead of deleting to show it was processed
        await markAsRead(notification.id);
        // Track this request as processed
        if (notification.data?.friendRequestId) {
          setProcessedRequests((prev) => new Set(prev).add(notification.data!.friendRequestId!));
        }
        alert('Đã chấp nhận lời mời kết bạn!');
      } else {
        console.error('Failed to accept friend request:', response.status, responseData);
        alert(`Lỗi: ${responseData.message || 'Không thể chấp nhận lời mời'}`);
      }
    } catch (error) {
      console.error('Error accepting friend request:', error);
      alert('Lỗi khi chấp nhận lời mời kết bạn');
    }
  };

  const handleRejectFriendRequest = async (e: React.MouseEvent, notification: Notification) => {
    e.stopPropagation();
    
    console.log('Reject button clicked');
    console.log('Notification data:', notification.data);
    console.log('friendRequestId:', notification.data?.friendRequestId);
    
    if (!notification.data?.friendRequestId) {
      console.error('No friendRequestId in notification data');
      alert('Lỗi: Không tìm thấy ID yêu cầu kết bạn');
      return;
    }

    try {
      const token = localStorage.getItem('accessToken');
      console.log('Token exists:', !!token);
      
      const url = `${process.env.NEXT_PUBLIC_API_URL}/student/friends/request/${notification.data.friendRequestId}`;
      console.log('API URL:', url);
      
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: 'REJECTED' }),
      });

      console.log('Response status:', response.status);
      const responseData = await response.json();
      console.log('Response data:', responseData);

      if (response.ok) {
        // Delete notification after rejecting
        await deleteNotification(notification.id);
        alert('Đã từ chối lời mời kết bạn');
      } else {
        console.error('Failed to reject friend request:', response.status, responseData);
        alert(`Lỗi: ${responseData.message || 'Không thể từ chối lời mời'}`);
      }
    } catch (error) {
      console.error('Error rejecting friend request:', error);
      alert('Lỗi khi từ chối lời mời kết bạn');
    }
  };

  const formatTimeAgo = (date: string) => {
    const now = new Date();
    const notifDate = new Date(date);
    const seconds = Math.floor((now.getTime() - notifDate.getTime()) / 1000);

    if (seconds < 60) return 'Vừa xong';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} phút trước`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} giờ trước`;
    if (seconds < 2592000) return `${Math.floor(seconds / 86400)} ngày trước`;
    return notifDate.toLocaleDateString('vi-VN');
  };

  const getNotificationIcon = (notification: Notification) => {
    const avatar = notification.data?.requesterAvatar || 
                   notification.data?.accepterAvatar || 
                   notification.data?.studentAvatar;
    
    if (avatar) {
      return (
        <Image
          src={avatar}
          alt="Avatar"
          width={40}
          height={40}
          className="rounded-full"
        />
      );
    }

    return (
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-blue-400 flex items-center justify-center text-white">
        <BellIcon className="w-5 h-5" />
      </div>
    );
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
      >
        {unreadCount > 0 ? (
          <BellAlertIcon className="w-6 h-6 text-purple-600" />
        ) : (
          <BellIcon className="w-6 h-6 text-gray-600" />
        )}
        
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50">
            <h3 className="font-semibold text-gray-900">Thông báo</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-sm text-purple-600 hover:text-purple-700 font-medium"
              >
                Đánh dấu đã đọc
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-[32rem] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <BellIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>Chưa có thông báo</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`p-4 border-b border-gray-100 hover:bg-purple-50 cursor-pointer transition-colors ${
                    !notification.read ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex gap-3">
                    {/* Icon/Avatar */}
                    <div className="flex-shrink-0">
                      {getNotificationIcon(notification)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">
                        {notification.title}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        {notification.content}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatTimeAgo(notification.createdAt)}
                      </p>

                      {/* Friend Request Actions */}
                      {notification.data?.type === 'friend_request' && 
                       !processedRequests.has(notification.data.friendRequestId || '') && (
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={(e) => handleAcceptFriendRequest(e, notification)}
                            className="flex-1 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all"
                          >
                            Chấp nhận
                          </button>
                          <button
                            onClick={(e) => handleRejectFriendRequest(e, notification)}
                            className="flex-1 px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 transition-all"
                          >
                            Từ chối
                          </button>
                        </div>
                      )}

                      {/* Show processed message for friend requests */}
                      {notification.data?.type === 'friend_request' && 
                       processedRequests.has(notification.data.friendRequestId || '') && (
                        <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                          <p className="text-xs text-green-700 font-medium">
                            ✓ Đã chấp nhận lời mời kết bạn
                          </p>
                        </div>
                      )}

                      {/* Friend Request Accepted Message */}
                      {notification.data?.type === 'friend_request_accepted' && (
                        <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                          <p className="text-xs text-green-700 font-medium">
                            🎉 Bạn và {notification.data.accepterName} đã trở thành bạn bè!
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2">
                      {!notification.read && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(notification.id);
                          }}
                          className="p-1 rounded hover:bg-purple-100 text-purple-600"
                          title="Đánh dấu đã đọc"
                        >
                          <CheckIcon className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(notification.id);
                        }}
                        className="p-1 rounded hover:bg-red-100 text-red-600"
                        title="Xóa"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 text-center">
              <button
                onClick={() => {
                  setIsOpen(false);
                  router.push(`/student/${userId}/notifications`);
                }}
                className="text-sm text-purple-600 hover:text-purple-700 font-medium"
              >
                Xem tất cả
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
