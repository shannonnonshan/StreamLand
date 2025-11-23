'use client';

import Header from '@/component/student/Headerbar';
import Sidebar from '@/component/Sidebar';
import { raleway } from '@/utils/front';
import { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChartColumn,
  MonitorPlay,
  Users,
  Mail,
  FileText,
  HelpCircle,
} from 'lucide-react';

const BackgroundColor = 'F0F2F9';

export default function MainLayout({ children }: { children: ReactNode }) {
  const router = useRouter();

  const navItems = [
    { type: "link" as const, href: "/dashboard", label: "Dashboard", icon: ChartColumn },
    { type: "link" as const, href: "/live-following", label: "Course", icon: MonitorPlay },
    { type: "link" as const, href: "/friends", label: "Friends", icon: Users },
    { type: "link" as const, href: "/message", label: "Inbox", icon: Mail },
    { type: "link" as const, href: "/documents", label: "Documents", icon: FileText },
  ];

  const bottomNavItem = {
    label: "Help",
    icon: HelpCircle,
    onClick: () => router.push("/student/help"),
    isActive: (pathname: string) => pathname.includes("/help"),
  };

  return (
    <div className={`${raleway.className} h-screen w-screen bg-[#${BackgroundColor}]`}>
      
      {/* Header - Fixed top */}
      <Header />
      
      {/* Sidebar - Fixed left below header */}
      <Sidebar 
        userId=""
        role="student"
        navItems={navItems}
        bottomNavItem={bottomNavItem}
        basePath="/student"
        belowHeader={true}
        headerHeight={64}
      />
      
      {/* Main content area */}
      <main className="fixed left-20 top-16 right-0 bottom-0 overflow-y-auto overflow-x-hidden">
        {children}
      </main>
      
    </div>
  );
}