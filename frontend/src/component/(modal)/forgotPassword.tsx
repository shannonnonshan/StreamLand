// components/Auth/ForgotPasswordModal.tsx
import { Dialog, Transition } from '@headlessui/react';
import { Fragment, useState, useEffect } from 'react';
import { 
  AtSymbolIcon, 
  AcademicCapIcon, 
  ExclamationCircleIcon, 
  CheckCircleIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';

const PrimaryColor = '161853'; // Xanh Đậm
const SecondaryColor = 'EC255A'; // Đỏ/Hồng

type ForgotPasswordModalProps = {
  isOpen: boolean;
  closeModal: () => void;
  openLoginModal: () => void;
  openOTPModal: (email?: string, purpose?: 'registration' | 'password-reset') => void;
};

type NotificationType = 'success' | 'error' | 'info' | null;

export default function ForgotPasswordModal({ 
  isOpen, 
  closeModal,
  openLoginModal,
  openOTPModal
}: ForgotPasswordModalProps) {
  // States
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [step, setStep] = useState(1); // 1: Email input, 2: Success/Instructions
  const [notification, setNotification] = useState<{ type: NotificationType; message: string }>({
    type: null,
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when modal is opened
  useEffect(() => {
    if (isOpen) {
      setEmail('');
      setEmailError('');
      setStep(1);
      setNotification({ type: null, message: '' });
      setIsSubmitting(false);
    }
  }, [isOpen]);

  // Validate email format
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      setEmailError('Email is required');
      return false;
    } else if (!emailRegex.test(email)) {
      setEmailError('Invalid email format');
      return false;
    }
    setEmailError('');
    return true;
  };

  const handleSubmit = async (e: { preventDefault: () => void; }) => {
    e.preventDefault();
    
    // Validate form
    const isEmailValid = validateEmail(email);
    
    if (!isEmailValid) {
      return;
    }
    
    setIsSubmitting(true);
    setNotification({ type: null, message: '' });
    
    try {
      console.log('Password reset request for:', { email });
      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Add password reset API logic here
      
      // Switch to OTP modal with email and password-reset purpose
      closeModal();
      openOTPModal(email, 'password-reset');
      
    } catch {
      // Handle error
      setNotification({
        type: 'error',
        message: 'Unable to send request. Please try again later.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep1 = () => (
    <>
      <Dialog.Title
        as="h3"
        className={`text-2xl font-extrabold leading-6 text-[#${PrimaryColor}] flex items-center gap-2 mb-2`}
      >
        <AcademicCapIcon className={`h-6 w-6 text-[#${PrimaryColor}]`} />
        Forgot Password
      </Dialog.Title>
      <p className="text-sm text-gray-600 mb-6">
        Please enter your email address to receive password reset instructions.
      </p>

      {/* Notification */}
      {notification.type && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
          notification.type === 'success' 
            ? 'bg-green-50 text-green-700' 
            : notification.type === 'error'
              ? 'bg-red-50 text-red-700'
              : 'bg-blue-50 text-blue-700'
        }`}>
          {notification.type === 'success' ? (
            <CheckCircleIcon className="h-5 w-5 text-green-500" />
          ) : notification.type === 'error' ? (
            <ExclamationCircleIcon className="h-5 w-5 text-red-500" />
          ) : (
            <ExclamationCircleIcon className="h-5 w-5 text-blue-500" />
          )}
          <span className="text-sm">{notification.message}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email */}
        <div>
          <label htmlFor="email" className="sr-only">Email</label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <AtSymbolIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (e.target.value) validateEmail(e.target.value);
              }}
              onBlur={(e) => validateEmail(e.target.value)}
              className={`block w-full rounded-lg border-0 py-2.5 pl-10 pr-4 text-gray-900 
                ring-1 ring-inset ${emailError ? 'ring-red-500 focus:ring-red-500' : `ring-gray-300 focus:ring-[#${PrimaryColor}]`} 
                placeholder:text-gray-400 focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6 transition duration-150`}
              placeholder="Email Address"
            />
            {emailError && (
              <div className="mt-1 text-sm text-red-600 flex items-center gap-1">
                <ExclamationCircleIcon className="h-4 w-4" />
                {emailError}
              </div>
            )}
          </div>
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className={`flex w-full justify-center rounded-lg bg-[#${SecondaryColor}] px-3 py-2.5 text-base font-semibold text-white shadow-md hover:bg-opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#${SecondaryColor}] transition duration-150
          ${isSubmitting ? 'opacity-75 cursor-not-allowed' : ''}`}
        >
          {isSubmitting ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing...
            </>
          ) : (
            'Send Instructions'
          )}
        </button>
      </form>

      {/* Footer */}
      <div className="mt-6 text-center text-sm">
        <button
          type="button"
          onClick={() => { closeModal(); openLoginModal(); }}
          className={`flex items-center justify-center mx-auto font-medium text-[#${PrimaryColor}] hover:text-[#${SecondaryColor}] transition duration-150`}
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Back to Sign In
        </button>
      </div>
    </>
  );

  const renderStep2 = () => (
    <>
      <div className="text-center py-4">
        <CheckCircleIcon className={`h-12 w-12 mx-auto text-[#${PrimaryColor}] mb-4`} />
        <Dialog.Title
          as="h3"
          className={`text-xl font-bold text-[#${SecondaryColor}] mb-2`}
        >
          Đã gửi hướng dẫn đặt lại mật khẩu!
        </Dialog.Title>
        <p className="text-sm text-gray-600 mb-6">
          Chúng tôi đã gửi hướng dẫn đặt lại mật khẩu đến <span className="font-medium text-gray-800">{email}</span>. 
          Vui lòng kiểm tra hộp thư của bạn và làm theo hướng dẫn để đặt lại mật khẩu.
        </p>
        <p className="text-xs text-gray-500 mb-6">
          Lưu ý: Nếu bạn không nhận được email trong vòng vài phút, hãy kiểm tra thư mục spam 
          hoặc thử lại với một địa chỉ email khác.
        </p>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={() => setStep(1)}
            className={`flex items-center justify-center rounded-lg border-2 border-[#${PrimaryColor}] px-4 py-2 text-base font-semibold text-[#${PrimaryColor}] hover:bg-gray-50 transition duration-150`}
          >
            Thử lại với email khác
          </button>
          <button
            type="button"
            onClick={() => { closeModal(); openLoginModal(); }}
            className={`flex items-center justify-center rounded-lg bg-[#${PrimaryColor}] px-4 py-2 text-base font-semibold text-white hover:bg-opacity-90 transition duration-150`}
          >
            Quay lại đăng nhập
          </button>
        </div>
      </div>
    </>
  );

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
          {/* Lớp phủ mờ (backdrop) */}
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
              {/* Nội dung modal */}
              <Dialog.Panel className={`w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-8 text-left align-middle shadow-2xl transition-all border-t-4 border-[#${PrimaryColor}]`}>
                {step === 1 ? renderStep1() : renderStep2()}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
