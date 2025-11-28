"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Play, Calendar, Clock, Search, Filter, Grid3x3, List } from "lucide-react";
import { getRecordedLivestreams, LiveStream, groupRecordingsByMonth } from "@/lib/api/teacher";

export default function RecordingsPage() {
  const params = useParams();
  const router = useRouter();
  const teacherId = params?.id as string || "1";

  const [filter, setFilter] = useState<"7days" | "1month" | "custom">("7days");
  const [customFrom, setCustomFrom] = useState("2025-01");
  const [customTo, setCustomTo] = useState("2025-10");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [recordings, setRecordings] = useState<LiveStream[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const recordingsByMonth = groupRecordingsByMonth(recordings);
  const months = Object.keys(recordingsByMonth).sort((a, b) => b.localeCompare(a));
  const [selectedMonth, setSelectedMonth] = useState(months[0] || "");

  // Fetch recordings from backend
  useEffect(() => {
    const fetchRecordings = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await getRecordedLivestreams(teacherId);
        setRecordings(data);
        if (data.length > 0) {
          const grouped = groupRecordingsByMonth(data);
          const monthKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
          setSelectedMonth(monthKeys[0]);
        }
      } catch (err) {
        console.error('Failed to fetch recordings:', err);
        setError('Failed to load recordings');
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecordings();
  }, [teacherId]);

  // Lọc tháng hiển thị theo filter
  const monthsToShow = filter === "custom"
    ? months.filter(m => m >= customFrom && m <= customTo)
    : months.slice(0, 6);

  // Filter recordings by search query
  const currentMonthRecordings = (recordingsByMonth[selectedMonth] || [])
    .filter(r => r.title.toLowerCase().includes(searchQuery.toLowerCase()));

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="text-gray-500">Loading recordings...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">My Recordings</h1>
        <p className="text-gray-600">Browse and manage your livestream recordings</p>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          {/* Search */}
          <div className="flex-1 min-w-[250px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search recordings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#292C6D] focus:border-transparent text-gray-900"
              />
            </div>
          </div>

          {/* Filter Options */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter size={18} className="text-gray-500" />
              <select
                className="border border-gray-500 rounded-lg bg-white px-4 py-2 text-sm focus:ring-2 focus:ring-[#292C6D] focus:border-transparent text-gray-900"
                value={filter}
                onChange={(e) => setFilter(e.target.value as "7days" | "1month" | "custom")}
              >
                <option value="7days">Last 7 days</option>
                <option value="1month">Last 1 month</option>
                <option value="custom">Custom range</option>
              </select>
            </div>

            {filter === "custom" && (
              <div className="flex items-center gap-2">
                <select
                  value={customFrom}
                  onChange={(e) => {
                    setCustomFrom(e.target.value);
                    if (e.target.value > customTo) setCustomTo(e.target.value);
                  }}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
                >
                  {months.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <span className="text-gray-400">→</span>
                <select
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
                >
                  {months.filter(m => m >= customFrom).map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            )}

            {/* View Mode Toggle */}
            <div className="flex border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 ${viewMode === "grid" ? "bg-[#292C6D] text-white" : "bg-white text-gray-600 hover:bg-[#FAEDF0]/50"}`}
              >
                <Grid3x3 size={18} />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 ${viewMode === "list" ? "bg-[#292C6D] text-white" : "bg-white text-gray-600 hover:bg-[#FAEDF0]/50"}`}
              >
                <List size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden gap-6">
        {/* Left Sidebar: Months */}
        <div className="w-64 bg-white rounded-xl shadow-sm p-4 overflow-y-auto">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar size={18} />
            Time Period
          </h3>
          <ul className="space-y-1">
            {monthsToShow.map(month => {
              const monthRecordings = recordingsByMonth[month] || [];
              return (
                <li key={month}>
                  <button
                    onClick={() => setSelectedMonth(month)}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-all ${
                      month === selectedMonth 
                        ? "bg-[#292C6D] text-white shadow-md" 
                        : "hover:bg-[#FAEDF0]/50 text-gray-700"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{month}</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        month === selectedMonth ? "bg-white/20" : "bg-gray-100 text-gray-600"
                      }`}>
                        {monthRecordings.length}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Right: Recordings Grid/List */}
        <div className="flex-1 overflow-y-auto">
          {currentMonthRecordings.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Play size={40} className="text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No recordings found</h3>
              <p className="text-gray-500">
                {searchQuery ? "Try adjusting your search query" : "No recordings for this period"}
              </p>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {currentMonthRecordings.map((rec) => (
                <div
                  key={rec.id}
                  className="bg-white rounded-xl shadow-sm overflow-hidden cursor-pointer group hover:shadow-xl transition-all transform hover:-translate-y-1"
                  onClick={() => router.push(`/teacher/${teacherId}/recordings/detail/${rec.id}`)}
                >
                  <div className="relative aspect-video overflow-hidden">
                    <Image
                      src={rec.thumbnail || "/logo.png"}
                      alt={rec.title}
                      width={400}
                      height={225}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center">
                        <Play size={24} className="text-[#292C6D] ml-1" />
                      </div>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-[#292C6D] transition-colors">
                      {rec.title}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar size={14} />
                        {new Date(rec.endedAt || rec.createdAt).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={14} />
                        {Math.floor(rec.duration / 60)}:{String(rec.duration % 60).padStart(2, '0')}
                      </span>
                      <span>{rec.totalViews} views</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {currentMonthRecordings.map((rec) => (
                <div
                  key={rec.id}
                  className="bg-white rounded-xl shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-all"
                  onClick={() => router.push(`/teacher/${teacherId}/recordings/detail/${rec.id}`)}
                >
                  <div className="flex gap-4 p-4">
                    <div className="relative w-48 h-28 flex-shrink-0 rounded-lg overflow-hidden">
                      <Image
                        src={rec.thumbnail || "/logo.png"}
                        alt={rec.title}
                        width={192}
                        height={112}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <Play size={32} className="text-white" />
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col justify-center">
                      <h3 className="font-semibold text-gray-900 mb-2 hover:text-[#292C6D] transition-colors">
                        {rec.title}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar size={14} />
                          {new Date(rec.endedAt || rec.createdAt).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={14} />
                          {Math.floor(rec.duration / 60)}:{String(rec.duration % 60).padStart(2, '0')}
                        </span>
                        <span>{rec.totalViews} views</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
