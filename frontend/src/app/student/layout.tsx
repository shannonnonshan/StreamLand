'use client';

import Header from '@/component/student/Headerbar';
import Sidebar from '@/component/Sidebar';
import { raleway } from '@/utils/front';
import { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChartBarIcon,
  ComputerDesktopIcon,
  EnvelopeIcon,
  DocumentTextIcon,
  QuestionMarkCircleIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { LucideIcon } from 'lucide-react';

const BackgroundColor = 'F0F2F9';

// Wrapper để convert Heroicons sang Lucide format
const createIconWrapper = (HeroIcon: React.ComponentType<{ className?: string }>): LucideIcon => {
  const IconWrapper = ({ className }: { className?: string }) => (
    <HeroIcon className={className} />
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return IconWrapper as any;
};

export default function MainLayout({ children }: { children: ReactNode }) {
  const router = useRouter();

  const navItems = [
    { type: "link" as const, href: "/dashboard", label: "Dashboard", icon: createIconWrapper(ChartBarIcon) },
    { type: "link" as const, href: "/live-following", label: "Course", icon: createIconWrapper(ComputerDesktopIcon) },
    { type: "link" as const, href: "/friends", label: "Friends", icon: createIconWrapper(UserGroupIcon) },
    { type: "link" as const, href: "/message", label: "Inbox", icon: createIconWrapper(EnvelopeIcon) },
    { type: "link" as const, href: "/documents", label: "Documents", icon: createIconWrapper(DocumentTextIcon) },
  ];

  const bottomNavItem = {
    label: "Help",
    icon: createIconWrapper(QuestionMarkCircleIcon),
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