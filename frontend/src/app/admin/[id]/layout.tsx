"use client";
import { raleway } from "@/utils/front";
import { usePathname, useRouter, useParams } from "next/navigation";
import "../../globals.css";
import Image from "next/image";
import {
  Search,
  Bell,
  User,
  Headset,
  LayoutDashboard,
  Flag,
  Users,
  ListFilter,
} from "lucide-react";
import { ReactNode } from "react";
import { v4 as uuidv4 } from "uuid";
import { useState } from "react";
import HoverTooltip from "@/component/HoverTooltip";

export default function RootLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams();
  const accountId =
    typeof window !== "undefined" ? localStorage.getItem("accountId") : null;
  const id = (params?.id as string) || accountId || "1"; // fallback id = 1


    // Trong navItems, thay href của Start LiveStream thành null
  const navItems = [
    { type: "link", href: "", label: "Dashboard", icon: LayoutDashboard },
    { type: "link", href: "/manage-account", label: "Manage Account", icon: Users },
    { type: "link", href: "/manage-report", label: "Manage Report", icon: Flag  },
    { type: "link", href: "/moderate-content", label: "Moderate Contents", icon: ListFilter },
    { type: "link", href: "/manage-notification", label: "Manage Notification", icon: Bell },
  ];

  const handleChatClick = () => {
    
    router.push(`/admin/${id}/chat`);
  };

  return (
    <html lang="vi">
      <body
        className={`${raleway.className}
        [&::-webkit-scrollbar]:w-2
        [&::-webkit-scrollbar-track]:rounded-full
        [&::-webkit-scrollbar-track]:bg-[#161853]
        [&::-webkit-scrollbar-thumb]:rounded-full
        [&::-webkit-scrollbar-thumb]:bg-[#FAEDF0]`}
      >
        <div className="flex min-h-screen flex-col bg-[#FAEDF0]">
          {/* Top Navigation */}
          <nav className="bg-[#FAEDF0] pr-10 py-4 flex justify-between items-center fixed top-0 left-0 right-0 z-10">
            {/* Logo */}
            <div className="flex pl-[3%] items-center">
              <a href={`/admin/${id}`}>
                <Image
                  src="/logo_transparent.png"
                  alt="StreamLand Logo"
                  width={60}
                  height={60}
                />
              </a>
            </div>
            {/* Right Navigation */}
            <ul className="flex space-x-6 items-center">
              <li className="relative group">
                <a
                  href={`/admin/${id}/search`}
                  className={`flex items-center ${
                    pathname === `/admin/${id}/search`
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
                  href={`/admin/${id}/notifications`}
                  className={`flex items-center ${
                    pathname === `/admin/${id}/notifications`
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
                  href={`/admin/${id}/profile`}
                  className={`flex items-center ${
                    pathname === `/admin/${id}/profile`
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
            <nav className="fixed top-1/3 -translate-y-1/4 bottom-0 pb-5 px-4 ml-[2%] shadow rounded-2xl bg-white text-gray-800  flex flex-col">
              {/* Scroll area */}
              <div
                  className="flex-1 overflow-y-auto
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
                        fullHref = href === "" ? `/admin/${id}` : `/admin/${id}${href}`;
                      }

                      const isDashboard = type === "link" && href === "" && pathname === `/admin/${id}`;
                      const isNormalLink = type === "link" && href && pathname.startsWith(fullHref!);
                      const isActive = isDashboard || isNormalLink;

                      const commonClass = `
                        relative flex items-center justify-center p-2 rounded-2xl w-fit mx-auto group
                        ${isActive
                          ? "bg-[#292C6D] text-white"
                          : "text-gray-500 hover:bg-[#292C6D] hover:text-white"}
                      `;

                      return (
                        <li key={label} className="relative group">
                            <a href={fullHref!} className={commonClass}>
                            <HoverTooltip label={label}>
                              <Icon className="w-6 h-6" />
                            </HoverTooltip>
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </div>


              {/* Fixed bottom item */}
              <div className="mt-auto relative group">
                <button
                  onClick={handleChatClick}
                  className={`relative flex items-center justify-center p-2 rounded-2xl w-fit mx-auto ${
                    pathname.includes("/chat")
                      ? "bg-[#292C6D] text-white"
                      : "text-gray-500 hover:bg-[#292C6D] hover:text-white"
                  }`}
                >
                  <HoverTooltip label={"Support Users"}>
                    <Headset className="w-6 h-6" />
                  </HoverTooltip>
                </button>
              </div>
            </nav>

            {/* Main Content */}
            <main className={`flex-1 ml-[9%] pt-5 ${raleway.className}`}>
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
