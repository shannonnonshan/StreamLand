// Kiểu dữ liệu sự kiện cho lịch
export interface CalendarEvent {
  id?: string;
  teacherId: string; // 🔥 id của giáo viên
  title: string;
  date: string;     // yyyy-mm-dd
  start: string;    // HH:mm
  end: string;      // HH:mm
  color: string;
  audience: "public" | "subscribers";
  notification?: number;
  description?: string;
}

export const sampleEvents: CalendarEvent[] = [
  {
    id: "1",
    teacherId: "1",
    title: "Math Livestream: Algebra Basics",
    date: "2025-09-20",
    start: "09:00",
    end: "10:30",
    color: "blue",
    audience: "public",
    description: "Introduction to algebra for grade 6 students.",
  },
  {
    id: "2",
    teacherId: "1",
    title: "English Livestream: Grammar Practice",
    date: "2025-09-23",
    start: "14:00",
    end: "15:00",
    color: "green",
    audience: "subscribers",
    notification: 30,
    description: "Focus on tenses and sentence structure.",
  },
  {
    id: "3",
    teacherId: "2",
    title: "Science Q&A Session",
    date: "2025-09-24",
    start: "19:00",
    end: "20:00",
    color: "purple",
    audience: "public",
    description: "Answering student questions on Physics and Chemistry.",
  },
  {
    id: "6",
    teacherId: "2",
    title: "Science Q&A Session",
    date: "2025-09-24",
    start: "14:00",
    end: "15:00",
    color: "purple",
    audience: "public",
    description: "Answering student questions on Physics and Chemistry.",
  },
  {
    id: "8",
    teacherId: "1",
    title: "Science Q&A Session",
    date: "2025-09-24",
    start: "14:00",
    end: "15:00",
    color: "purple",
    audience: "public",
    description: "Answering student questions on Physics and Chemistry.",
  },
  {
    id: "4",
    teacherId: "1",
    title: "History Livestream: World War II",
    date: "2025-09-25",
    start: "16:00",
    end: "17:30",
    color: "red",
    audience: "subscribers",
    description: "Detailed lesson about key events in WWII.",
  },
  {
    id: "7",
    teacherId: "1",
    title: "History Livestream: World War II",
    date: "2025-09-24",
    start: "08:00",
    end: "10:30",
    color: "green",
    audience: "subscribers",
    description: "Detailed lesson about key events in WWII.",
  },
  {
    id: "5",
    teacherId: "1",
    title: "Weekly Teacher Meeting",
    date: "2025-09-26",
    start: "10:00",
    end: "11:00",
    color: "yellow",
    audience: "subscribers",
    description: "Internal planning session with team.",
  },
];
