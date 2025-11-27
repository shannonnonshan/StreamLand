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
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [pendingChats, setPendingChats] = useState<ChatUser[]>([]);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});

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
          }
          const formatted = data.map((msg: MessageResponse) => ({
            id: msg.id,
            content: msg.content,
            timestamp: msg.createdAt,
            isAdmin: msg.senderId === 'ADMIN',
            status: "sent" as const,
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



  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImage(file);
      
      // Create preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || (!newMessage.trim() && !selectedImage)) return;

    const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

    try {
      const response = await fetch(`${API_URL}/admin/messages/${selectedUser}/reply`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: newMessage.trim(),
        }),
      });

      if (response.ok) {
        // Add message to local state immediately
        const newMsg: Message = {
          id: Date.now().toString(),
          content: newMessage.trim(),
          timestamp: new Date().toISOString(),
          isAdmin: true,
          status: "sent",
        };
        setMessages((prev) => ({
          ...prev,
          [selectedUser]: [...(prev[selectedUser] || []), newMsg],
        }));

        setNewMessage("");
        setSelectedImage(null);
        setImagePreview(null);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex">
      {/* Pending Chats List */}
      <div className="w-80 border-r flex flex-col bg-white">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold text-[#161853]">Pending Messages</h2>
        </div>
        <div className="overflow-y-auto flex-1">
          {pendingChats.map((chat) => (
            <button
              key={chat.id}
              onClick={() => setSelectedUser(chat.id)}
              className={`w-full p-4 flex items-start gap-3 hover:bg-gray-50 transition-colors ${
                selectedUser === chat.id ? "bg-gray-50" : ""
              }`}
            >
              <div className="relative">
                <div className="w-10 h-10 bg-[#161853] rounded-full flex items-center justify-center text-white">
                  <User className="w-5 h-5" />
                </div>
                {chat.status === "online" && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-medium truncate">{chat.name}</span>
                  <div className="flex items-center gap-2">
                    {chat.unreadCount > 0 && (
                      <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium bg-[#EC255A] text-white rounded-full">
                        {chat.unreadCount}
                      </span>
                    )}
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                      {new Date(chat.timestamp).toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-gray-500 truncate">{chat.lastMessage}</p>
              </div>
            </button>
          ))}
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
                {imagePreview && (
                  <div className="relative w-32 h-32">
                    <Image
                      src={imagePreview}
                      alt="Preview"
                      fill
                      className="object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedImage(null);
                        setImagePreview(null);
                      }}
                      className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                    >
                      <span className="sr-only">Remove image</span>
                      ×
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2 bg-white rounded-lg p-2 border border-gray-300">
                  <label className="cursor-pointer text-gray-500 hover:text-gray-700 flex items-center px-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
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
                    disabled={!newMessage.trim() && !selectedImage}
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
    </div>
  );
}
