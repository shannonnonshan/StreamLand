"use client";

import Link from "next/link";
import { usePathname, useRouter, useParams } from "next/navigation";
import { useEffect, useTransition } from "react";
import { raleway } from "@/utils/front";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function CalendarLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams();
  const [isPending, startTransition] = useTransition();

  const id = (params?.id as string) || "1";
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const currentDate = new Date().getDate();

  const activeView = pathname.includes("/month")
    ? "month"
    : pathname.includes("/week")
      ? "week"
      : pathname.includes("/year")
        ? "year"
        : "month";

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (pathname === `/teacher/${id}/calendar` || pathname === `/teacher/${id}/calendar/`) {
      const today = new Date();
      router.replace(`/teacher/${id}/calendar/month/${today.getFullYear()}/${today.getMonth() + 1}`);
    }
  }, [pathname, router, id]);

  const handlePrev = () => {
    startTransition(() => {
      if (pathname.includes("/month")) {
        const year = parseInt(params.year as string, 10);
        const month = parseInt(params.month as string, 10);
        let newYear = year, newMonth = month - 1;
        if (newMonth < 1) { newMonth = 12; newYear--; }
        router.push(`/teacher/${id}/calendar/month/${newYear}/${newMonth}`);
      } else if (pathname.includes("/week")) {
        const year = parseInt(params.year as string, 10);
        const month = parseInt(params.month as string, 10);
        const day = parseInt(params.day as string, 10);
        const current = new Date(year, month - 1, day);
        current.setDate(current.getDate() - 7);
        router.push(`/teacher/${id}/calendar/week/${current.getFullYear()}/${current.getMonth() + 1}/${current.getDate()}`);
      } else if (pathname.includes("/year")) {
        const year = parseInt(params.year as string, 10);
        router.push(`/teacher/${id}/calendar/year/${year - 1}`);
      }
    });
  };

  const handleNext = () => {
    startTransition(() => {
      if (pathname.includes("/month")) {
        const year = parseInt(params.year as string, 10);
        const month = parseInt(params.month as string, 10);
        let newYear = year, newMonth = month + 1;
        if (newMonth > 12) { newMonth = 1; newYear++; }
        router.push(`/teacher/${id}/calendar/month/${newYear}/${newMonth}`);
      } else if (pathname.includes("/week")) {
        const year = parseInt(params.year as string, 10);
        const month = parseInt(params.month as string, 10);
        const day = parseInt(params.day as string, 10);
        const current = new Date(year, month - 1, day);
        current.setDate(current.getDate() + 7);
        router.push(`/teacher/${id}/calendar/week/${current.getFullYear()}/${current.getMonth() + 1}/${current.getDate()}`);
      } else if (pathname.includes("/year")) {
        const year = parseInt(params.year as string, 10);
        router.push(`/teacher/${id}/calendar/year/${year + 1}`);
      }
    });
  };

  return (
    <div className={`${raleway.className} min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/30 to-indigo-50/20 text-slate-800`}>

      {/* Sticky glass nav */}
      <div
        className={`sticky top-0 z-30 border-b border-white/60 bg-white/70 backdrop-blur-xl px-4 py-2.5 transition-opacity duration-200 ${isPending ? "opacity-60" : "opacity-100"}`}
      >
        <div className="mx-auto flex w-full max-w-screen-2xl items-center justify-between gap-4">

          {/* Left: branding */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="hidden sm:flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-100">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="3" width="14" height="11" rx="2" stroke="#0284c7" strokeWidth="1.4" fill="none"/>
                <path d="M5 1v3M11 1v3M1 7h14" stroke="#0284c7" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-sky-500">Calendar</p>
              <p className="text-sm font-semibold text-slate-800 truncate leading-tight">Manage lessons &amp; schedules</p>
            </div>
          </div>

          {/* Center: view tabs */}
          <div className="flex items-center gap-0.5 rounded-2xl border border-slate-200/80 bg-slate-100/70 p-1">
            {(["month", "week", "year"] as const).map((view) => {
              const href =
                view === "month"
                  ? `/teacher/${id}/calendar/month/${currentYear}/${currentMonth}`
                  : view === "week"
                    ? `/teacher/${id}/calendar/week/${currentYear}/${currentMonth}/${currentDate}`
                    : `/teacher/${id}/calendar/year/${currentYear}`;
              return (
                <Link
                  key={view}
                  href={href}
                  className={`rounded-xl px-4 py-1.5 text-sm font-medium capitalize transition-all duration-150 ${
                    activeView === view
                      ? "bg-white text-sky-600 shadow-sm ring-1 ring-sky-100"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {view}
                </Link>
              );
            })}
          </div>

          {/* Right: nav arrows */}
          <div className="flex items-center gap-0.5 rounded-2xl border border-slate-200/80 bg-slate-100/70 p-1">
            <button
              onClick={handlePrev}
              disabled={isPending}
              aria-label="Previous period"
              className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 transition hover:bg-white hover:text-sky-600 hover:shadow-sm disabled:opacity-40"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={handleNext}
              disabled={isPending}
              aria-label="Next period"
              className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 transition hover:bg-white hover:text-sky-600 hover:shadow-sm disabled:opacity-40"
            >
              <ChevronRight size={16} />
            </button>
          </div>

        </div>
      </div>

      {/* Content */}
      <div className="mx-auto w-full max-w-screen-2xl px-4 py-5 lg:px-6">
        {children}
      </div>
    </div>
  );
}