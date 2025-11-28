"use client";
import Image from "next/image";
import "flatpickr/dist/themes/airbnb.css";
import { useState, useEffect } from "react";
import DashboardCalendar from "../../../component/admin/DashboardCalendar";

// Helper function to format numbers consistently on both server and client
const formatNumber = (num: number): string => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

interface DashboardStats {
  totalUsers: number;
  totalTeachers: number;
  totalStudents: number;
  pendingTeachers: number;
  approvedTeachers: number;
  rejectedTeachers: number;
  totalLivestreams: number;
  activeLivestreams: number;
  totalViews: number;
  monthlyRegistrations: number[];
}

interface Livestream {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
  totalViews: number;
  status: string;
  teacher: {
    id: string;
    fullName: string;
    email: string;
    avatar: string | null;
  };
}

interface Teacher {
  id: string;
  fullName: string;
  email: string;
  avatar: string | null;
  teacherProfile: {
    followers: { id: string }[];
  };
  _count: {
    livestreams: number;
  };
}

export default function Dashboard() {
  // ================== Data States ==================
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [topLivestreams, setTopLivestreams] = useState<Livestream[]>([]);
  const [topTeachers, setTopTeachers] = useState<Teacher[]>([]);
  
  // Initialize date on client side only to avoid hydration mismatch
  useEffect(() => {
    setSelectedDate(new Date());
  }, []);

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

        // Fetch dashboard stats
        const statsResponse = await fetch(`${API_URL}/admin/dashboard/stats`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (statsResponse.ok) {
          const stats = await statsResponse.json();
          setDashboardStats(stats);
        }

        // Fetch top livestreams (ENDED with highest views)
        const livestreamsResponse = await fetch(`${API_URL}/admin/livestreams?status=ENDED&limit=100`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (livestreamsResponse.ok) {
          const data = await livestreamsResponse.json();
          // Sort by totalViews descending and take top 3
          const sortedLivestreams = data.livestreams
            .filter((ls: Livestream) => ls.status === 'ENDED')
            .sort((a: Livestream, b: Livestream) => (b.totalViews || 0) - (a.totalViews || 0));
          setTopLivestreams(sortedLivestreams.slice(0, 3));
        }

        // Fetch top teachers (would need a dedicated endpoint, for now use users endpoint)
        const teachersResponse = await fetch(`${API_URL}/admin/users?role=TEACHER&limit=4`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (teachersResponse.ok) {
          const data = await teachersResponse.json();
          setTopTeachers(data.users.slice(0, 4));
        }

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // Compute stats for display
  const stats = dashboardStats ? [
    { count: dashboardStats.pendingTeachers, label: "waiting-approved TEACHER" },
    { count: dashboardStats.totalStudents, label: "total STUDENTS" },
    { count: dashboardStats.totalLivestreams, label: "video STREAMING" },
  ] : [
    { count: 0, label: "waiting-approved TEACHER" },
    { count: 0, label: "total STUDENTS" },
    { count: 0, label: "video STREAMING" },
  ];

  // ================== Color logic ==================
  const baseColors = ["#EC255A", "#fceb2d", "#1E93AB"];
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
  if (loading) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center">
        <div className="text-xl text-[#161853]">Loading dashboard data...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-2xl font-bold text-[#161853] mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ===== Left Side ===== */}
          <div className="flex flex-col gap-8">
          {/* Greeting Card */}
          <div className="flex items-center bg-white rounded-2xl p-8 shadow-sm min-h-[180px]">
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
                Hi Admin,
              </h2>
              <p className="text-gray-600">
                It is a lot of work for today. Let’s start
              </p>
            </div>
          </div>

          {/* Today we have */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h3 className="text-[#161853] font-bold mb-4">Today we have</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h3 className="text-[#161853] font-bold mb-4">Top livestreams</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-gray-500 border-b border-gray-200">
                  <tr>
                    <th className="text-left py-3">Live Title</th>
                    <th className="text-center py-3">Views</th>
                    <th className="text-center py-3">Status</th>
                    <th className="text-center py-3">Teacher</th>
                  </tr>
                </thead>
                <tbody className="text-[#161853]">
                  {topLivestreams.map((livestream) => (
                    <tr key={livestream.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-200 rounded-lg overflow-hidden">
                            {livestream.teacher.avatar ? (
                              <img src={livestream.teacher.avatar} alt={livestream.teacher.fullName} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gray-300 text-gray-600 font-bold">
                                {livestream.teacher.fullName.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="font-semibold">{livestream.title}</div>
                            <div className="text-xs text-gray-500">
                              {livestream.description || 'No description'}
                            </div>
                            <div className="text-xs text-gray-400">
                              {new Date(livestream.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="text-center font-medium text-[#161853]">{formatNumber(livestream.totalViews || 0)}</td>
                      <td className="text-center font-medium text-[#161853]">{livestream.status}</td>
                      <td className="text-center font-medium text-[#161853]">{livestream.teacher.fullName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
  
          {/* ===== Right Side ===== */}
        <div className="flex flex-col gap-6">
           <div className="flex flex-col gap-6">
            {selectedDate && (
              <DashboardCalendar
                selectedDate={selectedDate}
                onDateSelect={setSelectedDate}
              />
            )}
          </div>


          {/* Top teachers */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h3 className="text-[#161853] font-bold mb-4">Top teachers</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-gray-500 border-b border-gray-200">
                  <tr>
                    <th className="text-left py-3">Teacher</th>
                    <th className="text-center py-3">Followers</th>
                    <th className="text-center py-3">Livestreams</th>
                  </tr>
                </thead>
                <tbody className="text-[#161853]">
                  {topTeachers.map((teacher) => (
                    <tr key={teacher.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-200 rounded-lg overflow-hidden">
                            {teacher.avatar ? (
                              <img src={teacher.avatar} alt={teacher.fullName} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gray-300 text-gray-600 font-bold">
                                {teacher.fullName.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="font-semibold">{teacher.fullName}</div>
                            <div className="text-xs text-gray-500">{teacher.email}</div>
                          </div>
                        </div>
                      </td>
                    <td className="text-center font-medium text-[#161853]">
                      {formatNumber(teacher.teacherProfile?.followers?.length || 0)}
                    </td>
                    <td className="text-center font-medium text-[#161853]">{teacher._count?.livestreams || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}
