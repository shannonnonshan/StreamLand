"use client";

import { useRouter } from "next/navigation";
import {
  ChartColumn,
  FilePlay,
  CalendarDays,
  FileText,
  Settings,
  Radio,
  Headset,
} from "lucide-react";
import Sidebar, { NavItem, BottomNavItem } from "@/component/Sidebar";

interface TeacherSidebarProps {
  teacherId: string;
  onStartLiveClick: () => void;
}

export default function TeacherSidebar({
  teacherId,
  onStartLiveClick,
}: TeacherSidebarProps) {
  const router = useRouter();

  const navItems: NavItem[] = [
    { type: "link", href: "", label: "Dashboard", icon: ChartColumn },
    { type: "link", href: "/recordings", label: "Recordings", icon: FilePlay },
    {
      type: "link",
      href: "/calendar",
      label: "Schedule LiveStream",
      icon: CalendarDays,
    },
    {
      type: "link",
      href: "/documents/file",
      label: "Documents",
      icon: FileText,
    },
    {
      type: "button",
      label: "Start LiveStream",
      icon: Radio,
      onClick: onStartLiveClick,
    },
    { type: "link", href: "/settings", label: "Settings", icon: Settings },
  ];

  const bottomNavItem: BottomNavItem = {
    label: "Chat with Admin",
    icon: Headset,
    onClick: () => router.push(`/teacher/${teacherId}/chat-with-admin`),
    isActive: (pathname) => pathname.includes("/chat-with-admin"),
  };

  return (
    <Sidebar
      userId={teacherId}
      role="teacher"
      navItems={navItems}
      bottomNavItem={bottomNavItem}
    />
  );
}
