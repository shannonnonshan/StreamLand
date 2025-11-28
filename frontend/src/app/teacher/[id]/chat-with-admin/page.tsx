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
};

export default function ChatWithAdminPage() {
  const params = useParams();
  const router = useRouter();
  const teacherId = params.id as string;
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

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
          }
          const formattedMessages = data.map((msg: MessageResponse) => ({
            id: msg.id,
            text: msg.content,
            sender: msg.senderId === 'ADMIN' ? 'admin' : 'me',
            time: new Date(msg.createdAt).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit'
            }),
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
  if (!message.trim()) return;
  
  setLoading(true);
  try {
    const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    
    const response = await fetch(`${API_URL}/teacher/${teacherId}/message-admin`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: message.trim() }),
    });

    if (response.ok) {
      const data = await response.json();
      // Use the actual message from server with MongoDB _id
      const newMsg: ChatMessage = {
        id: data.id || data._id,
        text: data.content,
        sender: "me",
        time: new Date(data.createdAt).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit'
        }),
      };
      setMessages((prev) => [...prev, newMsg]);
      setMessage("");
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



        {/* Input + Upload + Send */}
        <div className="flex items-center gap-3 p-4 bg-white border-t">
          {/* Temporarily disabled - image upload to R2 not implemented yet
          <label className="cursor-pointer text-gray-400 hover:text-[#292C6D] transition-colors">
            <Paperclip size={24} />
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleUpload}
            />
          </label>
          */}
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
            disabled={loading || !message.trim()}
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
    </div>
  );
}
