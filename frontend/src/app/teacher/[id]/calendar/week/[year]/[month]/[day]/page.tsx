"use client";
import React, { useMemo, useState, useEffect, useRef } from "react";
import { raleway } from "@/utils/front";
import { useParams } from "next/navigation";
import { addDays, startOfWeek, format, isBefore, endOfDay } from "date-fns";
import { CalendarEvent, sampleEvents } from "@/utils/calendar";
import pastelise from "@/utils/colorise";
import EventDrawer from "@/component/teacher/calendar/EventDrawer";

export default function WeekCalendar() {
  const params = useParams();
  const today = new Date();

  // fallback id = "1"
  const teacherId = (params?.id as string) ?? "1";

  const year = params?.year ? parseInt(params.year as string) : today.getFullYear();
  const month = params?.month ? parseInt(params.month as string) : today.getMonth() + 1;
  const day = params?.day ? parseInt(params.day as string) : today.getDate();

  const currentDate = new Date(year, month - 1, day);
  const start = startOfWeek(currentDate, { weekStartsOn: 0 });

  const [cellHeight, setCellHeight] = useState(60);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const NAVBAR_OFFSET = 80;

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

  useEffect(() => {
    function updateHeight() {
      const headerHeight = headerRef.current?.offsetHeight ?? 120;
      const available = window.innerHeight - headerHeight - NAVBAR_OFFSET;
      const minCellHeight = 60;
      setCellHeight(Math.max(available / 24, minCellHeight));
    }
    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  const daysOfWeek = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(start, i)),
    [start]
  );

  const hours = useMemo(
    () => Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, "0")}:00`),
    []
  );

  const audienceColors: Record<CalendarEvent["audience"], string> = {
    public: "blue",
    subscribers: "purple",
  };

  function getEventStyle(start: string, end: string) {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const top = sh * cellHeight + (sm / 60) * cellHeight;
    let height = (eh - sh + (em - sm) / 60) * cellHeight;
    const minHeight = (45 / 60) * cellHeight;
    if (height < minHeight) height = minHeight;
    return { top, height };
  }

  function getEventDuration(start: string, end: string) {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    return (eh - sh) * 60 + (em - sm);
  }

  const firstDay = daysOfWeek[0];
  const lastDay = daysOfWeek[6];
  const firstMonth = format(firstDay, "MMMM yyyy");
  const lastMonth = format(lastDay, "MMMM yyyy");
  const headerTitle = firstMonth === lastMonth ? firstMonth : `${firstMonth} - ${lastMonth}`;

  // 🔹 chỉ lấy event có teacherId = id
  const filteredEvents = sampleEvents.filter((ev) => ev.teacherId === teacherId);

  return (
    <section className={`relative bg-white overflow-hidden ${raleway.className}`}>
      <div className="w-full overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Header */}
          <div ref={headerRef}>
            <div className="flex flex-col md:flex-row max-md:gap-3 items-center justify-between mb-5 px-4">
              <h6 className="text-xl leading-8 font-semibold text-gray-900">
                {headerTitle}
              </h6>
            </div>

            {/* Days row */}
            <div
              className="grid grid-cols-[50px_repeat(7,1fr)] border-t border-gray-200 sticky bg-stone-50"
              style={{ top: NAVBAR_OFFSET }}
            >
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
          </div>

          {/* Week grid */}
          <div className="hidden sm:grid grid-cols-[50px_repeat(7,1fr)] relative">
            {/* Hour column */}
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

            {/* Day columns */}
            {daysOfWeek.map((d, i) => (
              <div key={i} className="relative border-l border-gray-200">
                {hours.map((_, hi) => (
                  <div
                    key={hi}
                    className="border-t border-gray-100"
                    style={{ height: cellHeight }}
                  />
                ))}

                {filteredEvents
                  .filter((ev) => ev.date === format(d, "yyyy-MM-dd"))
                  .map((ev, ei) => {
                    const { top, height } = getEventStyle(ev.start, ev.end);
                    const duration = getEventDuration(ev.start, ev.end);
                    const baseColor = ev.color || audienceColors[ev.audience];
                    const isPast = isBefore(new Date(ev.date + "T" + ev.end), endOfDay(today));

                    return (
                      <div
                        key={ei}
                        onClick={() => openDrawer(ev)}
                        className="absolute left-1 right-1 rounded px-1 py-0.5 flex flex-col justify-start"
                        style={{
                          top,
                          height,
                          backgroundColor: isPast ? "#f3f4f6" : pastelise(baseColor, 0.25),
                          borderLeft: `4px solid ${isPast ? "#9ca3af" : baseColor}`,
                          color: isPast ? "#6b7280" : "#111827",
                          fontSize: "11px",
                          lineHeight: "1.1em",
                        }}
                      >
                        {duration < 45 ? (
                          <p className="font-medium truncate">
                            {ev.audience === "public" ? "🌐" : "🔒"} {ev.title}, {ev.start}-{ev.end}
                          </p>
                        ) : (
                          <>
                            <p className="font-medium break-words">
                              {ev.audience === "public" ? "🌐" : "🔒"} {ev.title}
                            </p>
                            <p className="font-semibold" style={{ color: isPast ? "#6b7280" : baseColor }}>
                              {ev.start} - {ev.end}
                            </p>
                          </>
                        )}
                      </div>
                    );
                  })}
                <EventDrawer event={selectedEvent} isOpen={drawerOpen} onClose={closeDrawer} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
