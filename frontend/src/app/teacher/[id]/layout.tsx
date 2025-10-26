"use client";
import { raleway } from "@/utils/front";
import { usePathname, useRouter, useParams } from "next/navigation";
import "../../globals.css";
import Image from "next/image";
import {
  ChartColumn,
  Search,
  Bell,
  User,
  FilePlay,
  CalendarDays,
  FileText,
  Settings,
  Radio,
  Headset,
} from "lucide-react";
import { ReactNode } from "react";
import { v4 as uuidv4 } from "uuid";
import { useState } from "react";
import HoverTooltip from "@/component/HoverTooltip";
import ScheduleEventModal, { ScheduleEvent } from "@/component/teacher/calendar/ScheduleEventModal";

export default function RootLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams();
  const [isLiveModalOpen, setIsLiveModalOpen] = useState(false);
  const [open, setOpen] = useState(false);

  const accountId =
    typeof window !== "undefined" ? localStorage.getItem("accountId") : null;
  const id = (params?.id as string) || accountId || "1"; // fallback id = 1

  const handleStartLiveClick = () => {
      const livestreamID = uuidv4();
      setIsLiveModalOpen(true);
      router.push(`/teacher/${id}/livestream/${livestreamID}`);
  };
  const handleSave = (event: ScheduleEvent) => {
    console.log("New scheduled event:", event);
  };
  const navItems = [
    { type: "link", href: "", label: "Dashboard", icon: ChartColumn },
    { type: "link", href: "/recordings", label: "Recordings", icon: FilePlay },
    { type: "link", href: "/calendar", label: "Schedule LiveStream", icon: CalendarDays },
    { type: "link", href: "/documents/file", label: "Documents", icon: FileText },
    { type: "button", label: "Start LiveStream", icon: Radio },
    { type: "link", href: "/settings", label: "Settings", icon: Settings },
  ];

  const handleChatClick = () => {
    
    router.push(`/teacher/${id}/chat-with-admin`);
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
              <li className="relative group">
                <a
                  href={`/teacher/${id}/profile`}
                  className={`flex items-center ${
                    pathname === `/teacher/${id}/profile`
                      ? "text-blue-500"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <User className="mr-2 flex-shrink-0" />
                  <span className="absolute right-0 top-8 hidden group-hover:block bg-gray-800 text-white text-xs rounded py-1 px-2 transform translate-x-8">
                    Account
                  </span>
                </a>
              </li>
            </ul>
          </nav>

          <div className="flex flex-row flex-1 mt-16">
            {/* Left Navigation */}
            <nav className=" fixed left-0 top-1/2 -translate-y-1/2 
              w-[70px] h-auto
              flex flex-col items-center justify-between
              bg-gradient-to-b from-[#161853] to-[#292C6D]
              rounded-r-3xl shadow-lg py-6">
              {/* Scroll area */}
              <div
                  className="flex-1 h-[60%] overflow-y-auto
                  [&::-webkit-scrollbar]:w-2
                  [&::-webkit-scrollbar-track]:rounded-full
                  [&::-webkit-scrollbar-track]:bg-[#161853]
                  [&::-webkit-scrollbar-thumb]:rounded-full
                  [&::-webkit-scrollbar-thumb]:bg-[#FAEDF0] overflow-x-hidden mt-5"
                >
                  <ul className="space-y-4">
                    {navItems.map(({ type, href, label, icon: Icon }) => {
                      let fullHref: string | null = null;
                      if (type === "link") {
                        fullHref = href === "" ? `/teacher/${id}` : `/teacher/${id}${href}`;
                      }

                      const isDashboard = type === "link" && href === "" && pathname === `/teacher/${id}`;
                      let isNormalLink = false;
                      if (type === "link" && href) {
                        if (href.startsWith("/documents")) {
                          isNormalLink = pathname.startsWith(`/teacher/${id}/documents`);
                        } else {
                          isNormalLink = pathname.startsWith(fullHref!);
                        }
                      }
                      const isLiveStream = type === "button" && pathname.startsWith(`/teacher/${id}/livestream`);
                      const isActive = isDashboard || isNormalLink || isLiveStream;

                      const commonClass = `
                        relative flex items-center justify-center p-2 rounded w-fit mx-auto group
                        ${isActive
                          ? "bg-[#FAEF5D] text-black"
                          : "text-white hover:bg-[#FAEF5D] hover:text-black"}
                      `;

                      return (
                        <li key={label} className="relative group">
                          {type === "link" ? (
                            <a href={fullHref!} className={commonClass}>
                              <HoverTooltip label={label}>
                                <Icon className="w-6 h-6 font-medium" />
                              </HoverTooltip>
                            </a>
                          ) : (
                            <button onClick={handleStartLiveClick} className={commonClass}>
                              <HoverTooltip label={label}>
                                <Icon className="w-6 h-6" />
                              </HoverTooltip>
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>


              {/* Fixed bottom item */}
              <div className="mt-4 relative group">
                <button
                  onClick={handleChatClick}
                  className={`relative flex items-center justify-center p-2 rounded w-fit mx-auto ${
                    pathname.includes("/chat-with-admin")
                      ? "bg-[#FAEF5D] text-black"
                      : "text-white hover:bg-[#FAEF5D] hover:text-black"
                  }`}
                >
                 
                  <HoverTooltip label={"Chat with Admin"}>
                     <Headset className="w-6 h-6" />
                  </HoverTooltip>
                </button>
              </div>
            </nav>

            {/* Main Content */}
            <main className={`flex-1 ml-[7%] pt-5 ${raleway.className}`}>
              {children}
            </main>
          </div>
        </div>
      </div>
  );
}
