"use client";
import { raleway } from "@/utils/front";
import { usePathname, useRouter, useParams } from "next/navigation";
import "../../globals.css";
import Image from "next/image";
import {
  Search,
  Bell,
  Headset,
  LayoutDashboard,
  Flag,
  Users,
  ListFilter,
  X,
} from "lucide-react";
import { ReactNode, useState, useEffect } from "react";
import HoverTooltip from "@/component/HoverTooltip";
import SearchModal from "@/component/admin/SearchModal";
import AuthButton from "@/component/AuthButton";
import { useAuth } from "@/hooks/useAuth";
import LoginModal from "@/component/(modal)/login";
import RegisterModal from "@/component/(modal)/register";
import ForgotPasswordModal from "@/component/(modal)/forgotPassword";
import OTPModal from "@/component/(modal)/verifyOtp";

export default function RootLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [otpEmail, setOtpEmail] = useState('');
  const [otpPurpose, setOtpPurpose] = useState<'registration' | 'password-reset'>('registration');
  const [authCheckDone, setAuthCheckDone] = useState(false);
  const { user, isAuthenticated, loading } = useAuth();

  // Check authentication and role
  useEffect(() => {
    if (!loading) {
      const routeId = (params?.id as string);
      
      if (!isAuthenticated) {
        // Not logged in - show login modal
        setShowLoginModal(true);
        setAuthCheckDone(true);
      } else if (user?.role !== 'ADMIN') {
        // Wrong role - redirect to correct dashboard
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        
        if (user?.role === 'TEACHER') {
          router.push(`/teacher/${user.id}`);
        } else if (user?.role === 'STUDENT') {
          router.push(`/student/${user.id}`);
        } else {
          // Unknown role - show login
          setShowLoginModal(true);
          setAuthCheckDone(true);
        }
      } else if (routeId && user?.id && routeId !== user.id) {
        // ID in URL doesn't match authenticated user - redirect to correct URL
        router.replace(`/admin/${user.id}${pathname.replace(`/admin/${routeId}`, '')}`);
        setAuthCheckDone(true);
      } else {
        // Correct role and ID - allow access
        setShowLoginModal(false);
        setAuthCheckDone(true);
      }
    }
  }, [loading, isAuthenticated, user, router, params?.id, pathname]);

  const id = user?.id || (params?.id as string) || "1"; // Use authenticated user's ID

  // Mock notifications data
  const notifications = [
    {
      id: 1,
      type: 'report',
      title: 'New Content Report',
      message: 'A new content has been reported for review',
      time: '5 minutes ago',
      isRead: false
    },
    {
      id: 2,
      type: 'user',
      title: 'New User Registration',
      message: 'A new teacher has registered and needs approval',
      time: '1 hour ago',
      isRead: false
    },
    {
      id: 3,
      type: 'system',
      title: 'System Update',
      message: 'System maintenance scheduled for tonight',
      time: '2 hours ago',
      isRead: false
    }
  ];

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

  // Show loading state while checking auth
  if (loading || !authCheckDone) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAEDF0]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#EC255A] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If not authenticated or wrong role, show modal overlay
  if (showLoginModal || showRegisterModal || showForgotPasswordModal || showOTPModal) {
    return (
      <>
        <div className="flex min-h-screen items-center justify-center bg-[#FAEDF0]">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Admin Access Required</h2>
            <p className="text-gray-600">Please login with an ADMIN account to access this page</p>
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
          openOTPModal={(email: string, purpose: 'registration' | 'password-reset') => {
            setOtpEmail(email);
            setOtpPurpose(purpose);
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
          openOTPModal={(email: string) => {
            setOtpEmail(email);
            setOtpPurpose('password-reset');
            setShowForgotPasswordModal(false);
            setShowOTPModal(true);
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

  return (
    <div
        className={`${raleway.className}
        [&::-webkit-scrollbar]:w-2
        [&::-webkit-scrollbar-track]:rounded-full
        [&::-webkit-scrollbar-track]:bg-[#161853]
        [&::-webkit-scrollbar-thumb]:rounded-full
        [&::-webkit-scrollbar-thumb]:bg-[#FAEDF0]`}
      >
        <div className="flex min-h-screen flex-col bg-[#FAEDF0]">
          {/* Top Navigation */}
          <nav className="bg-[#FAEDF0] pr-10 py-4 flex justify-end items-center w-full">
            {/* Right Navigation */}
            <ul className="flex space-x-6 items-center">
              <li className="relative group">
                <button
                  onClick={() => setIsSearchOpen(true)}
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
                </button>
                <SearchModal
                  isOpen={isSearchOpen}
                  onClose={() => setIsSearchOpen(false)}
                  pathname={pathname}
                />
              </li>
              <li className="relative group">
                <button
                  onClick={() => setShowNotifications(true)}
                  className={`flex items-center ${
                    pathname === `/admin/${id}/notifications`
                      ? "text-blue-500"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <div className="relative">
                    <Bell className="mr-2 flex-shrink-0" />
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                      3
                    </span>
                  </div>
                  <span className="absolute right-0 top-8 hidden group-hover:block bg-gray-800 text-white text-xs rounded py-1 px-2 transform translate-x-8">
                    Notifications
                  </span>
                </button>
              </li>
              <li>
                <AuthButton 
                  role="admin" 
                  basePath={`/admin/${id}`}
                />
              </li>
            </ul>
          </nav>

          <div className="flex flex-row flex-1">
            {/* Left Navigation */}
            <nav className="fixed left-0 top-0 bottom-0 w-20 flex flex-col items-center py-6 bg-white text-gray-800">
              {/* Logo */}
              <div className="w-full flex items-center justify-center">
                <a href={`/admin/${id}`}>
                  <Image src="/logo_transparent.png" alt="StreamLand Logo" width={56} height={56} />
                </a>
              </div>

              {/* Scroll area */}
              <div className="flex-1 w-full overflow-y-auto overflow-x-hidden flex items-center">
                <ul className="space-y-4 w-full px-2">
                  {navItems.map(({ type, href, label, icon: Icon }) => {
                    let fullHref: string | null = null;
                    if (type === "link") {
                      fullHref = href === "" ? `/admin/${id}` : `/admin/${id}${href}`;
                    }

                    const isDashboard = type === "link" && href === "" && pathname === `/admin/${id}`;
                    const isNormalLink = type === "link" && href && pathname.startsWith(fullHref!);
                    const isActive = isDashboard || isNormalLink;

                    return (
                      <li key={label} className="group w-full">
                        <a
                          href={fullHref!}
                          className={`flex items-center transition-all duration-150 ease-in-out ${
                            isActive
                              ? "bg-[#FAEDF0] text-[#292C6D] rounded-l-xl w-[calc(100%+1rem)] pr-4 justify-center pl-[1.8] py-3"
                              : "w-full  justify-center text-gray-500 hover:bg-[#FAEDF0]/50 hover:text-[#292C6D] py-3 px-2"
                          }`}
                        >
                          <HoverTooltip label={label}>
                            <Icon className="w-5 h-5" />
                          </HoverTooltip>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>


              {/* Fixed bottom item */}
              <div className="mt-auto w-full px-2 pb-4">
                <button
                  onClick={handleChatClick}
                  className={`flex items-center transition-all duration-150 ease-in-out ${
                    pathname.includes("/chat")
                      ? "bg-[#FAEDF0] text-[#292C6D] rounded-l-xl w-[calc(100%+1rem)] pr-4 justify-start pl-4 py-3"
                      : "w-full justify-center text-gray-500 hover:bg-[#FAEDF0]/50 hover:text-[#292C6D] py-3 px-2"
                  }`}
                >
                  <HoverTooltip label={"Support Users"}>
                    <Headset className="w-5 h-5" />
                  </HoverTooltip>
                </button>
              </div>
            </nav>

            {/* Notifications Modal */}
            {showNotifications && (
              <div className="fixed inset-0 bg-black/50 flex items-start justify-end p-4 z-50">
                <div className="bg-white rounded-xl w-96 shadow-2xl mr-4 mt-16">
                  {/* Modal Header */}
                  <div className="flex justify-between items-center p-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
                    <button
                      onClick={() => setShowNotifications(false)}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  {/* Notifications List */}
                  <div className="max-h-[calc(100vh-12rem)] overflow-y-auto">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className="p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0">
                            {notification.type === 'report' && (
                              <Flag className="text-red-500" size={20} />
                            )}
                            {notification.type === 'user' && (
                              <Users className="text-blue-500" size={20} />
                            )}
                            {notification.type === 'system' && (
                              <Bell className="text-yellow-500" size={20} />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">
                              {notification.title}
                            </p>
                            <p className="text-sm text-gray-500 mt-1">
                              {notification.message}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              {notification.time}
                            </p>
                          </div>
                          {!notification.isRead && (
                            <div className="flex-shrink-0">
                              <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* View All Link */}
                  <div className="p-4 border-t border-gray-200">
                    <a
                      href={`/admin/${id}/notifications`}
                      className="text-sm text-indigo-600 hover:text-indigo-700 font-medium block text-center"
                    >
                      View All Notifications
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* Main Content */}
            <main className={`flex-1 ml-24 ${raleway.className}`}>
              {children}
            </main>
          </div>
        </div>
      </div>
  );
}
