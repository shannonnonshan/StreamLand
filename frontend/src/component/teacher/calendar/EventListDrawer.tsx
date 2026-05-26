"use client";

import React, { useEffect, useState } from "react";
import { CalendarEvent } from "@/utils/data/teacher/calendar";
import { XIcon, ChevronRightIcon } from "lucide-react";
import EventDrawer from "./EventDrawer";
import { raleway } from "@/utils/front";
import pastelize from "@/utils/colorise";

interface EventListDrawerProps {
  date: Date | null;
  events: CalendarEvent[];
  isOpen: boolean;
  onClose: () => void;
}

export default function EventListDrawer({ date, events, isOpen, onClose }: EventListDrawerProps) {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  useEffect(() => {
    if (date) setSelectedEvent(null);
  }, [date]);

  if (!isOpen || !date) return null;

  if (selectedEvent) {
    return <EventDrawer event={selectedEvent} isOpen={isOpen} onClose={() => setSelectedEvent(null)} />;
  }

  return (
    <div className={`fixed right-0 top-0 z-50 h-screen w-full max-w-sm overflow-y-auto border-l border-slate-200 bg-white/95 px-4 py-5 text-slate-800 backdrop-blur ${raleway.className}`}>
      <button onClick={onClose} className="absolute right-3 top-3 text-slate-400 transition hover:text-slate-700">
        <XIcon size={20} />
        <span className="sr-only">Close</span>
      </button>

      <button
        onClick={onClose}
        className="absolute -left-3.5 top-1/2 -translate-y-1/2 rounded-full border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50"
      >
        <ChevronRightIcon size={18} />
      </button>

      <h5 className="mb-4 text-lg font-semibold text-slate-800">Events on {date.toDateString()}</h5>

      {events.length === 0 ? (
        <p className="text-sm text-slate-500">No events</p>
      ) : (
        <ul className="space-y-2">
          {events.map((event) => {
            const eventDate = new Date(event.date);
            const isPast = eventDate < new Date();
            const baseColor = event.color || "#3b82f6";

            return (
              <li
                key={event.id}
                className="cursor-pointer rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 transition hover:bg-sky-50"
                onClick={() => setSelectedEvent(event)}
                style={{
                  backgroundColor: isPast ? "#f8fafc" : pastelize(baseColor, 0.14),
                  borderLeft: `4px solid ${isPast ? "#cbd5e1" : baseColor}`,
                  color: isPast ? "#64748b" : "#334155",
                  fontSize: "13px",
                  lineHeight: "1.3em",
                }}
              >
                <p className="font-medium wrap-break-word">
                  {event.audience === "public" ? "🌐" : "🔒"} {event.title}
                </p>
                <p className="font-semibold" style={{ color: isPast ? "#64748b" : baseColor }}>
                  {event.start} - {event.end}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
