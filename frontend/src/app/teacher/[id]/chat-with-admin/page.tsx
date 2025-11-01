"use client";

import { useState, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Paperclip, Send, X, ArrowLeft, MessageCircle } from "lucide-react";
import Image from "next/image";
import { raleway } from "@/utils/front";

type ChatMessage = {
  id: number;
  text?: string;
  images?: string[];
  sender: "admin" | "me";
  time: string;
};

export default function ChatWithAdminPage() {
  const params = useParams();
  const router = useRouter();
  const chatId = params.id || "unknown";
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [message, setMessage] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Auto scroll to bottom when new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Upload nhiều ảnh
  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setImages((prev) => [...prev, ...files]);
      const newPreviews = files.map((file) => URL.createObjectURL(file));
      setPreviews((prev) => [...prev, ...newPreviews]);
    }
  };

  // Xóa ảnh khỏi preview
  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };
  function formatDateTime(date: Date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0"); // tháng bắt đầu từ 0
  const year = date.getFullYear();
  return `${hours}:${minutes}, ${day}/${month}/${year}`;
}

// Gửi tin nhắn
const handleSend = () => {
  if (!message && previews.length === 0) return;

  const now = new Date();
  const time = formatDateTime(now);

  const newMsg: ChatMessage = {
    id: Date.now(),
    text: message || undefined,
    images: previews.length > 0 ? [...previews] : undefined,
    sender: "me",
    time,
  };

  setMessages((prev) => [...prev, newMsg]);
  setMessage("");
  setImages([]);
  setPreviews([]);

  // Fake admin auto reply sau 1.5 giây
  setTimeout(() => {
    const replyTime = formatDateTime(new Date());
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now() + 1,
        text: "The admin will respond to you shortly.",
        sender: "admin",
        time: replyTime,
      },
    ]);
  }, 1500);
};


  // Nhấn Enter để gửi
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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
                  {msg.images && (
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      {msg.images.map((src, i) => (
                        <div key={i} className="relative w-32 h-32 rounded-lg overflow-hidden">
                          <Image
                            src={src}
                            alt="uploaded"
                            fill
                            className="object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  )}
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

        {/* Preview ảnh trước khi gửi */}
        {previews.length > 0 && (
          <div className="flex flex-wrap gap-3 p-4 bg-white border-t">
            {previews.map((src, i) => (
              <div key={i} className="relative w-24 h-24 rounded-lg overflow-hidden border-2 border-gray-200">
                <Image
                  src={src}
                  alt={`preview-${i}`}
                  fill
                  className="object-cover"
                />
                <button
                  onClick={() => removeImage(i)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center hover:bg-red-600 shadow-lg transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input + Upload + Send */}
        <div className="flex items-center gap-3 p-4 bg-white border-t">
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
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            className="flex-1 border border-gray-300 rounded-full px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#292C6D] focus:border-transparent text-gray-900 placeholder-gray-400"
          />
          <button
            onClick={handleSend}
            disabled={!message && previews.length === 0}
            className="bg-[#292C6D] text-white p-3 rounded-full hover:bg-[#1f2350] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
