"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, X, ChevronLeft, ChevronRight, ExternalLink, Search, Filter, ChevronsLeft } from "lucide-react";
import { clsx } from "clsx";
import { raleway } from "@/utils/front";

interface Report {
  id: string;
  reporterId: string;
  reporterType: "student" | "teacher";
  reporterName: string;
  reporterAvatar?: string;
  targetId: string;
  targetName: string;
  targetType: "student" | "teacher";
  targetAvatar?: string;
  reason: string;
  details: string;
  evidence?: string[];
  status: "waiting" | "banned" | "resolved" | "rejected";
  banDuration?: "1m" | "1w" | "1d" | "forever";
  bannedUntil?: string;
  createdAt: string;
  resolvedAt?: string;
}

type ReportUpdateStatus = 'RESOLVED' | 'DISMISSED';

const defaultAvatar = "/logo.png";

export default function ManageReport() {
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [selectedSnapshot, setSelectedSnapshot] = useState<Report | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reviewNote, setReviewNote] = useState("");
  const [activeTab, setActiveTab] = useState<"student" | "teacher">("student");
  const [isBanMenuOpen, setIsBanMenuOpen] = useState(false);
  const [isRejectConfirmOpen, setIsRejectConfirmOpen] = useState(false);
  const banMenuRef = useRef<HTMLDivElement | null>(null);

 

  // Filtering states
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Report["status"]>("all");
  const [pageSize, setPageSize] = useState(5);
  const [loadingReports, setLoadingReports] = useState(true);
  const [reportsLoadError, setReportsLoadError] = useState<string | null>(null);

  const filteredReports = useMemo(() => {
    return reports.filter(report => {
      const matchesTab = activeTab === "student"
        ? report.targetType === "student"
        : report.targetType === "teacher";

      const matchesSearch = search === "" ||
        report.targetName.toLowerCase().includes(search.toLowerCase()) ||
        report.reporterName.toLowerCase().includes(search.toLowerCase()) ||
        report.reason.toLowerCase().includes(search.toLowerCase());

      const matchesStatus = statusFilter === "all" || report.status === statusFilter;

      return matchesTab && matchesSearch && matchesStatus;
    });
  }, [reports, activeTab, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredReports.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedReports = useMemo(() => {
    return filteredReports.slice((safePage - 1) * pageSize, safePage * pageSize);
  }, [filteredReports, safePage, pageSize]);

  const firstItem = filteredReports.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const lastItem = Math.min(safePage * pageSize, filteredReports.length);

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setPage(1);
  };

  const goToPage = (nextPage: number) => {
    setPage(Math.min(Math.max(1, nextPage), totalPages));
  };

  const getStatusClasses = (status: Report["status"]) => {
    if (status === "waiting") return "bg-amber-100 text-amber-700 ring-1 ring-amber-200";
    if (status === "banned") return "bg-rose-100 text-rose-700 ring-1 ring-rose-200";
    if (status === "resolved") return "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200";
    return "bg-slate-100 text-slate-600 ring-1 ring-slate-200";
  };

  const formatBanUntil = (value?: string) => {
    if (!value) return '';

    return new Date(value).toLocaleString();
  };

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token') || localStorage.getItem('accessToken');

    return {
      Authorization: token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json',
    };
  };

  const getApiUrl = () => process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  const syncLocalReport = (reportId: string, patch: Partial<Report>) => {
    setReports((prev) => prev.map((report) => (report.id === reportId ? { ...report, ...patch } : report)));
  };

  const closeModerationPopup = () => {
    setIsBanMenuOpen(false);
    setIsDetailOpen(false);
    setIsRejectConfirmOpen(false);
    setSelectedReport(null);
    setSelectedSnapshot(null);
  };

  const fetchReports = useCallback(async (showLoader: boolean = true) => {
    if (showLoader) {
      setLoadingReports(true);
    }
    setReportsLoadError(null);
    try {
      const response = await fetch(`${getApiUrl()}/admin/reports`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to load reports');
      }

      const data = await response.json();
      const nextReports = Array.isArray(data) ? (data as Report[]) : [];
      setReports(nextReports);

      setSelectedReport((prevSelected) => {
        if (!prevSelected) {
          return prevSelected;
        }

        return nextReports.find((report) => report.id === prevSelected.id) || null;
      });
    } catch (error) {
      console.error('Error loading reports:', error);
      setReports([]);
      setReportsLoadError('Khong the tai du lieu report tu server. Vui long thu lai.');
    } finally {
      if (showLoader) {
        setLoadingReports(false);
      }
    }
  }, []);

  const updateReportStatus = async (reportId: string, status: ReportUpdateStatus, resolution?: string) => {
    const response = await fetch(`${getApiUrl()}/admin/reports/${reportId}/status`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status, resolution }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = typeof payload?.message === 'string'
        ? payload.message
        : payload?.error || 'Failed to update report status';
      throw new Error(message);
    }
  };

  const handleBanUser = async (report: Report, duration: Report["banDuration"]) => {
    setLoading(true);
    // Optimistic local update so UI updates immediately while server request runs
    const now = new Date().toISOString();
    syncLocalReport(report.id, {
      status: 'banned',
      banDuration: duration,
      bannedUntil: now,
      resolvedAt: now,
    });
    setSelectedSnapshot((prev) => (prev && prev.id === report.id ? { ...prev, status: 'banned', banDuration: duration, bannedUntil: now, resolvedAt: now } : prev));

    // Close UI immediately for snappy feedback
    setIsBanMenuOpen(false);
    setIsDetailOpen(false);
    setSelectedReport(null);

    try {
      // Send ban request
      const response = await fetch(`${getApiUrl()}/admin/users/${report.targetId}/ban`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ duration }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMessage = typeof payload?.message === 'string'
          ? payload.message
          : payload?.message?.message || payload?.error || 'Failed to ban user';

        const bannedUntil = payload?.message?.bannedUntil || payload?.bannedUntil || payload?.data?.bannedUntil;
        if (bannedUntil) {
          syncLocalReport(report.id, {
            status: 'banned',
            banDuration: duration,
            bannedUntil,
            resolvedAt: new Date().toISOString(),
          });
          void fetchReports(false);
          alert(`User is already banned until ${formatBanUntil(bannedUntil)}`);
          return;
        }

        // Roll back by reloading fresh data
        await fetchReports(true);
        throw new Error(errorMessage);
      }

      // Mark report resolved on server and update local state with final bannedUntil
      await updateReportStatus(report.id, 'RESOLVED', `User banned with duration ${duration}`);

      const finalBannedUntil = payload?.bannedUntil || payload?.data?.bannedUntil || now;
      syncLocalReport(report.id, {
        status: 'banned',
        banDuration: duration,
        bannedUntil: finalBannedUntil,
        resolvedAt: new Date().toISOString(),
      });

      // Background revalidation (non-blocking)
      void fetchReports(false);
    } catch (error) {
      console.error('Error banning user:', error);
      alert(error instanceof Error ? error.message : 'Failed to ban user');
    } finally {
      setLoading(false);
    }
  };

  const handleRejectReport = async (report: Report, reason?: string) => {
    setLoading(true);
    try {
      // If the report target is a teacher, call admin API to reject teacher and set isApproved = false
      if (report.targetType === 'teacher') {
        const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

        const resp = await fetch(`${API_URL}/admin/teachers/${report.targetId}/reject`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reason: reason || reviewNote || 'No reason provided' }),
        });

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          throw new Error(err?.message || 'Failed to reject teacher');
        }
      }

      // Update local report state regardless
      await updateReportStatus(report.id, 'DISMISSED', reason || reviewNote || 'Report rejected by admin');
      syncLocalReport(report.id, {
        status: 'rejected',
        resolvedAt: new Date().toISOString(),
      });

      await fetchReports(false);

      setReviewNote("");
    } catch (err) {
      console.error('Error rejecting report/teacher:', err);
      alert((err as Error).message || 'Failed to reject');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectedRejectReport = () => {
    if (!selectedSnapshot) return;
    setIsRejectConfirmOpen(true);
  };

  const confirmRejectReport = () => {
    if (!selectedSnapshot) return;

    setIsRejectConfirmOpen(false);
    void handleRejectReport(selectedSnapshot, reviewNote);
  };

  const handleSelectedBanUser = (duration: Report["banDuration"]) => {
    if (!selectedSnapshot) return;
    setIsBanMenuOpen(false);
    void handleBanUser(selectedSnapshot, duration);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (banMenuRef.current && !banMenuRef.current.contains(event.target as Node)) {
        setIsBanMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    void fetchReports();
  }, [fetchReports]);

  

  useEffect(() => {
    setPage(1);
  }, [activeTab, search, statusFilter, pageSize]);

  useEffect(() => {
    setPage(current => Math.min(current, totalPages));
  }, [totalPages]);

  return (
    <div className="min-h-screen p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="px-5 py-5 sm:px-6 sm:py-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <div className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-indigo-700">
                  Moderation
                </div>
                <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-950 sm:text-[2.15rem]">
                  Manage reports
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  Review reports, filter quickly, and handle bans or rejections from one compact moderation dashboard.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Waiting</p>
                  <p className="mt-1 text-lg font-bold text-slate-950">
                    {reports.filter((report) => report.status === "waiting").length}
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Resolved</p>
                  <p className="mt-1 text-lg font-bold text-slate-950">
                    {reports.filter((report) => report.status === "resolved").length}
                  </p>
                </div>
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Banned</p>
                  <p className="mt-1 text-lg font-bold text-slate-950">
                    {reports.filter((report) => report.status === "banned").length}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                onClick={() => setActiveTab("student")}
                className={clsx(
                  "rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition",
                  activeTab === "student"
                    ? "bg-slate-950 text-white shadow-sm"
                    : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                )}
              >
                Reports against students
              </button>
              <button
                onClick={() => setActiveTab("teacher")}
                className={clsx(
                  "rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition",
                  activeTab === "teacher"
                    ? "bg-slate-950 text-white shadow-sm"
                    : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                )}
              >
                Reports against teachers
              </button>
            </div>

            {reportsLoadError && (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {reportsLoadError}
              </div>
            )}
          </div>
        </section>

        <div className="rounded-[26px] border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
          <div className="border-b border-slate-200 px-4 py-3 sm:px-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Reports table</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by name or reason..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-40 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 sm:w-60"
                  />
                </div>

                <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
                  <Filter className="h-4 w-4 text-slate-400" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as "all" | Report["status"])}
                    className="bg-transparent text-sm font-medium text-slate-700 outline-none"
                  >
                    <option value="all">All status</option>
                    <option value="waiting">Waiting</option>
                    <option value="banned">Banned</option>
                    <option value="resolved">Resolved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>

                <button
                  onClick={resetFilters}
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-3 pt-3">
              <div className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 shadow-sm">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Per page
                </span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="bg-transparent text-sm font-medium text-slate-700 outline-none"
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
                <ChevronsLeft className="h-4 w-4" />
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
              <div className="rounded-full bg-slate-950 px-3 py-1.5 text-sm font-semibold text-white">
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
                <ChevronsLeft className="h-4 w-4 rotate-180" />
              </button>
            </div>
          </div>

        <div className="overflow-x-auto">
          <table className="w-full">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Reporter</th>
                  <th className="px-5 py-3 font-semibold">Target</th>
                  <th className="px-5 py-3 font-semibold">Reason</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading || loadingReports ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-500">
                      <Loader2 className="mr-2 inline-block h-5 w-5 animate-spin" />
                      Processing...
                    </td>
                  </tr>
                ) : paginatedReports.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-500">
                      No reports found
                    </td>
                  </tr>
                ) : (
                  paginatedReports.map((report) => (
                    <tr key={report.id} className="align-top transition hover:bg-slate-50/70">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-slate-950">
                            <Image
                              src={report.reporterAvatar || defaultAvatar}
                              alt={report.reporterName}
                              width={40}
                              height={40}
                              className="object-cover"
                            />
                          </div>
                          <div>
                            <div className="font-medium text-slate-950">{report.reporterName}</div>
                            <div className="text-sm capitalize text-slate-500">
                              {report.reporterType}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-slate-950">
                            <Image
                              src={report.targetAvatar || defaultAvatar}
                              alt={report.targetName}
                              width={40}
                              height={40}
                              className="object-cover"
                            />
                          </div>
                          <div>
                            <div className="font-medium text-slate-950">{report.targetName}</div>
                            <div className="text-sm capitalize text-slate-500">
                              {report.targetType}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="max-w-55 truncate text-slate-700" title={report.reason}>
                          {report.reason}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={clsx("inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]", getStatusClasses(report.status))}>
                          {report.status}
                          {report.banDuration && report.status === "banned" ? ` (${report.banDuration})` : ""}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedReport(report);
                            setSelectedSnapshot(report);
                            setIsDetailOpen(true);
                          }}
                          className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
          </table>
        </div>

        {/* Pagination */}
          <div className="px-4 pb-4 sm:px-5">
            <div className="flex items-center justify-between rounded-2xl border border-slate-100 px-3 py-2.5">
              <div className="text-xs text-slate-500">
                Showing {firstItem} to {lastItem} of {filteredReports.length} reports
              </div>
              <div className="text-xs text-slate-500">
                {activeTab === "student" ? "Students" : "Teachers"} reports
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Report Detail Dialog */}
      <Dialog.Root open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-slate-950/45 backdrop-blur-[2px]" />
          <Dialog.Content className={`fixed left-1/2 top-1/2 max-h-[85vh] w-[92vw] max-w-5xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border border-slate-200 bg-white p-0 shadow-[0_30px_90px_rgba(2,6,23,0.25)] ${raleway.className}`}>
            <Dialog.Title className="sr-only">Review Report</Dialog.Title>
            <div className="flex max-h-[85vh] w-full flex-col">
              <div className="flex shrink-0 items-start justify-between gap-4 bg-[#292C6D] px-6 py-5 text-white rounded-t-3xl">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/70">Report Moderation</p>
                  <h2 className="mt-1 text-2xl font-bold">Review Report</h2>
                  <p className="mt-1 text-sm text-white/75">{selectedSnapshot ? `${selectedSnapshot.targetName} · ${selectedSnapshot.targetType === 'student' ? 'Student' : 'Teacher'}` : ''}</p>
                </div>
                <div className="flex items-start gap-2">
                  <button
                    onClick={() => { closeModerationPopup(); }}
                    title="Close"
                    className="rounded-full border border-white/10 bg-white/10 p-2 text-white transition hover:bg-white/20"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
                <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                  {/* Left: report details */}
                  <div className="space-y-6">
                    <section className="rounded-3xl border border-[#292C6D]/10 bg-white p-5 shadow-sm">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#292C6D]/50">Report</p>
                          <h3 className="mt-1 text-lg font-bold text-slate-900">{selectedSnapshot?.reason}</h3>
                          <p className="mt-1 text-sm text-slate-600">Reported by {selectedSnapshot?.reporterName}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(selectedSnapshot?.status as Report['status'])}`}>
                          {selectedSnapshot?.status}
                        </span>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Reporter</p>
                          <p className="mt-1 text-sm font-medium text-slate-900">{selectedSnapshot?.reporterName}</p>
                          <p className="text-sm text-slate-500">{selectedSnapshot?.reporterType}</p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Target</p>
                          <p className="mt-1 text-sm font-medium text-slate-900">{selectedSnapshot?.targetName}</p>
                          <p className="text-sm text-slate-500">{selectedSnapshot?.targetType}</p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Reported On</p>
                          <p className="mt-1 text-sm font-medium text-slate-900">{selectedSnapshot ? new Date(selectedSnapshot.createdAt).toLocaleString() : ''}</p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Resolved At</p>
                          <p className="mt-1 text-sm font-medium text-slate-900">{selectedSnapshot?.resolvedAt ? new Date(selectedSnapshot.resolvedAt).toLocaleString() : '-'}</p>
                        </div>
                      </div>
                    </section>

                    <section className="rounded-3xl border border-[#292C6D]/10 bg-white p-5 shadow-sm">
                      <h4 className="text-sm font-medium text-slate-700 mb-2">Details</h4>
                      <p className="text-sm text-slate-600 whitespace-pre-wrap">{selectedSnapshot?.details}</p>
                    </section>

                    {selectedSnapshot?.evidence && selectedSnapshot.evidence.length > 0 && (
                      <section className="rounded-3xl border border-[#292C6D]/10 bg-white p-5 shadow-sm">
                        <h4 className="text-sm font-medium text-slate-700 mb-2">Evidence</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {selectedSnapshot!.evidence!.map((e, i) => (
                            <div key={i} className="relative aspect-video overflow-hidden rounded-md bg-slate-100">
                              <Image src={e} alt={`evidence-${i}`} fill className="object-cover" />
                              <button className="absolute right-2 top-2 rounded-full bg-white p-1 shadow-sm hover:bg-slate-50">
                                <ExternalLink className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}
                  </div>

                  {/* Right: moderation & actions */}
                  <div className="space-y-6">
                    <section className="rounded-3xl border border-[#292C6D]/10 bg-white p-5 shadow-sm">
                      <label className="mb-2 block text-sm font-semibold text-slate-900">Reason Rejection</label>
                      <textarea
                        value={reviewNote}
                        onChange={(e) => setReviewNote(e.target.value)}
                        placeholder="Reason for rejection (saved to teacher profile)"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none min-h-24 resize-none"
                      />
                    </section>

                    <section className="rounded-3xl border border-[#292C6D]/10 bg-white p-5 shadow-sm">
                      <div className="flex flex-wrap justify-end gap-3">
                        <button
                          onClick={handleSelectedRejectReport}
                          disabled={!selectedSnapshot || loading}
                          className={`inline-flex items-center rounded-full px-4 py-2.5 text-sm font-semibold transition focus:ring-2 focus:ring-amber-500 focus:ring-offset-2
                            ${!selectedSnapshot || loading ? 'cursor-not-allowed bg-slate-100 text-slate-400' : 'bg-amber-500 text-white hover:bg-amber-600'}`}
                        >
                          <X className="w-4 h-4 mr-2" /> Reject Report
                        </button>

                        <div ref={banMenuRef} className="relative">
                          <button
                            onClick={() => setIsBanMenuOpen((current) => !current)}
                            disabled={!selectedSnapshot || loading}
                            className={`inline-flex items-center rounded-full px-4 py-2.5 text-sm font-semibold transition focus:ring-2 focus:ring-rose-500 focus:ring-offset-2
                              ${!selectedSnapshot || loading ? 'cursor-not-allowed bg-slate-100 text-slate-400' : 'bg-rose-600 text-white hover:bg-rose-700'}`}
                            aria-expanded={isBanMenuOpen}
                            aria-haspopup="menu"
                          >
                            Ban User
                            <span className={`ml-2 inline-block transition-transform duration-200 ${isBanMenuOpen ? 'rotate-180' : 'rotate-0'}`}>▾</span>
                          </button>

                          <div
                            className={clsx(
                              'absolute right-0 top-full z-20 mt-2 w-44 origin-top-right rounded-2xl border border-slate-200 bg-white shadow-lg transition-all duration-200 ease-out',
                              isBanMenuOpen ? 'pointer-events-auto translate-y-0 scale-100 opacity-100' : 'pointer-events-none -translate-y-2 scale-95 opacity-0'
                            )}
                            role="menu"
                          >
                            <button onClick={() => handleSelectedBanUser('1d')} className="block w-full rounded-t-2xl px-4 py-2 text-left text-sm hover:bg-slate-50" role="menuitem">Ban 1 Day</button>
                            <button onClick={() => handleSelectedBanUser('1w')} className="block w-full px-4 py-2 text-left text-sm hover:bg-slate-50" role="menuitem">Ban 1 Week</button>
                            <button onClick={() => handleSelectedBanUser('1m')} className="block w-full px-4 py-2 text-left text-sm hover:bg-slate-50" role="menuitem">Ban 1 Month</button>
                            <button onClick={() => handleSelectedBanUser('forever')} className="block w-full rounded-b-2xl px-4 py-2 text-left text-sm text-rose-600 hover:bg-rose-50" role="menuitem">Ban Forever</button>
                          </div>
                        </div>
                      </div>
                    </section>
                  </div>
                </div>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={isRejectConfirmOpen} onOpenChange={setIsRejectConfirmOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-slate-950/45 backdrop-blur-[2px]" />
          <Dialog.Content className={`fixed left-1/2 top-1/2 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-slate-200 bg-white p-0 shadow-[0_30px_90px_rgba(2,6,23,0.25)] ${raleway.className}`}>
            <Dialog.Title className="sr-only">Confirm Reject</Dialog.Title>
            <div className="p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-600">Confirmation</p>
              <h3 className="mt-2 text-xl font-bold text-slate-950">Bạn có chắc reject không?</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Hành động này sẽ chuyển report sang trạng thái rejected và lưu thay đổi ngay lập tức.
              </p>

              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsRejectConfirmOpen(false)}
                  className="rounded-full border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={confirmRejectReport}
                  disabled={!selectedSnapshot || loading}
                  className={`rounded-full px-4 py-2.5 text-sm font-semibold text-white transition
                    ${!selectedSnapshot || loading ? 'cursor-not-allowed bg-slate-300' : 'bg-amber-500 hover:bg-amber-600'}`}
                >
                  Xác nhận reject
                </button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      
    </div>
  );
}
