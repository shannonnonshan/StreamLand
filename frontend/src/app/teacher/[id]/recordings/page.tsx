"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import {
  ArrowUpDown,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileVideo,
  Globe,
  Grid3x3,
  List,
  Lock,
  Play,
  Search,
  SlidersHorizontal,
  Video,
} from "lucide-react";
import { getRecordedLivestreams, LiveStream, groupRecordingsByMonth } from "@/lib/api/teacher";
import Pagination from "@/component/Pagination";

const getApprovalState = (value: string | null | undefined): "true" | "false" | "rejected" => {
  if (value === "TRUE" || value === "true") return "true";
  if (value === "rejected" || value === "REJECTED" || value === "reject") return "rejected";
  return "false";
};

const formatMonthLabel = (key: string) => {
  const [year, month] = key.split("-");
  return year && month ? `${month}/${year}` : key;
};

const formatDateLabel = (date: Date) =>
  date.toLocaleDateString(undefined, { month: "2-digit", day: "2-digit", year: "numeric" });
export default function RecordingsPage() {
  const params = useParams();
  const router = useRouter();
  const teacherId = (params?.id as string) || "1";

  // ── state ──────────────────────────────────────────────────────
  const [filter, setFilter]                   = useState<"7days" | "1month" | "custom">("7days");
  const [customFrom, setCustomFrom]           = useState("2025-01");
  const [customTo, setCustomTo]               = useState("2025-10");
  const [viewMode, setViewMode]               = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery]         = useState("");
  const [sortOrder, setSortOrder]             = useState<"newest" | "oldest">("newest");
  const [recordings, setRecordings]           = useState<LiveStream[]>([]);
  const [isLoading, setIsLoading]             = useState(true);
  const [error, setError]                     = useState<string | null>(null);
  const [recordingFilter, setRecordingFilter] = useState<"all" | "recorded" | "no-recording">("all");
  const [approvalFilter, setApprovalFilter]   = useState<"all" | "true" | "false" | "rejected">("all");
  const [currentPage, setCurrentPage]         = useState(1);
  const [itemsPerPage, setItemsPerPage]       = useState<6 | 12 | 24 | 36>(12);
  const [selectedMonth, setSelectedMonth]     = useState("");
  const [currentWindowStart, setCurrentWindowStart] = useState<Date>(() => {
    const d = new Date(); d.setDate(d.getDate() - 6); d.setHours(0, 0, 0, 0); return d;
  });

  // ── derived ────────────────────────────────────────────────────
  const recordingsByMonth  = groupRecordingsByMonth(recordings);
  const months             = Object.keys(recordingsByMonth).sort((a, b) => b.localeCompare(a));
  const visibleMonths      = filter === "custom"
    ? months.filter((m) => m >= customFrom && m <= customTo)
    : months.slice(0, 6);
  const selectedMonthIndex = visibleMonths.indexOf(selectedMonth);

  const windowStart = new Date(currentWindowStart);
  const windowEnd   = new Date(currentWindowStart);
  windowEnd.setDate(windowEnd.getDate() + 6);
  windowEnd.setHours(23, 59, 59, 999);

  const totalRecordings  = recordings.length;
  const recordedCount    = recordings.filter((r) => Boolean(r.recordingUrl)).length;
  const noRecordingCount = totalRecordings - recordedCount;
  const approvedCount    = recordings.filter((r) => getApprovalState(r.isApprove) === "true").length;

  // ── label ──────────────────────────────────────────────────────
  const getFilterLabel = () => {
    if (filter === "custom") return `${formatMonthLabel(customFrom)} – ${formatMonthLabel(customTo)}`;
    if (filter === "7days")  return `${formatDateLabel(windowStart)} – ${formatDateLabel(windowEnd)}`;
    return formatMonthLabel(selectedMonth);
  };

  // ── navigation ─────────────────────────────────────────────────
  const goToPreviousMonth = () => {
    if (selectedMonthIndex > 0) setSelectedMonth(visibleMonths[selectedMonthIndex - 1]);
  };
  const goToNextMonth = () => {
    if (selectedMonthIndex >= 0 && selectedMonthIndex < visibleMonths.length - 1)
      setSelectedMonth(visibleMonths[selectedMonthIndex + 1]);
  };
  const goToPrevious = () => {
    if (filter === "7days")
      setCurrentWindowStart((p) => { const d = new Date(p); d.setDate(d.getDate() - 7); return d; });
    else goToPreviousMonth();
  };
  const goToNext = () => {
    if (filter === "7days") {
      const next = new Date(currentWindowStart);
      next.setDate(next.getDate() + 7);
      if (next <= new Date()) setCurrentWindowStart(next);
    } else goToNextMonth();
  };
  const canGoPrev = filter === "7days" ? true : selectedMonthIndex > 0;
  const canGoNext = filter === "7days"
    ? (() => { const n = new Date(currentWindowStart); n.setDate(n.getDate() + 7); return n <= new Date(); })()
    : selectedMonthIndex >= 0 && selectedMonthIndex < visibleMonths.length - 1;

  // ── effects ────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        setIsLoading(true); setError(null);
        const data = await getRecordedLivestreams(teacherId);
        setRecordings(data);
        if (data.length > 0) {
          const keys = Object.keys(groupRecordingsByMonth(data)).sort((a, b) => b.localeCompare(a));
          setSelectedMonth(keys[0]);
        }
      } catch {
        setError("Failed to load recordings");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [teacherId]);

  useEffect(() => {
    if (months.length > 0 && !months.includes(selectedMonth)) setSelectedMonth(months[0]);
  }, [months, selectedMonth]);

  useEffect(() => {
    if (visibleMonths.length > 0 && !visibleMonths.includes(selectedMonth))
      setSelectedMonth(visibleMonths[0]);
  }, [visibleMonths, selectedMonth]);

  useEffect(() => {
    if (filter === "7days") {
      const d = new Date(); d.setDate(d.getDate() - 6); d.setHours(0, 0, 0, 0);
      setCurrentWindowStart(d);
    }
  }, [filter]);

  useEffect(() => { setCurrentPage(1); },
    [searchQuery, recordingFilter, approvalFilter, sortOrder, selectedMonth, viewMode, itemsPerPage, currentWindowStart]);

  // ── filtered + paginated ───────────────────────────────────────
  const displayedRecordings = (() => {
    if (filter === "custom") return visibleMonths.flatMap((m) => recordingsByMonth[m] || []);
    if (filter === "7days")  return recordings.filter((r) => {
      const d = new Date(r.endedAt || r.createdAt);
      return d >= windowStart && d <= windowEnd;
    });
    return recordingsByMonth[selectedMonth] || [];
  })();

  const filteredRecordings = displayedRecordings
    .filter((r) => {
      const ok = r.title.toLowerCase().includes(searchQuery.toLowerCase());
      const approval = getApprovalState(r.isApprove);
      if (approvalFilter !== "all" && approval !== approvalFilter) return false;
      if (recordingFilter === "recorded")     return ok && Boolean(r.recordingUrl);
      if (recordingFilter === "no-recording") return ok && !r.recordingUrl;
      return ok;
    })
    .sort((a, b) => {
      const da = new Date(a.endedAt || a.createdAt).getTime();
      const db = new Date(b.endedAt || b.createdAt).getTime();
      return sortOrder === "newest" ? db - da : da - db;
    });

  const totalPages             = Math.ceil(filteredRecordings.length / itemsPerPage);
  const currentMonthRecordings = filteredRecordings.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-gray-500">Loading recordings...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col px-4 pb-6 pt-5">
      <div className="mx-auto w-full max-w-7xl">
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Teacher workspace</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Recordings</h1>
              <p className="mt-1 text-sm text-slate-500">
                Browse livestream recordings, filter what you need, and open the right session fast.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: "Total", value: totalRecordings },
                { label: "Recorded", value: recordedCount },
                { label: "No rec", value: noRecordingCount },
                { label: "Approved", value: approvedCount },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-center">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{item.label}</div>
                  <div className="mt-1 text-lg font-bold text-slate-900">{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 pt-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="relative flex-[1.8]">
                <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Search by title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                <div className="flex h-11 min-w-44 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 shadow-sm">
                  <SlidersHorizontal size={16} className="text-slate-500" />
                  <select
                    className="bg-transparent text-sm font-medium text-slate-800 outline-none"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value as "7days" | "1month" | "custom")}
                  >
                    <option value="7days">Last 7 days</option>
                    <option value="1month">Last 1 month</option>
                    <option value="custom">Custom range</option>
                  </select>
                </div>

                {filter === "custom" && (
                  <div className="flex h-11 min-w-56 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 shadow-sm">
                    <Calendar size={16} className="text-slate-500" />
                    <select
                      value={customFrom}
                      onChange={(e) => {
                        setCustomFrom(e.target.value);
                        if (e.target.value > customTo) setCustomTo(e.target.value);
                      }}
                      className="bg-transparent text-sm font-medium text-slate-800 outline-none"
                    >
                      {months.map((month) => (
                        <option key={month} value={month}>
                          {month}
                        </option>
                      ))}
                    </select>
                    <span className="text-slate-400">to</span>
                    <select
                      value={customTo}
                      onChange={(e) => setCustomTo(e.target.value)}
                      className="bg-transparent text-sm font-medium text-slate-800 outline-none"
                    >
                      {months.filter((month) => month >= customFrom).map((month) => (
                        <option key={month} value={month}>
                          {month}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setApprovalFilter("all")}
                  className={`inline-flex h-10 items-center justify-center rounded-full border px-4 text-sm font-semibold transition ${
                    approvalFilter === "all"
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  All approvals
                </button>
                <button
                  type="button"
                  onClick={() => setApprovalFilter("true")}
                  className={`inline-flex h-10 items-center justify-center rounded-full border px-4 text-sm font-semibold transition ${
                    approvalFilter === "true"
                      ? "border-amber-500 bg-amber-500 text-white"
                      : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                  }`}
                >
                  Approved
                </button>
                <button
                  type="button"
                  onClick={() => setApprovalFilter("rejected")}
                  className={`inline-flex h-10 items-center justify-center rounded-full border px-4 text-sm font-semibold transition ${
                    approvalFilter === "rejected"
                      ? "border-rose-600 bg-rose-600 text-white"
                      : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                  }`}
                >
                  Rejected
                </button>
                <button
                  type="button"
                  onClick={() => setRecordingFilter("recorded")}
                  className={`inline-flex h-10 items-center justify-center rounded-full border px-4 text-sm font-semibold transition ${
                    recordingFilter === "recorded"
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  }`}
                >
                  Recorded
                </button>
                <button
                  type="button"
                  onClick={() => setRecordingFilter("no-recording")}
                  className={`inline-flex h-10 items-center justify-center rounded-full border px-4 text-sm font-semibold transition ${
                    recordingFilter === "no-recording"
                      ? "border-sky-600 bg-sky-600 text-white"
                      : "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100"
                  }`}
                >
                  No recording
                </button>
              </div>

              {filter !== "custom" && (
                <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-2 py-2 shadow-sm self-start xl:self-auto">
                  <button
                    type="button"
                    onClick={goToPrevious}
                    disabled={!canGoPrev}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 shadow-sm transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Previous"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={goToNext}
                    disabled={!canGoNext}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 shadow-sm transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Next"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-3xl border border-slate-200/70 bg-white/75 p-4 shadow-[0_18px_60px_-42px_rgba(15,23,42,0.4)] backdrop-blur-xl sm:p-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900">{getFilterLabel()}</div>
              <p className="mt-1 text-sm text-slate-500">
                {filteredRecordings.length} recording{filteredRecordings.length === 1 ? "" : "s"} found
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-1.5 py-1.5 shadow-sm">
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border text-sm font-semibold shadow-sm transition ${
                    viewMode === "grid"
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-indigo-50"
                  }`}
                  aria-label="Grid view"
                  title="Grid view"
                >
                  <Grid3x3 size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border text-sm font-semibold shadow-sm transition ${
                    viewMode === "list"
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-indigo-50"
                  }`}
                  aria-label="List view"
                  title="List view"
                >
                  <List size={18} />
                </button>
              </div>

              <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
                <ArrowUpDown size={16} className="text-slate-500" />
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as "newest" | "oldest")}
                  className="bg-transparent text-sm font-medium text-slate-800 outline-none"
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                </select>
              </div>
            </div>
          </div>

          {currentMonthRecordings.length === 0 ? (
            <div className="flex min-h-96 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50/80 text-center">
              <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-white shadow-sm">
                <Play size={34} className="text-slate-400" />
              </div>
              <h3 className="text-xl font-semibold text-slate-950">No recordings match this view</h3>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                {searchQuery
                  ? "Try a shorter search, a different month, or reset one of the filters above."
                  : "Change the filters above to reveal recordings here."}
              </p>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {currentMonthRecordings.map((rec) => {
                const approvalState = getApprovalState(rec.isApprove);

                return (
                  <button
                    key={rec.id}
                    type="button"
                    className="group overflow-hidden rounded-3xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-1 hover:shadow-[0_24px_60px_-34px_rgba(15,23,42,0.4)]"
                    onClick={() => router.push(`/teacher/${teacherId}/recordings/detail/${rec.id}`)}
                  >
                    <div className="relative aspect-video overflow-hidden bg-slate-100">
                      <Image
                        src={rec.thumbnail || "/logo.png"}
                        alt={rec.title}
                        width={400}
                        height={225}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />

                      <div className="absolute inset-0 bg-linear-to-t from-slate-950/70 via-slate-950/10 to-transparent" />

                      <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                        <div
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-sm ${
                            rec.recordingUrl
                              ? approvalState === "true"
                                ? "bg-emerald-500 text-white"
                                : approvalState === "rejected"
                                  ? "bg-rose-500 text-white"
                                  : "bg-amber-500 text-white"
                              : "bg-slate-700 text-white"
                          }`}
                        >
                          {rec.recordingUrl ? (
                            approvalState === "true" ? <FileVideo size={12} /> : approvalState === "rejected" ? <Lock size={12} /> : <Clock size={12} />
                          ) : (
                            <Video size={12} />
                          )}
                          {rec.recordingUrl
                            ? approvalState === "true"
                              ? "Approved"
                              : approvalState === "rejected"
                                ? "Rejected"
                                : "Waiting"
                            : "No recording"}
                        </div>
                      </div>

                      <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/40 bg-white/90 shadow-lg">
                          <Play size={24} className="ml-1 text-slate-900" />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 p-5">
                      <h3 className="line-clamp-2 text-base font-semibold leading-6 text-slate-950 transition group-hover:text-indigo-700">
                        {rec.title}
                      </h3>

                      {rec.description ? (
                        <p className="line-clamp-2 text-sm leading-6 text-slate-500">{rec.description}</p>
                      ) : null}

                      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                        <span className="flex items-center gap-1.5">
                          <Calendar size={14} />
                          {new Date(rec.endedAt || rec.createdAt).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock size={14} />
                          {Math.floor(rec.duration / 60)}:{String(rec.duration % 60).padStart(2, "0")}
                        </span>
                        <span className="rounded-full bg-slate-50 px-3 py-1.5">{rec.totalViews} views</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-4">
              {currentMonthRecordings.map((rec) => {
                const approvalState = getApprovalState(rec.isApprove);

                return (
                  <button
                    key={rec.id}
                    type="button"
                    className="group w-full overflow-hidden rounded-3xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_20px_50px_-30px_rgba(15,23,42,0.35)]"
                    onClick={() => router.push(`/teacher/${teacherId}/recordings/detail/${rec.id}`)}
                  >
                    <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                      <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-2xl bg-slate-100 sm:w-52">
                        <Image
                          src={rec.thumbnail || "/logo.png"}
                          alt={rec.title}
                          width={400}
                          height={118}
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-linear-to-t from-slate-950/60 to-transparent" />
                        <div
                          className={`absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm ${
                            rec.recordingUrl
                              ? approvalState === "true"
                                ? "bg-emerald-500"
                                : approvalState === "rejected"
                                  ? "bg-rose-500"
                                  : "bg-amber-500"
                              : "bg-slate-700"
                          }`}
                        >
                          {rec.recordingUrl ? (
                            approvalState === "true" ? <FileVideo size={12} /> : approvalState === "rejected" ? <Lock size={12} /> : <Clock size={12} />
                          ) : (
                            <Video size={12} />
                          )}
                          {rec.recordingUrl
                            ? approvalState === "true"
                              ? "Approved"
                              : approvalState === "rejected"
                                ? "Rejected"
                                : "Waiting"
                            : "No recording"}
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                          <Play size={34} className="text-white drop-shadow" />
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <h3 className="line-clamp-2 text-base font-semibold text-slate-950 transition group-hover:text-indigo-700">
                              {rec.title}
                            </h3>
                            {rec.description ? (
                              <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">{rec.description}</p>
                            ) : null}
                            <p className="mt-1 text-sm text-slate-500">Tap to open details</p>
                          </div>
                          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
                            {rec.isPublic ? <Globe size={12} /> : <Lock size={12} />}
                            {rec.isPublic ? "Public" : "Private"}
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                          <span className="flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1.5">
                            <Calendar size={14} />
                            {new Date(rec.endedAt || rec.createdAt).toLocaleDateString()}
                          </span>
                          <span className="flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1.5">
                            <Clock size={14} />
                            {Math.floor(rec.duration / 60)}:{String(rec.duration % 60).padStart(2, "0")}
                          </span>
                          <span className="rounded-full bg-slate-50 px-3 py-1.5">{rec.totalViews} views</span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {filteredRecordings.length > 0 && (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 sm:p-4">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                  <SlidersHorizontal size={16} className="text-slate-500" />
                  <span className="text-sm font-medium text-slate-700">Per page</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => setItemsPerPage(Number(e.target.value) as 6 | 12 | 24 | 36)}
                    className="bg-transparent text-sm font-semibold text-slate-900 outline-none"
                  >
                    {[6, 12, 24, 36].map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredRecordings.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                showInfo={true}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}