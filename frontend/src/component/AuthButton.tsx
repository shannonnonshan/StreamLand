'use client';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import AccountMenu from '@/component/AccountMenu';
import LoginModal from '@/component/(modal)/login';
import RegisterModal from '@/component/(modal)/register';
import OTPModal from '@/component/(modal)/verifyOtp';
import ForgotPasswordModal from '@/component/(modal)/forgotPassword';
import ResetPasswordModal from '@/component/(modal)/resetPassword';

interface AuthButtonProps {
  role: 'student' | 'teacher' | 'admin';
  basePath: string;
  useAnimation?: boolean;
  show2FA?: boolean;
}

export default function AuthButton({ role, basePath, useAnimation = false, show2FA = false }: AuthButtonProps) {
  const { isAuthenticated } = useAuth();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isOTPModalOpen, setIsOTPModalOpen] = useState(false);
  const [isForgotPasswordModalOpen, setIsForgotPasswordModalOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [otpEmail, setOtpEmail] = useState('');
  const [otpPurpose, setOtpPurpose] = useState<'registration' | 'password-reset'>('registration');

  const openLoginModal = () => {
    setIsLoginModalOpen(true);
    setIsRegisterModalOpen(false);
    setIsOTPModalOpen(false);
  };

  const closeLoginModal = () => setIsLoginModalOpen(false);

  const openRegisterModal = () => {
    setIsLoginModalOpen(false);
    setIsRegisterModalOpen(true);
    setIsOTPModalOpen(false);
  };

  const closeRegisterModal = () => setIsRegisterModalOpen(false);

  const openOTPModal = (email?: string, purpose?: 'registration' | 'password-reset') => {
    setIsRegisterModalOpen(false);
    setIsForgotPasswordModalOpen(false);
    setIsOTPModalOpen(true);
    if (email) setOtpEmail(email);
    if (purpose) setOtpPurpose(purpose);
  };

  const closeOTPModal = () => setIsOTPModalOpen(false);

  const openForgotPasswordModal = () => {
    setIsLoginModalOpen(false);
    setIsForgotPasswordModalOpen(true);
  };

  const closeForgotPasswordModal = () => setIsForgotPasswordModalOpen(false);

  const openResetPasswordModal = () => {
    setIsForgotPasswordModalOpen(false);
    setIsResetPasswordModalOpen(true);
  };

  const closeResetPasswordModal = () => setIsResetPasswordModalOpen(false);

  return (
    <>
      {isAuthenticated ? (
        <AccountMenu 
          role={role}
          basePath={basePath}
          useAnimation={useAnimation}
          show2FA={show2FA}
        />
      ) : (
        <div 
          className="flex items-center space-x-3 cursor-pointer hover:opacity-80 transition-all duration-300"
          onClick={openLoginModal}
        >
          <div className="h-8 w-8 rounded-full bg-gray-300 border-2 border-white shadow-sm overflow-hidden hover:border-[#EC255A] transition-all duration-300">
          </div>
        </div>
      )}

      {/* Auth Modals */}
      <LoginModal
        isOpen={isLoginModalOpen}
        closeModal={closeLoginModal}
        openRegisterModal={openRegisterModal}
        openForgotPasswordModal={openForgotPasswordModal}
      />
      <RegisterModal
        isOpen={isRegisterModalOpen}
        closeModal={closeRegisterModal}
        openLoginModal={openLoginModal}
        openOTPModal={openOTPModal}
      />
      <OTPModal
        isOpen={isOTPModalOpen}
        closeModal={closeOTPModal}
        email={otpEmail}
        otpPurpose={otpPurpose}
        openResetPasswordModal={openResetPasswordModal}
      />
      <ForgotPasswordModal
        isOpen={isForgotPasswordModalOpen}
        closeModal={closeForgotPasswordModal}
        openLoginModal={openLoginModal}
        openOTPModal={openOTPModal}
      />
      <ResetPasswordModal
        isOpen={isResetPasswordModalOpen}
        closeModal={closeResetPasswordModal}
        openLoginModal={openLoginModal}
      />
    </>
  );
}
