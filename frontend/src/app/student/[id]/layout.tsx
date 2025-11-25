'use client';

import Header from '@/component/student/Headerbar';
import Sidebar from '@/component/Sidebar';
import { raleway } from '@/utils/front';
import { ReactNode, useState, useEffect, use } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getStudentId } from '@/utils/student';
import { useAuth } from '@/hooks/useAuth';
import toast, { Toaster } from 'react-hot-toast';
import {
  ChartColumn,
  MonitorPlay,
  Users,
  Mail,
  FileText,
  HelpCircle,
} from 'lucide-react';

const BackgroundColor = 'F0F2F9';

export default function MainLayout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
  const { id: paramId } = use(params);
  
  // Update studentId and handle redirects based on authentication
  useEffect(() => {
    const id = getStudentId();
    
    // Redirect from guest to actual user ID after login
    if (isAuthenticated && paramId === 'guest' && id !== 'guest') {
      const currentPath = window.location.pathname.replace(`/student/guest`, '');
      router.replace(`/student/${id}${currentPath || '/dashboard'}`);
    }
    
    // Block guest access to protected pages (only allow dashboard)
    if (!isAuthenticated && paramId === 'guest' && !pathname.includes('/dashboard')) {
      toast((t) => (
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="font-semibold text-white">Sign in required</p>
            <p className="text-sm text-blue-100 mt-0.5">Please sign in to access this feature</p>
          </div>
          <button
            onClick={() => toast.dismiss(t.id)}
            className="flex-shrink-0 text-white/80 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ), {
        duration: 4000,
        position: 'top-center',
        style: {
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: '#fff',
          padding: '16px 20px',
          borderRadius: '12px',
          boxShadow: '0 10px 40px rgba(102, 126, 234, 0.4)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          minWidth: '320px',
        },
      });
      router.replace('/student/guest/dashboard');
    }
  }, [isAuthenticated, paramId, pathname, router]);

  const navItems = [
    { type: "link" as const, href: "/dashboard", label: "Dashboard", icon: ChartColumn },
    { 
      type: "link" as const, 
      href: "/live-following",
      label: "Course", 
      icon: MonitorPlay 
    },
    { 
      type: "link" as const, 
      href: "/friends",
      label: "Friends", 
      icon: Users 
    },
    { 
      type: "link" as const, 
      href: "/message",
      label: "Inbox", 
      icon: Mail 
    },
    { 
      type: "link" as const, 
      href: "/documents",
      label: "Documents", 
      icon: FileText 
    },
  ];

  const bottomNavItem = {
    label: "Help",
    icon: HelpCircle,
    onClick: () => {
      if (!isAuthenticated && paramId === 'guest') {
        toast((t) => (
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-white">Sign in required</p>
              <p className="text-sm text-blue-100 mt-0.5">Please sign in to access this feature</p>
            </div>
            <button
              onClick={() => toast.dismiss(t.id)}
              className="flex-shrink-0 text-white/80 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ), {
          duration: 4000,
          position: 'top-center',
          style: {
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: '#fff',
            padding: '16px 20px',
            borderRadius: '12px',
            boxShadow: '0 10px 40px rgba(102, 126, 234, 0.4)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(10px)',
            minWidth: '320px',
          },
        });
        return;
      }
      router.push(`/student/${paramId}/help`);
    },
    isActive: (pathname: string) => pathname.includes("/help"),
  };

  const handleSidebarNavigation = (href: string): boolean => {
    // Allow dashboard for guest users
    if (href.includes('/dashboard')) {
      return true;
    }
    
    // Block navigation for guest users to protected routes
    if (!isAuthenticated && paramId === 'guest') {
      toast((t) => (
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="font-semibold text-white">Sign in required</p>
            <p className="text-sm text-blue-100 mt-0.5">Please sign in to access this feature</p>
          </div>
          <button
            onClick={() => toast.dismiss(t.id)}
            className="flex-shrink-0 text-white/80 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ), {
        duration: 4000,
        position: 'top-center',
        style: {
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: '#fff',
          padding: '16px 20px',
          borderRadius: '12px',
          boxShadow: '0 10px 40px rgba(102, 126, 234, 0.4)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          minWidth: '320px',
        },
      });
      return false;
    }
    
    return true;
  };

  return (
    <div className={`${raleway.className} h-screen w-screen bg-[#${BackgroundColor}]`}>
      <Toaster />
      
      {/* Header - Fixed top */}
      <Header />
      
      {/* Sidebar - Fixed left below header */}
      <Sidebar 
        userId=""
        role="student"
        navItems={navItems}
        bottomNavItem={bottomNavItem}
        basePath={`/student/${paramId}`}
        belowHeader={true}
        headerHeight={64}
        onNavigate={handleSidebarNavigation}
      />
      
      {/* Main content area */}
      <main className="fixed left-20 top-16 right-0 bottom-0 overflow-y-auto overflow-x-hidden">
        {children}
      </main>
      
    </div>
  );
}
