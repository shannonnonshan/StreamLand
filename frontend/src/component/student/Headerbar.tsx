'use client';
import { MagnifyingGlassIcon, BellIcon, XMarkIcon, ChevronDownIcon, UserCircleIcon, ShieldCheckIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoginModal from '@/component/(modal)/login';
import RegisterModal from '@/component/(modal)/register';
import OTPModal from '@/component/(modal)/verifyOtp';
import ForgotPasswordModal from '@/component/(modal)/forgotPassword';
import ResetPasswordModal from '@/component/(modal)/resetPassword';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';

const PrimaryColor = '161853';

const searchResults = [
  { id: 1, title: 'IELTS Speaking Prep', teacher: 'Mr. David Nguyen', type: 'livestream' },
  { id: 2, title: 'Calculus I - Chapter 3', teacher: 'Ms. Lan Anh', type: 'video' },
  { id: 3, title: 'Hóa học Hữu cơ', teacher: 'Cô Thảo', type: 'course' },
  { id: 4, title: 'English Grammar', teacher: 'Mr. John', type: 'livestream' },
];

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
  const [filteredResults, setFilteredResults] = useState(searchResults);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current && 
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setIsSearchOpen(false);
      }
      if (
        userMenuRef.current && 
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setIsUserMenuOpen(false);
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
      setFilteredResults(searchResults);
      return;
    }
    
    const filtered = searchResults.filter(item => 
      item.title.toLowerCase().includes(query.toLowerCase()) || 
      item.teacher.toLowerCase().includes(query.toLowerCase())
    );
    
    setFilteredResults(filtered);
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
  const [otpPurpose, setOtpPurpose] = useState<'registration' | 'password-reset'>('registration');

  const openOTPModal = (email: string = '', purpose: 'registration' | 'password-reset' = 'registration') => {
    setOtpEmail(email);
    setOtpPurpose(purpose);
    setIsRegisterModalOpen(false);
    setIsForgotPasswordModalOpen(false);
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
  
  return (
    <header className={`fixed top-0 left-0 right-0 h-16 bg-white flex items-center justify-between px-8 shadow-sm border-b border-gray-100 z-40`}>
      
      {/* Logo on left */}
      <div className="flex items-center">
        <img src="/logo.png" alt="StreamLand Logo" className="h-8 w-auto" />
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
                      placeholder="Tìm kiếm khóa học, giáo viên..."
                      className="w-full p-2 bg-transparent border-none focus:outline-none text-sm"
                      value={searchQuery}
                      onChange={handleSearch}
                    />
                    {searchQuery && (
                      <button 
                        onClick={() => {
                          setSearchQuery('');
                          setFilteredResults(searchResults);
                        }} 
                        className="mr-3 p-1 hover:bg-gray-200 rounded-full"
                      >
                        <XMarkIcon className="h-4 w-4 text-gray-500" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="max-h-80 overflow-y-auto">
                  {filteredResults.length > 0 ? (
                    <div>
                      {filteredResults.map((result) => (
                        <div key={result.id} className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100">
                          <div className="flex items-center">
                            <div className="h-8 w-8 bg-gray-200 rounded-md mr-3 flex items-center justify-center">
                              {result.type === 'livestream' && (
                                <div className="h-3 w-3 bg-red-500 rounded-full"></div>
                              )}
                              {result.type === 'video' && (
                                <div className="h-0 w-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[10px] border-b-gray-500"></div>
                              )}
                              {result.type === 'course' && (
                                <div className="h-4 w-4 bg-blue-500 rounded-sm"></div>
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-[#161853]">{result.title}</p>
                              <p className="text-xs text-gray-500">{result.teacher}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-gray-500">
                      Không tìm thấy kết quả phù hợp.
                    </div>
                  )}
                </div>
                
                {filteredResults.length > 0 && (
                  <div className="p-2 text-center border-t border-gray-100">
                    <button className="text-xs text-[#161853] hover:underline">
                      Xem tất cả kết quả
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Notification Icon */}
        <button className="relative p-2 text-gray-500 hover:text-[#${PrimaryColor}] rounded-full hover:bg-gray-50 transition duration-150">
          <BellIcon className="h-6 w-6" />
          <span className={`absolute top-1 right-1 h-2 w-2 rounded-full bg-[#${PrimaryColor}]`} />
        </button>

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
                  <img src={user.avatar} alt={user.fullName || 'User'} className="w-full h-full object-cover" />
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
                    <span>Thông tin cá nhân</span>
                  </button>

                  {/* 2FA Toggle */}
                  <div className="px-4 py-2 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <ShieldCheckIcon className="h-5 w-5 text-gray-500" />
                        <span className="text-sm text-gray-700">Xác thực 2 yếu tố</span>
                      </div>
                      <button
                        onClick={() => setTwoFactorEnabled(!twoFactorEnabled)}
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
                      {twoFactorEnabled ? 'Đã bật bảo mật 2FA' : 'Tăng cường bảo mật tài khoản'}
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
                    <span>Đăng xuất</span>
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