"use client";

import { useState } from "react";
import { raleway } from "@/utils/front";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { mockRecordings, Recording } from "@/utils/data/teacher/mockRecordings";

export default function RecordingsPage() {
  const params = useParams();
  const router = useRouter();
  const teacherId = params?.id || "1";

  const [filter, setFilter] = useState<"7days" | "1month" | "custom">("7days");
  const [customFrom, setCustomFrom] = useState("2025-01");
  const [customTo, setCustomTo] = useState("2025-10");

  const months = Array.from(new Set(mockRecordings.map(r => r.month))).sort((a, b) => b.localeCompare(a));
  const [selectedMonth, setSelectedMonth] = useState(months[0]);

  // Lọc tháng hiển thị theo filter
  const monthsToShow = filter === "custom"
    ? months.filter(m => m >= customFrom && m <= customTo)
    : months.slice(0, 6);

  const currentMonthRecordings = mockRecordings.filter(r => r.month === selectedMonth);

  return (
    <div className={`flex flex-col h-full text-black p-5 ${raleway.className}`}>
      {/* Filter */}
      <div className="flex justify-between mb-4 space-x-4 items-center">
        <h2 className="text-2xl font-semibold">Recordings</h2>
        <div className="flex space-x-2 items-center">
          <select
            className="border rounded bg-[#161853] text-white px-3 py-1"
            value={filter}
            onChange={(e) => setFilter(e.target.value as "7days" | "1month" | "custom")}
          >
            <option value="7days">Last 7 days</option>
            <option value="1month">Last 1 month</option>
            <option value="custom">Custom range</option>
          </select>

          {filter === "custom" && (
            <div className="flex space-x-2">
              <select
                value={customFrom}
                onChange={(e) => {
                  setCustomFrom(e.target.value);
                  if (e.target.value > customTo) setCustomTo(e.target.value);
                }}
                className="border rounded px-2 py-1"
              >
                {months.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <span>→</span>
              <select
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="border rounded px-2 py-1"
              >
                {months.filter(m => m >= customFrom).map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Months */}
        <div className="w-[20%] border-r border-gray-300 pr-4 overflow-y-auto">
          <ul className="space-y-2">
            {monthsToShow.map(month => (
              <li key={month}>
                <button
                  onClick={() => setSelectedMonth(month)}
                  className={`w-full text-left p-2 rounded ${month === selectedMonth ? "bg-yellow-200 font-bold" : "hover:bg-gray-100"}`}
                >
                  {month}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Right: Recordings */}
        <div className="flex-1 pl-4 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {currentMonthRecordings.map((rec) => (
            <div
              key={rec.id}
              className="bg-white shadow border rounded p-2 flex flex-col items-center cursor-pointer hover:shadow-md"
              onClick={() => router.push(`/teacher/${teacherId}/recordings/detail/${rec.id}`)}
            >
              <Image
                src={rec.thumbnail}
                alt={rec.title}
                width={300}
                height={160}
                className="mb-2 rounded object-cover"
              />
              <h3 className="font-semibold text-center">{rec.title}</h3>
              <span className="text-xs text-gray-500">{rec.date}</span>
            </div>
          ))}
          {currentMonthRecordings.length === 0 && <p className="text-gray-500">No recordings for this month.</p>}
        </div>
      </div>
    </div>
  );
}
