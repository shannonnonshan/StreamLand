// components/EventDrawer.tsx
"use client";

import React, { useState, useEffect } from "react";
import { CalendarEvent } from "@/utils/data/teacher/calendar";
import pastelize from "@/utils/colorise";
import { raleway } from "@/utils/front";
import { XIcon, Clock, Users, Bell, StickyNote, Palette, UserRound, CalendarDays, ChevronRightIcon } from "lucide-react";

interface EventDrawerProps {
  event: CalendarEvent | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: (updated: CalendarEvent) => void; // callback khi update
}

export default function EventDrawer({
  event,
  isOpen,
  onClose,
  onUpdate,
}: EventDrawerProps) {
  const [openUpdate, setOpenUpdate] = useState(false);
  const [organizerName, setOrganizerName] = useState("System");

  // khởi tạo state, fallback rỗng nếu event null
  const [eventTitle, setEventTitle] = useState(event?.title || "");
  const [eventDate] = useState(event?.date || "");
  const [eventStartTime, setEventStartTime] = useState(event?.start || "");
  const [eventNotification, setEventNotification] = useState("15");
  const [eventAudience, setEventAudience] = useState<
    "public" | "subscribers"
  >(event?.audience as "public" | "subscribers" || "public");
  const [eventColor, setEventColor] = useState(event?.color || "#000000");
  const [eventDescription, setEventDescription] = useState(event?.description || "");

  // Get user info from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          setOrganizerName(user.name || user.email || 'Teacher');
        } catch (e) {
          console.error('Failed to parse user:', e);
        }
      }
    }
  }, []);

  if (!isOpen || !event) return null; // hook đã gọi hết rồi, giờ mới return

  const today = new Date().toISOString().split("T")[0];
  const isPast = event.date < today;

  const handleSave = () => {
    const updated: CalendarEvent = {
      ...event,
      title: eventTitle,
      date: eventDate,
      start: eventStartTime,
      audience: eventAudience,
      color: eventColor,
      description: eventDescription,
    };
    onUpdate?.(updated);
    setOpenUpdate(false);
  };
  
  return (
    <>
      {/* Drawer */}
       <div
      className={`fixed top-0 right-0 z-50 h-screen w-96 p-6 rounded-r-lg bg-white shadow-lg overflow-y-auto transition-transform transform translate-x-0 ${raleway.className}`}
    >
      
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-3 right-3 text-gray-400 hover:text-gray-900"
      >
        <XIcon size={22} />
      </button>
      <button
        onClick={onClose}
        className="absolute top-1/2 -left-4 transform -translate-y-1/2
        bg-white border rounded-full shadow p-2 hover:bg-gray-100"
      >
        <ChevronRightIcon size={18} className="text-gray-600" />
      </button>
      {/* Title */}
      <h2
        className="text-2xl font-extrabold mb-2"
        style={{ color: isPast ? "#6b7280" : event.color }}
      >
        {event.title}
      </h2>

      {/* Time */}
      <div className="flex items-center gap-2 text-sm text-gray-700 mb-3">
        <Clock size={18} />
        <span>
          {event.date} • {event.start} – {event.end}
        </span>
      </div>

      {/* Audience */}
      <div className="flex items-center gap-2 text-sm text-gray-700 mb-3">
        <Users size={18} />
        <span>
          Audience:{" "}
          <strong>{event.audience === "public" ? "🌐 Public" : "🔒 Subscribers"}</strong>
        </span>
      </div>

      {/* Color */}
      <div className="flex items-center gap-2 text-sm text-gray-700 mb-3">
        <Palette size={18} />
        <div
          className="w-4 h-4 rounded-full border"
          style={{ backgroundColor: pastelize(event.color, 0.8) }}
        ></div>
        <span>{event.color}</span>
      </div>

      {/* Description */}
      {event.description && (
        <div className="flex items-start gap-2 text-sm text-gray-700 mb-3">
          <StickyNote size={18} className="mt-0.5" />
          <p>{event.description}</p>
        </div>
      )}

      {/* Livestream Link */}
      {event.livestreamId && (
        <div className="mb-3">
          <a
            href={`/teacher/${event.teacherId}/livestream/${event.livestreamId}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#292C6D] text-white text-sm font-semibold rounded-lg hover:bg-[#1f2350] transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
            </svg>
            Join Livestream
          </a>
        </div>
      )}

      {/* Organizer */}
      <div className="flex items-center gap-2 text-sm text-gray-700 mb-6">
        <UserRound size={18} />
        <span>Organizer: <strong>{organizerName}</strong></span>
      </div>

      {/* Update button */}
      <button
        onClick={() => setOpenUpdate(true)}
        className="block w-full px-4 py-2 bg-[#EC255A] hover:bg-[#FAEDF0] hover:text-black hover:border hover:border-black text-white font-extrabold rounded-lg"
      >
        Update Event
      </button>
      </div>
       {/* Nút đóng dạng tròn ở mép trái giữa */}
      
      {/* Update Modal */}
      <div
  className={`fixed inset-0 bg-black/30 flex items-center justify-center transition-opacity duration-300
    ${openUpdate ? "opacity-100 visible" : "opacity-0 invisible"}`}
>
  <div
    className="relative bg-white rounded-lg p-6 w-1/2 max-h-2/3 overflow-y-scroll
      [&::-webkit-scrollbar]:w-2
      [&::-webkit-scrollbar-track]:rounded-full
      [&::-webkit-scrollbar-track]:bg-[#161853]
      [&::-webkit-scrollbar-thumb]:rounded-full
      [&::-webkit-scrollbar-thumb]:bg-[#FAEDF0] border border-black"
  >
    <button
      onClick={() => setOpenUpdate(false)}
      className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
    >
      <XIcon size={24} />
    </button>

    <h2 className="font-bold text-xl text-black text-center mb-6">Update Event</h2>

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
      onClick={handleSave}
      className="block mx-auto w-3/5 px-3 py-1 bg-[#EC255A] hover:bg-[#FAEDF0]
       hover:text-black hover:border hover:border-black text-white font-extrabold rounded-lg"
    >
      Update
    </button>
  </div>
</div>

    </>
  );
}
