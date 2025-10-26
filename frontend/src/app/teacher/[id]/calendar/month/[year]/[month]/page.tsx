"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { raleway } from "@/utils/front";
import { Bell, CalendarDays, Clock, Palette, UserRound, XIcon } from "lucide-react";
import { CalendarEvent, sampleEvents } from "@/utils/data/teacher/calendar";
import pastelize from "@/utils/colorise";
import EventDrawer from "@/component/teacher/calendar/EventDrawer";
import { ScheduleEvent } from "@/component/teacher/calendar/ScheduleEventModal";
import ScheduleEventModal from "@/component/teacher/calendar/ScheduleEventModal";
const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

export default function MonthCalendarPage({
  params,
}: { params?: { id?: string; year?: string; month?: string } }) {
  const today = new Date();
  const router = useRouter();

  const teacherId = params?.id ?? "1"; // fallback teacherId = 1
  const initialYear = params?.year ? Number(params.year) : today.getFullYear();
  const initialMonth = params?.month ? Number(params.month) - 1 : today.getMonth();

  const [month, setMonth] = useState<number>(initialMonth);
  const [year, setYear] = useState<number>(initialYear);
  const [noOfDays, setNoOfDays] = useState<number[]>([]);
  const [blankDays, setBlankDays] = useState<number[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>(sampleEvents);

  // modal state
  const [openModal, setOpenModal] = useState(false);
  const [eventDate, setEventDate] = useState("");

  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleSaveEvent = (newEvent: ScheduleEvent) => {
    const calendarEvent: CalendarEvent = {
      ...newEvent,
      end: newEvent.end || newEvent.start 
    };
    setEvents([...events, calendarEvent]);
  };

  const openDrawer = (ev: CalendarEvent) => {
    setSelectedEvent(ev);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedEvent(null);
  };

  // khi đổi tháng/năm → tính lại số ngày
  useEffect(() => {
    if (year && month >= 0) {
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const dayOfWeek = new Date(year, month, 1).getDay();
      setBlankDays(Array.from({ length: dayOfWeek }, (_, i) => i + 1));
      setNoOfDays(Array.from({ length: daysInMonth }, (_, i) => i + 1));
    }
  }, [month, year]);

  // sync state với url khi đổi month/year
  const handleChangeMonth = (newMonth: number) => {
    setMonth(newMonth);
    router.push(`/teacher/${teacherId}/calendar/month/${year}/${newMonth + 1}`);
  };

  const handleChangeYear = (newYear: number) => {
    setYear(newYear);
    router.push(`/teacher/${teacherId}/calendar/month/${newYear}/${month + 1}`);
  };

  const isToday = (date: number) => {
    const d = new Date(year, month, date);
    return today.toDateString() === d.toDateString();
  };

  const showEventModal = (date: number) => {
    setOpenModal(true);
    const selected = new Date(year, month, date);

    const localDate = new Date(selected.getTime() - selected.getTimezoneOffset() * 60000)
      .toISOString()
      .split("T")[0];

    setEventDate(localDate);
  };


  return (
    <div className={`w-full bg-white pt-2 shadow overflow-hidden ${raleway.className} mx-auto`}>
      {/* header */}
      <div className="flex items-center px-6">
        <div className="flex items-center gap-0">
          {/* chọn tháng */}
          <select
            value={month}
            onChange={(e) => handleChangeMonth(Number(e.target.value))}
            className="rounded px-1 py-1 hover:bg-[#F9DC7D] appearance-none text-black text-2xl font-bold"
          >
            {MONTH_NAMES.map((m, i) => (
              <option key={i} value={i}>{m}</option>
            ))}
          </select>
          {/* chọn năm */}
          <select
            value={year}
            onChange={(e) => handleChangeYear(Number(e.target.value))}
            className="rounded px-1 py-1 hover:bg-[#F9DC7D] appearance-none text-2xl text-black"
          >
            {Array.from({ length: 50 }, (_, i) => year - 25 + i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* days of week */}
      <div className="flex w-full ">
        {DAYS.map((d, i) => (
          <div key={i} className="w-[14.28%] text-black text-center font-bold">{d}</div>
        ))}
      </div>

      {/* calendar grid */}
      <div className="flex flex-wrap w-full border-t border-l">
        {blankDays.map((_, i) => (
          <div
            key={i}
            className="w-1/7 min-h-[150px] border-r border-b"
            style={{ height: "calc((100vh - 150px) / 6)" }}
          ></div>
        ))}
        {noOfDays.map((date, i) => {
          const cellDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(date).padStart(2, "0")}`;

          const dayEvents = events
            .filter((ev) => ev.teacherId === teacherId && ev.date === cellDate) // lọc teacherId
            .sort((a, b) => {
              const [ah, am] = a.start.split(":").map(Number);
              const [bh, bm] = b.start.split(":").map(Number);
              return ah * 60 + am - (bh * 60 + bm);
            });

          return (
            <div
              key={i}
              className="w-1/7 border-r min-h-[150px] border-b p-1"
              style={{ height: "calc((100vh - 150px) / 6)" }}
            >
              <div
                onClick={() => showEventModal(date)}
                className={`w-6 h-6 flex items-center justify-center rounded-full cursor-pointer ${
                  isToday(date) ? "bg-blue-500 text-black" : "hover:bg-blue-200 text-black"
                }`}
              >
                {date}
              </div>

              <div className="overflow-y-auto h-25 text-sm">
                {dayEvents.map((ev, idx) => {
                  const todayStr = new Date().toISOString().split("T")[0];
                  const isPast = ev.date < todayStr;

                  return (
                    <div
                      key={idx}
                      className="mt-1 rounded-md p-1 cursor-pointer border-l-4"
                      onClick={() => openDrawer(ev)}
                      style={{
                        backgroundColor: isPast ? "#f3f4f6" : pastelize(ev.color, 0.25),
                        borderColor: isPast ? "#9ca3af" : ev.color,
                        color: isPast ? "#6b7280" : "#111827",
                      }}
                    >
                      <div className="truncate font-medium">
                        <span style={{ color: isPast ? "#9ca3af" : ev.color }}>{ev.start} </span>
                        {ev.title}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <EventDrawer event={selectedEvent} isOpen={drawerOpen} onClose={closeDrawer} />

      {/* modal */}
      <ScheduleEventModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        onSave={handleSaveEvent}
        teacherId={teacherId}
        defaultDate={eventDate}
      />
    </div>
  );
}
