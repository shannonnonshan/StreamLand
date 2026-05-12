"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Bot, SendHorizonal, Sparkles, User, WandSparkles } from "lucide-react";
import { authenticatedFetch } from "@/lib/api/fetch";

type Role = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: Role;
  text: string;
  time: string;
};

const quickPrompts = [
  "Help me understand this lesson in simple terms",
  "Create a 7-day study plan for my current courses",
  "Quiz me with 5 questions from the latest livestream",
  "Summarize key points and suggest practice exercises",
];

const nowLabel = () =>
  new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function StudentHelpPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "boot-1",
      role: "assistant",
      text: "Hi, I am StreamLand AI. Ask me anything about your courses, livestreams, documents, or study strategy.",
      time: "",
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  const canSend = useMemo(() => input.trim().length > 0 && !isTyping, [input, isTyping]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, isTyping]);

  useEffect(() => {
    setMessages((prev) =>
      prev.map((message) =>
        message.id === "boot-1" && !message.time
          ? { ...message, time: nowLabel() }
          : message,
      ),
    );
  }, []);

  const sendMessageToAi = async (text: string) => {
    const body = await authenticatedFetch(`${API_URL}/student/help/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: text }),
    });

    return body.response || "No answer returned from AI.";
  };

  const handleSend = async (value?: string) => {
    const text = (value ?? input).trim();
    if (!text || isTyping) return;

    setMessages((prev) => [
      ...prev,
      {
        id: `u-${Date.now()}`,
        role: "user",
        text,
        time: nowLabel(),
      },
    ]);
    setInput("");
    setIsTyping(true);

    try {
      const reply = await sendMessageToAi(text);
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          text: reply,
          time: nowLabel(),
        },
      ]);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The AI service failed to respond. Please try again.";

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          text: `Sorry, I could not get an answer: ${message}`,
          time: nowLabel(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleSend();
  };

  return (
    <section className="h-full w-full bg-[radial-gradient(circle_at_10%_10%,#f8fafc,transparent_35%),radial-gradient(circle_at_95%_80%,#dbeafe,transparent_35%),linear-gradient(135deg,#eff6ff_0%,#ffffff_45%,#f8fafc_100%)] pl-24 pr-6 py-6">
      <div className="h-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
        <aside className="rounded-2xl border border-slate-200 bg-white/75 backdrop-blur-sm shadow-sm p-4 flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-600 to-sky-500 text-white grid place-items-center">
              <WandSparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">StreamLand AI</p>
              <p className="text-xs text-slate-500">Student Assistant</p>
            </div>
          </div>

          <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3 mb-4">
            <p className="text-xs font-semibold text-indigo-800 mb-1">Capabilities</p>
            <p className="text-xs text-indigo-700 leading-relaxed">
              Summarize lessons, answer learning questions, and create guided study plans.
            </p>
          </div>

          <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-2">Quick prompts</p>
          <div className="space-y-2 overflow-auto">
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => handleSend(prompt)}
                className="w-full text-left rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 transition"
              >
                {prompt}
              </button>
            ))}
          </div>
        </aside>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col min-h-[580px]">
          <div className="border-b border-slate-100 px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <p className="font-semibold text-slate-900">AI Chat</p>
            </div>
            <p className="text-xs text-slate-500">Connected through backend proxy</p>
          </div>

          <div ref={listRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4 bg-slate-50/50">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {message.role === "assistant" && (
                  <div className="h-8 w-8 rounded-lg bg-indigo-100 text-indigo-700 grid place-items-center flex-shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                    message.role === "user"
                      ? "bg-gradient-to-br from-indigo-600 to-sky-500 text-white rounded-br-md"
                      : "bg-white border border-slate-200 text-slate-800 rounded-bl-md"
                  }`}
                >
                  <p className="whitespace-pre-line">{message.text}</p>
                  <p
                    className={`mt-2 text-[11px] ${
                      message.role === "user" ? "text-indigo-100" : "text-slate-400"
                    }`}
                  >
                    {message.time}
                  </p>
                </div>

                {message.role === "user" && (
                  <div className="h-8 w-8 rounded-lg bg-slate-900 text-white grid place-items-center flex-shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}

            {isTyping && (
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-indigo-100 text-indigo-700 grid place-items-center">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="rounded-2xl rounded-bl-md bg-white border border-slate-200 px-4 py-3 shadow-sm">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 rounded-full bg-slate-300 animate-bounce [animation-delay:-0.2s]"></span>
                    <span className="h-2 w-2 rounded-full bg-slate-300 animate-bounce [animation-delay:-0.1s]"></span>
                    <span className="h-2 w-2 rounded-full bg-slate-300 animate-bounce"></span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={onSubmit} className="border-t border-slate-100 bg-white p-4">
            <div className="flex items-end gap-3">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask AI about lessons, exams, or study plans..."
                rows={2}
                className="flex-1 resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
              />
              <button
                type="submit"
                disabled={!canSend}
                className="h-11 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110 transition inline-flex items-center gap-2"
              >
                <SendHorizonal className="w-4 h-4" />
                Send
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
