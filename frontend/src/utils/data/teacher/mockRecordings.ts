// utils/mockRecordings.ts
export interface Recording {
  id: string;
  title: string;
  thumbnail: string;
  date: string; // YYYY-MM-DD
  videopath: string;
  month: string; // YYYY-MM, để filter theo tháng
}

export const mockRecordings: Recording[] = [
  { id: "rec-1", title: "Math Lecture 1", thumbnail: "/logo.png", date: "2025-10-01", videopath: "/videos/video1.mp4", month: "2025-10" },
  { id: "rec-2", title: "Physics Lecture 2", thumbnail: "/logo.png", date: "2025-10-02", videopath: "/videos/video2.mp4", month: "2025-10" },
  { id: "rec-3", title: "Chemistry Lecture 3", thumbnail: "/logo.png", date: "2025-10-28", videopath: "/videos/video3.mp4", month: "2025-10" },
  { id: "rec-4", title: "Biology Lecture 4", thumbnail: "/logo.png", date: "2025-10-25", videopath: "/videos/video4.mp4", month: "2025-10" },
  { id: "rec-5", title: "History Lecture 5", thumbnail: "/logo.png", date: "2025-08-15", videopath: "/videos/video5.mp4", month: "2025-08" },
  { id: "rec-6", title: "Geography Lecture 6", thumbnail: "/logo.png", date: "2025-08-10", videopath: "/videos/video6.mp4", month: "2025-08" },
  { id: "rec-7", title: "English Lecture 7", thumbnail: "/logo.png", date: "2025-07-20", videopath: "/videos/video7.mp4", month: "2025-07" },
  { id: "rec-8", title: "Literature Lecture 8", thumbnail: "/logo.png", date: "2025-07-18", videopath: "/videos/video8.mp4", month: "2025-07" },
  { id: "rec-9", title: "Art Lecture 9", thumbnail: "/logo.png", date: "2025-06-30", videopath: "/videos/video9.mp4", month: "2025-06" },
  { id: "rec-10", title: "Music Lecture 10", thumbnail: "/logo.png", date: "2025-06-25", videopath: "/videos/video10.mp4", month: "2025-06" },
];
