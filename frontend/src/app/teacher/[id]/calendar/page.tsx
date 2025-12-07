"use client";
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader } from "lucide-react";

export default function CalendarRootPage() {
  const router = useRouter();
  const params = useParams();

  useEffect(() => {
    const today = new Date();
    const id = params?.id || "1";
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    router.replace(`/teacher/${id}/calendar/month/${year}/${month}`);
  }, [router, params]);

  return (
    <div className="flex justify-center items-center h-screen">
      <div className="text-center">
        <Loader size={48} className="animate-spin text-blue-600 mx-auto mb-4" />
        <p className="text-gray-600">Loading calendar...</p>
      </div>
    </div>
  );
}
