import { use } from "react";
import YearCalendarClient from "@/component/teacher/calendar/YearCalendarClient";

export default function YearCalendarPage({
  params,
}: {
  params: Promise<{ year?: string; id?: string }>;
}) {
  const { year: yearParam, id: idParam } = use(params);
  const today = new Date();
  const initialYear = yearParam ? parseInt(yearParam, 10) : today.getFullYear();

  // fallback id = "1"
  const id = idParam ?? "1";

  return <YearCalendarClient initialYear={initialYear} teacherId={id} />;
}
