"use client";

import { useState, useEffect } from "react";
import { raleway } from "@/utils/front";
import { Bell, CalendarDays, Clock, Palette, UserRound, XIcon } from "lucide-react";

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

type CalendarEvent = {
  event_date: string;
  event_title: string;
  event_theme: string;
  start_time?: string;
  end_time?: string;
  event_audience?: string;
  notification?: number;
  event_description?: string;
};

export default function MonthCalendarPage({ params }: { params?: { year?: string; month?: string } }) {
  const today = new Date();

  // fallback nếu không có params
  const initialYear = params?.year ? Number(params.year) : today.getFullYear();
  const initialMonth = params?.month ? Number(params.month) - 1 : today.getMonth();

  const [month, setMonth] = useState<number>(initialMonth);
  const [year, setYear] = useState<number>(initialYear);
  const [noOfDays, setNoOfDays] = useState<number[]>([]);
  const [blankDays, setBlankDays] = useState<number[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([
    { event_date: new Date(2025, 8, 19).toDateString(), event_title: "Demo", event_theme: "blue" }
  ]);

  // modal state
  const [openModal, setOpenModal] = useState(false);
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventTheme, setEventTheme] = useState("#EC255A");
  const [eventStartTime, setEventStartTime] = useState("");
  const [eventAudience, setEventAudience] = useState("public");
  const [eventDescription, setEventDescription] = useState("");
  const [eventNotification, setEventNotification] = useState("10");

  // khi đổi tháng/năm → tính lại số ngày
  useEffect(() => {
    if (year && month >= 0) {
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const dayOfWeek = new Date(year, month, 1).getDay();
      setBlankDays(Array.from({ length: dayOfWeek }, (_, i) => i + 1));
      setNoOfDays(Array.from({ length: daysInMonth }, (_, i) => i + 1));
    }
  }, [month, year]);

  const isToday = (date: number) => {
    const d = new Date(year, month, date);
    return today.toDateString() === d.toDateString();
  };

  const showEventModal = (date: number) => {
    setOpenModal(true);
    setEventDate(new Date(year, month, date).toDateString());
  };

  const addEvent = () => {
    if (!eventTitle || !eventStartTime) return;
    setEvents([
      ...events,
      {
        event_date: eventDate,
        event_title: eventTitle,
        event_theme: eventTheme,
        start_time: eventStartTime,
        event_audience: eventAudience,
        event_description: eventDescription,
        notification: Number(eventNotification),
      },
    ]);
    // reset field
    setEventTitle("");
    setEventDate("");
    setEventTheme("#EC255A");
    setEventStartTime("");
    setEventAudience("public");
    setEventDescription("");
    setEventNotification("10");
    setOpenModal(false);
  };

  return (
    <div className={`w-full bg-white pt-2 shadow overflow-hidden ${raleway.className} mx-auto`}>
      {/* header */}
      <div className="flex items-center justify-between px-6">
        <div className="flex items-center gap-0">
          {/* chọn tháng */}
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="rounded px-1 py-1 hover:bg-[#F9DC7D] appearance-none text-black text-2xl font-bold"
          >
            {MONTH_NAMES.map((m, i) => (
              <option key={i} value={i}>{m}</option>
            ))}
          </select>
          {/* chọn năm */}
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded px-1 py-1 hover:bg-[#F9DC7D] appearance-none text-2xl text-black"
          >
            {Array.from({ length: 50 }, (_, i) => year - 25 + i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* days of week */}
      <div className="flex">
        {DAYS.map((d, i) => (
          <div key={i} className="w-[14.28%] text-black text-center font-bold">{d}</div>
        ))}
      </div>

      {/* calendar grid */}
      <div className="flex flex-wrap border-t border-l">
        {blankDays.map((_, i) => (
          <div key={i} className="w-1/7 h-28 border-r border-b"></div>
        ))}
        {noOfDays.map((date, i) => (
          <div key={i} className="w-1/7 h-28 border-r border-b p-1">
            <div
              onClick={() => showEventModal(date)}
              className={`w-6 h-6 flex items-center justify-center rounded-full cursor-pointer ${
                isToday(date) ? "bg-blue-500 text-black" : "hover:bg-blue-200 text-black"
              }`}
            >
              {date}
            </div>
            <div className="overflow-y-auto h-20 text-sm">
              {events
                .filter(e => new Date(e.event_date).toDateString() === new Date(year, month, date).toDateString())
                .map((ev, idx) => (
                  <div key={idx} className="mt-1 px-1 rounded bg-blue-100 text-blue-800 truncate">
                    {ev.event_title}
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>

      {/* modal */}
      <div
        className={`fixed inset-0 bg-black/30 flex items-center justify-center transition-opacity duration-300
          ${openModal ? "opacity-100 visible" : "opacity-0 invisible"}`}
      >
        <div className="relative bg-white rounded-lg p-6 w-1/2 max-h-2/3 overflow-y-scroll
        [&::-webkit-scrollbar]:w-2
        [&::-webkit-scrollbar-track]:rounded-full
      [&::-webkit-scrollbar-track]:bg-[#161853]
        [&::-webkit-scrollbar-thumb]:rounded-full
      [&::-webkit-scrollbar-thumb]:bg-[#FAEDF0] border border-black">
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
              onChange={(e) => setEventAudience(e.target.value)}
              className="border text-[#161853] text-sm font-bold border-black w-full p-2 rounded"
            >
              <option value="subscribers">Subscriber</option>
              <option value="public">Public</option>
            </select>
          </div>

          <div className="flex flex-row gap-1 mb-4">
            <Palette className="text-[#161853]" size={32} />
            <input
              type="color"
              value={eventTheme}
              onChange={(e) => setEventTheme(e.target.value)}
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
