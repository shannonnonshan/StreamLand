"use client";

import { useState, useRef, useEffect, use, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { 
  MagnifyingGlassIcon, 
  PaperAirplaneIcon, 
  PaperClipIcon,
  FaceSmileIcon,
  PhoneIcon,
  VideoCameraIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import { useChat, ChatMessage } from '@/hooks/useChat';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

type FriendData = {
  id: string;
  fullName: string;
  avatar: string | null;
  teacherProfile?: { id: string };
};

type FriendshipResponse = {
  friendshipId: string;
  friend: FriendData;
  since: string;
};

type Contact = {
  id: string;
  fullName: string;
  profilePicture: string | null;
  role: 'teacher' | 'student';
  online: boolean;
  lastMessage?: ChatMessage;
  unreadCount: number;
};

export default function MessagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useAuth();
  const userId = user?.id || id;
  const searchParams = useSearchParams();
  const targetUserId = searchParams.get('userId'); // Get userId from URL query

  // Add styles for animation
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateY(-10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const {
    isConnected,
    onlineUsers,
    sendMessage,
    markAsRead,
    sendTyping,
    getOnlineStatus,
    onNewMessage,
    onMessageSent,
    onUserTyping,
  } = useChat(userId);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoaded, setContactsLoaded] = useState(false);
  const [conversations, setConversations] = useState<Map<string, { lastMessage: ChatMessage; unreadCount: number }>>(new Map());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [chatFilter, setChatFilter] = useState<'all' | 'unread' | 'teachers'>('all');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const conversationsFetchedRef = useRef(false);

  // Fetch contacts (friends/teachers)
  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const response = await fetch(`${API_URL}/student/friends`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (response.ok) {
          const friendships: FriendshipResponse[] = await response.json();
          setContacts(
            friendships.map((friendship) => ({
              id: friendship.friend.id,
              fullName: friendship.friend.fullName,
              profilePicture: friendship.friend.avatar,
              role: friendship.friend.teacherProfile ? 'teacher' : 'student',
              online: false,
              unreadCount: 0,
            }))
          );
          setContactsLoaded(true);

          // Get online status for all friends
          if (friendships.length > 0) {
            getOnlineStatus(friendships.map((f) => f.friend.id));
          }
        }
      } catch (error) {
        console.error('Error fetching contacts:', error);
      }
    };

    if (userId && userId !== 'guest') {
      fetchContacts();
    }
  }, [userId, getOnlineStatus]);

  // Fetch recent conversations to get last messages and unread counts
  useEffect(() => {
    const fetchRecentConversations = async () => {
      if (!userId || userId === 'guest' || !contactsLoaded || conversationsFetchedRef.current) return;

      conversationsFetchedRef.current = true;

      try {
        const token = localStorage.getItem('accessToken');
        const response = await fetch(`${API_URL}/chat/conversations`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const conversationsData = await response.json();
          const conversationsMap = new Map<string, { lastMessage: ChatMessage; unreadCount: number }>();
          conversationsData.forEach((conv: { partnerId: string; lastMessage: ChatMessage; unreadCount: number }) => {
            conversationsMap.set(conv.partnerId, {
              lastMessage: conv.lastMessage,
              unreadCount: conv.unreadCount,
            });
          });
          
          setConversations(conversationsMap);
        } else {
          console.error('❌ Failed to fetch conversations:', response.status);
        }
      } catch (error) {
        console.error('Error fetching conversations:', error);
      }
    };

    fetchRecentConversations();
  }, [userId, contactsLoaded]);

  // Merged contacts with conversations and online status
  const mergedContacts = useMemo(() => {
    return contacts.map((contact) => {
      const conversation = conversations.get(contact.id);
      return {
        ...contact,
        online: onlineUsers.includes(contact.id),
        lastMessage: conversation?.lastMessage,
        unreadCount: conversation?.unreadCount || 0,
      };
    });
  }, [contacts, conversations, onlineUsers]);

  // Auto-select contact from URL parameter
  useEffect(() => {
    if (targetUserId && mergedContacts.length > 0 && !selectedContact) {
      const targetContact = mergedContacts.find(c => c.id === targetUserId);
      if (targetContact) {
        setSelectedContact(targetContact);
      }
    }
  }, [targetUserId, mergedContacts, selectedContact]);

  // Fetch conversation messages
  useEffect(() => {
    const fetchMessages = async () => {
      if (!selectedContact) return;

      try {
        const token = localStorage.getItem('accessToken');
        const response = await fetch(
          `${API_URL}/chat/conversation/${selectedContact.id}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (response.ok) {
          const msgs = await response.json();
          const reversedMsgs = msgs.reverse(); // Reverse to show oldest first
          setMessages(reversedMsgs);

          // Mark all unread messages as read
          const unreadMessages = reversedMsgs.filter(
            (msg: ChatMessage) => msg.senderId === selectedContact.id && !msg.readAt
          );
          unreadMessages.forEach((msg: ChatMessage) => {
            markAsRead(msg.id);
          });

          // Reset unread count in conversations Map
          setConversations((prev) => {
            const newMap = new Map(prev);
            const existing = newMap.get(selectedContact.id);
            if (existing) {
              newMap.set(selectedContact.id, {
                ...existing,
                unreadCount: 0,
              });
            }
            return newMap;
          });
        }
      } catch (error) {
        console.error('Error fetching messages:', error);
      }
    };

    fetchMessages();
  }, [selectedContact, markAsRead]);

  // Listen for new messages
  useEffect(() => {
    const cleanup = onNewMessage((message) => {
      // Add message if it's from the current conversation
      if (
        selectedContact &&
        (message.senderId === selectedContact.id ||
          message.receiverId === selectedContact.id)
      ) {
        setMessages((prev) => [...prev, message]);

        // Mark as read if the sender is the selected contact
        if (message.senderId === selectedContact.id) {
          markAsRead(message.id);
        }
      }

      // Update conversations Map with new lastMessage
      const partnerId = message.senderId === userId ? message.receiverId : message.senderId;
      setConversations((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(partnerId);
        const shouldIncrement = selectedContact?.id !== partnerId;
        newMap.set(partnerId, {
          lastMessage: message,
          unreadCount: shouldIncrement ? (existing?.unreadCount || 0) + 1 : (existing?.unreadCount || 0),
        });
        return newMap;
      });

      // Move contact to top
      setContacts((prev) => {
        const contactIndex = prev.findIndex(c => c.id === partnerId);
        if (contactIndex === -1) return prev;
        
        const updatedContact = prev[contactIndex];
        const reordered = [
          updatedContact,
          ...prev.slice(0, contactIndex),
          ...prev.slice(contactIndex + 1)
        ];
        return reordered;
      });
    });

    return cleanup;
  }, [onNewMessage, selectedContact, markAsRead, userId]);

  // Listen for sent messages
  useEffect(() => {
    const cleanup = onMessageSent((message) => {
      if (
        selectedContact &&
        (message.senderId === userId || message.receiverId === selectedContact.id)
      ) {
        setMessages((prev) => [...prev, message]);

        // Update conversations Map with new lastMessage
        setConversations((prev) => {
          const newMap = new Map(prev);
          newMap.set(message.receiverId, {
            lastMessage: message,
            unreadCount: prev.get(message.receiverId)?.unreadCount || 0,
          });
          return newMap;
        });

        // Move contact to top
        setContacts((prev) => {
          const contactIndex = prev.findIndex(c => c.id === message.receiverId);
          if (contactIndex === -1) return prev;
          
          const updatedContact = prev[contactIndex];
          const reordered = [
            updatedContact,
            ...prev.slice(0, contactIndex),
            ...prev.slice(contactIndex + 1)
          ];
          return reordered;
        });
      }
    });

    return cleanup;
  }, [onMessageSent, selectedContact, userId]);

  // Listen for typing indicators
  useEffect(() => {
    const cleanup = onUserTyping((data) => {
      if (data.isTyping) {
        setTypingUsers((prev) => new Set(prev).add(data.userId));
      } else {
        setTypingUsers((prev) => {
          const next = new Set(prev);
          next.delete(data.userId);
          return next;
        });
      }
    });

    return cleanup;
  }, [onUserTyping]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedContact) return;

    sendMessage({
      receiverId: selectedContact.id,
      content: newMessage.trim(),
      type: 'TEXT',
    });

    setNewMessage('');

    // Stop typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    sendTyping(selectedContact.id, false);
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);

    if (!selectedContact) return;

    // Send typing indicator
    sendTyping(selectedContact.id, true);

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      sendTyping(selectedContact.id, false);
    }, 2000);
  };

  const filteredContacts = mergedContacts
    .filter((contact) => {
      const matchesSearch = contact.fullName
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      
      if (chatFilter === 'unread') return matchesSearch && contact.unreadCount > 0;
      if (chatFilter === 'teachers') return matchesSearch && contact.role === 'teacher';
      return matchesSearch;
    })
    .sort((a, b) => {
      // Sort by lastMessage time, most recent first
      if (!a.lastMessage && !b.lastMessage) return 0;
      if (!a.lastMessage) return 1;
      if (!b.lastMessage) return -1;
      return new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime();
    });

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatTime = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex h-[calc(100vh-80px)] bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 px-[5%]">
      {/* Contacts List */}
      <div className="w-80 bg-white/80 backdrop-blur-md border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-4">
            Messages
          </h1>
          
          {/* Search */}
          <div className="relative">
            <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Filter */}
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setChatFilter('all')}
              className={`px-3 py-1 rounded-full text-sm ${
                chatFilter === 'all'
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setChatFilter('unread')}
              className={`px-3 py-1 rounded-full text-sm ${
                chatFilter === 'unread'
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              Unread
            </button>
            <button
              onClick={() => setChatFilter('teachers')}
              className={`px-3 py-1 rounded-full text-sm ${
                chatFilter === 'teachers'
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              Teachers
            </button>
          </div>

          {/* Connection Status */}
          <div className="mt-2 flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-gray-400'
              }`}
            />
            <span className="text-xs text-gray-600">
              {isConnected ? 'Connected' : 'Connecting...'}
            </span>
          </div>
        </div>

        {/* Contact List */}
        <div className="flex-1 overflow-y-auto">
          {filteredContacts.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              No contacts found
            </div>
          ) : (
            filteredContacts.map((contact, index) => (
              <div
                key={contact.id}
                onClick={() => setSelectedContact(contact)}
                className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-purple-50 transition-all duration-300 ${
                  selectedContact?.id === contact.id ? 'bg-purple-100' : ''
                }`}
                style={
                  contact.lastMessage
                    ? {
                        animationName: 'slideIn',
                        animationDuration: '0.3s',
                        animationTimingFunction: 'ease-out',
                        animationDelay: `${index * 0.05}s`,
                        animationFillMode: 'backwards',
                      }
                    : undefined
                }
              >
                <div className="flex items-start gap-3">
                  <div className="relative">
                    {contact.profilePicture ? (
                      <Image
                        src={contact.profilePicture}
                        alt={contact.fullName}
                        width={48}
                        height={48}
                        className="rounded-full"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-blue-400 flex items-center justify-center text-white font-semibold">
                        {getInitials(contact.fullName)}
                      </div>
                    )}
                    {contact.online && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {contact.fullName}
                      </h3>
                      {contact.lastMessage && (
                        <span className="text-xs text-gray-500">
                          {formatTime(contact.lastMessage.createdAt)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 truncate">
                      {contact.lastMessage?.content || 'Chưa có tin nhắn'}
                    </p>
                  </div>

                  {contact.unreadCount > 0 && (
                    <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {contact.unreadCount}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedContact ? (
          <>
            {/* Chat Header */}
            <div className="bg-white/80 backdrop-blur-md border-b border-gray-200 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  {selectedContact.profilePicture ? (
                    <Image
                      src={selectedContact.profilePicture}
                      alt={selectedContact.fullName}
                      width={40}
                      height={40}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-blue-400 flex items-center justify-center text-white font-semibold">
                      {getInitials(selectedContact.fullName)}
                    </div>
                  )}
                  {selectedContact.online && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
                  )}
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900">
                    {selectedContact.fullName}
                  </h2>
                  <p className="text-sm text-gray-600">
                    {selectedContact.online ? 'Đang hoạt động' : 'Không hoạt động'}
                    {typingUsers.has(selectedContact.id) && ' • Đang gõ...'}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <PhoneIcon className="w-5 h-5 text-gray-600" />
                </button>
                <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <VideoCameraIcon className="w-5 h-5 text-gray-600" />
                </button>
                <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <InformationCircleIcon className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => {
                const isMe = message.senderId === userId;
                return (
                  <div
                    key={message.id}
                    className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-md px-4 py-2 rounded-2xl ${
                        isMe
                          ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                          : 'bg-white text-gray-900'
                      }`}
                    >
                      <p>{message.content}</p>
                      <p
                        className={`text-xs mt-1 ${
                          isMe ? 'text-purple-200' : 'text-gray-500'
                        }`}
                      >
                        {formatTime(message.createdAt)}
                        {isMe && message.readAt && ' • Đã xem'}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="bg-white/80 backdrop-blur-md border-t border-gray-200 p-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <PaperClipIcon className="w-5 h-5 text-gray-600" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  multiple
                />

                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={handleTyping}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    className="w-full px-4 py-2 pr-12 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full">
                    <FaceSmileIcon className="w-5 h-5 text-gray-600" />
                  </button>
                </div>

                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                  className="p-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-full hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <PaperAirplaneIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-12 h-12 text-purple-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Select a conversation
              </h3>
              <p className="text-gray-600">
                Choose a contact to start chatting
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
