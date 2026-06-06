"use client";

import { useState, useEffect, use, useCallback } from "react";
import { raleway } from "@/utils/front";
import EventDrawer from "@/component/teacher/calendar/EventDrawer";
import { ScheduleEvent } from "@/component/teacher/calendar/ScheduleEventModal";
import ScheduleEventModal from "@/component/teacher/calendar/ScheduleEventModal";
import {
  createSchedule, formatLivestreamForCalendar, formatScheduleForCalendar,
  getTeacherLivestreams, getTeacherSchedules,
} from "@/lib/api/teacher";
import { useToast } from "@/hooks/useToast";
import ConfirmDialog from "@/component/ConfirmDialog";
import { Plus } from "lucide-react";

const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

interface CalendarEvent {
  id?: string; teacherId: string; title: string; date: string;
  start: string; end: string; color: string; audience: "public"|"subscribers";
  notification?: number; description?: string; livestreamId?: string;
  type?: "livestream"; status?: string; scheduleId?: string;
}

function eventBg(hex: string): string {
  const c = hex.replace("#","");
  if (c.length !== 6) return "#e0e7ff";
  const r = parseInt(c.slice(0,2),16), g = parseInt(c.slice(2,4),16), b = parseInt(c.slice(4,6),16);
  // Mix 22% color + 78% white
  return `rgb(${Math.round(r*0.22+255*0.78)},${Math.round(g*0.22+255*0.78)},${Math.round(b*0.22+255*0.78)})`;
}

