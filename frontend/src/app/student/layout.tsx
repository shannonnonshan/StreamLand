import Header from '@/component/student/Headerbar';
import Sidebar from '@/component/student/Sidebar';
import { raleway } from '@/utils/front';
import { ReactNode } from 'react';

const BackgroundColor = 'F0F2F9';

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${raleway.className} h-screen w-screen bg-[#${BackgroundColor}]`}>
      
      {/* Header - Fixed top */}
      <Header />
      
      {/* Sidebar - Fixed left below header */}
      <Sidebar />
      
      {/* Main content area */}
      <main className="fixed left-20 top-16 right-0 bottom-0 overflow-y-auto overflow-x-hidden">
        {children}
      </main>
      
    </div>
  );
}