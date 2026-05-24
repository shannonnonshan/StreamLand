"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, X, ChevronLeft, ChevronRight, ExternalLink, Search, Filter, ChevronsLeft } from "lucide-react";
import { clsx } from "clsx";

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
  createdAt: string;
  resolvedAt?: string;
}

const defaultAvatar = "/logo.png";

const mockReports: Report[] = [
  {
    id: "1",
    reporterId: "t1",
    reporterType: "teacher",
    reporterName: "John Smith",
    targetId: "s1",
    targetName: "Alice Johnson",
    targetType: "student",
    reason: "Inappropriate behavior during livestream",
    details: "Student was using offensive language and disrupting the class repeatedly.",
    evidence: ["/logo.png"],
    status: "waiting",
    createdAt: "2025-10-25T10:00:00Z",
  },
  {
    id: "2",
    reporterId: "s2",
    reporterType: "student",
    reporterName: "Bob Wilson",
    targetId: "t2",
    targetName: "Mary Davis",
    targetType: "teacher",
    reason: "Unprofessional conduct",
    details: "Teacher was consistently late to scheduled sessions.",
    status: "banned",
    banDuration: "1m",
    createdAt: "2025-10-24T15:30:00Z",
    resolvedAt: "2025-10-25T09:00:00Z",
  },
  // Add more mock data as needed
];

export default function ManageReport() {
  const [reports, setReports] = useState<Report[]>(mockReports);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"student" | "teacher">("student");

  // Filtering states
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Report["status"]>("all");
  const [pageSize, setPageSize] = useState(5);

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

  const handleBanUser = async (report: Report, duration: Report["banDuration"]) => {
    setLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
    
    setReports(prev => prev.map(r => 
      r.id === report.id 
        ? { ...r, status: "banned", banDuration: duration, resolvedAt: new Date().toISOString() }
        : r
    ));
    setLoading(false);
  };

  const handleRejectReport = async (report: Report) => {
    setLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
    
    setReports(prev => prev.map(r => 
      r.id === report.id 
        ? { ...r, status: "rejected", resolvedAt: new Date().toISOString() }
        : r
    ));
    setLoading(false);
  };

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
                {loading ? (
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
          <Dialog.Content className="fixed left-1/2 top-1/2 max-h-[85vh] w-[92vw] max-w-160 -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_30px_90px_rgba(2,6,23,0.25)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <Dialog.Title className="text-base font-semibold text-slate-950">
                Report Details
              </Dialog.Title>
              <Dialog.Close className="rounded-full p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900">
                <X className="h-4 w-4" />
              </Dialog.Close>
            </div>

            {selectedReport && (
              <div className="space-y-6">
                {/* Reporter & Target Info */}
                  <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-slate-500">Reporter</h3>
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-slate-950">
                        <Image
                          src={selectedReport.reporterAvatar || defaultAvatar}
                          alt={selectedReport.reporterName}
                          width={48}
                          height={48}
                          className="object-cover"
                        />
                      </div>
                      <div>
                        <div className="font-medium text-slate-950">{selectedReport.reporterName}</div>
                        <div className="text-sm capitalize text-slate-500">
                          {selectedReport.reporterType}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-slate-500">Target</h3>
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-slate-950">
                        <Image
                          src={selectedReport.targetAvatar || defaultAvatar}
                          alt={selectedReport.targetName}
                          width={48}
                          height={48}
                          className="object-cover"
                        />
                      </div>
                      <div>
                        <div className="font-medium text-slate-950">{selectedReport.targetName}</div>
                        <div className="text-sm capitalize text-slate-500">
                          {selectedReport.targetType}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Report Details */}
                <div className="space-y-4">
                  <div>
                    <h3 className="mb-1 text-sm font-medium text-slate-500">Reason</h3>
                    <p className="text-sm text-slate-700">{selectedReport.reason}</p>
                  </div>

                  <div>
                    <h3 className="mb-1 text-sm font-medium text-slate-500">Details</h3>
                    <p className="whitespace-pre-wrap text-sm text-slate-700">{selectedReport.details}</p>
                  </div>

                  {selectedReport.evidence && selectedReport.evidence.length > 0 && (
                    <div>
                      <h3 className="mb-2 text-sm font-medium text-slate-500">Evidence</h3>
                      <div className="grid grid-cols-2 gap-2">
                        {selectedReport.evidence.map((evidence, i) => (
                          <div
                            key={i}
                            className="relative aspect-video overflow-hidden rounded-md bg-slate-100"
                          >
                            <Image
                              src={evidence}
                              alt="Evidence"
                              fill
                              className="object-cover"
                            />
                            <button className="absolute right-2 top-2 rounded-full bg-white p-1 shadow-sm hover:bg-slate-50">
                              <ExternalLink className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Status & Timestamps */}
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div>
                      <h3 className="mb-1 text-sm font-medium text-slate-500">Status</h3>
                      <span
                        className={clsx("inline-block rounded-full px-2.5 py-1 text-sm capitalize", getStatusClasses(selectedReport.status))}
                      >
                        {selectedReport.status}
                        {selectedReport.banDuration && selectedReport.status === "banned"
                          ? ` (${selectedReport.banDuration})`
                          : ""}
                      </span>
                    </div>

                    <div>
                      <h3 className="mb-1 text-sm font-medium text-slate-500">Reported On</h3>
                      <p className="text-sm text-slate-700">
                        {new Date(selectedReport.createdAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                {selectedReport.status === "waiting" && (
                  <div className="flex justify-end gap-2 border-t pt-4">
                    <button
                      onClick={() => handleRejectReport(selectedReport)}
                      disabled={loading}
                      className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Reject Report
                    </button>
                    <div className="relative group">
                      <button
                        disabled={loading}
                        className="rounded-full bg-linear-to-r from-rose-500 to-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:from-rose-600 hover:to-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Ban User
                      </button>
                      <div className="absolute right-0 top-full mt-2 invisible rounded-2xl border border-slate-200 bg-white shadow-lg group-hover:visible">
                        <button
                          onClick={() => handleBanUser(selectedReport, "1d")}
                          className="block w-full rounded-t-2xl px-4 py-2 text-left text-sm hover:bg-slate-50"
                        >
                          Ban 1 Day
                        </button>
                        <button
                          onClick={() => handleBanUser(selectedReport, "1w")}
                          className="block w-full px-4 py-2 text-left text-sm hover:bg-slate-50"
                        >
                          Ban 1 Week
                        </button>
                        <button
                          onClick={() => handleBanUser(selectedReport, "1m")}
                          className="block w-full px-4 py-2 text-left text-sm hover:bg-slate-50"
                        >
                          Ban 1 Month
                        </button>
                        <button
                          onClick={() => handleBanUser(selectedReport, "forever")}
                          className="block w-full rounded-b-2xl px-4 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
                        >
                          Ban Forever
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
