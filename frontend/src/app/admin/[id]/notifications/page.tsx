"use client";

import { useState } from "react";
import { Bell, Flag, User, Trash2, Check, X, ExternalLink } from "lucide-react";

interface Notification {
  id: number;
  type: 'report' | 'user' | 'system';
  title: string;
  message: string;
  detailedMessage?: string;
  time: string;
  isRead: boolean;
  link?: string;
}

export default function NotificationsPage() {
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  // Mock notifications data - in real app, this would come from an API
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: 1,
      type: 'report',
      title: 'New Content Report',
      message: 'A new content has been reported for inappropriate content',
      detailedMessage: `A user has reported content for violating community guidelines. The content in question contains inappropriate material that needs immediate review.

Content Details:
- Type: Video
- Title: "Introduction to Programming"
- Reported by: User123
- Reason: Inappropriate content
- Additional notes: Contains offensive language and inappropriate gestures

Please review this content as soon as possible and take appropriate action according to our community guidelines.`,
      time: '5 minutes ago',
      isRead: false,
      link: '/admin/content/123'
    },
    {
      id: 2,
      type: 'user',
      title: 'New User Registration',
      message: 'Teacher John Doe has registered and needs approval',
      detailedMessage: `A new teacher registration requires your review and approval.

Teacher Information:
- Name: John Doe
- Email: john.doe@example.com
- Subject: Mathematics
- Experience: 8 years
- Institution: ABC University
- Verification Status: Documents Submitted

The teacher has submitted all required documentation for verification. Please review the provided materials and either approve or reject the registration.`,
      time: '1 hour ago',
      isRead: false,
      link: '/admin/users/pending/456'
    },
    {
      id: 3,
      type: 'system',
      title: 'System Update',
      message: 'System maintenance scheduled for tonight at 2 AM',
      time: '2 hours ago',
      isRead: false
    },
    {
      id: 4,
      type: 'report',
      title: 'Content Report Update',
      message: 'A previously reported content has been reviewed',
      time: '1 day ago',
      isRead: true
    }
  ]);

  const markAsRead = (id: number) => {
    setNotifications(notifications.map(notif => 
      notif.id === id ? { ...notif, isRead: true } : notif
    ));
  };

  const deleteNotification = (id: number) => {
    setNotifications(notifications.filter(notif => notif.id !== id));
  };

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">All Notifications</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setNotifications([])}
              className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
            >
              <Trash2 size={16} />
              Clear All
            </button>
            <button
              onClick={() => setNotifications(notifications.map(n => ({ ...n, isRead: true })))}
              className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
            >
              <Check size={16} />
              Mark All as Read
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No notifications to display
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                  !notification.isRead ? 'bg-blue-50/50' : ''
                }`}
                onClick={() => {
                  setSelectedNotification(notification);
                  if (!notification.isRead) {
                    markAsRead(notification.id);
                  }
                }}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-1">
                    {notification.type === 'report' && (
                      <Flag className="text-red-500" size={20} />
                    )}
                    {notification.type === 'user' && (
                      <User className="text-blue-500" size={20} />
                    )}
                    {notification.type === 'system' && (
                      <Bell className="text-yellow-500" size={20} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {notification.title}
                        </p>
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                          {notification.message}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        {!notification.isRead && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead(notification.id);
                            }}
                            className="text-blue-600 hover:text-blue-700 text-sm"
                          >
                            Mark as read
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(notification.id);
                          }}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {notification.time}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Notification Detail Modal */}
        {selectedNotification && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setSelectedNotification(null)}>
            <div className="bg-white rounded-xl w-full max-w-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
              {/* Modal Header */}
              <div className="flex justify-between items-center p-6 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  {selectedNotification.type === 'report' && (
                    <Flag className="text-red-500" size={24} />
                  )}
                  {selectedNotification.type === 'user' && (
                    <User className="text-blue-500" size={24} />
                  )}
                  {selectedNotification.type === 'system' && (
                    <Bell className="text-yellow-500" size={24} />
                  )}
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{selectedNotification.title}</h2>
                    <p className="text-sm text-gray-500">{selectedNotification.time}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedNotification(null)}
                  className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6">
                <div className="prose prose-sm max-w-none">
                  <p className="text-gray-900 whitespace-pre-wrap">
                    {selectedNotification.detailedMessage || selectedNotification.message}
                  </p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end items-center gap-3 p-6 border-t border-gray-200 bg-gray-50">
                <button
                  onClick={() => {
                    deleteNotification(selectedNotification.id);
                    setSelectedNotification(null);
                  }}
                  className="px-4 py-2 text-gray-700 hover:text-gray-900 flex items-center gap-2"
                >
                  <Trash2 size={16} />
                  Delete
                </button>
                {selectedNotification.link && (
                  <a
                    href={selectedNotification.link}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
                  >
                    <ExternalLink size={16} />
                    View Details
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}