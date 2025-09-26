"use client";

import Link from "next/link";
import { usePathname, useRouter, useParams } from "next/navigation";
import { useEffect } from "react";
import { raleway } from "@/utils/front";

export default function CalendarLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams();

  const id = (params?.id as string) || "1"; // fallback id = 1

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (pathname === `/teacher/${id}/calendar` || pathname === `/teacher/${id}/calendar/`) {
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth() + 1;

      router.replace(`/teacher/${id}/calendar/month/${year}/${month}`);
    }
  }, [pathname, router, id]);

  const handlePrev = () => {
    if (pathname.includes("/month")) {
      const year = parseInt(params.year as string, 10);
      const month = parseInt(params.month as string, 10);
      let newYear = year;
      let newMonth = month - 1;
      if (newMonth < 1) {
        newMonth = 12;
        newYear--;
      }
      router.push(`/teacher/${id}/calendar/month/${newYear}/${newMonth}`);
    } else if (pathname.includes("/week")) {
      const year = parseInt(params.year as string, 10);
      const month = parseInt(params.month as string, 10);
      const day = parseInt(params.day as string, 10);
      const current = new Date(year, month - 1, day);
      current.setDate(current.getDate() - 7);
      router.push(
        `/teacher/${id}/calendar/week/${current.getFullYear()}/${current.getMonth() + 1}/${current.getDate()}`
      );
    } else if (pathname.includes("/year")) {
      const year = parseInt(params.year as string, 10);
      router.push(`/teacher/${id}/calendar/year/${year - 1}`);
    }
  };

  const handleNext = () => {
    if (pathname.includes("/month")) {
      const year = parseInt(params.year as string, 10);
      const month = parseInt(params.month as string, 10);
      let newYear = year;
      let newMonth = month + 1;
      if (newMonth > 12) {
        newMonth = 1;
        newYear++;
      }
      router.push(`/teacher/${id}/calendar/month/${newYear}/${newMonth}`);
    } else if (pathname.includes("/week")) {
      const year = parseInt(params.year as string, 10);
      const month = parseInt(params.month as string, 10);
      const day = parseInt(params.day as string, 10);
      const current = new Date(year, month - 1, day);
      current.setDate(current.getDate() + 7);
      router.push(
        `/teacher/${id}/calendar/week/${current.getFullYear()}/${current.getMonth() + 1}/${current.getDate()}`
      );
    } else if (pathname.includes("/year")) {
      const year = parseInt(params.year as string, 10);
      router.push(`/teacher/${id}/calendar/year/${year + 1}`);
    }
  };

  return (
    <div>
      {/* Nav phụ */}
      <div className={`flex items-center justify-between border-b bg-white pb-2 px-4 ${raleway.className}`}>
        {/* Nút chọn view */}
        <div className="flex items-center gap-px rounded-lg bg-gray-100 p-1">
          <Link
            href={`/teacher/${id}/calendar/month/${new Date().getFullYear()}/${new Date().getMonth() + 1}`}
            className={`rounded-lg py-2.5 px-5 text-sm font-medium transition-all duration-300 ${
              pathname.includes("/month")
                ? "bg-white text-indigo-600"
                : "text-gray-500 hover:bg-white hover:text-indigo-600"
            }`}
          >
            Month
          </Link>
          <Link
            href={`/teacher/${id}/calendar/week/${new Date().getFullYear()}/${new Date().getMonth() + 1}/${new Date().getDate()}`}
            className={`rounded-lg py-2.5 px-5 text-sm font-medium transition-all duration-300 ${
              pathname.includes("/week")
                ? "bg-white text-indigo-600"
                : "text-gray-500 hover:bg-white hover:text-indigo-600"
            }`}
          >
            Week
          </Link>
          <Link
            href={`/teacher/${id}/calendar/year/${new Date().getFullYear()}`}
            className={`rounded-lg py-2.5 px-5 text-sm font-medium transition-all duration-300 ${
              pathname.includes("/year")
                ? "bg-white text-indigo-600"
                : "text-gray-500 hover:bg-white hover:text-indigo-600"
            }`}
          >
            Year
          </Link>
        </div>

        {/* Prev / Next */}
        <div className="border border-black text-black rounded-lg w-1/5 ml-auto flex justify-end items-stretch">
          <button
            onClick={handlePrev}
            className="hover:bg-[#161853] hover:text-white border-r border-black px-6 py-2 w-1/2"
          >
            ‹
          </button>
          <button
            onClick={handleNext}
            className="hover:bg-[#161853] hover:text-white px-6 py-2 w-1/2"
          >
            ›
          </button>
        </div>
      </div>

      {/* Nội dung */}
      <div>{children}</div>
    </div>
  );
}
