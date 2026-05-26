"use client";

import Link from "next/link";
import { usePathname, useRouter, useParams } from "next/navigation";
import { useEffect, useTransition } from "react";
import { raleway } from "@/utils/front";
import { ChevronLeft, ChevronRight } from "lucide-react";

const MONTH_NAMES = ["January","February","March","April","May","June",
  "July","August","September","October","November","December"];
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec"];

export default function CalendarLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const params   = useParams();
  const [isPending, startTransition] = useTransition();

  const id           = (params?.id as string) || "1";
  const currentYear  = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const currentDate  = new Date().getDate();

  const activeView = pathname.includes("/month") ? "month"
    : pathname.includes("/week")  ? "week"
    : pathname.includes("/year")  ? "year"
    : "month";

  const pYear  = parseInt(params?.year  as string, 10);
  const pMonth = parseInt(params?.month as string, 10);
  const pDay   = parseInt(params?.day   as string, 10);

  const periodLabel = (() => {
    if (activeView === "month" && !isNaN(pYear) && !isNaN(pMonth))
      return `${MONTH_NAMES[pMonth - 1]} ${pYear}`;
    if (activeView === "week" && !isNaN(pYear) && !isNaN(pMonth) && !isNaN(pDay)) {
      const start = new Date(pYear, pMonth - 1, pDay);
      const end   = new Date(pYear, pMonth - 1, pDay + 6);
      return `${start.getDate()} ${MONTH_SHORT[start.getMonth()]} – ${end.getDate()} ${MONTH_SHORT[end.getMonth()]} ${pYear}`;
    }
    if (activeView === "year" && !isNaN(pYear)) return String(pYear);
    return "";
  })();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (pathname === `/teacher/${id}/calendar` || pathname === `/teacher/${id}/calendar/`) {
      const t = new Date();
      router.replace(`/teacher/${id}/calendar/month/${t.getFullYear()}/${t.getMonth() + 1}`);
    }
  }, [pathname, router, id]);

  const handlePrev = () => startTransition(() => {
    if (activeView === "month") {
      let y = pYear, m = pMonth - 1;
      if (m < 1) { m = 12; y--; }
      router.push(`/teacher/${id}/calendar/month/${y}/${m}`);
    } else if (activeView === "week") {
      const d = new Date(pYear, pMonth - 1, pDay);
      d.setDate(d.getDate() - 7);
      router.push(`/teacher/${id}/calendar/week/${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`);
    } else {
      router.push(`/teacher/${id}/calendar/year/${pYear - 1}`);
    }
  });

  const handleNext = () => startTransition(() => {
    if (activeView === "month") {
      let y = pYear, m = pMonth + 1;
      if (m > 12) { m = 1; y++; }
      router.push(`/teacher/${id}/calendar/month/${y}/${m}`);
    } else if (activeView === "week") {
      const d = new Date(pYear, pMonth - 1, pDay);
      d.setDate(d.getDate() + 7);
      router.push(`/teacher/${id}/calendar/week/${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`);
    } else {
      router.push(`/teacher/${id}/calendar/year/${pYear + 1}`);
    }
  });

  const goToday = () => {
    const t = new Date();
    if (activeView === "month") router.push(`/teacher/${id}/calendar/month/${t.getFullYear()}/${t.getMonth() + 1}`);
    else if (activeView === "week") router.push(`/teacher/${id}/calendar/week/${t.getFullYear()}/${t.getMonth() + 1}/${t.getDate()}`);
    else router.push(`/teacher/${id}/calendar/year/${t.getFullYear()}`);
  };

  return (
    <div className={`${raleway.className} flex h-full flex-col bg-slate-50 px-4 pb-6 pt-5`}>
      <div className="mx-auto w-full max-w-7xl">

        {/* ── Header card ── */}
        <div className={`rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition-opacity ${isPending ? "opacity-60" : ""}`}>

          {/* 3 equal columns: title | navigator | view switcher */}
          <div className="grid grid-cols-3 items-center gap-6">

            {/* LEFT — title */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Teacher workspace</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Calendar</h1>
              <p className="mt-1 text-sm text-slate-500">Manage lessons and live stream schedules.</p>
            </div>

            {/* CENTER — period navigator */}
            <div className="flex flex-col items-center gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                {activeView === "month" ? "Monthly view"
                  : activeView === "week" ? "Weekly view" : "Yearly view"}
              </p>

              <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-slate-50 px-1 py-1">
                <button
                  onClick={handlePrev} disabled={isPending}
                  title={activeView === "month" ? "Previous month" : activeView === "week" ? "Previous week" : "Previous year"}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-white hover:text-sky-600 hover:shadow-sm disabled:opacity-40"
                >
                  <ChevronLeft size={18} />
                </button>

                <span className="min-w-[160px] px-2 text-center text-base font-bold tabular-nums text-slate-800">
                  {periodLabel}
                </span>

                <button
                  onClick={handleNext} disabled={isPending}
                  title={activeView === "month" ? "Next month" : activeView === "week" ? "Next week" : "Next year"}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-white hover:text-sky-600 hover:shadow-sm disabled:opacity-40"
                >
                  <ChevronRight size={18} />
                </button>
              </div>

              <button onClick={goToday} className="text-[11px] font-semibold text-sky-500 transition hover:text-sky-700 hover:underline">
                Back to today
              </button>
            </div>

            {/* RIGHT — view switcher */}
            <div className="flex flex-col items-end gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">View</p>

              <div className="flex items-center gap-0.5 rounded-2xl border border-slate-200 bg-slate-50 p-1">
                {(["month", "week", "year"] as const).map((view) => {
                  const href = view === "month"
                    ? `/teacher/${id}/calendar/month/${currentYear}/${currentMonth}`
                    : view === "week"
                      ? `/teacher/${id}/calendar/week/${currentYear}/${currentMonth}/${currentDate}`
                      : `/teacher/${id}/calendar/year/${currentYear}`;
                  return (
                    <Link key={view} href={href}
                      className={`rounded-xl px-4 py-1.5 text-sm font-semibold capitalize transition-all ${
                        activeView === view
                          ? "bg-white text-sky-600 shadow-sm ring-1 ring-slate-200"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      {view}
                    </Link>
                  );
                })}
              </div>
            </div>

          </div>
        </div>

        {/* Page content */}
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}