"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, Flag, User, Trash2, Check, X, ExternalLink, Search, Sparkles, Inbox, ChevronRight, RefreshCw } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface Notification {
  id: string;
  type: string;
  title: string;
  content: string;
  data?: Record<string, any>;
  read: boolean;
  createdAt: string;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const getToken = () =>
    typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;

  const fetchNotifications = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/notifications?limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setNotifications(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = async (id: string) => {
    const token = getToken();
    if (!token) return;
    await fetch(`${API_URL}/notifications/${id}/read`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = async () => {
    const token = getToken();
    if (!token) return;
    await fetch(`${API_URL}/notifications/mark-all-read`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const deleteNotification = async (id: string) => {
    const token = getToken();
    if (!token) return;
    await fetch(`${API_URL}/notifications/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setSelectedNotification((prev) => (prev?.id === id ? null : prev));
  };

  const getIcon = (type: string) => {
    if (type === "SYSTEM") return <Bell className="text-amber-500" size={18} />;
    if (type === "FRIEND_REQUEST" || type === "NEW_FOLLOWER")
      return <User className="text-sky-500" size={18} />;
    return <Flag className="text-rose-500" size={18} />;
  };

  const getAccentClass = (type: string) => {
    if (type === "SYSTEM") return "from-amber-500 to-lime-400";
    if (type === "FRIEND_REQUEST" || type === "NEW_FOLLOWER")
      return "from-sky-500 to-cyan-400";
    return "from-rose-500 to-orange-500";
  };

  const getApproveLink = (n: Notification) => {
    if (n.data?.type === "new_teacher_registration" && n.data?.teacherId)
      return `/admin/manage-account?pending=${n.data.teacherId}`;
    return null;
  };

  const filtered = notifications.filter((n) => {
    const matchType =
      typeFilter === "all" ||
      (typeFilter === "system" && n.type === "SYSTEM") ||
      (typeFilter === "user" && (n.data?.type === "new_teacher_registration" || n.type === "NEW_FOLLOWER")) ||
      (typeFilter === "other" && n.type !== "SYSTEM" && n.data?.type !== "new_teacher_registration");
    const q = searchQuery.trim().toLowerCase();
    const matchSearch = !q || `${n.title} ${n.content}`.toLowerCase().includes(q);
    return matchType && matchSearch;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;
  const teacherCount = notifications.filter((n) => n.data?.type === "new_teacher_registration").length;
  const systemCount = notifications.filter((n) => n.type === "SYSTEM").length;

  return (
    <div className="min-h-screen p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        {/* Header */}
        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
          <div className="relative px-5 py-5 sm:px-6 sm:py-6">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(15,23,42,0.02),transparent_55%)]" />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-700">
                  <Sparkles size={14} />
                  Notifications Center
                </div>
                <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-[2.15rem]">
                  Keep track of teacher registrations and system alerts.
                </h1>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Unread</p>
                  <p className="mt-1 text-lg font-black text-slate-950">{unreadCount}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Teachers</p>
                  <p className="mt-1 text-lg font-black text-slate-950">{teacherCount}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">System</p>
                  <p className="mt-1 text-lg font-black text-slate-950">{systemCount}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Toolbar */}
        <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-xs">
                <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search notifications..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2 pl-11 pr-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-500/10"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(["all", "user", "system", "other"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setTypeFilter(type)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      typeFilter === type
                        ? "bg-slate-950 text-white shadow-lg shadow-slate-950/15"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {type === "all" ? "All" : type === "user" ? "Teachers" : type === "system" ? "System" : "Other"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-2.5">
            <button
              onClick={fetchNotifications}
              className="flex flex-1 items-center justify-center gap-2 rounded-[18px] border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
            <button
              onClick={markAllAsRead}
              className="flex flex-1 items-center justify-center gap-2 rounded-[18px] border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
            >
              <Check size={16} />
              Mark all read
            </button>
          </div>
        </div>

        {/* List */}
        <div className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
          {loading ? (
            <div className="space-y-0 divide-y divide-slate-100">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-start gap-4 px-5 py-4 animate-pulse">
                  <div className="h-10 w-10 rounded-2xl bg-slate-200 shrink-0" />
                  <div className="flex-1 space-y-2 pt-1">
                    <div className="h-3 w-48 bg-slate-200 rounded" />
                    <div className="h-3 w-full bg-slate-100 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 p-8 text-center text-slate-500">
              <div className="rounded-full bg-slate-100 p-3 text-slate-400">
                <Inbox size={24} />
              </div>
              <div>
                <p className="text-lg font-semibold text-slate-800">No notifications</p>
                <p className="mt-1 text-sm text-slate-500">You're all caught up!</p>
              </div>
            </div>
          ) : (
            filtered.map((n) => (
              <div
                key={n.id}
                className={`group relative border-b border-slate-200/70 px-4 py-3.5 transition hover:bg-slate-50 cursor-pointer sm:px-5 ${
                  !n.read ? "bg-sky-50/40" : "bg-transparent"
                }`}
                onClick={() => { setSelectedNotification(n); if (!n.read) markAsRead(n.id); }}
              >
                <div className={`absolute left-0 top-4 h-10 w-1 rounded-r-full bg-gradient-to-b ${getAccentClass(n.type)} opacity-0 transition group-hover:opacity-100`} />
                <div className="flex items-start gap-4 pl-1">
                  <div className="shrink-0 rounded-2xl border border-slate-200 bg-slate-50 p-2.5 shadow-sm">
                    {getIcon(n.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-slate-950">{n.title}</p>
                          {!n.read && (
                            <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-sky-700">New</span>
                          )}
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">{n.content}</p>
                      </div>
                      <div className="flex items-center gap-2 md:ml-4">
                        {!n.read && (
                          <button
                            onClick={(e) => { e.stopPropagation(); markAsRead(n.id); }}
                            className="rounded-full bg-sky-100 px-3 py-2 text-xs font-semibold text-sky-700 transition hover:bg-sky-200"
                          >
                            Mark read
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                          className="rounded-full p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold uppercase tracking-[0.18em] text-slate-500">{n.type}</span>
                      <span>{timeAgo(n.createdAt)}</span>
                      <span className="text-slate-300">•</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedNotification(n); }}
                        className="inline-flex items-center gap-1 font-semibold text-slate-600 transition hover:text-slate-950"
                      >
                        Open details <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Detail modal */}
        {selectedNotification && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
            onClick={() => setSelectedNotification(null)}
          >
            <div
              className="w-full max-w-2xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_30px_90px_rgba(2,6,23,0.28)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_55%,#0ea5e9_100%)] px-6 py-5 text-white">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="rounded-2xl bg-white/15 p-3 backdrop-blur">
                      {getIcon(selectedNotification.type)}
                    </div>
                    <div>
                      <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80">
                        {selectedNotification.type}
                      </div>
                      <h2 className="mt-3 text-2xl font-bold tracking-tight">{selectedNotification.title}</h2>
                      <p className="mt-1 text-sm text-white/75">{timeAgo(selectedNotification.createdAt)}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedNotification(null)} className="rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20">
                    <X size={20} />
                  </button>
                </div>
              </div>
              <div className="p-5">
                <div className="rounded-3xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Message</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">{selectedNotification.content}</p>
                </div>
              </div>
              <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <button
                  onClick={() => { deleteNotification(selectedNotification.id); setSelectedNotification(null); }}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                >
                  <Trash2 size={16} /> Delete
                </button>
                {getApproveLink(selectedNotification) && (
                  <a
                    href={getApproveLink(selectedNotification)!}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    <ExternalLink size={16} /> Review Teacher
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}