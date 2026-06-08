"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, SendHorizontal, Sparkles, User, WandSparkles, Eye, BookOpen } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { authenticatedFetch } from "@/lib/api/fetch";

type Role = "user" | "assistant";

type VideoCard = {
  id: string;
  title: string;
  teacher?: string;
  category?: string;
  thumbnail_url?: string;
  views?: number;
  summary?: string;
  link?: string;
};

type ChatMessage = {
  id: string;
  role: Role;
  text: string;
  time: string;
  videoCards?: VideoCard[];
};

type AiChatResponse = {
  status?: string;
  response?: string;
  message?: string;
  video_cards?: VideoCard[];
  retrieved_ids?: string[];
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const CHATBOT_URL = `${API_URL.replace(/\/$/, "")}/ai/chat`;

const POPULAR_QUESTIONS = [
  "What is the most important concept in this video?",
  "Explain the hardest part in simple terms",
  "What should I already know before watching this?",
  "What is the main goal of this video?",
  "Give me a real-world example from this video",
  "How can I apply what I learned in practice?",
  "What problems can I solve after learning this?",
  "What are common mistakes beginners make here?",
  "Why is this topic important to learn?",
  "How does this connect to other concepts I should know?",
  "What should I watch after this?",
  "Recommend beginner-friendly videos on this topic",
  "Are there more advanced videos about this?",
  "Recommend more videos by this teacher",
];

const nowLabel = () =>
  new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

const pickRandom = (arr: string[], n: number) =>
  [...arr].sort(() => Math.random() - 0.5).slice(0, n);

function VideoCardItem({ card }: { card: VideoCard }) {
  const href = card.link || (card.id ? `/student/video/${card.id}` : "#");

  return (
    <Link
      href={href}
      className="group flex min-w-[190px] max-w-[210px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-indigo-300 hover:shadow-md"
    >
      <div className="relative h-24 w-full bg-slate-100">
        {card.thumbnail_url ? (
          <Image
            src={card.thumbnail_url}
            alt={card.title}
            fill
            className="object-cover"
            sizes="210px"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <BookOpen className="h-7 w-7 text-slate-300" />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100">
          <div className="rounded-full bg-indigo-600/80 p-1.5">
            <Eye className="h-3.5 w-3.5 text-white" />
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1 p-2.5">
        <p className="line-clamp-2 text-xs font-semibold text-slate-900 leading-tight">
          {card.title}
        </p>
        {card.teacher && (
          <p className="text-[11px] text-slate-500 truncate">{card.teacher}</p>
        )}
        {card.category && (
          <span className="self-start rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600">
            {card.category}
          </span>
        )}
        {card.summary && (
          <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500 leading-relaxed">
            {card.summary}
          </p>
        )}
        {card.views !== undefined && card.views > 0 && (
          <p className="mt-auto pt-1 text-[10px] text-slate-400">
            {card.views.toLocaleString()} views
          </p>
        )}
      </div>
    </Link>
  );
}

function VideoCardsRow({ cards }: { cards: VideoCard[] }) {
  if (!cards.length) return null;
  return (
    <div className="mt-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Recommended videos
      </p>
      <div className="flex gap-2.5 overflow-x-auto pb-1">
        {cards.map((card) => (
          <VideoCardItem key={card.id} card={card} />
        ))}
      </div>
    </div>
  );
}

interface VideoAiChatPanelProps {
  videoId: string;
  title?: string;
}

export default function VideoAiChatPanel({ videoId, title }: VideoAiChatPanelProps) {
  const bootMessage: ChatMessage = useMemo(
    () => ({
      id: "boot-1",
      role: "assistant",
      text: "Hi, I'm StreamLand AI. Ask me anything about this video or what to study next.",
      time: nowLabel(),
    }),
    [],
  );

  const [messages, setMessages] = useState<ChatMessage[]>([bootMessage]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>(() => pickRandom(POPULAR_QUESTIONS, 4));
  const [excludedIds, setExcludedIds] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Reset khi chuyển video — không giữ lịch sử qua video khác
  useEffect(() => {
    setMessages([{ ...bootMessage, time: nowLabel() }]);
    setSuggestions(pickRandom(POPULAR_QUESTIONS, 4));
    setExcludedIds([]);
    setShowSuggestions(true);
  }, [videoId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping]);

  const sendMessageToAi = useCallback(
    async (
      text: string,
      currentMessages: ChatMessage[],
    ): Promise<{ reply: string; cards: VideoCard[] }> => {
      const history = currentMessages
        .filter((m) => m.id !== "boot-1")
        .map((m) => ({ role: m.role, msg: m.text }));

      const payload = {
        message: text,
        history,
        exclude_ids: excludedIds,
        top_k: 5,
        current_video_id: videoId || undefined,
        current_video_title: title || undefined,
      };

      try {
        const res = await fetch(CHATBOT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = (await res.json()) as AiChatResponse;
        return {
          reply: data.response || data.message || "No answer returned.",
          cards: data.video_cards ?? [],
        };
      } catch {
        const data = await authenticatedFetch(`${API_URL}/student/help/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text }),
        });
        return { reply: data.response || "No answer returned.", cards: [] };
      }
    },
    [videoId, title, excludedIds],
  );

  const handleSend = useCallback(
    async (value?: string) => {
      const text = (value ?? input).trim();
      if (!text || isTyping) return;

      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        text,
        time: nowLabel(),
      };

      const nextMessages = [...messages, userMsg];
      setMessages(nextMessages);
      setInput("");
      setShowSuggestions(false);
      setIsTyping(true);

      try {
        const { reply, cards } = await sendMessageToAi(text, nextMessages);

        if (cards.length) {
          setExcludedIds((prev) => [...prev, ...cards.map((c) => c.id)]);
        }

        setMessages([
          ...nextMessages,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            text: reply,
            time: nowLabel(),
            videoCards: cards.length ? cards : undefined,
          },
        ]);
      } catch (error) {
        const msg =
          error instanceof Error ? error.message : "AI service failed. Please try again.";
        setMessages([
          ...nextMessages,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            text: `Sorry, I couldn't get an answer: ${msg}`,
            time: nowLabel(),
          },
        ]);
      } finally {
        setIsTyping(false);
      }
    },
    [input, isTyping, messages, sendMessageToAi],
  );

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleSend();
  };

  return (
    <div className="flex min-h-[460px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-600 to-sky-500 text-white shadow-sm">
            <WandSparkles className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">AI Chat</p>
            <p className="text-xs text-slate-500 truncate max-w-[200px]">
              {title || "Ask me anything"}
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
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
                className={`w-full rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                  message.role === "user"
                    ? "rounded-br-md bg-gradient-to-br from-indigo-600 to-sky-500 text-white"
                    : "rounded-bl-md border border-slate-200 bg-white text-slate-800"
                }`}
              >
                <p className="whitespace-pre-line">{message.text}</p>

                {message.videoCards && message.videoCards.length > 0 && (
                  <VideoCardsRow cards={message.videoCards} />
                )}

                <p
                  className={`mt-2 text-[11px] ${
                    message.role === "user" ? "text-indigo-100" : "text-slate-400"
                  }`}
                >
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

        {/* Input area */}
        <div className="border-t border-slate-100 bg-white px-4 py-3 space-y-3">
          {showSuggestions && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Suggested questions
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">Tap a prompt to ask quickly</p>
              <div className="mt-3 space-y-2">
                {suggestions.map((prompt, i) => (
                  <button
                    key={`${prompt}-${i}`}
                    type="button"
                    onClick={() => handleSend(prompt)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-left text-xs text-slate-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50"
                  >
                    <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-50 text-[11px] font-semibold text-indigo-600">
                      {i + 1}
                    </span>
                    <span className="whitespace-normal break-words">{prompt}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={onSubmit}>
            <div className="flex items-end gap-3">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask AI about this video..."
                rows={2}
                className="flex-1 resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
              <button
                type="submit"
                disabled={!input.trim() || isTyping}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 px-4 font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <SendHorizontal className="h-4 w-4" />
                Send
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}