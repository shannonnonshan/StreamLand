"use client";

import { raleway } from "@/utils/front";
import { useState, useEffect } from "react";
import { Bell, Clock, Palette, XIcon, Tag } from "lucide-react";
import { CalendarEvent } from "@/utils/data/teacher/calendar";

interface UpdateEventModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (updatedEvent: CalendarEvent) => void;
  event: CalendarEvent | null;
  teacherId: string;
}

export default function UpdateEventModal({
  open,
  onClose,
  onSave,
  event,
  teacherId,
}: UpdateEventModalProps) {
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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

  // Load schedule data when modal opens
  useEffect(() => {
    if (open && event?.id) {
      fetchScheduleData();
    }
  }, [open, event?.id]);

  const fetchScheduleData = async () => {
    if (!event?.id) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/schedule/${event.id}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized - please log in again');
        }
        throw new Error('Failed to fetch schedule');
      }

      const data = await response.json();
      
      // Parse ISO datetime correctly
      const startDateTime = new Date(data.startTime);
      const endDateTime = new Date(data.endTime);
      
      // Format as YYYY-MM-DD and HH:MM in local timezone
      const dateStr = startDateTime.toISOString().split('T')[0];
      const startTimeStr = String(startDateTime.getHours()).padStart(2, '0') + ':' + String(startDateTime.getMinutes()).padStart(2, '0');
      const endTimeStr = String(endDateTime.getHours()).padStart(2, '0') + ':' + String(endDateTime.getMinutes()).padStart(2, '0');

      setEventTitle(data.title || "");
      setEventDate(dateStr);
      setEventStartTime(startTimeStr);
      setEventEndTime(endTimeStr);
      setEventDescription(data.description || "");
      setEventNotification(String(data.notifyBefore || 15));
      setIsPublic(data.isPublic ?? true);
      setEventColor(data.color || "#EC255A");
      setTags(data.tags || []);
    } catch (error) {
      console.error('Failed to fetch schedule:', error);
      alert(error instanceof Error ? error.message : 'Failed to load schedule data');
    } finally {
      setLoading(false);
    }
  };

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

  const handleSave = async () => {
    if (!eventTitle || !eventStartTime || !eventEndTime || !event?.id) return;

    setIsSaving(true);
    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found - please log in again');
      }
      
      // Combine date and time into ISO string
      const startDateTime = new Date(`${eventDate}T${eventStartTime}`).toISOString();
      const endDateTime = new Date(`${eventDate}T${eventEndTime}`).toISOString();

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/schedule/${event.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: eventTitle,
            startTime: startDateTime,
            endTime: endDateTime,
            description: eventDescription,
            notifyBefore: Number(eventNotification),
            isPublic,
            color: eventColor,
            tags,
          }),
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized - please log in again');
        }
        const error = await response.json().catch(() => ({ message: 'Failed to update schedule' }));
        throw new Error(error.message || 'Failed to update schedule');
      }

      // Notify parent with updated event
      const updatedEvent: CalendarEvent = {
        ...event,
        title: eventTitle,
        date: eventDate,
        start: eventStartTime,
        end: eventEndTime,
        color: eventColor,
        description: eventDescription,
        audience: isPublic ? 'public' : 'subscribers',
      };
      
      onSave(updatedEvent);
      onClose();
      
      // Reload calendar to ensure fresh data
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      console.error('Failed to update schedule:', error);
      alert(error instanceof Error ? error.message : 'Failed to update schedule');
    } finally {
      setIsSaving(false);
    }
  };

  if (!open || !event) return null;

  return (
    <div
      className={`${raleway.className} fixed inset-0 bg-black/30 flex items-center justify-center transition-opacity duration-300 z-50
      ${open ? "opacity-100 visible" : "opacity-0 invisible"}`}
    >
      <div className="relative bg-white rounded-xl p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          disabled={loading || isSaving}
        >
          <XIcon size={28} />
        </button>

        <h2 className="font-bold text-3xl text-gray-900 text-center mb-2">Update Event</h2>
        <p className="text-center text-gray-500 text-sm mb-8">Edit your scheduled event</p>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#292C6D]"></div>
          </div>
        ) : (
          <>
            {/* Title Input */}
            <div className="mb-6">
              <label className="block text-sm font-bold text-gray-700 mb-2">Event Title *</label>
              <input
                type="text"
                placeholder="Enter event title"
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                className="border border-gray-300 text-gray-900 text-base font-medium w-full mb-1 p-3 rounded-lg focus:ring-2 focus:ring-[#292C6D] focus:border-transparent transition-all"
              />
              {!eventTitle && <p className="text-xs text-red-500">Title is required</p>}
            </div>

            {/* Date Selection */}
            <div className="mb-6">
              <label className="block text-sm font-bold text-gray-700 mb-2">Date *</label>
              <input
                type="date"
                value={eventDate}
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
                  className="border border-gray-300 text-gray-900 text-base font-medium w-full p-3 rounded-lg focus:ring-2 focus:ring-[#292C6D] focus:border-transparent transition-all"
                />
                {!eventEndTime && <p className="text-xs text-red-500 mt-1">Required</p>}
              </div>
            </div>

            {/* Visibility & Notification - 2 Columns */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Visibility</label>
                <select
                  value={isPublic ? "public" : "subscribers"}
                  onChange={(e) => setIsPublic(e.target.value === "public")}
                  className="border border-gray-300 text-gray-900 text-base font-medium w-full p-3 rounded-lg bg-white focus:ring-2 focus:ring-[#292C6D] focus:border-transparent transition-all"
                >
                  <option value="public">Public - Everyone</option>
                  <option value="subscribers">Subscribers Only</option>
                </select>
              </div>

              <div>
                <label className="flex text-sm font-bold text-gray-700 mb-2 items-center gap-2">
                  <Bell size={16} className="text-[#292C6D]" />
                  Notify Before (min)
                </label>
                <input
                  type="number"
                  value={eventNotification}
                  onChange={(e) => setEventNotification(e.target.value)}
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
            <div className="mb-8">
              <label className="flex text-sm font-bold text-gray-700 mb-3 items-center gap-2">
                <Tag size={16} className="text-[#292C6D]" />
                Tags
              </label>
              
              <div className="mb-3">
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                    placeholder="Add a new tag..."
                    className="border border-gray-300 text-gray-900 font-medium text-base flex-1 p-3 rounded-lg focus:ring-2 focus:ring-[#292C6D] focus:border-transparent transition-all"
                  />
                  <button
                    onClick={handleAddTag}
                    className="px-4 py-3 bg-[#292C6D] text-white font-semibold rounded-lg hover:bg-[#1f1a4a] transition-colors"
                  >
                    Add
                  </button>
                </div>
                
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag, i) => (
                      <div
                        key={i}
                        className="bg-[#292C6D] text-white text-sm font-medium px-3 py-1 rounded-full flex items-center gap-2"
                      >
                        {tag}
                        <button
                          onClick={() => setTags(tags.filter((_, idx) => idx !== i))}
                          className="ml-1 hover:text-red-300 transition-colors"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={isSaving}
                className="flex-1 px-6 py-3 bg-gray-200 text-gray-900 font-bold rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || !eventTitle}
                className="flex-1 px-6 py-3 bg-[#292C6D] text-white font-bold rounded-lg hover:bg-[#1f1a4a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
