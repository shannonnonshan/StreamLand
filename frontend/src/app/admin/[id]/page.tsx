"use client";
import { CalendarDays } from "lucide-react";
import Image from "next/image";
import Flatpickr from "react-flatpickr";
import "flatpickr/dist/themes/airbnb.css";
import { useState } from "react";
import DashboardCalendar from "../../../component/admin/DashboardCalendar";
export default function Dashboard() {
  // ================== Data States ==================
    const [selectedDate, setSelectedDate] = useState(new Date());
  const [stats, setStats] = useState<{ count: number; label: string }[]>([
    { count: 9, label: "waiting-approved TEACHER" },
    { count: 25, label: "new sign-up STUDENTS" },
    { count: 80, label: "video STREAMING" },
  ]);
  const [livestreams, setLivestreams] = useState([
    {
      id: 1,
      name: "name of the live",
      description: "description",
      date: "29/08/2025",
      views: 1000,
      comments: 100000,
      likes: 100,
    },
    {
      id: 2,
      name: "name of the live",
      description: "description",
      date: "29/08/2025",
      views: 980,
      comments: 45000,
      likes: 90,
    },
    {
      id: 3,
      name: "name of the live",
      description: "description",
      date: "29/08/2025",
      views: 920,
      comments: 30000,
      likes: 80,
    },
  ]);
  const [teachers, setTeachers] = useState([
    {
      id: 1,
      username: "teacher_anna",
      name: "Anna Nguyen",
      subscribers: 1200,
      livestreams: 25,
      growth: 80,
    },
    {
      id: 2,
      username: "teacher_tom",
      name: "Tom Lee",
      subscribers: 1100,
      livestreams: 22,
      growth: 65,
    },
    {
      id: 3,
      username: "teacher_jane",
      name: "Jane Pham",
      subscribers: 900,
      livestreams: 18,
      growth: 50,
    },
    {
      id: 4,
      username: "teacher_khanh",
      name: "Khanh Tran",
      subscribers: 700,
      livestreams: 15,
      growth: 30,
    },
  ]);

  // ================== Color logic ==================
  const baseColors = ["#EC255A", "#FAEF5D", "#1E93AB"];
  const cards = stats.map((item, i) => {
    const intensity = Math.min(item.count / 100, 1);
    const bgColor = "#FFFFFF";
    const base = baseColors[i % baseColors.length];

    const blendWithWhite = (hex: string, factor: number) => {
      const c = parseInt(hex.slice(1), 16);
      const r = (c >> 16) & 0xff;
      const g = (c >> 8) & 0xff;
      const b = c & 0xff;

      const gamma = 0.8;
      factor = Math.pow(factor, gamma);

      const rMix = Math.round(r + (255 - r) * (1 - factor));
      const gMix = Math.round(g + (255 - g) * (1 - factor));
      const bMix = Math.round(b + (255 - b) * (1 - factor));

      return `rgb(${rMix}, ${gMix}, ${bMix})`;
    };

    const textColor = blendWithWhite(base, intensity);
    return { ...item, bgColor, textColor };
  });


    // ================== UI ==================
  return (
    <div className="min-h-screen p-6">
      <h1 className="text-xl font-bold text-[#161853] mb-4">Dashboard</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ===== Left Side ===== */}
        <div className="flex flex-col gap-6">
          {/* Greeting Card */}
          <div className="flex h-[50%] items-center bg-white rounded-2xl p-6 shadow-sm">
            <Image
              src="/admin/welcome.gif"
              alt="Dashboard Illustration"
              width={120}
              height={120}
              className="mr-6"
              unoptimized
            />
            <div>
              <h2 className="text-3xl font-extrabold text-[#161853]">
                Hi Cam,
              </h2>
              <p className="text-gray-600">
                You have 25 new information today. It is a lot of work for
                today. Let’s start
              </p>
            </div>
          </div>

          {/* Today we have */}
          <div>
            <h3 className="text-[#161853] font-bold mb-2">Today we have</h3>
            <div className="flex gap-4 flex-row">
              {cards.map((item, i) => (
                <div
                  key={i}
                  className="rounded-xl shadow-sm flex items-center gap-3 p-4 w-fit transition-all duration-300"
                  style={{ backgroundColor: item.bgColor }}
                >
                  <div
                    className="font-extrabold text-xl transition-all duration-300"
                    style={{ color: item.textColor }}
                  >
                    {item.count}+
                  </div>
                  <div className="text-sm font-semibold transition-all duration-300 text-black">
                    {item.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top livestreams */}
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <h3 className="text-[#161853] font-bold mb-2">Top livestreams</h3>
              <table className="w-full text-sm text-left">
                <thead className="text-gray-500 border-b text-center">
                  <tr>
                    <th>Account</th>
                    <th>Views</th>
                    <th>Comments</th>
                    <th>Likes</th>
                  </tr>
                </thead>
                <tbody className="text-[#161853] ">
                  {livestreams.map((item) => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-gray-300 rounded" />
                          <div>
                            <div className="font-semibold">{item.name}</div>
                            <div className="text-xs text-gray-500">
                              {item.description}
                            </div>
                            <div className="text-xs text-gray-400">
                              {item.date}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="text-center">{item.views.toLocaleString()}</td>
                      <td className="text-center">{item.comments.toLocaleString()}</td>
                      <td className="text-center">{item.likes.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
          </div>
        </div>

        {/* ===== Right Side ===== */}
        <div className="flex flex-col gap-6">
           <div className="flex flex-col gap-6">
            <DashboardCalendar
              selectedDate={selectedDate}
              onDateSelect={setSelectedDate}
            />
          </div>


          {/* Top teachers */}
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <h3 className="text-[#161853] font-bold mb-3">Top teachers</h3>
            <table className="w-full text-sm text-left">
              <thead className="text-gray-500 border-b text-center">
                <tr>
                  <th>Username</th>
                  <th>Subscribers</th>
                  <th>Livestreams</th>
                  <th>Growth</th>
                </tr>
              </thead>
              <tbody className="text-[#161853]">
                {teachers.map((t) => (
                  <tr key={t.id} className="border-b last:border-0">
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gray-300 rounded" />
                        <div>
                          <div className="font-semibold">{t.username}</div>
                          <div className="text-xs text-gray-500">{t.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="text-center">{t.subscribers.toLocaleString()}</td>
                    <td className="text-center">{t.livestreams}</td>
                    <td
                      className={`font-semibold text-center ${
                        t.growth >= 0 ? "text-green-500" : "text-red-500"
                      }`}
                    >
                      {t.growth >= 0 ? "+" : ""}
                      {t.growth}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
