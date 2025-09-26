"use client";

import { useState } from "react";
import { CalendarEvent, sampleEvents } from "@/utils/data/teacher/calendar";
import EventListDrawer from "@/component/teacher/calendar/EventListDrawer";

const monthNames = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];
const dayNames = ["Mo","Tu","We","Th","Fr","Sa","Su"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstWeekday(year: number, month: number) {
  // Monday as start
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

export default function YearCalendarClient({
  initialYear,
  teacherId,
}: {
  initialYear: number;
  teacherId: string;
}) {
  const today = new Date();
  const [year, setYear] = useState(initialYear);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Lọc event theo ngày + teacherId
  const eventsByDate = (date: Date) =>
    sampleEvents.filter((ev: CalendarEvent) => {
      const d = new Date(ev.date);
      return (
        ev.teacherId === teacherId &&
        d.getFullYear() === date.getFullYear() &&
        d.getMonth() === date.getMonth() &&
        d.getDate() === date.getDate()
      );
    });

  const openDay = (date: Date) => {
    setSelectedDate(date);
    setDrawerOpen(true);
  };

  return (
    <div className="p-4">
      {/* Year header */}
      <h1 className="text-2xl font-bold text-black text-center mb-6">
        {year}26
      </h1>

      {/* Year grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {monthNames.map((month, idx) => {
          const daysInMonth = getDaysInMonth(year, idx);
          const firstWeekday = getFirstWeekday(year, idx);
          const cells = Array(firstWeekday).fill(null).concat(
            Array.from({ length: daysInMonth }, (_, i) => i + 1)
          );

          return (
            <div key={idx} className="p-2 bg-white rounded shadow">
              <p className="mb-2 text-lg font-bold text-center text-[#292C6D]">
                {month}
              </p>
              <div className="grid grid-cols-7 text-sm text-center font-bold">
                {dayNames.map((d, i) => (
                  <div
                    key={d}
                    className={i === 6 ? "text-[#EC255A]" : "text-gray-600"}
                  >
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1 mt-1 text-center text-black">
                {cells.map((day, i) => {
                  if (!day) return <div key={i}></div>;
                  const dateObj = new Date(year, idx, day);
                  const evs = eventsByDate(dateObj);
                  const isToday = today.toDateString() === dateObj.toDateString();
                  const isSunday = (i % 7) === 6;

                  return (
                    <div
                      key={i}
                      className={`relative p-1 rounded cursor-pointer hover:bg-green-100 transition-colors
                        ${isToday ? "ring-2 ring-green-500 font-bold bg-green-50" : ""}
                        ${isSunday ? "text-[#EC255A] font-semibold" : ""}`}
                      onClick={() => openDay(dateObj)}
                    >
                      <p className="text-xs">{day}</p>
                      {evs.length > 0 && (
                        <span className="absolute w-1.5 h-1.5 bg-[#EC255A] rounded-full bottom-0.5 left-1/2 -translate-x-1/2"></span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Drawer */}
      <EventListDrawer
        date={selectedDate}
        events={selectedDate ? eventsByDate(selectedDate) : []}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}
