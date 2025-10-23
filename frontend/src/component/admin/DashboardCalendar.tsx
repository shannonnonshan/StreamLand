"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

export default function DashboardCalendar({
  selectedDate,
  onDateSelect,
}: {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
}) {
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(selectedDate);

  const currentMonth = currentDate.toLocaleString("default", { month: "long" });
  const currentYear = currentDate.getFullYear();

  const firstDay = new Date(currentYear, currentDate.getMonth(), 1);
  const lastDay = new Date(currentYear, currentDate.getMonth() + 1, 0);

  const startDay = firstDay.getDay() === 0 ? 7 : firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const blanks = Array(startDay - 1).fill(null);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentYear, currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentDate.getMonth() + 1, 1));
  };

  const handleSelectDay = (day: number) => {
    const newDate = new Date(currentYear, currentDate.getMonth(), day);
    onDateSelect(newDate);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 w-full h-screen">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={handlePrevMonth}
          className="p-1 rounded hover:bg-gray-100 transition"
        >
          <ChevronLeft size={18} className="text-gray-500" />
        </button>

        <h3 className="font-bold text-[#161853] text-lg">
          {currentMonth} {currentYear}
        </h3>

        <button
          onClick={handleNextMonth}
          className="p-1 rounded hover:bg-gray-100 transition"
        >
          <ChevronRight size={18} className="text-gray-500" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-2 text-center text-sm font-medium text-gray-600">
        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
          <div key={d} className="text-gray-500 font-semibold">
            {d}
          </div>
        ))}

        {[...blanks, ...days].map((day, i) => {
          const dateObj = day
            ? new Date(currentYear, currentDate.getMonth(), day)
            : null;

          const isToday =
            day === today.getDate() &&
            currentDate.getMonth() === today.getMonth() &&
            currentDate.getFullYear() === today.getFullYear();

          const isSelected =
            dateObj &&
            selectedDate.getDate() === dateObj.getDate() &&
            selectedDate.getMonth() === dateObj.getMonth() &&
            selectedDate.getFullYear() === dateObj.getFullYear();

          return (
            <div
              key={i}
              onClick={() => day && handleSelectDay(day)}
              className={`py-2 rounded-xl transition-all duration-200 select-none cursor-pointer
                ${
                  day
                    ? isSelected
                      ? "bg-[#161853] text-white font-semibold shadow-md"
                      : isToday
                      ? "bg-gray-100 text-[#161853] font-semibold"
                      : "text-gray-700 hover:bg-gray-100"
                    : ""
                }`}
            >
              {day || ""}
            </div>
          );
        })}
      </div>
    </div>
  );
}