export default function MonthCalendarPage({ params }: { params: Promise<{ id?: string; year?: string; month?: string }> }) {
  const { id, year: yearParam, month: monthParam } = use(params);
  const today = new Date();
  const { success, error: showError, ToastComponent } = useToast();

  const teacherId = id ?? "1";
  const [month, setMonth] = useState(monthParam ? Number(monthParam)-1 : today.getMonth());
  const [year, setYear] = useState(yearParam ? Number(yearParam) : today.getFullYear());
  const [noOfDays, setNoOfDays] = useState<number[]>([]);
  const [blankDays, setBlankDays] = useState<number[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [openModal, setOpenModal] = useState(false);
  const [eventDate, setEventDate] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, date: 0 });

  const fetchSchedules = useCallback(async () => {
    try {
      const startDate = new Date(year, month, 1).toISOString().split("T")[0];
      const endDate = new Date(year, month+1, 0).toISOString().split("T")[0];
      const [schedules, livestreams] = await Promise.all([
        getTeacherSchedules(teacherId, startDate, endDate).catch(() => []),
        getTeacherLivestreams(teacherId).catch(() => []),
      ]);
      const cal: CalendarEvent[] = schedules.map(formatScheduleForCalendar);
      livestreams.forEach((ls: any) => {
        if (ls.schedule) return;
        if (["SCHEDULED","LIVE","ENDED"].includes(ls.status))
          cal.push(formatLivestreamForCalendar(ls, ls.status.toLowerCase()) as CalendarEvent);
      });
      setEvents(cal);
    } catch { setEvents([]); }
  }, [teacherId, year, month]);

  useEffect(() => { fetchSchedules(); }, [fetchSchedules]);
  useEffect(() => {
    const daysInMonth = new Date(year, month+1, 0).getDate();
    const firstDow = new Date(year, month, 1).getDay();
    setBlankDays(Array.from({ length: firstDow }, (_, i) => i));
    setNoOfDays(Array.from({ length: daysInMonth }, (_, i) => i+1));
  }, [month, year]);

  const isToday = (d: number) => today.toDateString() === new Date(year, month, d).toDateString();
  const todayStr = today.toISOString().split("T")[0];

  const showEventModal = (date: number) => {
    const sel = new Date(year, month, date);
    const now = new Date(); now.setHours(0,0,0,0);
    if (sel < now) { setConfirmDialog({ open: true, date }); return; }
    setOpenModal(true);
    setEventDate(new Date(sel.getTime() - sel.getTimezoneOffset()*60000).toISOString().split("T")[0]);
  };

  const handleSaveEvent = async (ev: ScheduleEvent) => {
    try {
      await createSchedule(teacherId, {
        title: ev.title, startTime: ev.startTime, endTime: ev.endTime,
        isPublic: ev.isPublic ?? true, color: ev.color,
        notifyBefore: ev.notifyBefore, tags: ev.tags, category: ev.category,
      });
      await fetchSchedules();
      success("Schedule created!");
    } catch (e) { showError(`Failed: ${e instanceof Error ? e.message : "error"}`); }
  };

  return (
    <div className={raleway.className}>
      {/* Grid */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
        {/* Day headers */}
        <div className="grid grid-cols-7 bg-slate-800">
          {DAYS.map((d, i) => (
            <div key={d} className={`py-2.5 text-center text-[11px] font-bold uppercase tracking-widest ${i===0?"text-rose-300":i===6?"text-sky-300":"text-slate-300"}`}>{d}</div>
          ))}
        </div>

        {/* Cells */}
        <div className="grid grid-cols-7 divide-x divide-y divide-slate-200 bg-white">
          {blankDays.map((_,i) => <div key={i} style={{minHeight:130}} className="bg-slate-50" />)}
          {noOfDays.map(date => {
            const dow = new Date(year, month, date).getDay();
            const isWknd = dow===0||dow===6;
            const cellDate = `${year}-${String(month+1).padStart(2,"0")}-${String(date).padStart(2,"0")}`;
            const now = new Date(); now.setHours(0,0,0,0);
            const isPast = new Date(year,month,date) < now;
            const dayEvs = events
              .filter(ev => ev.teacherId===teacherId && ev.date===cellDate)
              .sort((a,b) => a.start.localeCompare(b.start));

            return (
              <div key={date} style={{minHeight:130}}
                className={`group relative flex flex-col p-1.5 transition-colors ${
                  isPast ? "bg-slate-50" : isToday(date) ? "bg-sky-50 ring-2 ring-inset ring-sky-400" : isWknd ? "bg-slate-50/80 hover:bg-sky-50/50" : "bg-white hover:bg-sky-50/40"
                }`}>
                {/* Date number row */}
                <div className="mb-1 flex items-center justify-between">
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold cursor-pointer transition ${
                    isToday(date) ? "bg-sky-500 text-white shadow-md shadow-sky-300"
                    : isPast ? "text-slate-300"
                    : isWknd ? "text-slate-500 hover:bg-slate-200" : "text-slate-700 hover:bg-sky-100 hover:text-sky-700"
                  }`} onClick={() => !isPast && showEventModal(date)}>{date}</span>
                  {!isPast && (
                    <button onClick={() => showEventModal(date)}
                      className="invisible h-5 w-5 items-center justify-center rounded-full bg-sky-500 text-white opacity-0 transition flex group-hover:visible group-hover:opacity-100 hover:bg-sky-600">
                      <Plus size={11}/>
                    </button>
                  )}
                </div>

                {/* Events */}
                <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto" style={{maxHeight:90}}>
                  {dayEvs.map((ev, i) => {
                    const evIsPast = ev.date < todayStr;
                    const color = ev.color || "#6366f1";
                    const isLive = ev.status==="LIVE"||ev.status==="live";
                    if (isPast || evIsPast) return (
                      <button key={i} onClick={() => { setSelectedEvent(ev); setDrawerOpen(true); }}
                        className="w-full truncate rounded-md bg-slate-100 px-2 py-0.5 text-left text-[11px] font-medium text-slate-400 transition hover:bg-slate-200">
                        {ev.start} {ev.title}
                      </button>
                    );
                    return (
                      <button key={i} onClick={() => { setSelectedEvent(ev); setDrawerOpen(true); }}
                        className="flex w-full items-center gap-1 rounded-md px-2 py-1 text-left text-[11px] font-semibold transition hover:brightness-95 active:scale-[0.98]"
                        style={{ backgroundColor: eventBg(color), borderLeft: `3px solid ${color}`, color: "#1e293b" }}>
                        {isLive && <span className="shrink-0 rounded-sm bg-red-500 px-1 text-[9px] font-bold text-white">LIVE</span>}
                        <span className="truncate">{ev.title}</span>
                        <span className="ml-auto shrink-0 text-[10px] font-bold" style={{color}}>{ev.start}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <EventDrawer event={selectedEvent} isOpen={drawerOpen} onClose={() => { setDrawerOpen(false); setSelectedEvent(null); }}/>
      <ScheduleEventModal open={openModal} onClose={() => setOpenModal(false)} onSave={handleSaveEvent} teacherId={teacherId} defaultDate={eventDate}/>
      {ToastComponent}
      <ConfirmDialog open={confirmDialog.open} title="Cannot Schedule in the Past" message="Select a future date." type="warning" confirmText="OK" cancelText="Close"
        onConfirm={() => setConfirmDialog({open:false,date:0})} onCancel={() => setConfirmDialog({open:false,date:0})}/>
    </div>
  );
}