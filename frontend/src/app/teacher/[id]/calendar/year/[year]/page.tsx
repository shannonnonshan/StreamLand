"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { raleway } from "@/utils/front";
import { formatScheduleForCalendar, getTeacherSchedules } from "@/lib/api/teacher";

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTH_SHORT  = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAYS_SHORT   = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function eventBg(hex: string): string {
  const c = hex.replace("#","");
  if (c.length !== 6) return "#e0e7ff";
  const r = parseInt(c.slice(0,2),16), g = parseInt(c.slice(2,4),16), b = parseInt(c.slice(4,6),16);
  return `rgb(${Math.round(r*0.25+255*0.75)},${Math.round(g*0.25+255*0.75)},${Math.round(b*0.25+255*0.75)})`;
}

interface CalendarEvent {
  id?: string; teacherId: string; title: string; date: string;
  start: string; end: string; color: string;
  audience: "public" | "subscribers"; type?: "livestream"; status?: string;
}

interface Props {
  initialYear: number;
  teacherId: string;
}

export default function YearCalendarClient({ initialYear, teacherId }: Props) {
  const router  = useRouter();
  const today   = new Date();
  const todayStr = today.toISOString().split("T")[0];

  const safeYear = Number.isFinite(initialYear) ? initialYear : today.getFullYear();

  const [year, setYear]             = useState(safeYear);
  const [events, setEvents]         = useState<CalendarEvent[]>([]);
  const [expandedMonth, setExpanded] = useState<number | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const rows = await getTeacherSchedules(teacherId, `${year}-01-01`, `${year}-12-31`).catch(() => []);
      setEvents((rows as any[]).map(formatScheduleForCalendar));
    } catch {
      setEvents([]);
    }
  }, [teacherId, year]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const changeYear = (delta: number) => {
    const y = year + delta;
    setYear(y);
    setExpanded(null);
    router.push(`/teacher/${teacherId}/calendar/year/${y}`);
  };

  function monthEvents(mi: number) {
    const prefix = `${year}-${String(mi+1).padStart(2,"0")}`;
    return events.filter(ev => ev.teacherId === teacherId && ev.date.startsWith(prefix));
  }

  function buildMonth(mi: number) {
    return {
      firstDow:    new Date(year, mi, 1).getDay(),
      daysInMonth: new Date(year, mi+1, 0).getDate(),
    };
  }

  const currentMonthIdx = today.getFullYear() === year ? today.getMonth() : -1;

  return (
    <div className={raleway.className}>

      {/* ── 12-month grid ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 12 }, (_, mi) => {
          const { firstDow, daysInMonth } = buildMonth(mi);
          const mEvs     = monthEvents(mi);
          const isCurrent = mi === currentMonthIdx;
          const isExpanded = expandedMonth === mi;
          const blanks = Array.from({ length: firstDow });
          const days   = Array.from({ length: daysInMonth }, (_, i) => i+1);

          return (
            <div key={mi} className={`overflow-hidden rounded-2xl border shadow-sm transition-shadow ${
              isCurrent ? "border-sky-400 shadow-md shadow-sky-100" : "border-slate-200 hover:border-sky-200 hover:shadow-md"
            }`}>

              {/* Month header */}
              <div className={`flex items-center justify-between px-4 py-2.5 ${isCurrent ? "bg-slate-800" : "bg-slate-700"}`}>
                <button
                  onClick={() => router.push(`/teacher/${teacherId}/calendar/month/${year}/${mi+1}`)}
                  className="text-sm font-bold text-white transition hover:text-sky-200"
                >
                  {MONTH_NAMES[mi]}
                </button>
                <div className="flex items-center gap-2">
                  {mEvs.length > 0 && (
                    <span className="rounded-full bg-sky-500 px-2 py-0.5 text-[10px] font-bold text-white">
                      {mEvs.length}
                    </span>
                  )}
                  {mEvs.length > 0 && (
                    <button
                      onClick={() => setExpanded(isExpanded ? null : mi)}
                      className={`rounded-lg px-2 py-0.5 text-[10px] font-bold transition ${
                        isExpanded ? "bg-white/25 text-white" : "bg-white/10 text-slate-300 hover:bg-white/20 hover:text-white"
                      }`}
                    >
                      {isExpanded ? "Hide" : "Events"}
                    </button>
                  )}
                </div>
              </div>

              {/* Mini calendar */}
              <div className="bg-white px-2 pt-2 pb-1.5">
                {/* Weekday labels */}
                <div className="mb-1 grid grid-cols-7">
                  {DAYS_SHORT.map((d, i) => (
                    <div key={i} className={`text-center text-[9px] font-bold ${i===0?"text-rose-400":i===6?"text-sky-400":"text-slate-400"}`}>{d}</div>
                  ))}
                </div>

                {/* Date cells */}
                <div className="grid grid-cols-7">
                  {blanks.map((_, i) => <div key={`b${i}`} className="h-7" />)}
                  {days.map(date => {
                    const dStr   = `${year}-${String(mi+1).padStart(2,"0")}-${String(date).padStart(2,"0")}`;
                    const isToday = dStr === todayStr;
                    const isPast  = dStr < todayStr;
                    const dow     = new Date(year, mi, date).getDay();
                    const isWknd  = dow === 0 || dow === 6;
                    const evColor = events.find(ev => ev.teacherId === teacherId && ev.date === dStr)?.color;

                    return (
                      <div key={date} className="relative flex justify-center py-0.5">
                        <button
                          onClick={() => router.push(`/teacher/${teacherId}/calendar/month/${year}/${mi+1}`)}
                          className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition ${
                            isToday  ? "bg-sky-500 text-white shadow shadow-sky-200"
                            : isPast ? "text-slate-300"
                            : isWknd ? "text-slate-500 hover:bg-slate-100"
                            : "text-slate-700 hover:bg-sky-100 hover:text-sky-700"
                          }`}
                        >
                          {date}
                        </button>
                        {/* Event dot */}
                        {evColor && !isToday && (
                          <span
                            className="absolute bottom-0 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full border-2 border-white"
                            style={{ backgroundColor: evColor }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Expanded event list — click "Events"*/}
              {isExpanded && mEvs.length > 0 && (
                <div className="border-t border-slate-100 bg-slate-50">
                  <div className="max-h-52 divide-y divide-slate-100 overflow-y-auto">
                    {mEvs
                      .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))
                      .map((ev, i) => {
                        const color  = ev.color || "#6366f1";
                        const isPast = ev.date < todayStr;
                        const isLive = ev.status === "LIVE" || ev.status === "live";
                        const d      = new Date(ev.date + "T00:00:00");
                        const label  = `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
                        return (
                          <div
                            key={i}
                            className="flex cursor-pointer items-center gap-2 px-3 py-2 transition hover:bg-slate-100"
                            onClick={() => router.push(`/teacher/${teacherId}/calendar/month/${year}/${mi+1}`)}
                          >
                            <span
                              className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold"
                              style={{ backgroundColor: isPast ? "#f1f5f9" : eventBg(color), color: isPast ? "#94a3b8" : color }}
                            >
                              {label}
                            </span>
                            {isLive && (
                              <span className="shrink-0 rounded-sm bg-red-500 px-1 text-[9px] font-bold text-white">LIVE</span>
                            )}
                            <span className={`truncate text-xs font-semibold ${isPast ? "text-slate-400" : "text-slate-800"}`}>
                              {ev.title}
                            </span>
                            <span className="ml-auto shrink-0 text-[10px] font-bold" style={{ color: isPast ? "#94a3b8" : color }}>
                              {ev.start}
                            </span>
                          </div>
                        );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}