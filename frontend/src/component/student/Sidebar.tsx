'use client';

import { ChartBarIcon, ComputerDesktopIcon, EnvelopeIcon, DocumentTextIcon, QuestionMarkCircleIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { name: 'Dashboard', icon: ChartBarIcon, href: '/student/dashboard' },
  { name: 'Course', icon: ComputerDesktopIcon, href: '/student/live-following' },
  { name: 'Friends', icon: UserGroupIcon, href: '/student/friends' },
  { name: 'Inbox', icon: EnvelopeIcon, href: '/student/message' },
  { name: 'Documents', icon: DocumentTextIcon, href: '/student/documents' },
];

const PrimaryColor = '161853'; 

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <div className={`fixed left-0 top-16 h-[calc(100vh-64px)] w-20 bg-white shadow-xl flex flex-col items-center py-6 border-r border-gray-100 z-30`}>
      
      {/* Navigation items */}
      <nav className="flex flex-col items-center space-y-6 flex-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`relative p-3 rounded-xl transition-all duration-200 ease-in-out group ${
                isActive 
                  ? `bg-[#${PrimaryColor}] text-white shadow-lg scale-110` 
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700 hover:scale-105'
              }`}
            >
              <item.icon className="h-6 w-6" />
              
              {/* Active indicator bar */}
              {isActive && (
                <div 
                  className={`absolute -left-5 top-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-[#${PrimaryColor}] shadow-md animate-pulse`} 
                />
              )}
              
              {/* Glow effect when active */}
              {isActive && (
                <div className={`absolute inset-0 bg-[#${PrimaryColor}] opacity-20 blur-xl rounded-xl -z-10`} />
              )}
              
              {/* Tooltip */}
              <span className={`absolute left-full ml-4 top-1/2 -translate-y-1/2 hidden group-hover:block px-3 py-2 text-white text-xs rounded-lg whitespace-nowrap z-50 shadow-lg font-medium ${
                isActive ? 'bg-gray-800' : 'bg-gray-700'
              }`}>
                {item.name}
                {isActive && <span className="ml-2">•</span>}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Help icon at bottom */}
      <div className="mt-auto">
        <a 
          href="#" 
          className="p-2 rounded-xl text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition duration-200"
        >
          <QuestionMarkCircleIcon className="h-6 w-6" />
        </a>
      </div>
    </div>
  );
}