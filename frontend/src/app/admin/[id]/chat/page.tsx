"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { 
  User, 
  Image as ImageIcon, 
  Send, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Search,
  MoreVertical,
  Smile,
  Paperclip
} from "lucide-react";

interface Message {
  id: string;
  content: string;
  timestamp: string;
  isAdmin: boolean;
  status: "pending" | "sent" | "urgent";
  imageUrl?: string;
  attachments?: string[];
}

interface ChatUser {
  id: string;
  name: string;
  avatar?: string;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  status: "online" | "offline";
}

export default function ChatPage() {
  const accent = "#161853";
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [pendingChats, setPendingChats] = useState<ChatUser[]>([]);
  const [filteredChats, setFilteredChats] = useState<ChatUser[]>([]);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState<{show: boolean; message: string; type: 'error' | 'success'}>({show: false, message: '', type: 'success'});
  const [confirmModal, setConfirmModal] = useState<{show: boolean; messageId: string; attachmentUrl: string}>({show: false, messageId: '', attachmentUrl: ''});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const showToast = (message: string, type: 'error' | 'success' = 'error') => {
    setToast({show: true, message, type});
    setTimeout(() => setToast({show: false, message: '', type: 'success'}), 3000);
  };

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch conversations from backend
  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
        
        const response = await fetch(`${API_URL}/admin/messages`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          interface ConversationResponse {
            userId: string;
            user: { fullName: string; avatar?: string };
            lastMessage: string;
            lastMessageAt: string;
            unread: boolean;
          }
          const formattedChats = data.map((conv: ConversationResponse) => ({
            id: conv.userId,
            name: conv.user.fullName,
            avatar: conv.user.avatar,
            lastMessage: conv.lastMessage,
            timestamp: conv.lastMessageAt,
            unreadCount: conv.unread ? 1 : 0,
            status: "online" as const,
          }));
          setPendingChats(formattedChats);
          setFilteredChats(formattedChats);
        }
      } catch (error) {
        console.error('Error fetching conversations:', error);
      }
    };

    fetchConversations();
    const interval = setInterval(fetchConversations, 10000);
    return () => clearInterval(interval);
  }, []);

  // Filter chats based on search
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredChats(pendingChats);
    } else {
      setFilteredChats(
        pendingChats.filter(chat =>
          chat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          chat.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    }
  }, [searchQuery, pendingChats]);

  // Fetch messages for selected user
  useEffect(() => {
    // Removed unused code

    const fetchMessages = async () => {
      try {
        const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
        
        const response = await fetch(`${API_URL}/admin/messages/${selectedUser}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          interface MessageResponse {
            id: string;
            content: string;
            createdAt: string;
            senderId: string;
            attachments?: string[];
          }
          const formatted = data.map((msg: MessageResponse) => ({
            id: msg.id,
            content: msg.content,
            timestamp: msg.createdAt,
            isAdmin: msg.senderId === 'ADMIN',
            status: "sent" as const,
            attachments: msg.attachments || [],
          }));
          if (selectedUser) {
            setMessages((prev) => ({ ...prev, [selectedUser]: formatted.reverse() }));
          }
        }
      } catch (error) {
        console.error('Error fetching messages:', error);
      }
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [selectedUser]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || (!newMessage.trim() && selectedImages.length === 0)) return;

    const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

    try {
      const formData = new FormData();
      formData.append('content', newMessage.trim());
      selectedImages.forEach((image) => {
        formData.append('images', image);
      });

      const response = await fetch(`${API_URL}/admin/messages/${selectedUser}/reply`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        const newMsg: Message = {
          id: data.id,
          content: newMessage.trim(),
          timestamp: new Date().toISOString(),
          isAdmin: true,
          status: "sent",
          attachments: data.attachments || [],
        };
        setMessages((prev) => ({
          ...prev,
          [selectedUser]: [...(prev[selectedUser] || []), newMsg],
        }));

        setNewMessage("");
        setSelectedImages([]);
        setImagePreviews([]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleRemoveAttachment = async (messageId: string, attachmentUrl: string) => {
    setConfirmModal({show: true, messageId, attachmentUrl});
  };

  const confirmRemoveAttachment = async () => {
    const { messageId, attachmentUrl } = confirmModal;
    setConfirmModal({show: false, messageId: '', attachmentUrl: ''});
    
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      
      const response = await fetch(`${API_URL}/admin/messages/${messageId}/remove-attachment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ attachmentUrl }),
      });

      if (response.ok) {
        if (selectedUser) {
          setMessages((prev) => ({
            ...prev,
            [selectedUser]: prev[selectedUser]?.map(msg => {
              if (msg.id === messageId) {
                return {
                  ...msg,
                  attachments: msg.attachments?.filter(url => url !== attachmentUrl) || []
                };
              }
              return msg;
            }) || []
          }));
        }
        showToast('Image recalled successfully', 'success');
      } else {
        showToast('Failed to recall image');
      }
    } catch (error) {
      console.error('Error removing attachment:', error);
      showToast('Failed to recall image');
    }
  };

  const selectedChatUser = pendingChats.find(c => c.id === selectedUser);

  return (
    <div className="h-[calc(100vh-4rem)] flex bg-[linear-gradient(180deg,#f8f6f1_0%,#f3efe7_100%)] text-slate-900">
      {/* Sidebar - Chat List */}
      <div className="w-80 bg-white/80 backdrop-blur-xl border-r border-black/5 flex flex-col shadow-[0_24px_60px_-40px_rgba(17,24,39,0.45)]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-black/5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Admin inbox</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Messages</h1>
          
          {/* Search */}
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-black/5 bg-white px-10 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-4 focus:ring-slate-200/70"
            />
          </div>
        </div>

        {/* Chat List */}
        <div className="overflow-y-auto flex-1">
          {filteredChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 px-4 text-slate-400">
              <svg className="w-12 h-12 mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-sm">No conversations</p>
            </div>
          ) : (
            <div className="space-y-1.5 p-2">
              {filteredChats.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => setSelectedUser(chat.id)}
                  className={`group w-full text-left px-4 py-3.5 rounded-2xl transition-all duration-200 ${
                    selectedUser === chat.id
                      ? "bg-slate-900/4 ring-1 ring-slate-900/5"
                      : "hover:bg-white hover:shadow-[0_12px_30px_-22px_rgba(15,23,42,0.55)]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      <div className="w-12 h-12 rounded-full flex items-center justify-center text-white shadow-[0_10px_24px_-14px_rgba(17,24,39,0.65)]" style={{ backgroundColor: accent }}>
                        <User className="w-6 h-6" />
                      </div>
                      {chat.status === "online" && (
                        <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white bg-emerald-500 shadow-sm" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="truncate text-sm font-medium text-slate-900">{chat.name}</p>
                        {chat.unreadCount > 0 && (
                          <span className="inline-flex min-w-5 h-5 shrink-0 items-center justify-center rounded-full bg-slate-900 px-1.5 text-[11px] font-semibold text-white shadow-sm">
                            {chat.unreadCount}
                          </span>
                        )}
                      </div>
                      <p className="truncate text-xs leading-5 text-slate-500">{chat.lastMessage}</p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {new Date(chat.timestamp).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedUser && selectedChatUser ? (
          <>
            {/* Chat Header */}
            <div className="flex items-center justify-between border-b border-black/5 bg-white/75 px-6 py-4 backdrop-blur-xl">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-white shadow-[0_10px_24px_-14px_rgba(17,24,39,0.65)]" style={{ backgroundColor: accent }}>
                    <User className="w-6 h-6" />
                  </div>
                  {selectedChatUser.status === "online" && (
                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white bg-emerald-500 shadow-sm" />
                  )}
                </div>
                <div>
                  <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">{selectedChatUser.name}</h2>
                  <p className="flex items-center gap-1 text-sm text-slate-500">
                    <span className={`inline-block h-2 w-2 rounded-full ${selectedChatUser.status === 'online' ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                    {selectedChatUser.status === 'online' ? 'Active now' : 'Offline'}
                  </p>
                </div>
              </div>
              <button className="rounded-full p-2.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.02),transparent_38%),linear-gradient(180deg,#faf9f6_0%,#ffffff_100%)] p-6 space-y-4">
              {messages[selectedUser]?.map((message, idx) => (
                <div
                  key={message.id}
                  className={`flex ${message.isAdmin ? "justify-end" : "justify-start"} animate-fade-in`}
                >
                  <div className={`max-w-[min(32rem,85%)] ${message.isAdmin ? "order-2" : "order-1"}`}>
                    <div
                      className={`rounded-2xl p-4 ${
                        message.isAdmin
                          ? "bg-slate-900 text-white shadow-[0_16px_34px_-22px_rgba(15,23,42,0.8)]"
                          : "border border-black/5 bg-white text-slate-900 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.45)]"
                      }`}
                    >
                      {message.attachments && message.attachments.length > 0 && (
                        <div className="mb-3 space-y-2">
                          {message.attachments.map((imgUrl, i) => (
                            <div key={i} className="relative group">
                              <Image
                                src={imgUrl}
                                alt={`Attachment ${i + 1}`}
                                width={300}
                                height={200}
                                className="rounded-lg object-cover max-h-48"
                              />
                              {message.isAdmin && (
                                <button
                                  onClick={() => handleRemoveAttachment(message.id, imgUrl)}
                                  className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                                  title="Recall image"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                  </svg>
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      <p className="whitespace-pre-wrap wrap-break-word text-[15px] leading-7">{message.content}</p>
                    </div>
                    <div
                      className={`mt-2 flex items-center gap-2 text-[11px] text-slate-400
                        ${message.isAdmin ? "justify-end" : "justify-start"}`}
                    >
                      <span>
                        {new Date(message.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {message.isAdmin && (
                        <>
                          {message.status === "pending" && <Clock className="w-3 h-3" />}
                          {message.status === "sent" && (
                            <CheckCircle2 className="w-3 h-3 text-green-500" />
                          )}
                          {message.status === "urgent" && (
                            <AlertCircle className="w-3 h-3 text-red-500" />
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t border-black/5 bg-white/80 p-6 backdrop-blur-xl">
              <form onSubmit={handleSendMessage} className="space-y-4">
                {imagePreviews.length > 0 && (
                  <div className="flex gap-3 overflow-x-auto pb-4">
                    {imagePreviews.map((preview, idx) => (
                      <div key={idx} className="relative group shrink-0">
                        <div className="h-24 w-24 overflow-hidden rounded-2xl border border-black/5 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.5)]">
                          <Image
                            src={preview}
                            alt={`Preview ${idx + 1}`}
                            width={96}
                            height={96}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedImages(prev => prev.filter((_, i) => i !== idx));
                            setImagePreviews(prev => prev.filter((_, i) => i !== idx));
                          }}
                          className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 shadow-lg transition-all"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="flex items-end gap-3 rounded-3xl border border-black/5 bg-white px-4 py-3 shadow-[0_20px_50px_-35px_rgba(15,23,42,0.6)] transition-shadow hover:shadow-[0_24px_60px_-38px_rgba(15,23,42,0.7)]">
                  <label className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => {
                        if (e.target.files) {
                          const files = Array.from(e.target.files);
                          const totalImages = selectedImages.length + files.length;
                          
                          if (totalImages > 2) {
                            showToast('You can only send up to 2 images at a time');
                            return;
                          }
                          
                          setSelectedImages(prev => [...prev, ...files]);
                          
                          files.forEach(file => {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setImagePreviews(prev => [...prev, reader.result as string]);
                            };
                            reader.readAsDataURL(file);
                          });
                          
                          e.target.value = '';
                        }
                      }}
                      className="hidden"
                    />
                    <ImageIcon className="w-5 h-5" />
                  </label>
                  
                  <div className="flex-1">
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type your message..."
                      className="max-h-24 w-full resize-none border-none bg-transparent text-[15px] placeholder-slate-400 focus:ring-0"
                      rows={1}
                      style={{
                        minHeight: "2.5rem",
                        height: "2.5rem",
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage(e);
                        }
                      }}
                    />
                  </div>
                  
                  <button
                    type="submit"
                    disabled={!newMessage.trim() && selectedImages.length === 0}
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-white shadow-[0_14px_28px_-18px_rgba(15,23,42,0.8)] transition hover:bg-slate-800 hover:shadow-[0_16px_32px_-18px_rgba(15,23,42,0.9)] disabled:bg-slate-300 disabled:shadow-none"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </form>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.02),transparent_35%),linear-gradient(180deg,#faf9f6_0%,#ffffff_100%)] text-slate-500">
            <svg className="mb-4 h-16 w-16 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-lg font-medium tracking-tight text-slate-700">Select a conversation to start</p>
            <p className="mt-1 text-sm text-slate-400">Choose a user from the list to begin messaging</p>
          </div>
        )}
      </div>

      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed top-6 right-6 z-50 animate-fade-in">
          <div className={`px-6 py-4 rounded-xl shadow-xl flex items-center gap-3 ${
            toast.type === 'error' 
              ? 'bg-red-500' 
              : 'bg-green-500'
          } text-white backdrop-blur-sm`}>
            {toast.type === 'error' ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            )}
            <span className="font-semibold">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 animate-scale-in">
            <div className="flex items-center justify-center w-14 h-14 bg-red-100 rounded-full mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-600">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 text-center mb-2">Recall Image?</h3>
            <p className="text-gray-600 text-center text-sm mb-6">This action cannot be undone. The image will be permanently removed.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmModal({show: false, messageId: '', attachmentUrl: ''})}
                className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmRemoveAttachment}
                className="flex-1 px-4 py-2.5 bg-linear-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-lg font-medium transition-all shadow-md hover:shadow-lg"
              >
                Recall
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
