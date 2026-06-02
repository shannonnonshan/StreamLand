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

type AiChatResponse = {
  response?: string;
  message?: string;
};

type VideoRecommendation = {
  title: string;
  teacher?: string;
  category?: string;
  views?: string;
  tags?: string;
  summary?: string;
  link?: string;
};

const buildPopularQuestions = (videoTitle?: string) => {
  const topic = videoTitle?.trim() ? `"${videoTitle.trim()}"` : "this video";
  return [
    `Summarize the main points from ${topic}`,
    `Explain ${topic} in simpler words`,
    `What are the key takeaways from ${topic}?`,
    `Create 5 quiz questions from ${topic}`,
    `Give me 3 practice exercises about ${topic}`,
    `What concepts might appear in exams from ${topic}?`,
    `List important terms and definitions used in ${topic}`,
    `Break down ${topic} into 5 bullet points`,
    `What should I review after finishing ${topic}?`,
    `Explain the hardest part of ${topic} in an easy way`,
    `Give a real-world example related to ${topic}`,
    `What are common mistakes students make in ${topic}?`,
    `Provide a short revision plan for ${topic}`,
    `Generate flashcards from ${topic}`,
    `Give me a quick recap of ${topic} in 3 sentences`,
    `What questions should I ask the teacher about ${topic}?`,
    `Recommend more videos from the same teacher as ${topic}`,
    `Recommend more videos in the same category as ${topic}`,
    `Suggest follow-up videos after ${topic}`,
    `Compare ${topic} with a similar concept`,
    `Explain ${topic} step-by-step`,
    `Summarize the transcript of ${topic} in simple language`,
  ];
};

const pickRandomQuestions = (questions: string[], count: number) => {
  const shuffled = [...questions].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.max(1, Math.min(count, questions.length)));
};

const nowLabel = () =>
  new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const CHATBOT_URL = `${API_URL.replace(/\/$/, "")}/ai/chat`;


const bootMessage: ChatMessage = {
  id: "boot-1",
  role: "assistant",
  text: "Hi, I am StreamLand AI. Ask me about this video, the transcript, or what to study next.",
  time: "",
};

const createBootMessages = (): ChatMessage[] => [{ ...bootMessage, time: nowLabel() }];

const parseVideoRecommendations = (text: string): VideoRecommendation[] => {
  if (!text || !text.includes("Video Recommendation")) return [];

  const blocks = text
    .split(/\n\s*---\s*\n|\n\s*###\s*\*\*Video Recommendation:\*\*\s*\n/i)
    .map((block) => block.trim())
    .filter(Boolean);

  const extractLine = (block: string, label: string) => {
    const match = block.match(new RegExp(`\\*\\*${label}:\\*\\*\\s*(.+)`, "i"));
    return match?.[1]?.trim();
  };

  const extractLink = (block: string) => {
    const match = block.match(/\[Watch Now\]\(([^)]+)\)/i);
    return match?.[1]?.trim();
  };

  const results: VideoRecommendation[] = [];

  blocks.forEach((block) => {
    const title = extractLine(block, "Title");
    if (!title) return;

    results.push({
      title,
      teacher: extractLine(block, "Teacher"),
      category: extractLine(block, "Category"),
      views: extractLine(block, "Views"),
      tags: extractLine(block, "Tags"),
      summary: extractLine(block, "Summary"),
      link: extractLink(block),
    });
  });

  return results;
};

interface VideoAiChatPanelProps {
  videoId: string;
  title?: string;
}

export default function VideoAiChatPanel({ videoId, title }: VideoAiChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(createBootMessages);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const listRef = useRef<HTMLDivElement | null>(null);

  const popularQuestions = useMemo(() => buildPopularQuestions(title), [title]);
  const displaySuggestions = useMemo(
    () => (suggestions.length > 0 ? suggestions.slice(0, 4) : pickRandomQuestions(popularQuestions, 4)),
    [suggestions, popularQuestions],
  );

  const canSend = useMemo(() => input.trim().length > 0 && !isTyping, [input, isTyping]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, isTyping]);

  useEffect(() => {
    setMessages(createBootMessages());
    setSuggestions(pickRandomQuestions(popularQuestions, 4));
  }, [videoId, popularQuestions]);

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

      const data = (await response.json()) as AiChatResponse;
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

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col min-w-0">
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
                      ? "rounded-br-md bg-linear-to-br from-indigo-600 to-sky-500 text-white"
                      : "rounded-bl-md border border-slate-200 bg-white text-slate-800"
                  }`}
                >
                  <p className="whitespace-pre-line">{message.text}</p>
                  {message.role === "assistant" && parseVideoRecommendations(message.text).length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Recommended videos
                      </p>
                      <div className="flex gap-3 overflow-x-auto pb-2">
                        {parseVideoRecommendations(message.text).map((rec, index) => (
                          <div
                            key={`${rec.title}-${index}`}
                            className="min-w-[220px] rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                          >
                            <p className="text-sm font-semibold text-slate-900 line-clamp-2">{rec.title}</p>
                            {rec.teacher && (
                              <p className="mt-1 text-xs text-slate-500">Teacher: {rec.teacher}</p>
                            )}
                            {rec.category && (
                              <p className="text-xs text-slate-500">Category: {rec.category}</p>
                            )}
                            {rec.views && (
                              <p className="text-xs text-slate-500">Views: {rec.views}</p>
                            )}
                            {rec.tags && rec.tags !== "None" && (
                              <p className="text-xs text-slate-500">Tags: {rec.tags}</p>
                            )}
                            {rec.summary && (
                              <p className="mt-2 text-xs text-slate-600 line-clamp-3">{rec.summary}</p>
                            )}
                            {rec.link && (
                              <a
                                href={rec.link}
                                className="mt-3 inline-flex text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                              >
                                Watch now
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Suggested questions</p>
              <p className="mt-1 text-[11px] text-slate-400">Tap a prompt to ask quickly</p>
              <div className="mt-3 space-y-2">
                {displaySuggestions.map((prompt, index) => (
                  <button
                    key={`${prompt}-${index}`}
                    type="button"
                    onClick={() => handleSend(prompt)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-left text-xs text-slate-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50"
                  >
                    <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-50 text-[11px] font-semibold text-indigo-600">
                      {index + 1}
                    </span>
                    <span className="whitespace-normal break-words">{prompt}</span>
                  </button>
                ))}
              </div>
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
      </div>
    </div>
  );
}