"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CalendarEvent } from "@/utils/data/teacher/calendar";
import pastelize from "@/utils/colorise";
import { raleway } from "@/utils/front";
import { XIcon, Clock, Users, StickyNote, Palette, UserRound, ChevronRightIcon } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import EarlyStartWarningModal from "./EarlyStartWarningModal";
import UpdateEventModal from "./UpdateEventModal";
import StartLivestreamModal, { LivestreamData } from "@/component/teacher/StartLivestreamModal";
import { startLivestreamEarly } from "@/lib/api/teacher";
import { useConfirmDialog } from "@/component/teacher/useConfirmDialog";

interface EventDrawerProps {
  event: CalendarEvent | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: (updated: CalendarEvent) => void;
}

function Section({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">{children}</div>;
}

export default function EventDrawer({ event, isOpen, onClose, onUpdate }: EventDrawerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [openUpdate, setOpenUpdate] = useState(false);
  const [organizerName, setOrganizerName] = useState("System");
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [showEarlyStartWarning, setShowEarlyStartWarning] = useState(false);
  const [showStartLiveModal, setShowStartLiveModal] = useState(false);
  const [pendingLivestreamId, setPendingLivestreamId] = useState<string | null>(null);
  const [isStartingEarly, setIsStartingEarly] = useState(false);
  const { showDialog, DialogComponent } = useConfirmDialog();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const userStr = localStorage.getItem("user");
    if (!userStr) return;

    try {
      const user = JSON.parse(userStr);
      setOrganizerName(user.name || user.email || "Teacher");
    } catch (error) {
      console.error("Failed to parse user:", error);
    }
  }, []);

  useEffect(() => {
    if (showStartLiveModal && pathname.includes("/livestream/")) {
      setShowStartLiveModal(false);
      setPendingLivestreamId(null);
      setIsRedirecting(false);
    }
  }, [pathname, showStartLiveModal]);

  if (!isOpen || !event) return null;

  const today = new Date().toISOString().split("T")[0];
  const isPast = event.date < today;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-[1px]" onClick={onClose} />

      <aside className={`fixed right-0 top-0 z-50 h-screen w-full max-w-md overflow-y-auto border-l border-slate-200 bg-white/95 px-5 py-6 text-slate-800 backdrop-blur ${raleway.className}`}>
        <button onClick={onClose} className="absolute right-3 top-3 text-slate-400 transition hover:text-slate-700">
          <XIcon size={22} />
          <span className="sr-only">Close</span>
        </button>

        <button
          onClick={onClose}
          className="absolute -left-3.5 top-1/2 -translate-y-1/2 rounded-full border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50"
        >
          <ChevronRightIcon size={18} />
        </button>

        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">Event details</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight" style={{ color: isPast ? "#64748b" : event.color }}>
              {event.title}
            </h2>
          </div>

          <Section>
            <div className="space-y-3 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <Clock size={18} className="text-sky-700" />
                <span>
                  {event.date} • {event.start} – {event.end}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Users size={18} className="text-sky-700" />
                <span>
                  Audience: <strong className="text-slate-800">{event.audience === "public" ? "🌐 Public" : "🔒 Subscribers"}</strong>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Palette size={18} className="text-sky-700" />
                <div className="h-4 w-4 rounded-full border border-slate-200" style={{ backgroundColor: pastelize(event.color, 0.8) }} />
                <span>{event.color}</span>
              </div>

              {event.description && (
                <div className="flex items-start gap-2">
                  <StickyNote size={18} className="mt-0.5 text-sky-700" />
                  <p>{event.description}</p>
                </div>
              )}
            </div>
          </Section>

          {event.livestreamId && (
            <Section>
              <div className="space-y-3">
                {isPast ? (
                  (event as any).type === "livestream" && (event as any).status === "ended" ? (
                    <button
                      onClick={() => {
                        setIsRedirecting(true);
                        router.push(`/teacher/${event.teacherId}/recordings/detail/${event.livestreamId}`);
                      }}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={isRedirecting}
                    >
                      {isRedirecting ? (
                        <>
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
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
                    <button disabled className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-200 px-4 py-3 text-sm font-semibold text-slate-500 cursor-not-allowed">
                      No Recording Available
                    </button>
                  )
                ) : (
                  <button
                    onClick={() => {
                      const eventDate = new Date(event.date);
                      const todayDate = new Date();
                      todayDate.setHours(0, 0, 0, 0);

                      if (eventDate > todayDate) {
                        setShowEarlyStartWarning(true);
                      } else {
                        setIsRedirecting(true);
                        router.push(`/teacher/${event.teacherId}/livestream/${event.livestreamId}`);
                      }
                    }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isRedirecting}
                  >
                    {isRedirecting ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
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
            </Section>
          )}

          <Section>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <UserRound size={18} className="text-sky-700" />
              <span>
                Organizer: <strong className="text-slate-800">{organizerName}</strong>
              </span>
            </div>
          </Section>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <button
              onClick={() => setOpenUpdate(true)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-500 px-4 py-3 font-semibold text-white transition hover:bg-rose-600"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
              Update Event
            </button>
          </div>
        </div>
      </aside>

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

      <EarlyStartWarningModal
        open={showEarlyStartWarning}
        onClose={() => setShowEarlyStartWarning(false)}
        scheduledDate={event?.date || ""}
        scheduledTime={event?.start || ""}
        onStartNow={async () => {
          if (!event?.livestreamId) return;

          setIsStartingEarly(true);
          try {
            const response = await startLivestreamEarly(event.livestreamId, event.title, (event as any).category);
            setIsRedirecting(true);
            router.push(`/teacher/${event.teacherId}/livestream/${response.id}`);
          } catch (error) {
            console.error("Failed to start livestream early:", error);
            setIsStartingEarly(false);
            showDialog({
              title: "Error",
              message: "Failed to start livestream. Please try again.",
              type: "danger",
              confirmText: "OK",
            });
          }
        }}
        onStartNewLivestream={() => {
          setPendingLivestreamId(uuidv4());
          setShowStartLiveModal(true);
          setShowEarlyStartWarning(false);
        }}
        isLoading={isStartingEarly}
      />

      <StartLivestreamModal
        isOpen={showStartLiveModal}
        closeModal={() => {
          setShowStartLiveModal(false);
          setPendingLivestreamId(null);
        }}
        onStartLivestream={async (data: LivestreamData) => {
          if (!pendingLivestreamId) return;

          try {
            const token = localStorage.getItem("token") || localStorage.getItem("accessToken");
            const userStr = localStorage.getItem("user");
            const user = userStr ? JSON.parse(userStr) : null;

            if (!token) throw new Error("No authentication token found. Please login again.");
            if (!user?.id) throw new Error("User information not found. Please login again.");

            const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
            const response = await fetch(`${API_URL}/livestream/create`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                id: pendingLivestreamId,
                teacherId: user.id,
                title: data.title,
                description: data.description,
                category: data.category,
                isPublic: data.isPublic,
                allowComments: data.allowComments,
              }),
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({ message: "Failed to create livestream" }));
              if (response.status === 401) {
                throw new Error("Authentication failed. Please log in again.");
              }
              throw new Error(errorData.message || `Failed to create livestream (${response.status})`);
            }

            await response.json().catch(() => null);

            for (let index = 0; index < 8; index++) {
              const readyResponse = await fetch(`${API_URL}/livestream/${pendingLivestreamId}`, { cache: "no-store" }).catch(() => null);
              if (readyResponse?.ok) break;
              await new Promise((resolve) => setTimeout(resolve, 500));
            }

            setIsRedirecting(true);
            router.push(`/teacher/${event.teacherId}/livestream/${pendingLivestreamId}`);
          } catch (error) {
            showDialog({
              title: "Error",
              message: error instanceof Error ? error.message : "Failed to create livestream",
              type: "danger",
              confirmText: "OK",
            });
            throw error;
          }
        }}
        teacherId={event?.teacherId || ""}
      />

      {DialogComponent}
    </>
  );
}
