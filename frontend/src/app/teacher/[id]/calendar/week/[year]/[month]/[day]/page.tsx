"use client";
import React, { useMemo, useState, useEffect, useRef } from "react";
import { raleway } from "@/utils/front";
import { useParams, useRouter } from "next/navigation";
import { addDays, startOfWeek, format, isBefore, endOfDay } from "date-fns";
import { CalendarEvent } from "@/utils/data/teacher/calendar";
import EventDrawer from "@/component/teacher/calendar/EventDrawer";
import { getTeacherSchedules, formatScheduleForCalendar } from "@/lib/api/teacher";

function eventBg(hex: string): string {
  const c = hex.replace("#","");
  if (c.length!==6) return "#e0e7ff";
  const r=parseInt(c.slice(0,2),16), g=parseInt(c.slice(2,4),16), b=parseInt(c.slice(4,6),16);
  return `rgb(${Math.round(r*0.22+255*0.78)},${Math.round(g*0.22+255*0.78)},${Math.round(b*0.22+255*0.78)})`;
}

export default function WeekCalendar() {
  const params = useParams();
  const today = new Date();
  const router = useRouter();
  const todayStr = format(today, "yyyy-MM-dd");

  const teacherId = (params?.id as string) ?? "1";
  const year = params?.year ? parseInt(params.year as string) : today.getFullYear();
  const month = params?.month ? parseInt(params.month as string) : today.getMonth()+1;
  const day = params?.day ? parseInt(params.day as string) : today.getDate();
  const currentDate = new Date(year, month-1, day);
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });

  const CELL_H = 56;
  const STICKY_TOP = 56;

  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent|null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getTeacherSchedules(teacherId).then(s => setEvents(s.map(formatScheduleForCalendar))).catch(()=>{});
  }, [teacherId]);

  // Scroll to 7am on mount
  useEffect(() => {
    if (gridRef.current) gridRef.current.scrollTop = 7 * CELL_H;
  }, []);

  const daysOfWeek = useMemo(() => Array.from({length:7},(_,i)=>addDays(weekStart,i)), [weekStart]);
  const hours = useMemo(() => Array.from({length:24},(_,i)=>`${String(i).padStart(2,"0")}:00`), []);

  function eventStyle(s: string, e: string) {
    const [sh,sm]=s.split(":").map(Number), [eh,em]=e.split(":").map(Number);
    return { top: sh*CELL_H+(sm/60)*CELL_H, height: Math.max((eh-sh+(em-sm)/60)*CELL_H, 36) };
  }
  function getDur(s: string, e: string) {
    const [sh,sm]=s.split(":").map(Number), [eh,em]=e.split(":").map(Number);
    return (eh-sh)*60+(em-sm);
  }

  const firstM = format(daysOfWeek[0],"MMMM yyyy");
  const lastM  = format(daysOfWeek[6],"MMMM yyyy");
  const title  = firstM===lastM ? firstM : `${firstM} — ${lastM}`;
  const filtered = events.filter(ev=>ev.teacherId===teacherId);

  return (
    <section className={raleway.className}>
      {/* Header */}
      <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-2 shadow-sm">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-sky-500">Weekly</p>
          <h2 className="text-base font-bold text-slate-800">{title}</h2>
        </div>
        <button onClick={() => { const t=new Date(); router.push(`/teacher/${teacherId}/calendar/week/${t.getFullYear()}/${t.getMonth()+1}/${t.getDate()}`); }}
          className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-1.5 text-sm font-bold text-sky-600 transition hover:bg-sky-100 active:scale-95">
          Today
        </button>
      </div>

      {/* Calendar */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
        <div className="overflow-x-auto">
          <div style={{minWidth:680}}>

            {/* Day headers — dark bg */}
            <div className="sticky grid grid-cols-[52px_repeat(7,1fr)] border-b border-slate-700 bg-slate-800 z-20" >
              <div className="border-r border-slate-700 py-3"/>
              {daysOfWeek.map((d,i)=>{
                const dStr=format(d,"yyyy-MM-dd");
                const isToday=dStr===todayStr;
                const dow=d.getDay();
                const isWknd=dow===0||dow===6;
                return (
                  <div key={i} className={`flex flex-col items-center border-r border-slate-700 py-2 last:border-r-0 ${isToday?"bg-sky-600":""}`}>
                    <span className={`text-[9px] font-bold uppercase tracking-widest ${isToday?"text-sky-100":isWknd?"text-rose-300":"text-slate-400"}`}>
                      {format(d,"EEE")}
                    </span>
                    <span className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${isToday?"bg-white text-sky-600 shadow":"text-slate-200"}`}>
                      {format(d,"d")}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Scrollable grid — max 14h visible, scroll to see all */}
            <div ref={gridRef} className="overflow-y-auto bg-white" style={{maxHeight:"calc(100vh - 260px)"}}>
              <div className="grid grid-cols-[52px_repeat(7,1fr)]">
                {/* Hour labels */}
                <div className="border-r border-slate-200">
                  {hours.map((h,i)=>(
                    <div key={h} className="relative border-t border-slate-100" style={{height:CELL_H}}>
                      {i>0&&<span className="absolute -top-2.5 right-2 text-[10px] font-semibold text-slate-400">{h}</span>}
                    </div>
                  ))}
                </div>

                {/* Day columns */}
                {daysOfWeek.map((d,i)=>{
                  const dStr=format(d,"yyyy-MM-dd");
                  const isPastDay=dStr<todayStr;
                  const isToday=dStr===todayStr;
                  const dow=d.getDay();
                  const isWknd=dow===0||dow===6;
                  const dayEvs=filtered.filter(ev=>ev.date===dStr);
                  return (
                    <div key={i} className={`relative border-l border-slate-200 ${isToday?"bg-sky-50/60":isPastDay?"bg-slate-50":isWknd?"bg-slate-50/40":"bg-white"}`}>
                      {hours.map((_,hi)=><div key={hi} className="border-t border-slate-100" style={{height:CELL_H}}/>)}
                      {/* Half-hour dotted lines */}
                      {hours.map((_,hi)=><div key={`h${hi}`} className="absolute left-0 right-0 border-t border-slate-100 border-dashed" style={{top:hi*CELL_H+CELL_H/2}}/>)}

                      {dayEvs.map((ev,ei)=>{
                        const {top,height}=eventStyle(ev.start,ev.end);
                        const dur=getDur(ev.start,ev.end);
                        const color=ev.color||"#6366f1";
                        const isPast=isBefore(new Date(ev.date+"T"+ev.end),endOfDay(today));
                        const isLive=(ev as any).status==="LIVE"||(ev as any).status==="live";

                        if(isPast||isPastDay) return (
                          <button key={ei} onClick={()=>{setSelectedEvent(ev);setDrawerOpen(true);}}
                            className="absolute left-1 right-1 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 px-2 py-1 text-left focus:outline-none hover:bg-slate-200 transition"
                            style={{top,height,fontSize:11,lineHeight:"1.3em"}}>
                            <p className="truncate font-semibold text-slate-400">{ev.title}</p>
                            {dur>=45&&<p className="text-[10px] text-slate-300">{ev.start}–{ev.end}</p>}
                          </button>
                        );
                        return (
                          <button key={ei} onClick={()=>{setSelectedEvent(ev);setDrawerOpen(true);}}
                            className="absolute left-1 right-1 overflow-hidden rounded-lg px-2 py-1 text-left transition hover:brightness-90 active:scale-[0.98] focus:outline-none"
                            style={{top,height,backgroundColor:eventBg(color),borderLeft:`3px solid ${color}`,fontSize:11,lineHeight:"1.3em"}}>
                            {isLive&&<span className="mb-0.5 inline-flex rounded-sm bg-red-500 px-1.5 py-px text-[9px] font-bold text-white">● LIVE</span>}
                            <p className="truncate font-bold text-slate-800">{ev.title}</p>
                            {dur>=45&&<p className="font-semibold" style={{color}}>{ev.start}–{ev.end}</p>}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <EventDrawer event={selectedEvent} isOpen={drawerOpen} onClose={()=>{setDrawerOpen(false);setSelectedEvent(null);}}/>
    </section>
  );
}