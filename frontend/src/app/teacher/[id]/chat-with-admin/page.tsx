"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Paperclip, Send, X } from "lucide-react";
import Image from "next/image";
import {raleway} from "@/utils/front";
type ChatMessage = {
  id: number;
  text?: string;
  images?: string[];
  sender: "admin" | "me";
  time: string;
};

export default function ChatWithAdminPage() {
  const params = useParams();
  const chatId = params.id || "unknown";

  const [message, setMessage] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

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
    <div className={`${raleway.variable} flex top-[10%] justify-center min-h-screen bg-gray-50 text-black overflow-hidden p-4`}>
      <div className="w-[85%] h-[80vh] border rounded-4xl shadow-sm flex flex-col justify-between bg-white">
        {/* Header */}
        <div className="px-3 py-2 font-semibold text-sm border-b">
          Chat with Admin – ID: {chatId}
        </div>

        {/* Chat body */}
        <div className="flex-1 p-3 overflow-y-auto text-sm space-y-2">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${
                msg.sender === "me" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`rounded-lg px-3 py-2 max-w-[70%] ${
                  msg.sender === "me"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200 text-black"
                }`}
              >
                {msg.text && <p>{msg.text}</p>}
                {msg.images && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {msg.images.map((src, i) => (
                      <div key={i} className="relative w-32 h-32">
                        <Image
                          src={src}
                          alt="uploaded"
                          fill
                          className="rounded object-cover"
                        />
                      </div>
                    ))}
                  </div>
                )}
                <span className={`block text-xs  ${
                  msg.sender === "me" ? "text-white mt-1 text-right" : "text-gray-500 mt-1 text-left"
                }`}>
                  {msg.time}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Preview ảnh trước khi gửi */}
        {previews.length > 0 && (
          <div className="flex flex-wrap gap-2 p-2 border-t bg-gray-50">
            {previews.map((src, i) => (
              <div key={i} className="relative w-20 h-20">
                <Image
                  src={src}
                  alt={`preview-${i}`}
                  fill
                  className="rounded border object-cover"
                />
                <button
                  onClick={() => removeImage(i)}
                  className="absolute top-0 right-0 bg-black bg-opacity-60 text-white p-1 rounded-bl"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input + Upload + Send */}
        <div className="flex items-center p-2 gap-2 border-t">
          <label className="cursor-pointer text-gray-500 hover:text-gray-700">
            <Paperclip size={20} />
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
            placeholder="Aa"
            className="flex-1 border rounded px-2 py-1 text-sm focus:outline-none"
          />
          <button
            onClick={handleSend}
            className="bg-black text-white p-2 rounded-full hover:bg-gray-800"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
