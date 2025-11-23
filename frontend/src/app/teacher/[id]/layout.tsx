"use client";
import { raleway } from "@/utils/front";
import { usePathname, useRouter, useParams } from "next/navigation";
import "../../globals.css";
import Image from "next/image";
import {
  ChartColumn,
  Search,
  Bell,
  FilePlay,
  CalendarDays,
  FileText,
  Settings as SettingsIcon,
  Radio,
  Headset,
} from "lucide-react";
import { ReactNode, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import ScheduleEventModal, { ScheduleEvent } from "@/component/teacher/calendar/ScheduleEventModal";
import Sidebar from "@/component/Sidebar";
import AuthButton from "@/component/AuthButton";

export default function RootLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams();
  const [open, setOpen] = useState(false);

  const accountId =
    typeof window !== "undefined" ? localStorage.getItem("accountId") : null;
  const id = (params?.id as string) || accountId || "1"; // fallback id = 1

  const handleStartLiveClick = () => {
      const livestreamID = uuidv4();
      router.push(`/teacher/${id}/livestream/${livestreamID}`);
  };
  
  const handleSave = (event: ScheduleEvent) => {
    console.log("New scheduled event:", event);
  };
  
  const navItems = [
    { type: "link" as const, href: "", label: "Dashboard", icon: ChartColumn },
    { type: "link" as const, href: "/recordings", label: "Recordings", icon: FilePlay },
    { type: "link" as const, href: "/calendar", label: "Schedule LiveStream", icon: CalendarDays },
    { type: "link" as const, href: "/documents/file", label: "Documents", icon: FileText },
    { type: "button" as const, label: "Start LiveStream", icon: Radio, onClick: handleStartLiveClick },
    { type: "link" as const, href: "/settings", label: "Settings", icon: SettingsIcon },
  ];

  const handleChatClick = () => {
    router.push(`/teacher/${id}/chat-with-admin`);
  };

  const bottomNavItem = {
    label: "Chat with Admin",
    icon: Headset,
    onClick: handleChatClick,
    isActive: (pathname: string) => pathname.includes("/chat-with-admin"),
  };

  return (
      <div
        className={`${raleway.className}
        overflow-x-hidden 
        [&::-webkit-scrollbar]:w-2
        [&::-webkit-scrollbar-track]:rounded-full
        [&::-webkit-scrollbar-track]:bg-[#161853]
        [&::-webkit-scrollbar-thumb]:rounded-full
        [&::-webkit-scrollbar-thumb]:bg-[#FAEDF0]`}
      >
        <div className="flex min-h-screen flex-col bg-[#F9F9F9]">
          {/* Top Navigation */}
          <nav className=" bg-[#F9F9F9] shadow-2xs pl-[8%] px-10 py-4 flex justify-between items-center fixed top-0 left-0 right-0 z-10">
            {/* Logo */}
            <div className="flex items-center">
              <a href={`/teacher/${id}`}>
                <Image
                  src="/logo.png"
                  alt="StreamLand Logo"
                  width={45}
                  height={45}
                />
              </a>
            </div>
            {/* Right Navigation */}
            <ul className="flex space-x-6 items-center">
              <li>
                <div className="flex gap-3">
                  <button onClick={() => setOpen(true)} className="bg-[#FAEDF0] text-black text-md font-semibold px-4 py-2 rounded-xl hover:bg-yellow-400">
                    + Schedule live stream
                  </button>
                  <ScheduleEventModal
                    open={open}
                    onClose={() => setOpen(false)}
                    onSave={handleSave}
                    teacherId={id}
                  />

                  <button className="bg-[#EC255A] text-white text-md font-semibold px-4 py-2 rounded-xl hover:bg-red-500">
                    + Start your live stream
                  </button>
                </div>
              </li>
              <li className="relative group">
                <a
                  href={`/teacher/${id}/search`}
                  className={`flex items-center ${
                    pathname === `/teacher/${id}/search`
                      ? "text-blue-500"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <Search className="mr-2 flex-shrink-0" />
                  <span className="absolute right-0 top-8 hidden group-hover:block bg-gray-800 text-white text-xs rounded py-1 px-2 transform translate-x-8">
                    Search
                  </span>
                </a>
              </li>
              <li className="relative group">
                <a
                  href={`/teacher/${id}/notifications`}
                  className={`flex items-center ${
                    pathname === `/teacher/${id}/notifications`
                      ? "text-blue-500"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <Bell className="mr-2 flex-shrink-0" />
                  <span className="absolute right-0 top-8 hidden group-hover:block bg-gray-800 text-white text-xs rounded py-1 px-2 transform translate-x-8">
                    Notifications
                  </span>
                </a>
              </li>
              <li>
                <AuthButton 
                  role="teacher" 
                  basePath={`/teacher/${id}`}
                />
              </li>
            </ul>
          </nav>

          <div className="flex flex-row flex-1 mt-16">
            {/* Shared Sidebar Component */}
            <Sidebar 
              userId={id}
              role="teacher"
              navItems={navItems}
              bottomNavItem={bottomNavItem}
              basePath={`/teacher/${id}`}
            />

            {/* Main Content */}
            <main className={`flex-1 ml-[7%] ${raleway.className}`}>
              {children}
            </main>
          </div>
        </div>
      </div>
  );
}
