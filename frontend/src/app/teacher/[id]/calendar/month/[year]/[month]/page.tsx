"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { raleway } from "@/utils/front";
import { Bell, CalendarDays, Clock, Palette, UserRound, XIcon } from "lucide-react";
import { CalendarEvent, sampleEvents } from "@/utils/calendar";
import pastelize from "@/utils/colorise";
import EventDrawer from "@/component/teacher/calendar/EventDrawer";

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
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventColor, setEventColor] = useState("#EC255A");
  const [eventStartTime, setEventStartTime] = useState("");
  const [eventEndTime, setEventEndTime] = useState("");
  const [eventAudience, setEventAudience] = useState<"public" | "subscribers">("public");
  const [eventDescription, setEventDescription] = useState("");
  const [eventNotification, setEventNotification] = useState("10");
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

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
    setEventDate(selected.toISOString().split("T")[0]);
  };

  const addEvent = () => {
    if (!eventTitle || !eventStartTime) return;
    const newEvent: CalendarEvent = {
      id: Date.now().toString(),
      title: eventTitle,
      date: eventDate,
      start: eventStartTime,
      end: eventEndTime,
      color: eventColor,
      audience: eventAudience,
      description: eventDescription,
      notification: Number(eventNotification),
      teacherId: teacherId, // gán teacherId
    };
    setEvents([...events, newEvent]);

    // reset
    setEventTitle("");
    setEventDate("");
    setEventColor("#EC255A");
    setEventStartTime("");
    setEventEndTime("");
    setEventAudience("public");
    setEventDescription("");
    setEventNotification("10");
    setOpenModal(false);
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
      <div
        className={`fixed inset-0 bg-black/30 flex items-center justify-center transition-opacity duration-300
          ${openModal ? "opacity-100 visible" : "opacity-0 invisible"}`}
      >
        <div className="relative bg-white rounded-lg p-6 w-1/2 max-h-2/3 overflow-y-scroll border border-black">
          <button
            onClick={() => setOpenModal(false)}
            className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
          >
            <XIcon size={24} />
          </button>
             <h2 className="font-bold text-xl text-black text-center mb-6">Schedule New Event</h2>

          <input
            type="text"
            placeholder="Event title"
            value={eventTitle}
            onChange={(e) => setEventTitle(e.target.value)}
            className="border text-[#161853] text-sm font-bold border-black w-full mb-4 p-2 rounded"
          />

          <div className="mb-4 flex flex-row gap-1 items-center">
            <CalendarDays className="text-[#161853]" size={32} />
            <input
              type="text"
              value={eventDate}
              readOnly
              className="border text-[#161853] text-sm font-bold border-black w-full p-2 rounded"
            />
          </div>

          <div className="flex flex-row gap-1 mb-4">
            <Clock className="text-[#161853]" size={32} />
            <input
              type="time"
              value={eventStartTime}
              onChange={(e) => setEventStartTime(e.target.value)}
              className="border text-[#161853] text-sm font-bold border-black w-full p-2 rounded"
            />
          </div>

          <div className="flex flex-row gap-1 mb-4">
            <Bell className="text-[#161853]" size={32} />
            <input
              type="number"
              value={eventNotification}
              onChange={(e) => setEventNotification(e.target.value)}
              className="border text-[#161853] text-sm font-bold border-black w-full p-2 rounded"
            />
          </div>

          <div className="flex flex-row gap-1 mb-4">
            <UserRound className="text-[#161853]" size={32} />
            <select
              value={eventAudience}
              onChange={(e) => setEventAudience(e.target.value as "public" | "subscribers")}
              className="border text-[#161853] text-sm font-bold border-black w-full p-2 rounded"
            >
              <option value="subscribers">Subscribers</option>
              <option value="public">Public</option>
            </select>
          </div>

          <div className="flex flex-row gap-1 mb-4">
            <Palette className="text-[#161853]" size={32} />
            <input
              type="color"
              value={eventColor}
              onChange={(e) => setEventColor(e.target.value)}
              className="border font-bold text-sm border-black w-full rounded"
            />
          </div>

          <textarea
            placeholder="Event Description (optional)"
            value={eventDescription}
            onChange={(e) => setEventDescription(e.target.value)}
            className="border text-[#161853] font-bold text-sm border-black w-full h-12 mb-4 p-2 rounded"
          />

          <button
            onClick={addEvent}
            className="block mx-auto w-3/5 px-3 py-1 bg-[#EC255A] hover:bg-[#FAEDF0]
             hover:text-black hover:border hover:border-black text-white font-extrabold rounded-lg"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
