// components/Auth/OTPModal.jsx
import { Dialog, Transition } from '@headlessui/react';
import { Fragment, useState, useRef } from 'react';
import { ShieldCheckIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';

const PrimaryColor = '161853'; // Xanh Đậm (màu chủ đạo mới)
const SecondaryColor = 'EC255A'; // Đỏ/Hồng
const OTP_LENGTH = 6;

interface OTPModalProps {
  isOpen: boolean;
  closeModal: () => void;
  email?: string;
  otpPurpose?: 'registration' | 'password-reset';
  openResetPasswordModal?: (email: string) => void;
}

export default function OTPModal({ 
  isOpen, 
  closeModal, 
  email = '',
  otpPurpose = 'registration',
  openResetPasswordModal
}: OTPModalProps) {
  const router = useRouter();
  const { verifyOtp, requestOtp } = useAuth();
  const [otp, setOtp] = useState(new Array(OTP_LENGTH).fill(''));
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]); // Mảng các ref cho 6 ô input

  // Focus ô tiếp theo khi nhập
  const handleChange = (element: HTMLInputElement, index: number) => {
    // Chỉ cho phép nhập số
    if (isNaN(Number(element.value))) return false;

    // Cập nhật giá trị OTP
    const newOtp = [...otp];
    newOtp[index] = element.value.slice(-1); // Chỉ lấy ký tự cuối cùng
    setOtp(newOtp);

    // Tự động chuyển focus sang ô tiếp theo
      if (element.value !== '' && index < OTP_LENGTH - 1 && inputRefs.current[index + 1]) {
        inputRefs.current[index + 1]?.focus();
      }
  };

  // Xử lý phím Backspace/Delete để xóa và quay lại ô trước đó
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Backspace' && otp[index] === '' && index > 0 && inputRefs.current[index - 1]) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const finalOtp = otp.join('');
    if (finalOtp.length !== OTP_LENGTH) {
      setError('Please enter all 6 OTP digits.');
      return;
    }

    setIsVerifying(true);
    setError('');
    setSuccessMessage('');

    try {
      // Call verify OTP API
      const result = await verifyOtp({
        email,
        otp: finalOtp,
      });

      if (result.success) {
        setSuccessMessage('OTP verified successfully!');
        
        // Wait a moment to show success message
        setTimeout(() => {
          closeModal();
          
          // Redirect based on purpose and user role
          if (otpPurpose === 'registration') {
            // After registration verification, redirect to dashboard
            if (result.user?.role === 'TEACHER') {
              router.push(`/teacher/${result.user.id}`);
            } else {
              router.push('/student/dashboard');
            }
          } else if (otpPurpose === 'password-reset' && openResetPasswordModal) {
            // Open reset password modal
            openResetPasswordModal(email);
          }
        }, 1500);
      } else {
        setError(result.error || 'Invalid OTP. Please try again.');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };
  
  const handleResend = async () => {
    setError('');
    setSuccessMessage('');
    
    try {
      const result = await requestOtp(email);
      
      if (result.success) {
        setSuccessMessage('OTP resent successfully!');
        setOtp(new Array(OTP_LENGTH).fill(''));
        if (inputRefs.current[0]) {
          inputRefs.current[0].focus();
        }
      } else {
        setError(result.error || 'Unable to resend OTP. Please try again.');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={closeModal}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className={`w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-8 text-left align-middle shadow-2xl transition-all border-t-8 border-[#${PrimaryColor}]`}>
                
                {/* Header */}
                <div className="text-center">
                    <ShieldCheckIcon className={`mx-auto h-12 w-12 text-[#${PrimaryColor}]`} />
                    <Dialog.Title
                        as="h3"
                        className={`mt-4 text-2xl font-extrabold text-[#${SecondaryColor}]`}
                    >
                        Verify OTP Code
                    </Dialog.Title>
                    <p className="mt-2 text-sm text-gray-500">
                        {otpPurpose === 'password-reset' 
                          ? `A 6-digit password reset verification code has been sent to ${email || 'your email'}.`
                          : 'A 6-digit verification code has been sent to your email.'}
                    </p>
                </div>

                {/* Error/Success Messages */}
                {error && (
                  <div className="mt-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm flex items-center gap-2">
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span>{error}</span>
                  </div>
                )}
                
                {successMessage && (
                  <div className="mt-4 p-3 rounded-lg bg-green-50 text-green-700 text-sm flex items-center gap-2">
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>{successMessage}</span>
                  </div>
                )}

                {/* OTP Input Grid */}
                <div className="mt-6 flex justify-center space-x-2 sm:space-x-3" role="group">
                    {otp.map((data, index) => (
                        <input
                            key={index}
                            maxLength={1}
                            value={data}
                            onChange={(e) => handleChange(e.target, index)}
                            onKeyDown={(e) => handleKeyDown(e, index)}
                            ref={(el) => { inputRefs.current[index] = el }} // Gán ref
                            className={`w-10 h-10 sm:w-12 sm:h-12 text-center text-xl font-bold rounded-lg border-2 ring-1 ring-inset ${
                                data 
                                    ? `border-[#${PrimaryColor}] ring-[#${PrimaryColor}] text-[#${SecondaryColor}]`
                                    : 'border-gray-300 ring-gray-300 text-gray-900'
                            } transition duration-150 focus:outline-none focus:ring-2 focus:ring-[#${PrimaryColor}] focus:border-[#${PrimaryColor}]`}
                            autoFocus={index === 0}
                        />
                    ))}
                </div>

                {/* Actions */}
                <div className="mt-6 space-y-3">
                    <button
                        type="button"
                        onClick={handleVerify}
                        disabled={otp.join('').length !== OTP_LENGTH || isVerifying}
                        className={`flex w-full justify-center rounded-lg px-4 py-2.5 text-base font-semibold text-white shadow-md transition duration-150 ${
                            otp.join('').length === OTP_LENGTH && !isVerifying
                                ? `bg-[#${SecondaryColor}] hover:bg-opacity-90`
                                : 'bg-gray-400 cursor-not-allowed'
                        }`}
                    >
                        Verify
                    </button>
                    
                    <p className="text-center text-sm text-gray-500">
                        Didn&apos;t receive the code?{' '}
                        <button
                            type="button"
                            onClick={handleResend}
                            className={`font-semibold text-[#${PrimaryColor}] hover:text-opacity-80 transition duration-150`}
                        >
                            Resend Code
                        </button>
                    </p>
                </div>
                
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}