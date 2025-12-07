"use client";

import { raleway } from "@/utils/front";
import { useState } from "react";
import { Bell, Clock, Palette, UserRound, XIcon, Tag } from "lucide-react";
import { useEffect } from "react";
export interface ScheduleEvent {
  id?: string;
  title: string;
  startTime: string; // ISO datetime
  endTime: string; // ISO datetime
  isPublic?: boolean;
  color?: string;
  description?: string;
  notifyBefore?: number; // minutes
  teacherId: string;
  tags?: string[];
  livestreamId?: string;
  category?: string; // Category for livestream
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
  const [eventDescription, setEventDescription] = useState("");
  const [eventNotification, setEventNotification] = useState("15");
  const [isPublic, setIsPublic] = useState(true);
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [eventCategory, setEventCategory] = useState("");
  
  // Livestream categories
  const livestreamCategories = [
    "IELTS",
    "TOEFL", 
    "Grammar",
    "Speaking",
    "Writing",
    "Listening",
    "Reading",
    "Business English",
    "Pronunciation",
    "Vocabulary",
    "Conversation",
    "Academic Writing",
    "Exam Prep",
    "Beginner",
    "Intermediate",
    "Advanced",
    "Q&A",
    "Workshop",
    "Tutorial",
    "Other"
  ];
  
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
    if (!eventTitle || !eventStartTime || !eventEndTime) return;
    
    // Combine date and time into ISO datetime
    const startDateTime = new Date(`${eventDate}T${eventStartTime}`).toISOString();
    const endDateTime = new Date(`${eventDate}T${eventEndTime}`).toISOString();
    
    // Check if event is in the past
    const now = new Date();
    if (new Date(startDateTime) < now) {
      alert('Cannot schedule events in the past. Please select a future date and time.');
      return;
    }
    
