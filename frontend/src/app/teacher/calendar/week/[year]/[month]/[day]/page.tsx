"use client";
import React, { useMemo } from "react";
import { raleway } from "@/utils/front";
import { useParams } from "next/navigation";
import { addDays, startOfWeek, format } from "date-fns";

interface Event {
  title: string;
  color: string;
  start: string; // HH:mm
  end: string;   // HH:mm
  date: string;  // yyyy-MM-dd
}

export default function WeekCalendar() {
  const params = useParams();
  const today = new Date();
  const year = params?.year ? parseInt(params.year as string) : today.getFullYear();
  const month = params?.month ? parseInt(params.month as string) : today.getMonth() + 1;
  const day = params?.day ? parseInt(params.day as string) : today.getDate();
  const currentDate = new Date(year, month - 1, day);
  const start = startOfWeek(currentDate, { weekStartsOn: 0 });

  const daysOfWeek = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(start, i)),
    [start]
  );

  // 24 giờ
  const hours = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) =>
        `${i.toString().padStart(2, "0")}:00`
      ),
    []
  );

  const cellHeight = 60; // 60px = 1h

  const events: Event[] = [
    {
      title: "Pickup the grandmother",
      color: "purple",
      start: "06:00",
      end: "07:30",
      date: format(daysOfWeek[2], "yyyy-MM-dd"), // ví dụ ngày thứ 3
    },
    {
      title: "Meeting with Project Manager",
      color: "blue",
      start: "11:00",
      end: "12:30",
      date: format(daysOfWeek[4], "yyyy-MM-dd"),
    },
  ];

  function getEventStyle(start: string, end: string) {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const top = sh * cellHeight + (sm / 60) * cellHeight;
    const height = (eh - sh + (em - sm) / 60) * cellHeight;
    return { top, height };
  }

  // Header logic
  const firstDay = daysOfWeek[0];
  const lastDay = daysOfWeek[6];
  const firstMonth = format(firstDay, "MMMM yyyy");
  const lastMonth = format(lastDay, "MMMM yyyy");

  const headerTitle =
    firstMonth === lastMonth
      ? firstMonth
      : `${firstMonth} - ${lastMonth}`;

  return (
    <section className={`relative bg-stone-50 ${raleway.className}`}>
      <div className="w-full max-w-7xl mx-auto px-6 lg:px-8 overflow-x-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row max-md:gap-3 items-center justify-between mb-5">
          <h6 className="text-xl leading-8 font-semibold text-gray-900">
            {headerTitle}
          </h6>
        </div>

        {/* Days row */}
        <div className="grid grid-cols-[50px_repeat(7,1fr)] border-t border-gray-200 sticky top-0 bg-stone-50 z-10">
          <div className="p-2 text-xs font-medium text-gray-500">Hour</div>
          {daysOfWeek.map((d, i) => (
            <div
              key={i}
              className={`p-2 text-sm font-medium text-center flex flex-col items-center ${
                format(d, "yyyy-MM-dd") === format(currentDate, "yyyy-MM-dd")
                  ? "text-indigo-600"
                  : "text-gray-900"
              }`}
            >
              <span className="text-sm">{format(d, "EEE")}</span>
              <span className="text-lg">{format(d, "d")}</span>
            </div>
          ))}
        </div>

        {/* Week grid */}
        <div className="hidden sm:grid grid-cols-[50px_repeat(7,1fr)] relative">
          {/* Cột giờ */}
          <div className="relative">
            {hours.map((h) => (
              <div
                key={h}
                className="border-t border-gray-200 text-[10px] text-gray-400 pr-1 text-right"
                style={{ height: cellHeight }}
              >
                {h}
              </div>
            ))}
          </div>

          {/* Cột ngày */}
          {daysOfWeek.map((d, i) => (
            <div key={i} className="relative border-l border-gray-200">
              {/* Background lines */}
              {hours.map((_, hi) => (
                <div
                  key={hi}
                  className="border-t border-gray-100"
                  style={{ height: cellHeight }}
                />
              ))}

              {/* Events */}
              {events
                .filter((ev) => ev.date === format(d, "yyyy-MM-dd"))
                .map((ev, ei) => {
                  const { top, height } = getEventStyle(ev.start, ev.end);
                  return (
                    <div
                      key={ei}
                      className={`absolute left-1 right-1 rounded px-2 py-1 border-l-4 bg-${ev.color}-50 border-${ev.color}-600`}
                      style={{ top, height }}
                    >
                      <p className="text-xs font-medium text-gray-900">
                        {ev.title}
                      </p>
                      <p
                        className={`text-[10px] font-semibold text-${ev.color}-600`}
                      >
                        {ev.start} - {ev.end}
                      </p>
                    </div>
                  );
                })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
