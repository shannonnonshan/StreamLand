"use client";

import { useState, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Send, ArrowLeft, MessageCircle, Paperclip, X } from "lucide-react";
import Image from "next/image";
import { raleway } from "@/utils/front";
import { useConfirmDialog } from "@/component/teacher/useConfirmDialog";

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
  const [toast, setToast] = useState<{ show: boolean; message: string; type: "error" | "success" }>({
    show: false,
    message: "",
    type: "success",
  });
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    messageId: number;
    attachmentUrl: string;
  }>({ show: false, messageId: 0, attachmentUrl: "" });
  const { showDialog, DialogComponent } = useConfirmDialog();

  const showToast = (message: string, type: "error" | "success" = "error") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000);
  };

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const token = localStorage.getItem("token") || localStorage.getItem("accessToken");
        const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
        const response = await fetch(`${API_URL}/teacher/${teacherId}/admin-conversation`, {
          headers: { Authorization: `Bearer ${token}` },
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
            sender: msg.senderId === "ADMIN" ? "admin" : "me",
            time: new Date(msg.createdAt).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            }),
            attachments: msg.attachments || [],
          }));
          setMessages(formattedMessages.reverse());
        }
      } catch (error) {
        console.error("Error fetching messages:", error);
      }
    };
    if (teacherId) {
      fetchMessages();
      const interval = setInterval(fetchMessages, 5000);
      return () => clearInterval(interval);
    }
  }, [teacherId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!message.trim() && selectedImages.length === 0) return;
    setLoading(true);
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("accessToken");
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const formData = new FormData();
      formData.append("content", message.trim());
      selectedImages.forEach((image) => formData.append("images", image));
      const response = await fetch(`${API_URL}/teacher/${teacherId}/message-admin`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (response.ok) {
        const data = await response.json();
        const newMsg: ChatMessage = {
          id: data.id || data._id,
          text: data.content,
          sender: "me",
          time: new Date(data.createdAt).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          attachments: data.attachments || [],
        };
        setMessages((prev) => [...prev, newMsg]);
        setMessage("");
        setSelectedImages([]);
        setImagePreviews([]);
      } else {
        showDialog({ title: "Error", message: "Failed to send message", type: "danger", confirmText: "OK" });
      }
    } catch (error) {
      console.error("Error sending message:", error);
      showDialog({ title: "Error", message: "Failed to send message", type: "danger", confirmText: "OK" });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAttachment = async (messageId: number, attachmentUrl: string) => {
    setConfirmModal({ show: true, messageId, attachmentUrl });
  };

  const confirmRemoveAttachment = async () => {
    const { messageId, attachmentUrl } = confirmModal;
    setConfirmModal({ show: false, messageId: 0, attachmentUrl: "" });
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("accessToken");
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const response = await fetch(`${API_URL}/teacher/${teacherId}/message/${messageId}/remove-attachment`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ attachmentUrl }),
      });
      if (response.ok) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId
              ? { ...msg, attachments: msg.attachments?.filter((url) => url !== attachmentUrl) || [] }
              : msg
          )
        );
        showToast("Image recalled successfully", "success");
      } else {
        showToast("Failed to recall image");
      }
    } catch (error) {
      console.error("Error removing attachment:", error);
      showToast("Failed to recall image");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={`${raleway.className} flex h-full flex-col px-4 pb-6 pt-5`}>
      <div className="mx-auto w-full max-w-7xl flex flex-col gap-4 h-full">

        {/* Header card — giống DocumentsLayout */}
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="flex items-center justify-center w-9 h-9 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 transition"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="flex items-center gap-3 flex-1">
              <div className="w-10 h-10 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center">
                <MessageCircle size={18} className="text-sky-600" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Teacher workspace
                </p>
                <h1 className="text-xl font-bold tracking-tight text-slate-900 leading-tight">
                  Chat with Admin
                </h1>
              </div>
            </div>
            {/* Online badge */}
            <div className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-emerald-700">Support online</span>
            </div>
          </div>
        </div>

        {/* Chat window card */}
        <div className="flex flex-col rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden flex-1 min-h-0" style={{ height: "calc(100vh - 260px)" }}>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3 bg-slate-50">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <MessageCircle size={28} className="opacity-40" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-500">No messages yet</p>
                  <p className="text-xs text-slate-400 mt-0.5">Start a conversation with admin</p>
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.sender === "me" ? "justify-end" : "justify-start"}`}>
                  {msg.sender === "admin" && (
                    <div className="w-8 h-8 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center shrink-0 mr-2 mt-1">
                      <MessageCircle size={14} className="text-sky-600" />
                    </div>
                  )}
                  <div
                    className={`rounded-2xl px-4 py-3 max-w-[65%] ${
                      msg.sender === "me"
                        ? "bg-sky-600 text-white rounded-br-sm"
                        : "bg-white text-slate-800 border border-slate-200 rounded-bl-sm shadow-sm"
                    }`}
                  >
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="mb-2 space-y-2">
                        {msg.attachments.map((imgUrl, idx) => (
                          <div key={idx} className="relative group">
                            <Image
                              src={imgUrl}
                              alt={`Attachment ${idx + 1}`}
                              width={280}
                              height={180}
                              className="rounded-xl object-cover"
                            />
                            {msg.sender === "me" && (
                              <button
                                onClick={() => handleRemoveAttachment(msg.id, imgUrl)}
                                className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                                title="Recall image"
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {msg.text && <p className="text-sm leading-relaxed">{msg.text}</p>}
                    <span className={`block text-[10px] mt-1.5 font-medium ${msg.sender === "me" ? "text-sky-200 text-right" : "text-slate-400 text-left"}`}>
                      {msg.time}
                    </span>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Image previews strip */}
          {imagePreviews.length > 0 && (
            <div className="px-4 py-3 border-t border-slate-100 bg-white flex gap-2">
              {imagePreviews.map((preview, idx) => (
                <div key={idx} className="relative">
                  <Image
                    src={preview}
                    alt={`Preview ${idx + 1}`}
                    width={72}
                    height={72}
                    className="rounded-xl object-cover border border-slate-200"
                  />
                  <button
                    onClick={() => {
                      setSelectedImages((prev) => prev.filter((_, i) => i !== idx));
                      setImagePreviews((prev) => prev.filter((_, i) => i !== idx));
                    }}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 shadow"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input bar */}
          <div className="flex items-center gap-3 px-4 py-3 border-t border-slate-100 bg-white">
            <label className="cursor-pointer w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition">
              <Paperclip size={16} />
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) {
                    const files = Array.from(e.target.files);
                    if (selectedImages.length + files.length > 2) {
                      showToast("You can only send up to 2 images at a time");
                      return;
                    }
                    setSelectedImages((prev) => [...prev, ...files]);
                    files.forEach((file) => {
                      const reader = new FileReader();
                      reader.onloadend = () => setImagePreviews((prev) => [...prev, reader.result as string]);
                      reader.readAsDataURL(file);
                    });
                    e.target.value = "";
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
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent disabled:opacity-50 transition"
            />

            <button
              onClick={handleSend}
              disabled={loading || (!message.trim() && selectedImages.length === 0)}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-sky-600 text-white hover:bg-sky-700 transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              ) : (
                <Send size={16} />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast.show && (
        <div className="fixed top-4 right-4 z-50">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-lg text-sm font-semibold border ${
            toast.type === "error"
              ? "bg-red-50 text-red-700 border-red-200"
              : "bg-emerald-50 text-emerald-700 border-emerald-200"
          }`}>
            {toast.type === "error" ? (
              <X size={16} />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            )}
            {toast.message}
          </div>
        </div>
      )}

      {/* Confirm modal */}
      {confirmModal.show && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center">
                <X size={18} className="text-red-500" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Recall image</h3>
            </div>
            <p className="text-sm text-slate-500 mb-5">
              Are you sure you want to recall this image? This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmModal({ show: false, messageId: 0, attachmentUrl: "" })}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmRemoveAttachment}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-sm font-semibold text-white hover:bg-red-600 transition"
              >
                Recall
              </button>
            </div>
          </div>
        </div>
      )}

      {DialogComponent}
    </div>
  );
}