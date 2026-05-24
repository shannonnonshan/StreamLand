"use client";

import React, { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, X, ChevronLeft, ChevronRight, Calendar, Search } from "lucide-react";
import { raleway } from "@/utils/front";

interface Notification {
  id: string;
  subject: string;
  content: string;
  target: "teachers" | "students" | "admins" | "all";
  date: string;
  status: "sent";
}

const mockNotifications: Notification[] = [
  {
    id: "1",
    subject: "System Maintenance Notice",
    content: "The platform will be under maintenance on Sunday from 2 AM to 4 AM.",
    target: "all",
    date: "2025-10-25",
    status: "sent",
  },
  {
    id: "2",
    subject: "New Feature Update",
    content: "We've added new features to the streaming capabilities.",
    target: "teachers",
    date: "2025-10-24",
    status: "sent",
  },
  {
    id: "3",
    subject: "Important: Exam Guidelines",
    content: "Please review the updated exam guidelines for online assessments.",
    target: "students",
    date: "2025-10-23",
    status: "sent",
  },
];

export default function ManageNotification() {
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<Notification["target"]>("all");
  const [targetFilter, setTargetFilter] = useState<"all" | Notification["target"]>("all");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [search, setSearch] = useState("");

  // Form states
  const [formData, setFormData] = useState({
    subject: "",
    content: "",
    confirmed: false,
  });

  const handleSendNotification = async () => {
    if (!formData.subject.trim() || !formData.content.trim() || !formData.confirmed) {
      return;
    }

    setLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));

    const newNotification: Notification = {
      id: Date.now().toString(),
      subject: formData.subject,
      content: formData.content,
      target: selectedTarget,
      date: new Date().toISOString().split('T')[0],
      status: "sent",
    };

    setNotifications(prev => [newNotification, ...prev]);
    setLoading(false);
    setIsModalOpen(false);
    setFormData({ subject: "", content: "", confirmed: false });
  };

  // Filter notifications
  const filteredNotifications = notifications.filter(notification => {
    const matchesType = targetFilter === "all" || notification.target === targetFilter;
    const matchesSearch = search === "" ||
      notification.subject.toLowerCase().includes(search.toLowerCase()) ||
      notification.content.toLowerCase().includes(search.toLowerCase());

    const matchesDateRange = (!startDate || notification.date >= startDate) &&
      (!endDate || notification.date <= endDate);

    return matchesType && matchesSearch && matchesDateRange;
  });

  const totalPages = Math.max(1, Math.ceil(filteredNotifications.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedNotifications = filteredNotifications.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  const firstItem = filteredNotifications.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const lastItem = Math.min(safePage * pageSize, filteredNotifications.length);

  const goToPage = (nextPage: number) => {
    setPage(Math.min(Math.max(1, nextPage), totalPages));
  };

  const resetFilters = () => {
    setSearch("");
    setStartDate("");
    setEndDate("");
    setTargetFilter("all");
    setPage(1);
  };

  const openComposer = (target: Notification["target"] = "all") => {
    setSelectedTarget(target);
    setIsModalOpen(true);
  };

  useEffect(() => {
    setPage(1);
  }, [search, startDate, endDate, targetFilter, pageSize]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  return (
    <div className="min-h-screen p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="px-5 py-5 sm:px-6 sm:py-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <div className={`inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-indigo-700 ${raleway.className}`}>
                  Notifications
                </div>
                <h1 className={`mt-3 text-2xl font-bold tracking-tight text-slate-950 sm:text-[2.15rem] ${raleway.className}`}>
                  Manage notification
                </h1>
                <p className={`mt-2 max-w-2xl text-sm leading-6 text-slate-600 ${raleway.className}`}>
                  Send, filter, and review notifications without the oversized spacing or heavy glass effect.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2">
                  <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 ${raleway.className}`}>Total</p>
                  <p className="mt-1 text-lg font-bold text-slate-950">{notifications.length}</p>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 ${raleway.className}`}>Sent</p>
                  <p className="mt-1 text-lg font-bold text-slate-950">{notifications.length}</p>
                </div>
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-3 py-2">
                  <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 ${raleway.className}`}>Pages</p>
                  <p className="mt-1 text-lg font-bold text-slate-950">{totalPages || 1}</p>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "To Teachers", value: "teachers" as const },
                  { label: "To Students", value: "students" as const },
                  { label: "To Admins", value: "admins" as const },
                  { label: "To All Users", value: "all" as const },
                ].map((item) => (
                  <button
                    key={item.value}
                    onClick={() => openComposer(item.value)}
                    className={`rounded-full px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${raleway.className} ${
                      item.value === "teachers"
                        ? "bg-linear-to-r from-rose-500 to-pink-500 text-white shadow-sm hover:from-rose-600 hover:to-pink-600"
                        : item.value === "students"
                          ? "bg-linear-to-r from-amber-500 to-orange-500 text-white shadow-sm hover:from-amber-600 hover:to-orange-600"
                          : item.value === "admins"
                            ? "bg-linear-to-r from-indigo-500 to-violet-500 text-white shadow-sm hover:from-indigo-600 hover:to-violet-600"
                            : "bg-linear-to-r from-slate-900 to-slate-700 text-white shadow-sm hover:from-slate-800 hover:to-slate-600"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <button
                onClick={() => openComposer("all")}
                className={`inline-flex items-center justify-center rounded-full border border-cyan-200 bg-linear-to-r from-cyan-500 to-blue-500 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white transition hover:from-cyan-600 hover:to-blue-600 ${raleway.className}`}
              >
                New notification
              </button>
            </div>
          </div>
        </section>

        <div className="rounded-[26px] border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
          <div className="border-b border-slate-200 px-4 py-3 sm:px-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className={`text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 ${raleway.className}`}>Notifications table</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className={`w-36 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 sm:w-52 ${raleway.className}`}
                  />
                </div>

                <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="border-0 bg-transparent p-0 text-xs text-slate-700 outline-none"
                  />
                  <span className="text-xs text-slate-400">to</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="border-0 bg-transparent p-0 text-xs text-slate-700 outline-none"
                  />
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {(["all", "teachers", "students", "admins"] as const).map((item) => (
                    <button
                      key={item}
                      onClick={() => setTargetFilter(item)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] transition ${raleway.className} ${
                        targetFilter === item
                          ? "bg-slate-950 text-white shadow-sm"
                          : item === "teachers"
                            ? "bg-rose-100 text-rose-700 hover:bg-rose-200"
                            : item === "students"
                              ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                              : item === "admins"
                                ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {item === "all" ? "All" : item}
                    </button>
                  ))}
                </div>

                <button
                  onClick={resetFilters}
                  className={`rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 ${raleway.className}`}
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-3 pt-3">
              <div className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 shadow-sm">
                <span className={`text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 ${raleway.className}`}>
                  Per page
                </span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className={`bg-transparent text-sm font-medium text-slate-700 outline-none ${raleway.className}`}
                >
                  {[5, 10, 20].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => goToPage(1)}
                disabled={safePage === 1}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="First page"
                title="First page"
              >
                <ChevronLeft className="h-4 w-4" />
                <ChevronLeft className="-ml-2 h-4 w-4" />
              </button>
              <button
                onClick={() => goToPage(safePage - 1)}
                disabled={safePage === 1}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Previous page"
                title="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className={`rounded-full bg-slate-950 px-3 py-1.5 text-sm font-semibold text-white ${raleway.className}`}>
                {safePage} / {totalPages}
              </div>
              <button
                onClick={() => goToPage(safePage + 1)}
                disabled={safePage === totalPages}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Next page"
                title="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => goToPage(totalPages)}
                disabled={safePage === totalPages}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Last page"
                title="Last page"
              >
                <ChevronRight className="h-4 w-4" />
                <ChevronRight className="-ml-2 h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-190">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Subject & Content</th>
                  <th className="px-5 py-3 font-semibold">Target</th>
                  <th className="px-5 py-3 font-semibold">Date</th>
                  <th className="px-5 py-3 text-center font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedNotifications.map((notification) => (
                  <tr key={notification.id} className="align-top transition hover:bg-slate-50/70">
                    <td className="px-5 py-4">
                      <div className="max-w-130 space-y-1">
                        <div className={`font-semibold text-slate-950 ${raleway.className}`}>{notification.subject}</div>
                        <div className="line-clamp-2 text-sm leading-6 text-slate-500">
                          {notification.content}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 capitalize text-sm text-slate-700">{notification.target}</td>
                    <td className="px-5 py-4 text-sm text-slate-700">{notification.date}</td>
                    <td className="px-5 py-4 text-center">
                      <span className={`inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700 ${raleway.className}`}>
                        Sent
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      {/* Send Notification Modal */}
      <Dialog.Root open={isModalOpen} onOpenChange={setIsModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-slate-950/45 backdrop-blur-[2px]" />
          <Dialog.Content className="fixed top-1/2 left-1/2 w-[92vw] max-w-115 -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_30px_90px_rgba(2,6,23,0.25)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <Dialog.Title className={`text-base font-semibold text-slate-950 ${raleway.className}`}>
                Send notification to {selectedTarget}
              </Dialog.Title>
              <Dialog.Close className="rounded-full p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900">
                <X className="h-4 w-4" />
              </Dialog.Close>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className={`mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 ${raleway.className}`}>
                  Subject
                </label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                  className={`w-full rounded-2xl border border-slate-200 bg-transparent px-3 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-500/10 ${raleway.className}`}
                  placeholder="Enter notification subject"
                />
              </div>

              <div>
                <label className={`mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 ${raleway.className}`}>
                  Content
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                  rows={4}
                  className={`w-full resize-none rounded-2xl border border-slate-200 bg-transparent px-3 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-500/10 ${raleway.className}`}
                  placeholder="Enter notification content"
                />
              </div>

              <label className="flex items-start gap-2.5 rounded-2xl border border-slate-200 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={formData.confirmed}
                  onChange={(e) => setFormData(prev => ({ ...prev, confirmed: e.target.checked }))}
                  className="mt-1 rounded text-slate-950 focus:ring-slate-950"
                />
                <span className={`text-sm leading-6 text-slate-600 ${raleway.className}`}>
                  I confirm about this notification and take the responsibility for any problem occurs.
                </span>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <Dialog.Close className={`rounded-full px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 ${raleway.className}`}>
                  Cancel
                </Dialog.Close>
                <button
                  onClick={handleSendNotification}
                  disabled={loading || !formData.subject.trim() || !formData.content.trim() || !formData.confirmed}
                  className={`inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 ${raleway.className}`}
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Send Notification
                </button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      </div>
    </div>
  );
}
