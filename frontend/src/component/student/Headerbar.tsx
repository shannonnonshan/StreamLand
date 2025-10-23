// components/Header.jsx
'use client';
import { MagnifyingGlassIcon, BellIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useState, useRef, useEffect } from 'react';
import LoginModal from '@/component/(modal)/login';
import RegisterModal from '@/component/(modal)/register';
import OTPModal from '@/component/(modal)/verifyOtp';
import ForgotPasswordModal from '@/component/(modal)/forgotPassword';
import ResetPasswordModal from '@/component/(modal)/resetPassword';
import { motion, AnimatePresence } from 'framer-motion';

const PrimaryColor = '161853';

// Mock data cho kết quả tìm kiếm
const searchResults = [
  { id: 1, title: 'IELTS Speaking Prep', teacher: 'Mr. David Nguyen', type: 'livestream' },
  { id: 2, title: 'Calculus I - Chapter 3', teacher: 'Ms. Lan Anh', type: 'video' },
  { id: 3, title: 'Hóa học Hữu cơ', teacher: 'Cô Thảo', type: 'course' },
  { id: 4, title: 'English Grammar', teacher: 'Mr. John', type: 'livestream' },
];

export default function Header() {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isOTPModalOpen, setIsOTPModalOpen] = useState(false);
  const [isForgotPasswordModalOpen, setIsForgotPasswordModalOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredResults, setFilteredResults] = useState(searchResults);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  
  // Xử lý click bên ngoài khung tìm kiếm
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

  // Tự động focus vào ô tìm kiếm khi mở
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);
  
  // Xử lý tìm kiếm
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

  // state lưu trữ email và mục đích của OTP
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
  
  // Reset password modal
  const openResetPasswordModal = (email: string = '') => {
    setOtpEmail(email); // Sử dụng email đã xác thực OTP
    setIsForgotPasswordModalOpen(false);
    setIsOTPModalOpen(false);
    setIsResetPasswordModalOpen(true);
  };
  
  const closeResetPasswordModal = () => {
    setIsResetPasswordModalOpen(false);
  };
  return (
    <header className={`fixed top-0 left-20 right-0 h-16 bg-white flex items-center justify-end px-8 shadow-sm border-b border-gray-100 z-20`}>
      
      {/* Icons bên phải */}
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
        
        {/* Profile Avatar */}
        <div 
          className="flex items-center space-x-3 cursor-pointer hover:opacity-80 transition-all duration-300"
          onClick={openLoginModal}
        >
          <div className="h-8 w-8 rounded-full bg-gray-300 border-2 border-white shadow-sm overflow-hidden hover:border-[#EC255A] transition-all duration-300">
            {/* <img src="/avatar.jpg" alt="User Avatar" /> */}
          </div>
        </div>
        
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