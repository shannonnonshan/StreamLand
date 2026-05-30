"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Bot, SendHorizontal, Sparkles, User, WandSparkles } from "lucide-react";
import { authenticatedFetch } from "@/lib/api/fetch";

type Role = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: Role;
  text: string;
  time: string;
};

const quickPrompts = [
  "Summarize the main points from this video",
  "Explain this lesson in simpler words",
  "Create 5 quiz questions from the transcript",
  "What should I remember most from this livestream?",
];

const nowLabel = () =>
  new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const CHATBOT_URL = `${API_URL.replace(/\/$/, "")}/ai/chat`;

const getChatHistoryKey = (videoId: string) => {
  if (typeof window === "undefined") return null;

  try {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const parsed = JSON.parse(storedUser) as { id?: string; userId?: string; email?: string };
      const viewerId = parsed.id || parsed.userId || parsed.email || "guest";
      return `streamland:video-ai-history:${videoId}:${viewerId}`;
    }
  } catch {
    // Ignore malformed storage payloads.
  }

  return `streamland:video-ai-history:${videoId}:guest`;
};

const readChatHistory = (videoId: string) => {
  if (typeof window === "undefined") return null;
  const key = getChatHistoryKey(videoId);
  if (!key) return null;

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as ChatMessage[];
    if (!Array.isArray(parsed)) return null;

    return parsed.filter(
      (message) =>
        message &&
        (message.role === "user" || message.role === "assistant") &&
        typeof message.id === "string" &&
        typeof message.text === "string" &&
        typeof message.time === "string",
    );
  } catch {
    return null;
  }
};

const bootMessage: ChatMessage = {
  id: "boot-1",
  role: "assistant",
  text: "Hi, I am StreamLand AI. Ask me about this video, the transcript, or what to study next.",
  time: "",
};

const createBootMessages = (): ChatMessage[] => [{ ...bootMessage, time: nowLabel() }];

interface VideoAiChatPanelProps {
  videoId: string;
  title?: string;
}

export default function VideoAiChatPanel({ videoId, title }: VideoAiChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(createBootMessages);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  const canSend = useMemo(() => input.trim().length > 0 && !isTyping, [input, isTyping]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, isTyping]);

  useEffect(() => {
    const stored = readChatHistory(videoId);
    if (stored && stored.length > 0) {
      setMessages(stored);
      return;
    }

    setMessages(createBootMessages());
  }, [videoId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = getChatHistoryKey(videoId);
    if (!key) return;
    localStorage.setItem(key, JSON.stringify(messages));
  }, [messages, videoId]);

  const sendMessageToAi = async (text: string) => {
    try {
      const response = await fetch(CHATBOT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: text }),
      });

      if (!response.ok) {
        throw new Error("Chatbot request failed");
      }

      const data = await response.json();
      return data.response || data.message || "No answer returned from AI.";
    } catch {
      const body = await authenticatedFetch(`${API_URL}/student/help/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: text }),
      });

      return body.response || "No answer returned from AI.";
    }
  };

  const handleSend = async (value?: string) => {
    const text = (value ?? input).trim();
    if (!text || isTyping) return;

    const userMessage: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      text,
      time: nowLabel(),
    };

    const nextMessages: ChatMessage[] = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setIsTyping(true);

    try {
      const reply = await sendMessageToAi(text);
      const assistantMessage: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        text: reply,
        time: nowLabel(),
      };

      setMessages([...nextMessages, assistantMessage]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The AI service failed to respond. Please try again.";
      const fallbackMessage: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        text: `Sorry, I could not get an answer: ${message}`,
        time: nowLabel(),
      };

      setMessages([...nextMessages, fallbackMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    handleSend();
  };

  return (
    <div className="flex min-h-115 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-linear-to-br from-indigo-600 to-sky-500 text-white shadow-sm">
            <WandSparkles className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">AI Chat</p>
            <p className="text-xs text-slate-500">Ask about {title || "this video"}</p>
          </div>
        </div>
      </div>

      <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto bg-slate-50/60 px-4 py-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {message.role === "assistant" && (
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-100 text-indigo-700">
                <Bot className="h-4 w-4" />
              </div>
            )}

            <div
              className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                message.role === "user"
                  ? "rounded-br-md bg-linear-to-br from-indigo-600 to-sky-500 text-white"
                  : "rounded-bl-md border border-slate-200 bg-white text-slate-800"
              }`}
            >
              <p className="whitespace-pre-line">{message.text}</p>
              <p className={`mt-2 text-[11px] ${message.role === "user" ? "text-indigo-100" : "text-slate-400"}`}>
                {message.time}
              </p>
            </div>

            {message.role === "user" && (
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-900 text-white">
                <User className="h-4 w-4" />
              </div>
            )}
          </div>
        ))}

        {isTyping && (
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-100 text-indigo-700">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-slate-300 [animation-delay:-0.2s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-slate-300 [animation-delay:-0.1s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-slate-300" />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 bg-white px-4 py-3">
        <div className="mb-3 flex flex-wrap gap-2">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => handleSend(prompt)}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-left text-xs text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
            >
              {prompt}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit}>
          <div className="flex items-end gap-3">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask AI about this video..."
              rows={2}
              className="flex-1 resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
            <button
              type="submit"
              disabled={!canSend}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-linear-to-r from-indigo-600 to-sky-500 px-4 font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <SendHorizontal className="h-4 w-4" />
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}