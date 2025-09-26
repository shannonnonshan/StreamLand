import YearCalendarClient from "@/component/teacher/calendar/YearCalendarClient";

export default function YearCalendarPage({
  params,
}: {
  params: { year?: string; id?: string };
}) {
  const today = new Date();
  const yearParam = params.year;
  const initialYear = yearParam ? parseInt(yearParam, 10) : today.getFullYear();

  // fallback id = "1"
  const id = params.id ?? "1";

  return <YearCalendarClient initialYear={initialYear} teacherId={id} />;
}
