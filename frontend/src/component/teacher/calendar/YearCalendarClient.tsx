"use client";

import { useState, useEffect } from "react";
import { CalendarEvent } from "@/utils/data/teacher/calendar";
import EventListDrawer from "@/component/teacher/calendar/EventListDrawer";
import { getTeacherSchedules, formatScheduleForCalendar } from "@/lib/api/teacher";
import { useConfirmDialog } from "@/component/teacher/useConfirmDialog";

const monthNames = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const dayNames = ["Mo","Tu","We","Th","Fr","Sa","Su"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstWeekday(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

function eventBg(hex: string): string {
  const c = hex.replace("#", "");
  if (c.length !== 6) return "#e0e7ff";
  const r = parseInt(c.slice(0,2),16), g = parseInt(c.slice(2,4),16), b = parseInt(c.slice(4,6),16);
  return `rgb(${Math.round(r*0.25+255*0.75)},${Math.round(g*0.25+255*0.75)},${Math.round(b*0.25+255*0.75)})`;
}

export default function YearCalendarClient({
  initialYear,
  teacherId,
}: {
  initialYear: number;
  teacherId: string;
}) {
  const today   = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const safeYear = Number.isFinite(initialYear) ? initialYear : today.getFullYear();

  const [year, setYear]           = useState(safeYear);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [drawerOpen, setDrawerOpen]     = useState(false);
  const [events, setEvents]             = useState<CalendarEvent[]>([]);
  const { showDialog, DialogComponent } = useConfirmDialog();

  useEffect(() => {
    getTeacherSchedules(teacherId)
      .then(s => setEvents(s.map(formatScheduleForCalendar)))
      .catch(() => {});
  }, [teacherId]);

  const eventsByDate = (date: Date) => {
    const dStr = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
    return events.filter(ev => ev.teacherId === teacherId && ev.date === dStr);
  };

  const isPastDate = (date: Date) => {
    const d = new Date(date); d.setHours(0,0,0,0);
    const n = new Date();     n.setHours(0,0,0,0);
    return d < n;
  };

  const openDay = (date: Date) => {
    if (isPastDate(date)) {
      showDialog({
        title: "Cannot Schedule in the Past",
        message: "Cannot schedule events in the past. Please select a future date.",
        type: "warning", confirmText: "OK", cancelText: "Close",
      });
      return;
    }
    setSelectedDate(date);
    setDrawerOpen(true);
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 pb-6 pt-2 lg:px-6">

      {/* ── Year header ── */}
      <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setYear(y => y - 1)}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-lg font-bold text-slate-500 transition hover:bg-sky-50 hover:text-sky-600 active:scale-95"
          >‹</button>
          <span className="min-w-[4rem] text-center text-xl font-bold tabular-nums text-slate-800">{year}</span>
          <button
            onClick={() => setYear(y => y + 1)}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-lg font-bold text-slate-500 transition hover:bg-sky-50 hover:text-sky-600 active:scale-95"
          >›</button>
        </div>
        <button
          onClick={() => setYear(today.getFullYear())}
          className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-1.5 text-sm font-bold text-sky-600 transition hover:bg-sky-100 active:scale-95"
        >
          This year
        </button>
      </div>

      {/* ── 12-month grid ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {monthNames.map((monthName, idx) => {
          const daysInMonth  = getDaysInMonth(year, idx);
          const firstWeekday = getFirstWeekday(year, idx);
          const cells = Array(firstWeekday).fill(null).concat(
            Array.from({ length: daysInMonth }, (_, i) => i + 1)
          );

          const isCurrentMonth = today.getFullYear() === year && today.getMonth() === idx;

          // Collect events in this month for the dot strip
          const monthStr = `${year}-${String(idx+1).padStart(2,"0")}`;
          const mEvs = events.filter(ev => ev.teacherId === teacherId && ev.date.startsWith(monthStr));

          return (
            <div key={idx} className={`overflow-hidden rounded-2xl border shadow-sm transition-shadow ${
              isCurrentMonth ? "border-sky-400 shadow-md shadow-sky-100" : "border-slate-200 hover:border-sky-200 hover:shadow-md"
            }`}>

              {/* Month title bar — dark */}
              <div className={`px-4 py-2.5 ${isCurrentMonth ? "bg-slate-800" : "bg-slate-700"}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white">{monthName}</span>
                  {mEvs.length > 0 && (
                    <span className="rounded-full bg-sky-500 px-2 py-0.5 text-[10px] font-bold text-white">
                      {mEvs.length} event{mEvs.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>

              {/* Mini calendar */}
              <div className="bg-white px-3 pt-2.5 pb-3">
                {/* Weekday headers */}
                <div className="mb-1.5 grid grid-cols-7 text-center">
                  {dayNames.map((d, i) => (
                    <div key={d} className={`text-[9px] font-bold uppercase tracking-wide ${
                      i === 6 ? "text-rose-400" : "text-slate-400"
                    }`}>{d}</div>
                  ))}
                </div>

                {/* Date cells */}
                <div className="grid grid-cols-7 gap-y-0.5 text-center">
                  {cells.map((day, i) => {
                    if (!day) return <div key={i} className="h-8" />;

                    const dateObj  = new Date(year, idx, day);
                    const dStr     = `${year}-${String(idx+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
                    const evs      = events.filter(ev => ev.teacherId === teacherId && ev.date === dStr);
                    const isToday  = today.toDateString() === dateObj.toDateString();
                    const isSunday = (i % 7) === 6;
                    const isPast   = isPastDate(dateObj);
                    const dotColor = evs[0]?.color;

                    return (
                      <div
                        key={i}
                        onClick={() => !isPast && openDay(dateObj)}
                        title={isPast ? "Cannot schedule in the past" : evs.length ? evs.map(e=>e.title).join(", ") : ""}
                        className={`relative flex h-8 flex-col items-center justify-center rounded-lg transition ${
                          isToday
                            ? "bg-sky-500 font-bold text-white shadow shadow-sky-200"
                            : isPast
                              ? "cursor-not-allowed bg-slate-50 text-slate-300"
                              : isSunday
                                ? "cursor-pointer text-rose-500 hover:bg-rose-50"
                                : "cursor-pointer text-slate-700 hover:bg-sky-50 hover:text-sky-700"
                        }`}
                      >
                        <span className="text-xs leading-none">{day}</span>

                        {evs.length > 0 && (
                          <span
                            className="mt-0.5 h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: isToday ? "white" : dotColor || "#0ea5e9" }}
                          />
                        )}

                        {evs.length > 1 && !isToday && (
                          <span
                            className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-bold text-white"
                            style={{ backgroundColor: dotColor || "#0ea5e9" }}
                          >
                            {evs.length}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {mEvs.length > 0 && (
                  <div className="mt-2.5 space-y-1 border-t border-slate-100 pt-2">
                    {mEvs.slice(0, 3).map((ev, i) => {
                      const color  = ev.color || "#0ea5e9";
                      const isPast = ev.date < todayStr;
                      const d      = new Date(ev.date + "T00:00:00");
                      return (
                        <div
                          key={i}
                          onClick={() => !isPast && openDay(d)}
                          className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 transition hover:brightness-95 ${isPast ? "opacity-50" : ""}`}
                          style={{ backgroundColor: isPast ? "#f8fafc" : eventBg(color), borderLeft: `3px solid ${isPast ? "#cbd5e1" : color}` }}
                        >
                          <span className="text-[10px] font-bold" style={{ color: isPast ? "#94a3b8" : color }}>
                            {d.getDate()}
                          </span>
                          <span className="truncate text-[11px] font-semibold text-slate-700">{ev.title}</span>
                          <span className="ml-auto shrink-0 text-[10px] font-bold" style={{ color: isPast ? "#94a3b8" : color }}>
                            {ev.start}
                          </span>
                        </div>
                      );
                    })}
                    {mEvs.length > 3 && (
                      <p className="pl-2 text-[10px] font-semibold text-slate-400">+{mEvs.length - 3} more</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <EventListDrawer
        date={selectedDate}
        events={selectedDate ? eventsByDate(selectedDate) : []}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />

      {DialogComponent}
    </div>
  );
}