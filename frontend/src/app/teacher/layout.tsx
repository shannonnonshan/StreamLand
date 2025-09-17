"use client";
import { raleway } from '@/utils/front';
import { usePathname } from 'next/navigation';
import "../../app/globals.css";
import Image from 'next/image';
import { ChartColumn, Search, Bell, User, FilePlay, CalendarDays, FileText, Settings, Radio, Headset } from "lucide-react";
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
    const navItems = [
    {
      href: "/teacher",
      label: "Dashboard",
      icon: ChartColumn,
    },
    {
      href: "/teacher/recordings",
      label: "Recordings",
      icon: FilePlay,
    },
    {
      href: "/teacher/calendar",
      label: "Schedule LiveStream",
      icon: CalendarDays,
    },
    {
      href: "/teacher/documents",
      label: "Documents",
      icon: FileText,
    },
    {
      href: "/teacher/livestream",
      label: "Start LiveStream",
      icon: Radio,
    },
    {
      href: "/teacher/settings",
      label: "Settings",
      icon: Settings,
    },
  ];
  return (
    <html lang="vi">
      <body className={raleway.className}>
        <div className="flex min-h-screen flex-col">
          {/* Top Navigation */}
          <nav className="bg-white border border-b-4 border-gray-400 shadow px-10 py-4 flex justify-between items-center fixed top-0 left-0 right-0 z-10">
            {/* Logo */}
            <div className="flex items-center">
              <a href="/teacher">
                <Image
                  src="/logo.png"
                  alt="StreamLand Logo"
                  width={45}
                  height={45}
                />
              </a>
            </div>
            {/* Right Navigation */}
            <ul className="flex space-x-6">
              <li className="relative group">
                <a
                  href="/teacher/search"
                  className={`flex items-center ${
                    pathname === '/teacher/search' ? 'text-blue-500' : 'text-gray-600 hover:text-gray-900'
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
                  href="/teacher/notifications"
                  className={`flex items-center ${
                    pathname === '/teacher/notifications' ? 'text-blue-500' : 'text-gray-600 hover:text-gray-900'
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
                  href="/teacher/profile"
                  className={`flex items-center ${
                    pathname === '/teacher/profile' ? 'text-blue-500' : 'text-gray-600 hover:text-gray-900'
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

          <div className="flex flex-1 mt-16">
            {/* Left Navigation */}
            <nav className="fixed top-16 bottom-0 pb-5 sm:w-1/8 w-1/6 bg-white border border-r-4 border-gray-400 text-gray-800 p-4 flex flex-col">
              <div className="hidden sm:flex flex-col items-center mb-2">
                <Image
                  src="/logo.png"
                  alt="StreamLand Logo"
                  width={55}
                  height={55}
                  className="my-2"
                />
                <h2 className="text-lg font-bold">Your Channel</h2>
                <span className="text-md">Doan Minh Khanh</span>
              </div>

              {/* Scroll area */}
              <div className="flex-1 h-[60%] overflow-y-auto overflow-x-hidden mt-2">
                <ul className="space-y-4">
                  {navItems.map(({ href, label, icon: Icon }) => (
                    <li key={href} className="relative group">
                      <a
                        href={href}
                        className={`relative flex items-center justify-center p-2 rounded w-fit mx-auto ${
                          pathname === href
                            ? "bg-[#FAEF5D] text-black"
                            : "text-black hover:bg-[#FAEF5D] hover:text-black"
                        }`}
                      >
                        <Icon className="w-6 h-6" />
                        {/* Tooltip */}
                        <span
                          className="absolute top-full -translate-y-1/2 ml-2 mt-3
                                    hidden group-hover:block bg-gray-800 text-white text-xs 
                                    rounded py-1 px-2 whitespace-nowrap z-50 shadow-lg"
                        >
                          {label}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Fixed bottom item */}
              <div className="mt-auto relative group">
                <a
                  href="/teacher/chat-with-admin"
                  className={`relative flex items-center justify-center p-2 rounded w-fit mx-auto ${
                    pathname === "/teacher/chat-with-admin"
                      ? "bg-[#FAEF5D] text-white"
                      : "text-black hover:bg-[#FAEF5D] hover:text-black"
                  }`}
                >
                  <Headset className="w-6 h-6" />
                  <span
                    className="absolute top-1/2 -translate-y-1/2 ml-2 mt-3
                              hidden group-hover:block bg-gray-800 text-white text-xs 
                              rounded py-1 px-2 whitespace-nowrap z-50 shadow-lg"
                  >
                    Chat with Admin
                  </span>
                </a>
              </div>
            </nav>


            {/* Main Content */}
            <main className="flex-1 ml-64 p-6 overflow-y-auto">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}