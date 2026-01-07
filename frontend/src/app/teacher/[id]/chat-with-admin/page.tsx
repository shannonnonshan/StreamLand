"use client";

import { useState, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Send, ArrowLeft, MessageCircle } from "lucide-react";
import Image from "next/image";
import { raleway } from "@/utils/front";

type ChatMessage = {
  id: number;
  text?: string;
  sender: "admin" | "me";
  time: string;
  attachments?: string[];
};

export default function ChatWithAdminPage() {
  const params = useParams();
  const router = useRouter();
  const teacherId = params.id as string;
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [toast, setToast] = useState<{show: boolean; message: string; type: 'error' | 'success'}>({show: false, message: '', type: 'success'});
  const [confirmModal, setConfirmModal] = useState<{show: boolean; messageId: number; attachmentUrl: string}>({show: false, messageId: 0, attachmentUrl: ''});

  const showToast = (message: string, type: 'error' | 'success' = 'error') => {
    setToast({show: true, message, type});
    setTimeout(() => setToast({show: false, message: '', type: 'success'}), 3000);
  };

  // Fetch messages from backend
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
        
        const response = await fetch(`${API_URL}/teacher/${teacherId}/admin-conversation`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          interface MessageResponse {
            id: string;
            content: string;
            senderId: string;
            createdAt: string;
            attachments?: string[];
          }
          const formattedMessages = data.map((msg: MessageResponse) => ({
            id: msg.id,
            text: msg.content,
            sender: msg.senderId === 'ADMIN' ? 'admin' : 'me',
            time: new Date(msg.createdAt).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit'
            }),
            attachments: msg.attachments || [],
          }));
          setMessages(formattedMessages.reverse()); // Reverse to show oldest first
        }
      } catch (error) {
        console.error('Error fetching messages:', error);
      }
    };

    if (teacherId) {
      fetchMessages();
      // Poll for new messages every 5 seconds
      const interval = setInterval(fetchMessages, 5000);
      return () => clearInterval(interval);
    }
  }, [teacherId]);

  // Auto scroll to bottom when new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

// Gửi tin nhắn
const handleSend = async () => {
  if (!message.trim() && selectedImages.length === 0) return;
  
  setLoading(true);
  try {
    const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    
    const formData = new FormData();
    formData.append('content', message.trim());
    selectedImages.forEach((image) => {
      formData.append('images', image);
    });
    
    const response = await fetch(`${API_URL}/teacher/${teacherId}/message-admin`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (response.ok) {
      const data = await response.json();
      const newMsg: ChatMessage = {
        id: data.id || data._id,
        text: data.content,
        sender: "me",
        time: new Date(data.createdAt).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit'
        }),
        attachments: data.attachments || [],
      };
      setMessages((prev) => [...prev, newMsg]);
      setMessage("");
      setSelectedImages([]);
      setImagePreviews([]);
    } else {
      alert('Failed to send message');
    }
  } catch (error) {
    console.error('Error sending message:', error);
    alert('Failed to send message');
  } finally {
    setLoading(false);
  }
};

// Xóa ảnh đính kèm
const handleRemoveAttachment = async (messageId: number, attachmentUrl: string) => {
  setConfirmModal({show: true, messageId, attachmentUrl});
};

const confirmRemoveAttachment = async () => {
  const { messageId, attachmentUrl } = confirmModal;
  setConfirmModal({show: false, messageId: 0, attachmentUrl: ''});
  
  try {
    const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    
    const response = await fetch(`${API_URL}/teacher/${teacherId}/message/${messageId}/remove-attachment`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ attachmentUrl }),
    });

    if (response.ok) {
      // Update local state
      setMessages((prev) => prev.map(msg => {
        if (msg.id === messageId) {
          return {
            ...msg,
            attachments: msg.attachments?.filter(url => url !== attachmentUrl) || []
          };
        }
        return msg;
      }));
      showToast('Image recalled successfully', 'success');
    } else {
      showToast('Failed to recall image');
    }
  } catch (error) {
    console.error('Error removing attachment:', error);
    showToast('Failed to recall image');
  }
};


  // Nhấn Enter để gửi
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={`${raleway.className} flex justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4`}>
      <div className="w-full max-w-5xl h-[85vh] rounded-2xl shadow-xl flex flex-col bg-white overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#292C6D] to-[#1f2350] px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="text-white hover:text-[#FAEDF0] transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 bg-[#FAEDF0] rounded-full flex items-center justify-center">
              <MessageCircle className="text-[#292C6D]" size={20} />
            </div>
            <div>
              <h1 className="text-white font-semibold text-lg">Admin Support</h1>
              <p className="text-[#FAEDF0] text-sm">We&apos;re here to help</p>
            </div>
          </div>
        </div>

        {/* Chat body */}
        <div className="flex-1 p-6 overflow-y-auto bg-gray-50 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <MessageCircle size={64} className="mb-4 opacity-30" />
              <p className="text-lg font-medium">No messages yet</p>
              <p className="text-sm">Start a conversation with admin</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${
                  msg.sender === "me" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`rounded-2xl px-4 py-3 max-w-[70%] shadow-sm ${
                    msg.sender === "me"
                      ? "bg-[#292C6D] text-white rounded-br-sm"
                      : "bg-white text-gray-900 border border-gray-200 rounded-bl-sm"
                  }`}
                >
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="mb-2 space-y-2">
                      {msg.attachments.map((imgUrl, idx) => (
                        <div key={idx} className="relative group">
                          <Image
                            src={imgUrl}
                            alt={`Attachment ${idx + 1}`}
                            width={300}
                            height={200}
                            className="rounded-lg object-cover"
                          />
                          {msg.sender === "me" && (
                            <button
                              onClick={() => handleRemoveAttachment(msg.id, imgUrl)}
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
                  {msg.text && <p className="leading-relaxed">{msg.text}</p>}
                  <span
                    className={`block text-xs mt-2 ${
                      msg.sender === "me"
                        ? "text-[#FAEDF0] text-right"
                        : "text-gray-400 text-left"
                    }`}
                  >
                    {msg.time}
                  </span>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>



        {/* Image Previews */}
        {imagePreviews.length > 0 && (
          <div className="p-4 bg-gray-50 border-t flex gap-2">
            {imagePreviews.map((preview, idx) => (
              <div key={idx} className="relative">
                <Image
                  src={preview}
                  alt={`Preview ${idx + 1}`}
                  width={80}
                  height={80}
                  className="rounded-lg object-cover"
                />
                <button
                  onClick={() => {
                    setSelectedImages(prev => prev.filter((_, i) => i !== idx));
                    setImagePreviews(prev => prev.filter((_, i) => i !== idx));
                  }}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input + Upload + Send */}
        <div className="flex items-center gap-3 p-4 bg-white border-t">
          <label className="cursor-pointer text-gray-400 hover:text-[#292C6D] transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
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
            />
          </label>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={loading}
            placeholder="Type your message..."
            className="flex-1 border border-gray-300 rounded-full px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#292C6D] focus:border-transparent text-gray-900 placeholder-gray-400 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={loading || (!message.trim() && selectedImages.length === 0)}
            className="bg-[#292C6D] text-white p-3 rounded-full hover:bg-[#1f2350] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
            ) : (
              <Send size={20} />
            )}
          </button>
        </div>
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
                onClick={() => setConfirmModal({show: false, messageId: 0, attachmentUrl: ''})}
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
