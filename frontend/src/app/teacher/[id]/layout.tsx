"use client";
import { raleway } from "@/utils/front";
import { usePathname, useRouter, useParams } from "next/navigation";
import "../../globals.css";
import Image from "next/image";
import {
  ChartColumn,
  Search,
  Bell,
  FilePlay,
  CalendarDays,
  FileText,
  Settings as SettingsIcon,
  Radio,
  Headset,
  ArrowUp,
} from "lucide-react";
import { ReactNode, useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import ScheduleEventModal from "@/component/teacher/calendar/ScheduleEventModal";
import Sidebar from "@/component/Sidebar";
import AuthButton from "@/component/AuthButton";
import { useAuth } from "@/hooks/useAuth";
import LoginModal from "@/component/(modal)/login";
import RegisterModal from "@/component/(modal)/register";
import ForgotPasswordModal from "@/component/(modal)/forgotPassword";
import OTPModal from "@/component/(modal)/verifyOtp";
import StartLivestreamModal, { LivestreamData } from "@/component/teacher/StartLivestreamModal";
import NotificationBell from "@/component/NotificationBell";
import { NotificationProvider } from '@/contexts/NotificationContext';

export default function RootLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams();
  const [open, setOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [otpEmail, setOtpEmail] = useState('');
  const [otpPurpose, setOtpPurpose] = useState<'registration' | 'password-reset'>('registration');
  const [authCheckDone, setAuthCheckDone] = useState(false);
  const [showStartLiveModal, setShowStartLiveModal] = useState(false);
  const [pendingLivestreamId, setPendingLivestreamId] = useState<string | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const { user, isAuthenticated, loading } = useAuth();

  // Scroll to top button
  useEffect(() => {
    const handleScroll = () => {
      const scrollPercentage = (window.scrollY / document.documentElement.scrollHeight) * 100;
      setShowScrollTop(scrollPercentage > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Check authentication and role
  useEffect(() => {
    if (!loading) {
      const routeId = (params?.id as string);
      
      if (!isAuthenticated) {
        // Not logged in - show login modal
        setShowLoginModal(true);
        setAuthCheckDone(true);
      } else if (user?.role !== 'TEACHER') {
        // Wrong role - logout and redirect to correct dashboard
        setIsRedirecting(true);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        
        if (user?.role === 'ADMIN') {
          router.push(`/admin/${user.id}`);
        } else if (user?.role === 'STUDENT') {
          router.push(`/student/${user.id}`);
        } else {
          // Unknown role - show login
          setShowLoginModal(true);
          setAuthCheckDone(true);
        }
      } else if (routeId && user?.id && routeId !== user.id) {
        // ID in URL doesn't match authenticated user - redirect to correct URL
        setIsRedirecting(true);
        router.replace(`/teacher/${user.id}${pathname.replace(`/teacher/${routeId}`, '')}`);
        setAuthCheckDone(true);
      } else {
        // Correct role and ID - allow access
        setShowLoginModal(false);
        setAuthCheckDone(true);
      }
    }
  }, [loading, isAuthenticated, user, router, params?.id, pathname]);

  const id = user?.id || (params?.id as string) || "1"; // Use authenticated user's ID

  const handleStartLiveClick = () => {
      const livestreamID = uuidv4();
      setPendingLivestreamId(livestreamID);
      setShowStartLiveModal(true);
  };

  const handleLivestreamSubmit = async (data: LivestreamData) => {
    if (!pendingLivestreamId) return;

    try {
      // Get token from localStorage (check both 'token' and 'accessToken')
      const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      
      if (!token) {
        throw new Error('No authentication token found. Please login again.');
      }

      if (!user?.id) {
        throw new Error('User information not found. Please login again.');
      }

      // Verify token is not expired
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const expirationTime = payload.exp * 1000;
        const currentTime = Date.now();
        
        if (currentTime >= expirationTime) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
          throw new Error('Your session has expired. Please login again.');
        }
      } catch (e) {
        if (e instanceof Error && e.message.includes('expired')) {
          throw e;
        }
        throw new Error('Invalid authentication token. Please login again.');
      }

      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const response = await fetch(`${API_URL}/livestream/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: pendingLivestreamId,
          teacherId: user?.id, // MUST use user.id from JWT - not route param
          title: data.title,
          description: data.description,
          category: data.category,
          isPublic: data.isPublic,
          allowComments: data.allowComments,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to create livestream' }));
        if (response.status === 401) {
          throw new Error('Authentication failed. Please log in again.');
        }
        throw new Error(errorData.message || `Failed to create livestream (${response.status})`);
      }

      const livestreamData = await response.json();

      // Close modal immediately for better UX
      setShowStartLiveModal(false);
      
      // Navigate with data to avoid refetching
      setIsRedirecting(true);
      router.push(`/teacher/${id}/livestream/${pendingLivestreamId}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to create livestream');
      throw error; // Re-throw to keep modal in loading state
    }
  };
  
  const handleSave = () => {
    // Schedule event saved
  };
  
  const navItems = [
    { type: "link" as const, href: "", label: "Dashboard", icon: ChartColumn },
    { type: "link" as const, href: "/recordings", label: "Recordings", icon: FilePlay },
    { type: "link" as const, href: "/calendar", label: "Schedule LiveStream", icon: CalendarDays },
    { type: "link" as const, href: "/documents/file", label: "Documents", icon: FileText },
    { type: "button" as const, label: "Start LiveStream", icon: Radio, onClick: handleStartLiveClick },
    { type: "link" as const, href: "/settings", label: "Settings", icon: SettingsIcon },
  ];

  const handleChatClick = () => {
    setIsRedirecting(true);
    router.push(`/teacher/${id}/chat-with-admin`);
  };

  const bottomNavItem = {
    label: "Chat with Admin",
    icon: Headset,
    onClick: handleChatClick,
    isActive: (pathname: string) => pathname.includes("/chat-with-admin"),
  };

  // Show loading state while checking auth or redirecting
  if (loading || !authCheckDone || isRedirecting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F9F9F9]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#EC255A] mx-auto mb-4"></div>
          <p className="text-gray-600">{isRedirecting ? 'Redirecting...' : 'Loading...'}</p>
        </div>
      </div>
    );
  }

  // If not authenticated or wrong role, show modal overlay
  if (showLoginModal || showRegisterModal || showForgotPasswordModal || showOTPModal) {
    return (
      <>
        <div className="flex min-h-screen items-center justify-center bg-[#F9F9F9]">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Teacher Access Required</h2>
            <p className="text-gray-600">Please login with a TEACHER account to access this page</p>
          </div>
        </div>
        
        {/* All modals rendered separately with proper z-index */}
        <LoginModal
          isOpen={showLoginModal && !showRegisterModal && !showForgotPasswordModal && !showOTPModal}
          closeModal={() => {
            // Prevent closing - must login
          }}
          openRegisterModal={() => {
            setShowLoginModal(false);
            setShowRegisterModal(true);
          }}
          openForgotPasswordModal={() => {
            setShowLoginModal(false);
            setShowForgotPasswordModal(true);
          }}
        />
        
        <RegisterModal
          isOpen={showRegisterModal}
          closeModal={() => {
            setShowRegisterModal(false);
            setShowLoginModal(true);
          }}
          openOTPModal={(email?: string, purpose?: 'registration' | 'password-reset') => {
            setOtpEmail(email || '');
            setOtpPurpose(purpose || 'registration');
            setShowRegisterModal(false);
            setShowOTPModal(true);
          }}
          openLoginModal={() => {
            setShowRegisterModal(false);
            setShowLoginModal(true);
          }}
        />
        
        <ForgotPasswordModal
          isOpen={showForgotPasswordModal}
          closeModal={() => {
            setShowForgotPasswordModal(false);
            setShowLoginModal(true);
          }}
          openOTPModal={(email?: string) => {
            setOtpEmail(email || '');
            setOtpPurpose('password-reset');
            setShowForgotPasswordModal(false);
            setShowOTPModal(true);
          }}
          openLoginModal={() => {
            setShowForgotPasswordModal(false);
            setShowLoginModal(true);
          }}
        />
        
        <OTPModal
          isOpen={showOTPModal}
          closeModal={() => {
            setShowOTPModal(false);
            if (otpPurpose === 'registration') {
              setShowLoginModal(true);
            } else {
              setShowLoginModal(true);
            }
          }}
          email={otpEmail}
          otpPurpose={otpPurpose}
        />
      </>
    );
  }

  // Render StartLivestreamModal separately (available for authenticated teachers)
  const renderStartLiveModal = () => (
    <StartLivestreamModal
      isOpen={showStartLiveModal}
      closeModal={() => {
        setShowStartLiveModal(false);
        setPendingLivestreamId(null);
      }}
      onStartLivestream={handleLivestreamSubmit}
      teacherId={id}
    />
  );

  return (
    <NotificationProvider userId={user?.id || null}>
      <>
        {/* Start Livestream Modal */}
        {renderStartLiveModal()}

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
          <nav className=" bg-[#F9F9F9] shadow-2xs pl-[8%] px-10 py-4 flex justify-between items-center">
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

                  <button onClick={handleStartLiveClick} className="bg-[#EC255A] text-white text-md font-semibold px-4 py-2 rounded-xl hover:bg-red-500">
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
              <li>
                <NotificationBell />
              </li>
              <li>
                <AuthButton 
                  role="teacher" 
                  basePath={`/teacher/${id}`}
                />
              </li>
            </ul>
          </nav>

          <div className="flex flex-row flex-1">
            {/* Shared Sidebar Component */}
            <Sidebar 
              userId={id}
              role="teacher"
              navItems={navItems}
              bottomNavItem={bottomNavItem}
              basePath={`/teacher/${id}`}
            />

            {/* Main Content */}
            <main className={`flex-1 ml-[7%] ${raleway.className}`}>
              {children}
            </main>
          </div>

          {/* Scroll to Top Button */}
          {showScrollTop && (
            <button
              onClick={scrollToTop}
              className="fixed bottom-8 right-8 bg-[#EC255A] text-white p-3 rounded-full shadow-lg hover:bg-red-600 transition-all duration-300 z-50"
              aria-label="Scroll to top"
            >
              <ArrowUp size={24} />
            </button>
          )}
        </div>
        </div>
      </>
    </NotificationProvider>
  );
}
