"use client";

import { useMemo, useState } from "react";
import { Bell, Flag, User, Trash2, Check, X, ExternalLink, Search, Sparkles, Inbox, ShieldAlert, ChevronRight } from "lucide-react";

interface Notification {
  id: number;
  type: 'report' | 'user' | 'system';
  title: string;
  message: string;
  detailedMessage?: string;
  time: string;
  isRead: boolean;
  link?: string;
}

export default function NotificationsPage() {
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<'all' | 'report' | 'user' | 'system'>('all');
  // Mock notifications data - in real app, this would come from an API
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: 1,
      type: 'report',
      title: 'New Content Report',
      message: 'A new content has been reported for inappropriate content',
      detailedMessage: `A user has reported content for violating community guidelines. The content in question contains inappropriate material that needs immediate review.

Content Details:
- Type: Video
- Title: "Introduction to Programming"
- Reported by: User123
- Reason: Inappropriate content
- Additional notes: Contains offensive language and inappropriate gestures

Please review this content as soon as possible and take appropriate action according to our community guidelines.`,
      time: '5 minutes ago',
      isRead: false,
      link: '/admin/content/123'
    },
    {
      id: 2,
      type: 'user',
      title: 'New User Registration',
      message: 'Teacher John Doe has registered and needs approval',
      detailedMessage: `A new teacher registration requires your review and approval.

Teacher Information:
- Name: John Doe
- Email: john.doe@example.com
- Subject: Mathematics
- Experience: 8 years
- Institution: ABC University
- Verification Status: Documents Submitted

The teacher has submitted all required documentation for verification. Please review the provided materials and either approve or reject the registration.`,
      time: '1 hour ago',
      isRead: false,
      link: '/admin/users/pending/456'
    },
    {
      id: 3,
      type: 'system',
      title: 'System Update',
      message: 'System maintenance scheduled for tonight at 2 AM',
      time: '2 hours ago',
      isRead: false
    },
    {
      id: 4,
      type: 'report',
      title: 'Content Report Update',
      message: 'A previously reported content has been reviewed',
      time: '1 day ago',
      isRead: true
    }
  ]);

  const markAsRead = (id: number) => {
    setNotifications((prev) => prev.map(notif => 
      notif.id === id ? { ...notif, isRead: true } : notif
    ));
  };

  const deleteNotification = (id: number) => {
    setNotifications((prev) => prev.filter(notif => notif.id !== id));
    setSelectedNotification((prev) => (prev?.id === id ? null : prev));
  };

  const unreadCount = useMemo(() => notifications.filter((notification) => !notification.isRead).length, [notifications]);
  const reportCount = useMemo(() => notifications.filter((notification) => notification.type === 'report').length, [notifications]);
  const systemCount = useMemo(() => notifications.filter((notification) => notification.type === 'system').length, [notifications]);

  const filteredNotifications = useMemo(() => {
    return notifications.filter((notification) => {
      const matchesType = typeFilter === 'all' || notification.type === typeFilter;
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch = !query || [notification.title, notification.message, notification.detailedMessage || '']
        .join(' ')
        .toLowerCase()
        .includes(query);

      return matchesType && matchesSearch;
    });
  }, [notifications, searchQuery, typeFilter]);

  const getIcon = (type: Notification['type']) => {
    if (type === 'report') return <Flag className="text-rose-500" size={18} />;
    if (type === 'user') return <User className="text-sky-500" size={18} />;
    return <Bell className="text-amber-500" size={18} />;
  };

  const getAccentClass = (type: Notification['type']) => {
    if (type === 'report') return 'from-rose-500 to-orange-500';
    if (type === 'user') return 'from-sky-500 to-cyan-400';
    return 'from-amber-500 to-lime-400';
  };

  return (
    <div className="min-h-screen p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
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
                  Keep track of reports, users, and system alerts in one place.
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  Review incoming alerts quickly, filter what matters, and open full details without leaving the page.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Unread</p>
                  <p className="mt-1 text-lg font-black text-slate-950">{unreadCount}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Reports</p>
                  <p className="mt-1 text-lg font-black text-slate-950">{reportCount}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">System</p>
                  <p className="mt-1 text-lg font-black text-slate-950">{systemCount}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-105">
                <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search notifications..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2 pl-11 pr-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-500/10"
                />
              </div>

              <div className="flex flex-wrap gap-1.5">
                {(['all', 'report', 'user', 'system'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setTypeFilter(type)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      typeFilter === type
                        ? 'bg-slate-950 text-white shadow-lg shadow-slate-950/15'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {type === 'all' ? 'All' : type === 'report' ? 'Reports' : type === 'user' ? 'Users' : 'System'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-2.5">
            <button
              onClick={() => setNotifications([])}
              className="flex flex-1 items-center justify-center gap-2 rounded-[18px] border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
            >
              <Trash2 size={16} />
              Clear all
            </button>
            <button
              onClick={() => setNotifications((prev) => prev.map(n => ({ ...n, isRead: true })))}
              className="flex flex-1 items-center justify-center gap-2 rounded-[18px] border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
            >
              <Check size={16} />
              Mark all read
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
          {filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 p-8 text-center text-slate-500">
              <div className="rounded-full bg-slate-100 p-3 text-slate-400">
                <Inbox size={24} />
              </div>
              <div>
                <p className="text-lg font-semibold text-slate-800">No notifications to display</p>
                <p className="mt-1 text-sm text-slate-500">Try a different filter or clear your search.</p>
              </div>
            </div>
          ) : (
            filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`group relative border-b border-slate-200/70 px-4 py-3.5 transition hover:bg-slate-50 sm:px-5 ${
                  !notification.isRead ? 'bg-sky-50/40' : 'bg-transparent'
                }`}
                onClick={() => {
                  setSelectedNotification(notification);
                  if (!notification.isRead) {
                    markAsRead(notification.id);
                  }
                }}
              >
                <div className={`absolute left-0 top-4 h-10 w-1 rounded-r-full bg-linear-to-b ${getAccentClass(notification.type)} opacity-0 transition group-hover:opacity-100`} />
                <div className="flex items-start gap-4 pl-1">
                  <div className="shrink-0 rounded-2xl border border-slate-200 bg-slate-50 p-2.5 shadow-sm">
                    {getIcon(notification.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-slate-950">{notification.title}</p>
                          {!notification.isRead && (
                            <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-sky-700">
                              New
                            </span>
                          )}
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">
                          {notification.message}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 md:ml-4">
                        {!notification.isRead && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead(notification.id);
                            }}
                            className="rounded-full bg-sky-100 px-3 py-2 text-xs font-semibold text-sky-700 transition hover:bg-sky-200"
                          >
                            Mark read
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(notification.id);
                          }}
                          className="rounded-full p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                          aria-label="Delete notification"
                          title="Delete notification"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {notification.type}
                      </span>
                      <span>{notification.time}</span>
                      <span className="text-slate-300">•</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedNotification(notification);
                        }}
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

        {/* Notification Detail Modal */}
        {selectedNotification && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" onClick={() => setSelectedNotification(null)}>
            <div className="w-full max-w-2xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_30px_90px_rgba(2,6,23,0.28)]" onClick={e => e.stopPropagation()}>
              <div className="bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_55%,#0ea5e9_100%)] px-6 py-5 text-white">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="rounded-2xl bg-white/15 p-3 backdrop-blur">
                      {selectedNotification.type === 'report' && <Flag size={24} />}
                      {selectedNotification.type === 'user' && <User size={24} />}
                      {selectedNotification.type === 'system' && <Bell size={24} />}
                    </div>
                    <div>
                      <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80">
                        {selectedNotification.type}
                      </div>
                      <h2 className="mt-3 text-2xl font-bold tracking-tight">{selectedNotification.title}</h2>
                      <p className="mt-1 text-sm text-white/75">{selectedNotification.time}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedNotification(null)}
                    className="rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
                    aria-label="Close modal"
                    title="Close modal"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="p-5">
                <div className="rounded-3xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Message</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                    {selectedNotification.detailedMessage || selectedNotification.message}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <button
                  onClick={() => {
                    deleteNotification(selectedNotification.id);
                    setSelectedNotification(null);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                >
                  <Trash2 size={16} />
                  Delete notification
                </button>
                {selectedNotification.link && (
                  <a
                    href={selectedNotification.link}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    <ExternalLink size={16} />
                    View details
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