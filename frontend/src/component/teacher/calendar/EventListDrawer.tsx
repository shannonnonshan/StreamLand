"use client";

import React, { useState, useEffect } from "react";
import { CalendarEvent } from "@/utils/calendar";
import { XIcon, ChevronRightIcon } from "lucide-react";
import EventDrawer from "./EventDrawer";
import { raleway } from "@/utils/front";
import pastelise  from "@/utils/colorise"; // giả sử bạn có hàm pastelise()

interface EventListDrawerProps {
  date: Date | null;
  events: CalendarEvent[];
  isOpen: boolean;
  onClose: () => void;
}

export default function EventListDrawer({
  date,
  events,
  isOpen,
  onClose,
}: EventListDrawerProps) {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  useEffect(() => {
    if (date) setSelectedEvent(null); // reset khi đổi ngày
  }, [date]);

  if (!isOpen || !date) return null;

  // Nếu đã chọn event thì show EventDrawer (detail view)
  if (selectedEvent) {
    return (
      <EventDrawer
        event={selectedEvent}
        isOpen={isOpen}
        onClose={() => setSelectedEvent(null)} // nút back
      />
    );
  }

  return (
    <div
      className={`fixed top-0 right-0 z-50 h-screen w-80 p-4
      bg-white shadow-lg overflow-y-auto transition-transform ${raleway.className}`}
    >
      {/* Nút đóng ở góc phải trên */}
      <button
        onClick={onClose}
        className="absolute top-2.5 right-2.5 text-gray-400 hover:text-gray-900"
      >
        <XIcon size={20} />
        <span className="sr-only">Close</span>
      </button>

      {/* Nút đóng dạng tròn ở mép trái giữa */}
      <button
        onClick={onClose}
        className="absolute top-1/2 -left-4 transform -translate-y-1/2
        bg-white border rounded-full shadow p-2 hover:bg-gray-100"
      >
        <ChevronRightIcon size={18} className="text-gray-600" />
      </button>

      <h5 className="text-lg font-bold text-black mb-4">
        Events on {date.toDateString()}
      </h5>

      {events.length === 0 ? (
        <p className="text-sm text-gray-500">No events</p>
      ) : (
        <ul className="space-y-2">
          {events.map((ev) => {
            const eventDate = new Date(ev.date);
            const isPast = eventDate < new Date();
            const baseColor = ev.color || "#3b82f6"; // fallback màu xanh Tailwind
            return (
              <li
                key={ev.id}
                className="rounded px-2 py-1 cursor-pointer"
                onClick={() => setSelectedEvent(ev)}
                style={{
                  backgroundColor: isPast ? "#f3f4f6" : pastelise(baseColor, 0.25),
                  borderLeft: `4px solid ${isPast ? "#9ca3af" : baseColor}`,
                  color: isPast ? "#6b7280" : "#111827",
                  fontSize: "13px",
                  lineHeight: "1.3em",
                }}
              >
                <p className="font-medium break-words">
                  {ev.audience === "public" ? "🌐" : "🔒"} {ev.title}
                </p>
                <p
                  className="font-semibold"
                  style={{ color: isPast ? "#6b7280" : baseColor }}
                >
                  {ev.start} - {ev.end}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
