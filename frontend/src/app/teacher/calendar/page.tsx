"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CalendarRootPage() {
  const router = useRouter();

  useEffect(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    router.replace(`/teacher/calendar/month/${year}/${month}`);
  }, [router]);

  return null; // hoặc spinner/loading
}
