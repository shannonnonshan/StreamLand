"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, X, ChevronLeft, ChevronRight, Calendar, Search } from "lucide-react";
import { clsx } from "clsx";
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
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [search, setSearch] = useState("");
  const itemsPerPage = 5;

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
    const matchesSearch = search === "" ||
      notification.subject.toLowerCase().includes(search.toLowerCase()) ||
      notification.content.toLowerCase().includes(search.toLowerCase());

    const matchesDateRange = (!startDate || notification.date >= startDate) &&
      (!endDate || notification.date <= endDate);

    return matchesSearch && matchesDateRange;
  });

  const totalPages = Math.ceil(filteredNotifications.length / itemsPerPage);
  const paginatedNotifications = filteredNotifications.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className={`text-2xl font-bold text-[#161853] ${raleway.className}`}>Manage Notification</h1>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setSelectedTarget("teachers");
              setIsModalOpen(true);
            }}
            className={`px-4 py-2 bg-[#FFD93D] text-[#161853] rounded-md hover:bg-[#ffc90f] font-medium ${raleway.className}`}
          >
            TO TEACHERS
          </button>
          <button
            onClick={() => {
              setSelectedTarget("students");
              setIsModalOpen(true);
            }}
            className="px-4 py-2 bg-[#FFD93D] text-[#161853] rounded-md hover:bg-[#ffc90f] font-medium"
          >
            TO STUDENTS
          </button>
          <button
            onClick={() => {
              setSelectedTarget("admins");
              setIsModalOpen(true);
            }}
            className={`px-4 py-2 bg-[#FFD93D] text-[#161853] rounded-md hover:bg-[#ffc90f] font-medium ${raleway.className}`}
          >
            TO ADMINS
          </button>
          <button
            onClick={() => {
              setSelectedTarget("all");
              setIsModalOpen(true);
            }}
            className={`px-4 py-2 bg-[#FFD93D] text-[#161853] rounded-md hover:bg-[#ffc90f] font-medium ${raleway.className}`}
          >
            TO ALL USERS
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center bg-white p-4 rounded-lg shadow-sm">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search notifications..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className={`w-full pl-10 pr-4 py-2 border rounded-md text-sm bg-white ${raleway.className}`}
          />
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-gray-400" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border rounded-md px-2 py-2 text-sm bg-white"
          />
          <span className="text-gray-500">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border rounded-md px-2 py-2 text-sm bg-white"
          />
        </div>
      </div>

      {/* Notifications Table */}
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <table className="w-full">
          <thead className="text-left border-b">
            <tr>
              <th className="pb-4">Subject & Content</th>
              <th className="pb-4">Target</th>
              <th className="pb-4">Date</th>
              <th className="pb-4 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {paginatedNotifications.map((notification) => (
              <tr key={notification.id}>
                <td className="py-4">
                  <div className="space-y-1">
                    <div className="font-medium">{notification.subject}</div>
                    <div className="text-sm text-gray-500 line-clamp-2">
                      {notification.content}
                    </div>
                  </div>
                </td>
                <td className="capitalize">{notification.target}</td>
                <td>{notification.date}</td>
                <td className="text-center">
                  <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                    Sent
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {filteredNotifications.length > 0 && (
          <div className="mt-4 flex items-center justify-between border-t pt-4">
            <div className="text-sm text-gray-500">
              Showing {((page - 1) * itemsPerPage) + 1} to {Math.min(page * itemsPerPage, filteredNotifications.length)} of {filteredNotifications.length} notifications
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

      {/* Send Notification Modal */}
      <Dialog.Root open={isModalOpen} onOpenChange={setIsModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 w-[90vw] max-w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <Dialog.Title className={`text-lg font-semibold text-[#161853] ${raleway.className}`}>
                Send notification to {selectedTarget}
              </Dialog.Title>
              <Dialog.Close className="rounded-full p-1.5 hover:bg-gray-100">
                <X className="h-4 w-4" />
              </Dialog.Close>
            </div>

            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium text-gray-700 mb-1 ${raleway.className}`}>
                  Subject
                </label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                  className={`w-full px-3 py-2 border rounded-md text-sm bg-white ${raleway.className}`}
                  placeholder="Enter notification subject"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium text-gray-700 mb-1 ${raleway.className}`}>
                  Content
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                  rows={4}
                  className={`w-full px-3 py-2 border rounded-md text-sm bg-white resize-none ${raleway.className}`}
                  placeholder="Enter notification content"
                />
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.confirmed}
                  onChange={(e) => setFormData(prev => ({ ...prev, confirmed: e.target.checked }))}
                  className="rounded text-[#161853] focus:ring-[#161853]"
                />
                <span className={`text-sm text-gray-600 ${raleway.className}`}>
                  I confirm about this notification and take the responsibility for any problem occurs.
                </span>
              </label>

              <div className="flex justify-end gap-2 pt-4">
                <Dialog.Close className={`px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-800 ${raleway.className}`}>
                  Cancel
                </Dialog.Close>
                <button
                  onClick={handleSendNotification}
                  disabled={loading || !formData.subject.trim() || !formData.content.trim() || !formData.confirmed}
                  className={`px-4 py-2 bg-[#EC255A] text-white rounded-md text-sm font-medium hover:bg-[#d61e4e] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${raleway.className}`}
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
  );
}
