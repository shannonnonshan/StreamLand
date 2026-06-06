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
import MessageStatusIcon from '@/component/MessageStatusIcon';

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
      @keyframes pulse-online {
        0%, 100% {
          opacity: 1;
          transform: scale(1);
        }
        50% {
          opacity: 0.8;
          transform: scale(1.1);
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
    onMessageSeen,
    onMessageDelivered,
    onUserTyping,
    onOnlineStatus,
  } = useChat(userId);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [conversationsLoading, setConversationsLoading] = useState(true);
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

  // Fetch contacts (friends/teachers)
  useEffect(() => {
    const fetchContacts = async () => {
      try {
        setContactsLoading(true);
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

          // Get online status for all friends
          if (friendships.length > 0) {
            getOnlineStatus(friendships.map((f) => f.friend.id));
          }
        }
      } catch (error) {
        console.error('Error fetching contacts:', error);
      } finally {
        setContactsLoading(false);
      }
    };

    if (userId && userId !== 'guest') {
      fetchContacts();
    }
  }, [userId, getOnlineStatus]);

  // Fetch recent conversations to get last messages and unread counts
  useEffect(() => {
    const fetchRecentConversations = async () => {
      if (!userId || userId === 'guest') return;

      try {
        setConversationsLoading(true);
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
      } finally {
        setConversationsLoading(false);
      }
    };

    fetchRecentConversations();
  }, [userId]);

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

  // Update selectedContact online status when onlineUsers changes
  useEffect(() => {
    if (selectedContact) {
      const updatedContact = mergedContacts.find(c => c.id === selectedContact.id);
      if (updatedContact && updatedContact.online !== selectedContact.online) {
        setSelectedContact(updatedContact);
      }
    }
  }, [onlineUsers, selectedContact, mergedContacts]);

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

  // Listen for online status updates in real-time
  useEffect(() => {
    // Listen to WebSocket online status events
    const cleanup = onOnlineStatus((data) => {
      // Online status automatically updated via onlineUsers state
      console.log('📡 Online status updated:', data.onlineUsers);
    });

    // Poll online status every 10 seconds for contacts as backup
    const interval = setInterval(() => {
      if (contacts.length > 0) {
        getOnlineStatus(contacts.map(c => c.id));
      }
    }, 10000);

    return () => {
      cleanup?.();
      clearInterval(interval);
    };
  }, [contacts, getOnlineStatus, onOnlineStatus]);

  // Listen for message delivered status updates
  useEffect(() => {
    const cleanup = onMessageDelivered((data) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.messageId
            ? { ...msg, status: 'DELIVERED' as const, deliveredAt: data.deliveredAt }
            : msg
        )
      );
    });

    return cleanup;
  }, [onMessageDelivered]);

  // Listen for message seen status updates
  useEffect(() => {
    const cleanup = onMessageSeen((data) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.messageId
            ? { ...msg, status: 'SEEN' as const, readAt: data.readAt }
            : msg
        )
      );
    });

    return cleanup;
  }, [onMessageSeen]);

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
    <div className="h-[calc(100vh-80px)] bg-[radial-gradient(circle_at_10%_10%,#eef2ff,transparent_30%),radial-gradient(circle_at_90%_90%,#dbeafe,transparent_35%),linear-gradient(135deg,#f8fafc_0%,#f1f5f9_100%)] px-[4%] py-4">
      <div className="flex h-full overflow-hidden rounded-3xl border border-white/70 bg-white/40 backdrop-blur-md shadow-[0_20px_80px_rgba(30,41,59,0.12)]">
      {/* Contacts List */}
      <div className="w-80 bg-white/75 backdrop-blur-xl border-r border-slate-200/70 flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-200/80">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 bg-clip-text text-transparent mb-4 tracking-tight">
            Messages
          </h1>
          
          {/* Search */}
          <div className="relative">
            <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 bg-white/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400/60 focus:border-indigo-300 transition"
            />
          </div>

          {/* Filter */}
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setChatFilter('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                chatFilter === 'all'
                  ? 'bg-gradient-to-r from-indigo-600 to-sky-500 text-white shadow-md'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setChatFilter('unread')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                chatFilter === 'unread'
                  ? 'bg-gradient-to-r from-indigo-600 to-sky-500 text-white shadow-md'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Unread
            </button>
            <button
              onClick={() => setChatFilter('teachers')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                chatFilter === 'teachers'
                  ? 'bg-gradient-to-r from-indigo-600 to-sky-500 text-white shadow-md'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Teachers
            </button>
          </div>

          {/* Connection Status */}
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-200/70 px-2.5 py-1.5 w-fit">
            <div
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-gray-400'
              }`}
            />
            <span className="text-xs text-slate-600 font-medium">
              {isConnected ? 'Connected' : 'Connecting...'}
            </span>
          </div>
        </div>

        {/* Contact List */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
          {contactsLoading || conversationsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="p-3 rounded-2xl border border-slate-200 bg-white/80 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-slate-200" />
                    <div className="flex-1">
                      <div className="h-3 w-2/5 bg-slate-200 rounded mb-2" />
                      <div className="h-3 w-4/5 bg-slate-100 rounded" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-sm">
              No contacts found
            </div>
          ) : (
            filteredContacts.map((contact, index) => (
              <div
                key={contact.id}
                onClick={() => setSelectedContact(contact)}
                className={`p-3 rounded-2xl border cursor-pointer transition-all duration-300 ${
                  selectedContact?.id === contact.id
                    ? 'bg-gradient-to-r from-indigo-50 to-sky-50 border-indigo-200 shadow-sm'
                    : 'bg-white/80 border-slate-200 hover:border-indigo-200 hover:bg-white hover:shadow-sm'
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
                      <div 
                        className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full transition-all duration-300" 
                        style={{ animation: 'pulse-online 2s ease-in-out infinite' }}
                      />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-slate-900 truncate">
                        {contact.fullName}
                      </h3>
                      {contact.lastMessage && (
                        <span className="text-[11px] text-slate-500">
                          {formatTime(contact.lastMessage.createdAt)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 truncate mt-0.5">
                      {contact.lastMessage?.content || 'No messages yet'}
                    </p>
                  </div>

                  {contact.unreadCount > 0 && (
                    <div className="bg-gradient-to-r from-indigo-600 to-sky-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center shadow-sm">
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
      <div className="flex-1 flex flex-col bg-white/35">
        {selectedContact ? (
          <>
            {/* Chat Header */}
            <div className="bg-white/75 backdrop-blur-md border-b border-slate-200/80 p-4 flex items-center justify-between">
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
                    <div 
                      className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" 
                      style={{ animation: 'pulse-online 2s ease-in-out infinite' }}
                    />
                  )}
                </div>
                <div>
                  <h2 className="font-semibold text-slate-900">
                    {selectedContact.fullName}
                  </h2>
                  <p className={`text-sm font-medium transition-colors duration-300 ${
                    selectedContact.online ? 'text-green-600' : 'text-gray-500'
                  }`}>
                    {selectedContact.online ? 'Online' : 'Offline'}
                    {typingUsers.has(selectedContact.id) && ' • Typing...'}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <button className="p-2.5 hover:bg-slate-100 rounded-full transition-colors border border-transparent hover:border-slate-200">
                  <PhoneIcon className="w-5 h-5 text-slate-600" />
                </button>
                <button className="p-2.5 hover:bg-slate-100 rounded-full transition-colors border border-transparent hover:border-slate-200">
                  <VideoCameraIcon className="w-5 h-5 text-slate-600" />
                </button>
                <button className="p-2.5 hover:bg-slate-100 rounded-full transition-colors border border-transparent hover:border-slate-200">
                  <InformationCircleIcon className="w-5 h-5 text-slate-600" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[radial-gradient(circle_at_5%_10%,#eef2ff,transparent_25%),radial-gradient(circle_at_90%_80%,#e0f2fe,transparent_25%)]">
              {messages.map((message, index) => {
                const isMe = message.senderId === userId;
                const myMessages = messages.filter(m => m.senderId === userId);
                const lastMyMessageIndex = messages.lastIndexOf(myMessages[myMessages.length - 1]);
                const isLastMyMessage = isMe && index === lastMyMessageIndex;
                
                return (
                  <div
                    key={message.id}
                    className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-md px-4 py-2.5 rounded-2xl shadow-sm border ${
                        isMe
                          ? 'bg-gradient-to-r from-indigo-600 to-sky-500 text-white border-transparent'
                          : 'bg-white text-slate-900 border-slate-200'
                      }`}
                    >
                      <p>{message.content}</p>
                      <div
                        className={`text-xs mt-1 flex items-center gap-1 ${
                          isMe ? 'text-purple-200' : 'text-gray-500'
                        }`}
                      >
                        <span>{formatTime(message.createdAt)}</span>
                        {isLastMyMessage && message.status && (
                          <MessageStatusIcon 
                            status={message.status} 
                            className={isMe ? 'text-white opacity-90' : 'text-gray-500'}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="bg-white/80 backdrop-blur-md border-t border-slate-200 p-4">
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2.5 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <PaperClipIcon className="w-5 h-5 text-slate-600" />
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
                    className="w-full px-4 py-2.5 pr-12 border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-400/60 focus:border-indigo-300"
                  />
                  <button className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-slate-100 rounded-full">
                    <FaceSmileIcon className="w-5 h-5 text-slate-600" />
                  </button>
                </div>

                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                  className="p-3 bg-gradient-to-r from-indigo-600 to-sky-500 text-white rounded-full hover:shadow-lg hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  <PaperAirplaneIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center bg-white/80 backdrop-blur-sm border border-slate-200 rounded-3xl px-10 py-12 shadow-sm">
              <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-indigo-100 to-sky-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-12 h-12 text-indigo-600"
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
              <h3 className="text-xl font-semibold text-slate-900 mb-2">
                Select a conversation
              </h3>
              <p className="text-slate-600">
                Choose a contact to start chatting
              </p>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
