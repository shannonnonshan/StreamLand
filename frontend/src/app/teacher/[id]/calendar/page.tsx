"use client";
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function CalendarRootPage() {
  const router = useRouter();
  const params = useParams();

  useEffect(() => {
    const today = new Date();
    const id = params?.id || "1"; // fallback id = 1
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    router.replace(`/teacher/${id}/calendar/month/${year}/${month}`);
  }, [router]);

  return null; // hoặc spinner/loading
}
