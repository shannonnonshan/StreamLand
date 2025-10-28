"use client";

import { useState } from "react";
import Image from "next/image";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, X, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
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
  const itemsPerPage = 5;

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

  // Filter reports
  const filteredReports = reports.filter(report => {
    const matchesTab = activeTab === "student" 
      ? report.targetType === "student"
      : report.targetType === "teacher";
    
    const matchesSearch = search === "" || 
      report.targetName.toLowerCase().includes(search.toLowerCase()) ||
      report.reporterName.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || report.status === statusFilter;
    
    return matchesTab && matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredReports.length / itemsPerPage);
  const paginatedReports = filteredReports.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold text-[#161853]">Manage Reports</h1>

      {/* Tabs */}
      <div className="flex gap-4 border-b">
        <button
          onClick={() => {
            setActiveTab("student");
            setPage(1);
          }}
          className={clsx(
            "px-4 py-2 font-medium text-sm transition-colors relative",
            activeTab === "student"
              ? "text-[#161853] border-b-2 border-[#161853] -mb-[2px]"
              : "text-gray-500 hover:text-gray-700"
          )}
        >
          Reports Against Students
        </button>
        <button
          onClick={() => {
            setActiveTab("teacher");
            setPage(1);
          }}
          className={clsx(
            "px-4 py-2 font-medium text-sm transition-colors relative",
            activeTab === "teacher"
              ? "text-[#161853] border-b-2 border-[#161853] -mb-[2px]"
              : "text-gray-500 hover:text-gray-700"
          )}
        >
          Reports Against Teachers
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by name..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 border rounded-md text-sm bg-white"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as "all" | Report["status"]);
            setPage(1);
          }}
          className="border rounded-md px-3 py-2 text-sm bg-white"
        >
          <option value="all">All Status</option>
          <option value="waiting">Waiting</option>
          <option value="banned">Banned</option>
          <option value="resolved">Resolved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Reports Table */}
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="text-left border-b border-gray-200">
              <tr>
                <th className="pb-3">Reporter</th>
                <th className="pb-3">Target</th>
                <th className="pb-3">Reason</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-500">
                    <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" />
                    Processing...
                  </td>
                </tr>
              ) : paginatedReports.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-500">
                    No reports found
                  </td>
                </tr>
              ) : (
                paginatedReports.map((report) => (
                  <tr key={report.id}>
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#161853] rounded-full overflow-hidden flex items-center justify-center">
                          <Image
                            src={report.reporterAvatar || defaultAvatar}
                            alt={report.reporterName}
                            width={40}
                            height={40}
                            className="object-cover"
                          />
                        </div>
                        <div>
                          <div className="font-medium">{report.reporterName}</div>
                          <div className="text-sm text-gray-500 capitalize">
                            {report.reporterType}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#161853] rounded-full overflow-hidden flex items-center justify-center">
                          <Image
                            src={report.targetAvatar || defaultAvatar}
                            alt={report.targetName}
                            width={40}
                            height={40}
                            className="object-cover"
                          />
                        </div>
                        <div>
                          <div className="font-medium">{report.targetName}</div>
                          <div className="text-sm text-gray-500 capitalize">
                            {report.targetType}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="max-w-[200px] truncate" title={report.reason}>
                        {report.reason}
                      </div>
                    </td>
                    <td>
                      <span
                        className={clsx(
                          "px-2 py-1 rounded-full text-sm capitalize",
                          report.status === "waiting"
                            ? "bg-yellow-100 text-yellow-700"
                            : report.status === "banned"
                            ? "bg-red-100 text-red-700"
                            : report.status === "resolved"
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-700"
                        )}
                      >
                        {report.status}
                        {report.banDuration && report.status === "banned"
                          ? ` (${report.banDuration})`
                          : ""}
                      </span>
                    </td>
                    <td className="text-right">
                      <button
                        onClick={() => {
                          setSelectedReport(report);
                          setIsDetailOpen(true);
                        }}
                        className="px-3 py-1.5 border rounded-md text-sm hover:bg-gray-50"
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
        {filteredReports.length > 0 && (
          <div className="mt-4 flex items-center justify-between border-t pt-4">
            <div className="text-sm text-gray-500">
              Showing {((page - 1) * itemsPerPage) + 1} to {Math.min(page * itemsPerPage, filteredReports.length)} of {filteredReports.length} reports
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-md border text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-md border text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Report Detail Dialog */}
      <Dialog.Root open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 w-[90vw] max-w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-lg max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <Dialog.Title className="text-lg font-semibold text-[#161853]">
                Report Details
              </Dialog.Title>
              <Dialog.Close className="rounded-full p-1.5 hover:bg-gray-100">
                <X className="h-4 w-4" />
              </Dialog.Close>
            </div>

            {selectedReport && (
              <div className="space-y-6">
                {/* Reporter & Target Info */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <h3 className="font-medium text-sm text-gray-500">Reporter</h3>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-[#161853] rounded-full overflow-hidden flex items-center justify-center">
                        <Image
                          src={selectedReport.reporterAvatar || defaultAvatar}
                          alt={selectedReport.reporterName}
                          width={48}
                          height={48}
                          className="object-cover"
                        />
                      </div>
                      <div>
                        <div className="font-medium">{selectedReport.reporterName}</div>
                        <div className="text-sm text-gray-500 capitalize">
                          {selectedReport.reporterType}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-medium text-sm text-gray-500">Target</h3>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-[#161853] rounded-full overflow-hidden flex items-center justify-center">
                        <Image
                          src={selectedReport.targetAvatar || defaultAvatar}
                          alt={selectedReport.targetName}
                          width={48}
                          height={48}
                          className="object-cover"
                        />
                      </div>
                      <div>
                        <div className="font-medium">{selectedReport.targetName}</div>
                        <div className="text-sm text-gray-500 capitalize">
                          {selectedReport.targetType}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Report Details */}
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium text-sm text-gray-500 mb-1">Reason</h3>
                    <p className="text-sm">{selectedReport.reason}</p>
                  </div>

                  <div>
                    <h3 className="font-medium text-sm text-gray-500 mb-1">Details</h3>
                    <p className="text-sm whitespace-pre-wrap">{selectedReport.details}</p>
                  </div>

                  {selectedReport.evidence && selectedReport.evidence.length > 0 && (
                    <div>
                      <h3 className="font-medium text-sm text-gray-500 mb-2">Evidence</h3>
                      <div className="grid grid-cols-2 gap-2">
                        {selectedReport.evidence.map((evidence, i) => (
                          <div
                            key={i}
                            className="relative aspect-video bg-gray-100 rounded-md overflow-hidden"
                          >
                            <Image
                              src={evidence}
                              alt="Evidence"
                              fill
                              className="object-cover"
                            />
                            <button className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-sm hover:bg-gray-50">
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
                      <h3 className="font-medium text-sm text-gray-500 mb-1">Status</h3>
                      <span
                        className={clsx(
                          "px-2 py-1 rounded-full text-sm capitalize inline-block",
                          selectedReport.status === "waiting"
                            ? "bg-yellow-100 text-yellow-700"
                            : selectedReport.status === "banned"
                            ? "bg-red-100 text-red-700"
                            : selectedReport.status === "resolved"
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-700"
                        )}
                      >
                        {selectedReport.status}
                        {selectedReport.banDuration && selectedReport.status === "banned"
                          ? ` (${selectedReport.banDuration})`
                          : ""}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-medium text-sm text-gray-500 mb-1">Reported On</h3>
                      <p className="text-sm">
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
                  <div className="border-t pt-4 flex justify-end gap-2">
                    <button
                      onClick={() => handleRejectReport(selectedReport)}
                      disabled={loading}
                      className="px-4 py-2 border rounded-md text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                    >
                      Reject Report
                    </button>
                    <div className="relative group">
                      <button
                        disabled={loading}
                        className="px-4 py-2 bg-red-500 text-white rounded-md text-sm font-medium hover:bg-red-600 disabled:opacity-50"
                      >
                        Ban User
                      </button>
                      <div className="absolute right-0 top-full mt-2 bg-white rounded-md shadow-lg border invisible group-hover:visible">
                        <button
                          onClick={() => handleBanUser(selectedReport, "1d")}
                          className="block w-full px-4 py-2 text-sm text-left hover:bg-gray-50"
                        >
                          Ban 1 Day
                        </button>
                        <button
                          onClick={() => handleBanUser(selectedReport, "1w")}
                          className="block w-full px-4 py-2 text-sm text-left hover:bg-gray-50"
                        >
                          Ban 1 Week
                        </button>
                        <button
                          onClick={() => handleBanUser(selectedReport, "1m")}
                          className="block w-full px-4 py-2 text-sm text-left hover:bg-gray-50"
                        >
                          Ban 1 Month
                        </button>
                        <button
                          onClick={() => handleBanUser(selectedReport, "forever")}
                          className="block w-full px-4 py-2 text-sm text-left hover:bg-gray-50 text-red-600"
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
