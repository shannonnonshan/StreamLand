"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { 
  User, 
  Image as ImageIcon, 
  Send, 
  Clock, 
  CheckCircle2, 
  AlertCircle 
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
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [pendingChats, setPendingChats] = useState<ChatUser[]>([]);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [toast, setToast] = useState<{show: boolean; message: string; type: 'error' | 'success'}>({show: false, message: '', type: 'success'});
  const [confirmModal, setConfirmModal] = useState<{show: boolean; messageId: string; attachmentUrl: string}>({show: false, messageId: '', attachmentUrl: ''});

  const showToast = (message: string, type: 'error' | 'success' = 'error') => {
    setToast({show: true, message, type});
    setTimeout(() => setToast({show: false, message: '', type: 'success'}), 3000);
  };

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
        }
      } catch (error) {
        console.error('Error fetching conversations:', error);
      }
    };

    fetchConversations();
    const interval = setInterval(fetchConversations, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, []);

  // Fetch messages for selected user
  useEffect(() => {
    if (!selectedUser) return;

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
          setMessages((prev) => ({ ...prev, [selectedUser]: formatted.reverse() }));
        }
      } catch (error) {
        console.error('Error fetching messages:', error);
      }
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 5000); // Poll every 5s
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
        // Update local state for selected user
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

  return (
    <div className="h-[calc(100vh-4rem)] flex">
      {/* Pending Chats List */}
      <div className="w-72 border-r flex flex-col bg-white shadow-sm">
        <div className="px-4 py-3 border-b bg-gradient-to-r from-[#161853] to-[#0f1038]">
          <h2 className="text-base font-semibold text-white">Pending Messages</h2>
          {pendingChats.length > 0 && (
            <p className="text-xs text-gray-300 mt-1">{pendingChats.length} conversation{pendingChats.length !== 1 ? 's' : ''}</p>
          )}
        </div>
        <div className="overflow-y-auto flex-1">
          {pendingChats.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-gray-400">
              <p className="text-sm">No pending messages</p>
            </div>
          ) : (
            pendingChats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => setSelectedUser(chat.id)}
                className={`w-full px-3 py-3 flex items-start gap-3 border-b transition-all duration-200 hover:bg-blue-50 ${
                  selectedUser === chat.id ? "bg-blue-50 border-l-4 border-l-[#161853]" : "border-gray-100"
                }`}
              >
                <div className="relative flex-shrink-0">
                  <div className="w-11 h-11 bg-gradient-to-br from-[#161853] to-[#0f1038] rounded-full flex items-center justify-center text-white shadow-sm">
                    <User className="w-5 h-5" />
                  </div>
                  {chat.status === "online" && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white shadow-md" />
                  )}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-medium truncate text-gray-900 text-sm flex-1 text-left">{chat.name}</span>
                    {chat.unreadCount > 0 && (
                      <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold bg-[#EC255A] text-white rounded-full flex-shrink-0 shadow-md">
                        {chat.unreadCount}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 truncate mb-1.5 text-left">{chat.lastMessage}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400 text-left">
                      {new Date(chat.timestamp).toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </span>
                    {chat.status === "online" && (
                      <span className="text-xs text-green-600 font-medium">Online</span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-gray-50">
        {selectedUser ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b bg-white">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 bg-[#161853] rounded-full flex items-center justify-center text-white">
                    <User className="w-5 h-5" />
                  </div>
                  {pendingChats.find(c => c.id === selectedUser)?.status === "online" && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                  )}
                </div>
                <div>
                  <h3 className="font-medium">
                    {pendingChats.find(c => c.id === selectedUser)?.name}
                  </h3>
                  <span className="text-sm text-gray-500">
                    {pendingChats.find(c => c.id === selectedUser)?.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages[selectedUser]?.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.isAdmin ? "justify-end" : "justify-start"}`}
                >
                  <div className={`max-w-[70%] ${message.isAdmin ? "order-2" : "order-1"}`}>
                    <div
                      className={`rounded-lg p-3 ${
                        message.isAdmin
                          ? "bg-[#161853] text-white"
                          : "bg-white border shadow-sm"
                      }`}
                    >
                      {message.attachments && message.attachments.length > 0 && (
                        <div className="mb-2 space-y-2">
                          {message.attachments.map((imgUrl, idx) => (
                            <div key={idx} className="relative group">
                              <Image
                                src={imgUrl}
                                alt={`Attachment ${idx + 1}`}
                                width={300}
                                height={200}
                                className="rounded-lg object-cover"
                              />
                              {message.isAdmin && (
                                <button
                                  onClick={() => handleRemoveAttachment(message.id, imgUrl)}
                                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
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
                      {message.imageUrl && (
                        <div className="mb-2">
                          <Image
                            src={message.imageUrl}
                            alt="Attached image"
                            width={300}
                            height={200}
                            className="rounded-lg"
                          />
                        </div>
                      )}
                      <p className="whitespace-pre-wrap break-words">{message.content}</p>
                    </div>
                    <div
                      className={`flex items-center gap-1 mt-1 text-xs text-gray-500 
                        ${message.isAdmin ? "justify-end" : "justify-start"}`}
                    >
                      <span>
                        {new Date(message.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {!message.isAdmin && (
                        <>
                          {message.status === "pending" && <Clock className="w-3 h-3" />}
                          {message.status === "sent" && (
                            <CheckCircle2 className="w-3 h-3 text-green-500" />
                          )}
                          {message.status === "urgent" && (
                            <AlertCircle className="w-3 h-3 text-[#EC255A]" />
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Input Area */}
            <div className="p-4 border-t bg-white">
              <form onSubmit={handleSendMessage} className="space-y-4">
                {imagePreviews.length > 0 && (
                  <div className="flex gap-2">
                    {imagePreviews.map((preview, idx) => (
                      <div key={idx} className="relative w-32 h-32">
                        <Image
                          src={preview}
                          alt={`Preview ${idx + 1}`}
                          fill
                          className="object-cover rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedImages(prev => prev.filter((_, i) => i !== idx));
                            setImagePreviews(prev => prev.filter((_, i) => i !== idx));
                          }}
                          className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                        >
                          <span className="sr-only">Remove image</span>
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2 bg-white rounded-lg p-2 border border-gray-300">
                  <label className="cursor-pointer text-gray-500 hover:text-gray-700 flex items-center px-2">
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
                          
                          // Create previews
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
                      placeholder="Type a message..."
                      className="w-full resize-none border-none focus:ring-0 bg-transparent py-2"
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
                    className="p-2 text-[#161853] hover:text-[#0f1038] disabled:text-gray-400 flex items-center"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Select a chat to start messaging
          </div>
        )}
      </div>

      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed top-4 right-4 z-50 animate-fade-in">
          <div className={`px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 ${
            toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'
          } text-white`}>
            {toast.type === 'error' ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            )}
            <span className="font-medium">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scale-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-600">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="15" y1="9" x2="9" y2="15"></line>
                  <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900">Recall Image</h3>
            </div>
            <p className="text-gray-600 mb-6">Are you sure you want to recall this image? This action cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmModal({show: false, messageId: '', attachmentUrl: ''})}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmRemoveAttachment}
                className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium transition-colors"
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
