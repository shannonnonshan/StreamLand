"use client";

import { raleway } from "@/utils/front";
import { useState } from "react";
import { Bell, CalendarDays, Clock, Palette, UserRound, XIcon, Tag } from "lucide-react";
import { useEffect } from "react";
export interface ScheduleEvent {
  id?: string;
  title: string;
  date: string;
  start: string;
  end?: string;
  color: string;
  audience: "public" | "subscribers";
  description?: string;
  notification: number;
  teacherId: string;
  tags?: string[];
}

interface ScheduleEventModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (event: ScheduleEvent) => void;
  teacherId: string;
  defaultDate?: string;
}

export default function ScheduleEventModal({
  open,
  onClose,
  onSave,
  teacherId,
  defaultDate,
}: ScheduleEventModalProps) {
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventColor, setEventColor] = useState("#EC255A");
  const [eventStartTime, setEventStartTime] = useState("");
  const [eventEndTime, setEventEndTime] = useState("");
  const [eventAudience, setEventAudience] = useState<"public" | "subscribers">("public");
  const [eventDescription, setEventDescription] = useState("");
  const [eventNotification, setEventNotification] = useState("10");
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  
  useEffect(() => {
    if (defaultDate) {
      setEventDate(defaultDate);
    } else {
      const today = new Date();
      const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
        .toISOString()
        .split("T")[0];
      setEventDate(localDate);
    }
  }, [defaultDate]);

  const handleAddTag = async () => {
    const tag = newTag.trim();
    if (!tag) return;
    try {
      const res = await fetch(`/api/tags/check?name=${encodeURIComponent(tag)}`);
      const data = await res.json();

      if (!data.exists) {
        await fetch("/api/tags/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: tag }),
        });
      }
      if (!tags.includes(tag)) setTags([...tags, tag]);
      setNewTag("");
    } catch (err) {
      console.error("Tag fetch error:", err);
    }
  };

  const handleSave = () => {
    if (!eventTitle || !eventStartTime) return;
    const newEvent: ScheduleEvent = {
      id: Date.now().toString(),
      title: eventTitle,
      date: eventDate,
      start: eventStartTime,
      end: eventEndTime,
      color: eventColor,
      audience: eventAudience,
      description: eventDescription,
      notification: Number(eventNotification),
      teacherId,
      tags,
    };
    onSave(newEvent);
    onClose();
  };

  return (
    <div
      className={`${raleway.className} fixed inset-0 bg-black/30 flex items-center justify-center mt-[2%] transition-opacity duration-300 z-50
      ${open ? "opacity-100 visible" : "opacity-0 invisible"}`}
    >
      <div className="relative bg-white rounded-lg p-6 w-1/3 max-h-3/4 overflow-y-scroll shadow">
        <button
          onClick={onClose}
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
          className="border text-[#161853] text-sm font-bold w-full mb-4 p-2 rounded"
        />

        <div className="mb-4 flex flex-row gap-1 items-center">
        <input
          type="date"
          value={eventDate || new Date().toISOString().split("T")[0]}
          onChange={(e) => setEventDate(e.target.value)}
          className="border text-[#161853] text-sm font-bold w-full p-2 rounded"
        />
      </div>

        <div className="flex flex-row gap-1 mb-4">
          <Clock className="text-[#161853]" size={22} />
          <input
            type="time"
            value={eventStartTime}
            onChange={(e) => setEventStartTime(e.target.value)}
            className="border text-[#161853] text-sm font-bold w-full p-2 rounded"
          />
        </div>

        {/* Notification, Color, Audience */}
        <div className="flex flex-row items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Bell className="text-[#161853]" size={22} />
            <input
              type="number"
              value={eventNotification}
              onChange={(e) => setEventNotification(e.target.value)}
              className="border text-[#161853] text-sm font-bold p-2 rounded h-9 w-20"
            />
          </div>

          <div className="flex items-center gap-2">
            <Palette className="text-[#161853]" size={22} />
            <input
              type="color"
              value={eventColor}
              onChange={(e) => setEventColor(e.target.value)}
              className="border font-bold text-sm rounded h-9 w-9 p-1"
            />
          </div>

          <div className="flex items-center gap-2 w-full">
            <UserRound className="text-[#161853]" size={22} />
            <select
              value={eventAudience}
              onChange={(e) => setEventAudience(e.target.value as "public" | "subscribers")}
              className="border text-[#161853] h-9 text-sm font-bold w-full p-2 rounded"
            >
              <option value="subscribers">Subscribers</option>
              <option value="public">Public</option>
            </select>
          </div>
        </div>

        {/* Tag input */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Tag className="text-[#161853]" size={22} />
            <input
              type="text"
              placeholder="Add tag"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              className="border text-[#161853] text-sm font-bold w-full p-2 rounded"
            />
            <button
              onClick={handleAddTag}
              className="bg-[#EC255A] text-white px-3 py-1 rounded hover:bg-[#FAEDF0] hover:text-black border border-transparent hover:border-black"
            >
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {tags.map((t, i) => (
              <span
                key={i}
                className="bg-[#F9DC7D] text-[#161853] font-semibold px-2 py-1 rounded-full text-xs"
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        <textarea
          placeholder="Event Description (optional)"
          value={eventDescription}
          onChange={(e) => setEventDescription(e.target.value)}
          className="border text-[#161853] font-bold text-sm w-full h-24 mb-4 p-2 rounded"
        />

        <button
          onClick={handleSave}
          className="block mx-auto w-3/5 px-3 py-1 bg-[#EC255A] hover:bg-[#FAEDF0]
          hover:text-black hover:border hover:border-black text-white font-extrabold rounded-lg"
        >
          Save
        </button>
      </div>
    </div>
  );
}
