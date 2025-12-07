// components/EventDrawer.tsx
"use client";

import React, { useState, useEffect } from "react";
import { CalendarEvent } from "@/utils/data/teacher/calendar";
import pastelize from "@/utils/colorise";
import { raleway } from "@/utils/front";
import { XIcon, Clock, Users, Bell, StickyNote, Palette, UserRound, CalendarDays, ChevronRightIcon } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import EarlyStartWarningModal from "./EarlyStartWarningModal";
import UpdateEventModal from "./UpdateEventModal";
import StartLivestreamModal, { LivestreamData } from "@/component/teacher/StartLivestreamModal";
import { startLivestreamEarly } from "@/lib/api/teacher";

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
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [showEarlyStartWarning, setShowEarlyStartWarning] = useState(false);
  const [showStartLiveModal, setShowStartLiveModal] = useState(false);
  const [pendingLivestreamId, setPendingLivestreamId] = useState<string | null>(null);
  const [isStartingEarly, setIsStartingEarly] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

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
          {isPast ? (
            // Event đã ended
            (event as any).type === 'livestream' && (event as any).status === 'ended' ? (
              <button
                onClick={() => {
                  setIsRedirecting(true);
                  window.location.href = `/teacher/${event.teacherId}/recordings/detail/${event.livestreamId}`;
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isRedirecting}
              >
                {isRedirecting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M5 3a2 2 0 00-2 2v6h6V5a2 2 0 00-2-2H5zM15 3a2 2 0 012 2v6h-6V5a2 2 0 012-2h2zM5 13H3v2a2 2 0 002 2h2v-4zm10 0v4h2a2 2 0 002-2v-2h-4z" />
                    </svg>
                    View Recording
                  </>
                )}
              </button>
            ) : (
              <button
                disabled
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-300 text-gray-600 text-sm font-semibold rounded-lg cursor-not-allowed"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M8.707 7.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" />
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                No Recording Available
              </button>
            )
          ) : (
            // Event chưa ended - show Join Livestream
            <button
              onClick={() => {
                // Check nếu scheduled date chưa tới
                const eventDate = new Date(event.date);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                if (eventDate > today) {
                  // Chưa tới ngày - show warning
                  setShowEarlyStartWarning(true);
                } else {
                  // Đã tới ngày - join livestream
                  setIsRedirecting(true);
                  window.location.href = `/teacher/${event.teacherId}/livestream/${event.livestreamId}`;
                }
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#292C6D] text-white text-sm font-semibold rounded-lg hover:bg-[#1f2350] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isRedirecting}
            >
              {isRedirecting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                  </svg>
                  Join Livestream
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Organizer */}
      <div className="flex items-center gap-2 text-sm text-gray-700 mb-6">
        <UserRound size={18} />
        <span>Organizer: <strong>{organizerName}</strong></span>
      </div>

      {/* Action Buttons - Update Only */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        {/* Update Event Button */}
        <button
          onClick={() => setOpenUpdate(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#EC255A] hover:bg-[#d41f48] text-white font-bold rounded-lg transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
          </svg>
          Update Event
        </button>
      </div>
      </div>
       {/* Nút đóng dạng tròn ở mép trái giữa */}
      
      {/* Update Event Modal - New Version */}
      <UpdateEventModal
        open={openUpdate}
        onClose={() => setOpenUpdate(false)}
        event={event}
        teacherId={event?.teacherId || ""}
        onSave={(updatedEvent) => {
          onUpdate?.(updatedEvent);
          setOpenUpdate(false);
        }}
      />

      {/* Early Start Warning Modal */}
      <EarlyStartWarningModal
        open={showEarlyStartWarning}
        onClose={() => setShowEarlyStartWarning(false)}
        scheduledDate={event?.date || ''}
        scheduledTime={event?.start || ''}
        onStartNow={async () => {
          if (!event?.livestreamId) return;
          
          setIsStartingEarly(true);
          try {
            await startLivestreamEarly(
              event.livestreamId,
              event.title,
              (event as any).category
            );
            
            // Redirect to the new livestream
            setIsRedirecting(true);
            window.location.href = `/teacher/${event.teacherId}/livestream`;
          } catch (error) {
            console.error('Failed to start livestream early:', error);
            setIsStartingEarly(false);
            alert('Failed to start livestream. Please try again.');
          }
        }}
        onStartNewLivestream={() => {
          // Show StartLivestreamModal
          const newId = uuidv4();
          setPendingLivestreamId(newId);
          setShowStartLiveModal(true);
          setShowEarlyStartWarning(false);
        }}
        isLoading={isStartingEarly}
      />

      {/* Start Livestream Modal */}
      <StartLivestreamModal
        isOpen={showStartLiveModal}
        closeModal={() => {
          setShowStartLiveModal(false);
          setPendingLivestreamId(null);
        }}
        onStartLivestream={async (data: LivestreamData) => {
          if (!pendingLivestreamId) return;

          try {
            const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
            const userStr = localStorage.getItem('user');
            const user = userStr ? JSON.parse(userStr) : null;
            
            if (!token) {
              throw new Error('No authentication token found. Please login again.');
            }

            if (!user?.id) {
              throw new Error('User information not found. Please login again.');
            }

            const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
            const response = await fetch(`${API_URL}/livestream/create`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({
                id: pendingLivestreamId,
                teacherId: user?.id,
                title: data.title,
                description: data.description,
                category: data.category,
                isPublic: data.isPublic,
                allowComments: data.allowComments,
              }),
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({ message: 'Failed to create livestream' }));
              if (response.status === 401) {
                throw new Error('Authentication failed. Please log in again.');
              }
              throw new Error(errorData.message || `Failed to create livestream (${response.status})`);
            }

            setShowStartLiveModal(false);
            setIsRedirecting(true);
            window.location.href = `/teacher/${event?.teacherId}/livestream/${pendingLivestreamId}`;
          } catch (error) {
            alert(error instanceof Error ? error.message : 'Failed to create livestream');
            throw error;
          }
        }}
        teacherId={event?.teacherId || ""}
      />

    </>
  );
}
