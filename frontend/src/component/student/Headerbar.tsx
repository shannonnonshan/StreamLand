'use client';
import { MagnifyingGlassIcon, XMarkIcon, ChevronDownIcon, UserCircleIcon, ShieldCheckIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import LoginModal from '@/component/(modal)/login';
import RegisterModal from '@/component/(modal)/register';
import OTPModal from '@/component/(modal)/verifyOtp';
import ForgotPasswordModal from '@/component/(modal)/forgotPassword';
import ResetPasswordModal from '@/component/(modal)/resetPassword';
import NotificationBell from '@/component/NotificationBell';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';

const PrimaryColor = '161853';

interface Teacher {
  id: string;
  name: string;
  bio?: string;
  profilePicture?: string;
}

export default function Header() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isOTPModalOpen, setIsOTPModalOpen] = useState(false);
  const [isForgotPasswordModalOpen, setIsForgotPasswordModalOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [filteredTeachers, setFilteredTeachers] = useState<Teacher[]>([]);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Fetch all teachers on mount
  useEffect(() => {
    const fetchTeachers = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/student/teachers/all`, {
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          setTeachers(data);
          setFilteredTeachers(data);
        }
      } catch {
        // Error fetching teachers
      }
    };

    fetchTeachers();
  }, []);

  // Check token validity on mount and clear if invalid
  useEffect(() => {
    const checkTokenValidity = async () => {
      const accessToken = localStorage.getItem('accessToken');
      const storedUser = localStorage.getItem('user');
      
      // If no token but has user data, clear everything
      if (!accessToken && storedUser) {
        localStorage.removeItem('user');
        localStorage.removeItem('userId');
        localStorage.removeItem('role');
        localStorage.removeItem('refreshToken');
        return;
      }
      
      // If we have a token, verify it's still valid
      if (accessToken && storedUser) {
        try {
          // Decode JWT to check expiration
          const payload = JSON.parse(atob(accessToken.split('.')[1]));
          const expirationTime = payload.exp * 1000; // Convert to milliseconds
          const currentTime = Date.now();
          
          // If token is expired, clear everything
          if (currentTime >= expirationTime) {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('user');
            localStorage.removeItem('userId');
            localStorage.removeItem('role');
            logout();
          }
        } catch {
          // If token is malformed, clear everything
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
          localStorage.removeItem('userId');
          localStorage.removeItem('role');
          logout();
        }
      }
    };
    
    checkTokenValidity();
  }, [logout]);

  // Load 2FA status from user data
  useEffect(() => {
    if (user) {
      setTwoFactorEnabled(!!user.twoFactorEnabled);
    }
  }, [user]);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current && 
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setIsSearchOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);
  
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    if (query.trim() === '') {
      setFilteredTeachers(teachers);
      return;
    }
    
    // Split query into words and filter
    const queryWords = query.toLowerCase().trim().split(/\s+/);
    
    const filtered = teachers.filter(teacher => {
      const teacherName = teacher.name.toLowerCase();
      const teacherBio = (teacher.bio || '').toLowerCase();
      const searchableText = `${teacherName} ${teacherBio}`;
      
      // Match if ALL query words are found in teacher data
      return queryWords.every(word => searchableText.includes(word));
    });
    
    setFilteredTeachers(filtered);
  };
  
  const openLoginModal = () => {
    setIsLoginModalOpen(true);
    setIsRegisterModalOpen(false);
    setIsOTPModalOpen(false);
  };

  const closeLoginModal = () => {
    setIsLoginModalOpen(false);
  };
  
  const openRegisterModal = () => {
    setIsLoginModalOpen(false);
    setIsRegisterModalOpen(true);
    setIsOTPModalOpen(false);
  };

  const closeRegisterModal = () => {
    setIsRegisterModalOpen(false);
  };

  const [otpEmail, setOtpEmail] = useState('');
  const [otpPurpose, setOtpPurpose] = useState<'registration' | 'password-reset' | '2fa'>('registration');

  const openOTPModal = (email: string = '', purpose: 'registration' | 'password-reset' | '2fa' = 'registration') => {
    setOtpEmail(email);
    setOtpPurpose(purpose);
    setIsRegisterModalOpen(false);
    setIsForgotPasswordModalOpen(false);
    setIsLoginModalOpen(false);
    setIsOTPModalOpen(true);
  };

  const closeOTPModal = () => {
    setIsOTPModalOpen(false);
  };

  const openForgotPasswordModal = () => {
    setIsForgotPasswordModalOpen(true);
    setIsLoginModalOpen(false);
    setIsRegisterModalOpen(false);
    setIsResetPasswordModalOpen(false);
  };
  
  const closeForgotPasswordModal = () => {
    setIsForgotPasswordModalOpen(false);
  };
  
  const openResetPasswordModal = (email: string = '') => {
    setOtpEmail(email);
    setIsForgotPasswordModalOpen(false);
    setIsOTPModalOpen(false);
    setIsResetPasswordModalOpen(true);
  };
  
  const closeResetPasswordModal = () => {
    setIsResetPasswordModalOpen(false);
  };

  const handleToggle2FA = async () => {
    if (!user) return;

    const newStatus = !twoFactorEnabled;
    
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/auth/${user.id}/2fa`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ twoFactorEnabled: newStatus }),
      });

      if (response.ok) {
        setTwoFactorEnabled(newStatus);
        // Update user in localStorage
        const updatedUser = { ...user, twoFactorEnabled: newStatus };
        localStorage.setItem('user', JSON.stringify(updatedUser));
      } else {
        console.error('Failed to update 2FA status');
        alert('Failed to update 2FA setting. Please try again.');
      }
    } catch (error) {
      console.error('Error updating 2FA:', error);
      alert('Error updating 2FA setting. Please try again.');
    }
  };
  
  return (
    <header className={`fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-md flex items-center justify-between px-8 shadow-sm border-b border-gray-100/50 z-40`}>
      {/* Logo on left */}
      <div className="flex items-center">
        <Image src="/logo.png" alt="StreamLand Logo" width={32} height={32} className="h-8 w-auto" />
      </div>
      
      {/* Right side icons */}
      <div className="flex items-center space-x-4">
        
        {/* Search Box & Icon */}
        <div ref={searchContainerRef} className="relative">
          <button 
            className={`p-2 ${isSearchOpen ? `text-[#${PrimaryColor}] bg-gray-100` : 'text-gray-500 hover:bg-gray-50'} rounded-full transition duration-150`}
            onClick={() => setIsSearchOpen(!isSearchOpen)}
          >
            <MagnifyingGlassIcon className="h-6 w-6" />
          </button>
          
          <AnimatePresence>
            {isSearchOpen && (
              <motion.div 
                className="absolute right-0 top-12 w-80 bg-white rounded-md shadow-lg border border-gray-200 overflow-hidden z-30"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <div className="p-3 border-b border-gray-100">
                  <div className="flex items-center bg-gray-50 rounded-md">
                    <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 ml-3" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Search courses, teachers..."
                      className="w-full p-2 bg-transparent border-none focus:outline-none text-sm"
                      value={searchQuery}
                      onChange={handleSearch}
                    />
                    {searchQuery && (
                      <button 
                        onClick={() => {
                          setSearchQuery('');
                          setFilteredTeachers(teachers);
                        }} 
                        className="mr-3 p-1 hover:bg-gray-200 rounded-full"
                      >
                        <XMarkIcon className="h-4 w-4 text-gray-500" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="max-h-80 overflow-y-auto">
                  {filteredTeachers.length > 0 ? (
                    <div>
                      {filteredTeachers.map((teacher) => (
                        <div 
                          key={teacher.id} 
                          className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100"
                          onClick={() => {
                            router.push(`/teacher/public/${teacher.id}`);
                            setIsSearchOpen(false);
                            setSearchQuery('');
                          }}
                        >
                          <div className="flex items-center gap-3">
                            {teacher.profilePicture ? (
                              <Image
                                src={teacher.profilePicture}
                                alt={teacher.name}
                                width={40}
                                height={40}
                                className="rounded-full object-cover"
                              />
                            ) : (
                              <div className="h-10 w-10 bg-gradient-to-br from-purple-400 to-blue-500 rounded-full flex items-center justify-center">
                                <span className="text-white font-semibold text-sm">
                                  {teacher.name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                            <div className="flex-1">
                              <p className="text-sm font-medium text-[#161853]">{teacher.name}</p>
                              {teacher.bio && (
                                <p className="text-xs text-gray-500 line-clamp-1">{teacher.bio}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-gray-500">
                      {searchQuery ? 'No teachers found.' : 'Start typing to search teachers...'}
                    </div>
                  )}
                </div>
                
                {filteredTeachers.length > 0 && (
                  <div className="p-2 text-center border-t border-gray-100">
                    <p className="text-xs text-gray-500">
                      {filteredTeachers.length} teacher{filteredTeachers.length !== 1 ? 's' : ''} found
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Notifications */}
        {isAuthenticated && user && (
          <NotificationBell />
        )}

        {/* Divider */}
        <div className="w-px h-6 bg-gray-200 mx-2" />
        
        {/* Profile Avatar / Login Button */}
        {isAuthenticated && user ? (
          <div className="relative" ref={userMenuRef}>
            <div 
              className="flex items-center space-x-2 cursor-pointer hover:opacity-80 transition-all duration-300 px-2 py-1 rounded-lg hover:bg-gray-50"
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            >
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 border-2 border-white shadow-sm overflow-hidden flex items-center justify-center text-white font-semibold">
                {user.avatar ? (
                  <Image src={user.avatar} alt={user.fullName || 'User'} width={32} height={32} className="w-full h-full object-cover" />
                ) : (
                  <span>{user.fullName?.charAt(0)?.toUpperCase() || 'U'}</span>
                )}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-sm font-semibold text-gray-800">{user.fullName || 'User'}</p>
                <p className="text-xs text-gray-500">{user.role || 'STUDENT'}</p>
              </div>
              <ChevronDownIcon className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
            </div>

            {/* Dropdown Menu */}
            <AnimatePresence>
              {isUserMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-100 py-2 z-50"
                >
                  {/* User Info */}
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-semibold text-gray-800">{user.fullName || 'User'}</p>
                    <p className="text-xs text-gray-500">{user.email || 'email@example.com'}</p>
                  </div>

                  {/* Profile Link */}
                  <button
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      router.push(`/student/${user.id}/profile`);
                    }}
                  >
                    <UserCircleIcon className="h-5 w-5 text-gray-500" />
                    <span>Personal Information</span>
                  </button>

                  {/* 2FA Toggle */}
                  <div className="px-4 py-2 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <ShieldCheckIcon className="h-5 w-5 text-gray-500" />
                        <span className="text-sm text-gray-700">Two-Factor Authentication</span>
                      </div>
                      <button
                        onClick={handleToggle2FA}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                          twoFactorEnabled ? 'bg-blue-600' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                            twoFactorEnabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 ml-8">
                      {twoFactorEnabled ? '2FA security enabled' : 'Enhance account security'}
                    </p>
                  </div>

                  {/* Logout */}
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      logout();
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 border-t border-gray-100 mt-1"
                  >
                    <ArrowRightOnRectangleIcon className="h-5 w-5" />
                    <span>Logout</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div 
            className="flex items-center space-x-3 cursor-pointer hover:opacity-80 transition-all duration-300"
            onClick={openLoginModal}
          >
            <div className="h-8 w-8 rounded-full bg-gray-300 border-2 border-white shadow-sm overflow-hidden hover:border-[#EC255A] transition-all duration-300">
              {/* <img src="/avatar.jpg" alt="User Avatar" /> */}
            </div>
          </div>
        )}
        
        {/* Login Modal */}
        <LoginModal 
          isOpen={isLoginModalOpen} 
          closeModal={closeLoginModal} 
          openRegisterModal={openRegisterModal}
          openForgotPasswordModal={openForgotPasswordModal}
          openOTPModal={openOTPModal}
        />
        
        {/* Register Modal */}
        <RegisterModal 
          isOpen={isRegisterModalOpen}
          closeModal={closeRegisterModal}
          openLoginModal={openLoginModal}
          openOTPModal={openOTPModal}
        />
        
        {/* OTP Verification Modal */}
        <OTPModal
          isOpen={isOTPModalOpen}
          closeModal={closeOTPModal}
          email={otpEmail}
          otpPurpose={otpPurpose}
          openResetPasswordModal={openResetPasswordModal}
        />
        
        {/* Forgot Password Modal */}
        <ForgotPasswordModal
          isOpen={isForgotPasswordModalOpen}
          closeModal={closeForgotPasswordModal}
          openLoginModal={openLoginModal}
          openOTPModal={openOTPModal}
        />
        
        {/* Reset Password Modal */}
        <ResetPasswordModal
          isOpen={isResetPasswordModalOpen}
          closeModal={closeResetPasswordModal}
          openLoginModal={openLoginModal}
          email={otpEmail}
        />
      </div>
    </header>
  );
}