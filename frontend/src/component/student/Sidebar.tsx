// components/Sidebar.jsx
import { ChartBarIcon, ComputerDesktopIcon, EnvelopeIcon, DocumentTextIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';

const navItems = [
  { name: 'Dashboard', icon: ChartBarIcon, href: '/student/dashboard', active: true },
  { name: 'Course', icon: ComputerDesktopIcon, href: '/student/live-following', active: false },
  { name: 'Inbox', icon: EnvelopeIcon, href: '/student/message', active: false },
  { name: 'Documents', icon: DocumentTextIcon, href: '/student/documents', active: false },
];

const PrimaryColor = '161853'; 

export default function Sidebar() {
  return (
    <div className={`fixed left-0 top-0 h-full w-20 bg-white shadow-xl flex flex-col items-center py-6 border-r border-gray-100 z-30`}>
      
      {/* Logo */}
      <div className="mb-10 flex flex-col items-center">
        {/* Logo Streamland từ thư mục public */}
        <Image 
          src="/logo.png" 
          alt="StreamLand Logo" 
          width={32} 
          height={32} 
          className="h-8 w-auto"
        />
      </div>

      {/* Nav Items */}
      <nav className="flex flex-col items-center space-y-6">
        {navItems.map((item) => (
          <a
            key={item.name}
            href={item.href}
            className={`relative p-2 rounded-xl transition duration-200 ease-in-out group ${
              item.active 
                ? `bg-gray-100 text-[#${PrimaryColor}]` 
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
            }`}
          >
            <item.icon className="h-6 w-6" />
            
            {/* Thanh màu Active bên trái (như trong hình) */}
            {item.active && (
              <div 
                className={`absolute -left-5 top-1/2 -translate-y-1/2 w-1.5 h-10 rounded-full bg-[#${PrimaryColor}]`} 
              />
            )}
            
            {/* Tooltip (ẩn) */}
            <span className="absolute left-full ml-4 top-1/2 -translate-y-1/2 hidden group-hover:block px-3 py-1 bg-gray-800 text-white text-xs rounded-lg whitespace-nowrap z-50">
              {item.name}
            </span>
          </a>
        ))}
      </nav>

      {/* Help Icon (Dưới cùng) */}
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