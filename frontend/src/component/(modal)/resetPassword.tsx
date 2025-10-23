// components/Auth/ResetPasswordModal.tsx
import { Dialog, Transition } from '@headlessui/react';
import { Fragment, useState, useEffect } from 'react';
import { 
  LockClosedIcon, 
  AcademicCapIcon, 
  ExclamationCircleIcon, 
  CheckCircleIcon,
  EyeIcon,
  EyeSlashIcon
} from '@heroicons/react/24/outline';

const PrimaryColor = '161853'; // Xanh Đậm
const SecondaryColor = 'EC255A'; // Đỏ/Hồng

type ResetPasswordModalProps = {
  isOpen: boolean;
  closeModal: () => void;
  openLoginModal: () => void;
  email?: string; // Email đã xác thực từ quá trình OTP
};

type NotificationType = 'success' | 'error' | 'info' | null;

export default function ResetPasswordModal({ 
  isOpen, 
  closeModal,
  openLoginModal,
  email = ''
}: ResetPasswordModalProps) {
  // States
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [step, setStep] = useState(1); // 1: Password input, 2: Success
  const [notification, setNotification] = useState<{ type: NotificationType; message: string }>({
    type: null,
    message: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when modal is opened
  useEffect(() => {
    if (isOpen) {
      setNewPassword('');
      setConfirmPassword('');
      setPasswordError('');
      setConfirmPasswordError('');
      setStep(1);
      setNotification({ type: null, message: '' });
      setShowPassword(false);
      setShowConfirmPassword(false);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  // Validate mật khẩu
  const validatePassword = (password: string) => {
    if (!password) {
      setPasswordError('Mật khẩu không được để trống');
      return false;
    } else if (password.length < 8) {
      setPasswordError('Mật khẩu phải có ít nhất 8 ký tự');
      return false;
    } else if (!/[A-Z]/.test(password)) {
      setPasswordError('Mật khẩu phải có ít nhất 1 chữ viết hoa');
      return false;
    } else if (!/[0-9]/.test(password)) {
      setPasswordError('Mật khẩu phải có ít nhất 1 chữ số');
      return false;
    } else if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      setPasswordError('Mật khẩu phải có ít nhất 1 ký tự đặc biệt (!@#$%^&*...)');
      return false;
    }
    setPasswordError('');
    return true;
  };

  // Validate mật khẩu xác nhận
  const validateConfirmPassword = (password: string, confirmPassword: string) => {
    if (!confirmPassword) {
      setConfirmPasswordError('Vui lòng xác nhận mật khẩu');
      return false;
    } else if (password !== confirmPassword) {
      setConfirmPasswordError('Mật khẩu xác nhận không khớp');
      return false;
    }
    setConfirmPasswordError('');
    return true;
  };

  const handleSubmit = async (e: { preventDefault: () => void; }) => {
    e.preventDefault();
    
    // Validate form
    const isPasswordValid = validatePassword(newPassword);
    const isConfirmValid = validateConfirmPassword(newPassword, confirmPassword);
    
    if (!isPasswordValid || !isConfirmValid) {
      return;
    }
    
    setIsSubmitting(true);
    setNotification({ type: null, message: '' });
    
    try {
      console.log('Đặt lại mật khẩu cho:', { email, newPassword });
      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Thêm logic API đặt lại mật khẩu ở đây
      
      // Chuyển sang bước thành công
      setStep(2);
      setNotification({
        type: 'success',
        message: 'Mật khẩu của bạn đã được đặt lại thành công!'
      });
      
    } catch {
      // Xử lý lỗi
      setNotification({
        type: 'error',
        message: 'Không thể đặt lại mật khẩu. Vui lòng thử lại sau.'
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
        Đặt lại mật khẩu
      </Dialog.Title>
      <p className="text-sm text-gray-600 mb-6">
        {email ? `Tạo mật khẩu mới cho tài khoản ${email}` : 'Tạo mật khẩu mới cho tài khoản của bạn'}
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
        {/* New Password */}
        <div>
          <label htmlFor="newPassword" className="sr-only">Mật khẩu mới</label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <LockClosedIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              id="newPassword"
              name="newPassword"
              type={showPassword ? "text" : "password"}
              required
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                if (e.target.value) validatePassword(e.target.value);
              }}
              onBlur={(e) => validatePassword(e.target.value)}
              className={`block w-full rounded-lg border-0 py-2.5 pl-10 pr-10 text-gray-900 
                ring-1 ring-inset ${passwordError ? 'ring-red-500 focus:ring-red-500' : `ring-gray-300 focus:ring-[#${PrimaryColor}]`} 
                placeholder:text-gray-400 focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6 transition duration-150`}
              placeholder="Mật khẩu mới (ít nhất 8 ký tự)"
            />
            <button 
              type="button" 
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 cursor-pointer"
            >
              {showPassword ? (
                <EyeSlashIcon className="h-5 w-5 text-gray-400 hover:text-gray-500" />
              ) : (
                <EyeIcon className="h-5 w-5 text-gray-400 hover:text-gray-500" />
              )}
            </button>
            {passwordError && (
              <div className="mt-1 text-sm text-red-600 flex items-center gap-1">
                <ExclamationCircleIcon className="h-4 w-4" />
                {passwordError}
              </div>
            )}
          </div>
          <div className="mt-1 text-xs text-gray-500">
            Mật khẩu phải có ít nhất 8 ký tự, bao gồm 1 chữ hoa, 1 số và 1 ký tự đặc biệt.
          </div>
        </div>

        {/* Confirm Password */}
        <div>
          <label htmlFor="confirmPassword" className="sr-only">Xác nhận mật khẩu</label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <LockClosedIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              required
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (e.target.value) validateConfirmPassword(newPassword, e.target.value);
              }}
              onBlur={(e) => validateConfirmPassword(newPassword, e.target.value)}
              className={`block w-full rounded-lg border-0 py-2.5 pl-10 pr-10 text-gray-900 
                ring-1 ring-inset ${confirmPasswordError ? 'ring-red-500 focus:ring-red-500' : `ring-gray-300 focus:ring-[#${PrimaryColor}]`} 
                placeholder:text-gray-400 focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6 transition duration-150`}
              placeholder="Xác nhận mật khẩu mới"
            />
            <button 
              type="button" 
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 cursor-pointer"
            >
              {showConfirmPassword ? (
                <EyeSlashIcon className="h-5 w-5 text-gray-400 hover:text-gray-500" />
              ) : (
                <EyeIcon className="h-5 w-5 text-gray-400 hover:text-gray-500" />
              )}
            </button>
            {confirmPasswordError && (
              <div className="mt-1 text-sm text-red-600 flex items-center gap-1">
                <ExclamationCircleIcon className="h-4 w-4" />
                {confirmPasswordError}
              </div>
            )}
          </div>
        </div>

        {/* Nút gửi */}
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
              Đang xử lý...
            </>
          ) : (
            'Đặt lại mật khẩu'
          )}
        </button>
      </form>
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
          Mật khẩu đã được đặt lại!
        </Dialog.Title>
        <p className="text-sm text-gray-600 mb-6">
          Mật khẩu của bạn đã được đặt lại thành công. Bạn có thể sử dụng mật khẩu mới để đăng nhập vào tài khoản của mình.
        </p>

        {/* Button */}
        <button
          type="button"
          onClick={() => { closeModal(); openLoginModal(); }}
          className={`flex items-center justify-center mx-auto rounded-lg bg-[#${PrimaryColor}] px-4 py-2.5 text-base font-semibold text-white hover:bg-opacity-90 transition duration-150`}
        >
          Đăng nhập ngay
        </button>
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