    const newEvent: ScheduleEvent = {
      title: eventTitle,
      startTime: startDateTime,
      endTime: endDateTime,
      isPublic,
      color: eventColor,
      description: eventDescription,
      notifyBefore: Number(eventNotification),
      teacherId,
      tags,
      category: eventCategory,
    };
    onSave(newEvent);
    onClose();
  };

  return (
    <div
      className={`${raleway.className} fixed inset-0 bg-black/30 flex items-center justify-center transition-opacity duration-300 z-50
      ${open ? "opacity-100 visible" : "opacity-0 invisible"}`}
    >
      <div className="relative bg-white rounded-xl p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <XIcon size={28} />
        </button>

        <h2 className="font-bold text-3xl text-gray-900 text-center mb-2">New Schedule Event</h2>
        <p className="text-center text-gray-500 text-sm mb-8">Create and manage your livestream schedule</p>

        {/* Title Input */}
        <div className="mb-6">
          <label className="block text-sm font-bold text-gray-700 mb-2">Event Title *</label>
          <input
            type="text"
            placeholder="Enter event title (e.g., IELTS Listening Preparation)"
            value={eventTitle}
            onChange={(e) => setEventTitle(e.target.value)}
            className="border border-gray-300 text-gray-900 text-base font-medium w-full mb-1 p-3 rounded-lg focus:ring-2 focus:ring-[#292C6D] focus:border-transparent transition-all"
          />
          {!eventTitle && <p className="text-xs text-red-500">Title is required</p>}
        </div>

        {/* Category Selection */}
        <div className="mb-6">
          <label className="block text-sm font-bold text-gray-700 mb-2">Category *</label>
          <select
            value={eventCategory}
            onChange={(e) => setEventCategory(e.target.value)}
            className="border border-gray-300 text-gray-900 text-base font-medium w-full p-3 rounded-lg bg-white focus:ring-2 focus:ring-[#292C6D] focus:border-transparent transition-all"
          >
            <option value="">Select a category...</option>
            {livestreamCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          {!eventCategory && <p className="text-xs text-red-500 mt-1">Category is required</p>}
        </div>

        {/* Date Selection */}
        <div className="mb-6">
          <label className="block text-sm font-bold text-gray-700 mb-2">Date *</label>
          <input
            type="date"
            value={eventDate || new Date().toISOString().split("T")[0]}
            onChange={(e) => setEventDate(e.target.value)}
            className="border border-gray-300 text-gray-900 text-base font-medium w-full p-3 rounded-lg focus:ring-2 focus:ring-[#292C6D] focus:border-transparent transition-all"
          />
        </div>

        {/* Time Selection - 2 Columns */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="flex text-sm font-bold text-gray-700 mb-2 items-center gap-2">
              <Clock size={16} className="text-[#292C6D]" />
              Start Time *
            </label>
            <input
              type="time"
              value={eventStartTime}
              onChange={(e) => setEventStartTime(e.target.value)}
              placeholder="Start time"
              className="border border-gray-300 text-gray-900 text-base font-medium w-full p-3 rounded-lg focus:ring-2 focus:ring-[#292C6D] focus:border-transparent transition-all"
            />
            {!eventStartTime && <p className="text-xs text-red-500 mt-1">Required</p>}
          </div>

          <div>
            <label className="flex text-sm font-bold text-gray-700 mb-2 items-center gap-2">
              <Clock size={16} className="text-[#292C6D]" />
              End Time *
            </label>
            <input
              type="time"
              value={eventEndTime}
              onChange={(e) => setEventEndTime(e.target.value)}
              placeholder="End time"
              className="border border-gray-300 text-gray-900 text-base font-medium w-full p-3 rounded-lg focus:ring-2 focus:ring-[#292C6D] focus:border-transparent transition-all"
            />
            {!eventEndTime && <p className="text-xs text-red-500 mt-1">Required</p>}
          </div>
        </div>

        {/* Visibility & Notification - 2 Columns */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Visibility */}
          <div>
            <label className="flex text-sm font-bold text-gray-700 mb-2 items-center gap-2">
              <UserRound size={16} className="text-[#292C6D]" />
              Visibility
            </label>
            <select
              value={isPublic ? "public" : "subscribers"}
              onChange={(e) => setIsPublic(e.target.value === "public")}
              className="border border-gray-300 text-gray-900 text-base font-medium w-full p-3 rounded-lg bg-white focus:ring-2 focus:ring-[#292C6D] focus:border-transparent transition-all"
            >
              <option value="public">Public - Everyone</option>
              <option value="subscribers">Subscribers Only</option>
            </select>
          </div>

          {/* Notification */}
          <div>
            <label className="flex text-sm font-bold text-gray-700 mb-2 items-center gap-2">
              <Bell size={16} className="text-[#292C6D]" />
              Notify Before (min)
            </label>
            <input
              type="number"
              value={eventNotification}
              onChange={(e) => setEventNotification(e.target.value)}
              placeholder="Minutes"
              className="border border-gray-300 text-gray-900 text-base font-medium w-full p-3 rounded-lg focus:ring-2 focus:ring-[#292C6D] focus:border-transparent transition-all"
            />
          </div>
        </div>

        {/* Color Selection */}
        <div className="mb-6">
          <label className="flex text-sm font-bold text-gray-700 mb-2 items-center gap-2">
            <Palette size={16} className="text-[#292C6D]" />
            Event Color
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={eventColor}
              onChange={(e) => setEventColor(e.target.value)}
              className="border-2 border-gray-300 h-12 w-20 p-1 rounded-lg cursor-pointer hover:border-[#292C6D] transition-colors"
            />
            <span className="text-sm text-gray-600">{eventColor.toUpperCase()}</span>
          </div>
        </div>

        {/* Description */}
        <div className="mb-6">
          <label className="block text-sm font-bold text-gray-700 mb-2">Description (Optional)</label>
          <textarea
            placeholder="Add event description..."
            value={eventDescription}
            onChange={(e) => setEventDescription(e.target.value)}
            rows={3}
            className="border border-gray-300 text-gray-900 font-medium text-base w-full mb-2 p-3 rounded-lg focus:ring-2 focus:ring-[#292C6D] focus:border-transparent transition-all resize-none"
          />
        </div>

        {/* Tags Section */}
        <div className="mb-6">
          <label className="flex text-sm font-bold text-gray-700 mb-3 items-center gap-2">
            <Tag size={16} className="text-[#292C6D]" />
            Tags
          </label>
          
          <div className="mb-3">
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                placeholder="Add a tag..."
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                className="border border-gray-300 text-gray-900 text-base font-medium flex-1 p-2 rounded-lg focus:ring-2 focus:ring-[#292C6D] focus:border-transparent transition-all"
              />
              <button
                onClick={handleAddTag}
                className="bg-[#292C6D] text-white px-4 py-2 rounded-lg hover:bg-[#1f2350] transition-colors font-medium"
              >
                Add
              </button>
            </div>

            {/* Suggested tags */}
            <div className="mb-3">
              <p className="text-xs text-gray-500 mb-2 font-medium">Quick tags:</p>
              <div className="flex flex-wrap gap-2">
                {['IELTS', 'TOEFL', 'Grammar', 'Speaking', 'Writing', 'Listening', 'Reading', 'Business English', 'Pronunciation', 'Vocabulary', 'Conversation', 'Academic Writing', 'Exam Prep', 'Beginner', 'Intermediate', 'Advanced', 'Q&A', 'Workshop', 'Tutorial'].map((tag: string) => (
                  <button
                    key={tag}
                    onClick={() => {
                      if (!tags.includes(tag)) {
                        setTags([...tags, tag]);
                      }
                    }}
                    disabled={tags.includes(tag)}
                    className={`text-xs px-3 py-1 rounded-full font-medium transition ${
                      tags.includes(tag)
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-gray-100 text-gray-700 hover:bg-[#292C6D] hover:text-white border border-gray-300'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Selected tags */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map((t, i) => (
                  <div key={i} className="bg-[#292C6D] text-white font-semibold px-3 py-1 rounded-full text-xs flex items-center gap-2">
                    {t}
                    <button
                      onClick={() => setTags(tags.filter((_, idx) => idx !== i))}
                      className="hover:text-red-200 transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 mt-8 pt-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-gray-200 transition-colors text-base"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-3 bg-[#292C6D] text-white font-bold rounded-lg hover:bg-[#1f2350] transition-colors text-base"
          >
            Save Event
          </button>
        </div>
      </div>
    </div>
  );
}
