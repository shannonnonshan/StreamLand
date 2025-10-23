// components/Auth/LoginModal.jsx
import { Dialog, Transition } from '@headlessui/react';
import { Fragment, useState, useEffect } from 'react';
import { AtSymbolIcon, LockClosedIcon, AcademicCapIcon, EyeIcon, EyeSlashIcon, ExclamationCircleIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { FaGithub } from 'react-icons/fa'; // Cần cài đặt react-icons: npm install react-icons

const PrimaryColor = '161853'; // Xanh Đậm (màu chủ đạo mới)

type LoginModalProps = {
  isOpen: boolean;
  closeModal: () => void;
  openRegisterModal: () => void;
  openForgotPasswordModal: () => void;
};

type NotificationType = 'success' | 'error' | null;

export default function LoginModal({ isOpen, closeModal, openRegisterModal, openForgotPasswordModal }: LoginModalProps) {
  // State quản lý việc show/hide modal
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [notification, setNotification] = useState<{ type: NotificationType; message: string }>({
    type: null,
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset errors when modal is opened
  useEffect(() => {
    if (isOpen) {
      setEmailError('');
      setPasswordError('');
      setNotification({ type: null, message: '' });
    }
  }, [isOpen]);

  // Validate email format
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      setEmailError('Email không được để trống');
      return false;
    } else if (!emailRegex.test(email)) {
      setEmailError('Email không hợp lệ');
      return false;
    }
    setEmailError('');
    return true;
  };

  // Validate password strength
  const validatePassword = (password: string) => {
    if (!password) {
      setPasswordError('Mật khẩu không được để trống');
      return false;
    } else if (password.length < 6) {
      setPasswordError('Mật khẩu phải có ít nhất 6 ký tự');
      return false;
    }
    setPasswordError('');
    return true;
  };

  const handleSubmit = async (e: { preventDefault: () => void; }) => {
    e.preventDefault();
    
    // Validate form
    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);
    
    if (!isEmailValid || !isPasswordValid) {
      return;
    }
    
    setIsSubmitting(true);
    setNotification({ type: null, message: '' });
    
    try {
      console.log('Đăng nhập với:', { email, password });
      // Mock API call with timeout
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Thêm logic API đăng nhập ở đây
      // Mẫu phản hồi thành công
      setNotification({
        type: 'success',
        message: 'Đăng nhập thành công!'
      });
      
      // Đóng modal sau 1.5 giây khi đăng nhập thành công
      setTimeout(() => {
        closeModal();
      }, 1500);
      
    } catch {
      // Xử lý lỗi
      setNotification({
        type: 'error',
        message: 'Đăng nhập thất bại. Vui lòng kiểm tra email và mật khẩu.'
      });
    } finally {
      setIsSubmitting(false);
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
                
                {/* Header */}
                <Dialog.Title
                  as="h3"
                  className={`text-2xl font-extrabold leading-6 text-[#${PrimaryColor}] flex items-center gap-2 mb-2`}
                >
                  <AcademicCapIcon className={`h-6 w-6 text-[#${PrimaryColor}]`} />
                  Chào mừng trở lại Streamland
                </Dialog.Title>
                <p className="text-sm text-gray-600 mb-6">
                  Đăng nhập để tiếp tục hành trình học tập và giảng dạy.
                </p>
                
                {/* Nút đăng nhập bên ngoài */}
                <div className="space-y-3 mb-6">
                  {/* Google Login */}
                  <button
                    type="button"
                    className={`flex w-full items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-base font-semibold text-[#${PrimaryColor}] shadow-sm hover:bg-gray-50 transition duration-150`}
                  >
                    <div className="mr-2 h-5 w-5 flex items-center justify-center">
                      <svg width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
                        <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/>
                        <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"/>
                        <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"/>
                        <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"/>
                      </svg>
                    </div>
                    Đăng nhập bằng Google
                  </button>
                  {/* Github Login */}
                  <button
                    type="button"
                    className={`flex w-full items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-base font-semibold text-[#${PrimaryColor}] shadow-sm hover:bg-gray-50 transition duration-150 cursor-pointer`}
                  >
                    <FaGithub className="mr-2 h-5 w-5 text-gray-800" />
                    Đăng nhập bằng GitHub
                  </button>
                </div>

                <div className="relative flex justify-center py-4">
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="w-full border-t border-gray-200" />
                  </div>
                  <div className="relative bg-white px-4 text-sm font-medium text-gray-600">
                    Hoặc đăng nhập bằng Email
                  </div>
                </div>

                {/* Notification */}
                {notification.type && (
                  <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
                    notification.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                  }`}>
                    {notification.type === 'success' ? (
                      <CheckCircleIcon className="h-5 w-5 text-green-500" />
                    ) : (
                      <ExclamationCircleIcon className="h-5 w-5 text-red-500" />
                    )}
                    <span className="text-sm">{notification.message}</span>
                  </div>
                )}

                {/* Form Login */}
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
                        placeholder="Địa chỉ Email"
                      />
                    </div>
                    {emailError && (
                      <div className="mt-1 text-sm text-red-600 flex items-center gap-1">
                        <ExclamationCircleIcon className="h-4 w-4" />
                        {emailError}
                      </div>
                    )}
                  </div>
                  
                  {/* Password */}
                  <div>
                    <label htmlFor="password" className="sr-only">Mật khẩu</label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <LockClosedIcon className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (e.target.value) validatePassword(e.target.value);
                        }}
                        onBlur={(e) => validatePassword(e.target.value)}
                        className={`block w-full rounded-lg border-0 py-2.5 pl-10 pr-10 text-gray-900 
                          ring-1 ring-inset ${passwordError ? 'ring-red-500 focus:ring-red-500' : `ring-gray-300 focus:ring-[#${PrimaryColor}]`} 
                          placeholder:text-gray-400 focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6 transition duration-150`}
                        placeholder="Mật khẩu"
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute top-0 bottom-0 right-0 flex items-center pr-3 cursor-pointer"
                      >
                        {showPassword ? (
                          <EyeSlashIcon className="h-5 w-5 text-gray-400 hover:text-gray-500" />
                        ) : (
                          <EyeIcon className="h-5 w-5 text-gray-400 hover:text-gray-500" />
                        )}
                      </button>
                    </div>
                    {passwordError && (
                      <div className="mt-1 text-sm text-red-600 flex items-center gap-1">
                        <ExclamationCircleIcon className="h-4 w-4" />
                        {passwordError}
                      </div>
                    )}
                    <div className="flex justify-end mt-2">
                      <button 
                        type="button"
                        onClick={() => { closeModal(); openForgotPasswordModal(); }}
                        className="text-xs text-[#161853] hover:text-[#EC255A] cursor-pointer"
                      >
                        Quên mật khẩu?
                      </button>
                    </div>
                  </div>

                  {/* Nút Đăng nhập */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`flex w-full justify-center rounded-lg bg-[#EC255A] px-3 py-2.5 text-base font-semibold text-white shadow-md hover:bg-[#D91E50] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#EC255A] transition duration-150 cursor-pointer
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
                      'Đăng Nhập'
                    )}
                  </button>
                </form>

                {/* Footer */}
                <div className="mt-6 text-center text-sm">
                  <p className="text-gray-500">
                    Chưa có tài khoản?{' '}
                    <button
                      type="button"
                      onClick={() => { closeModal(); openRegisterModal(); }}
                      className={`font-semibold text-[#${PrimaryColor}] hover:text-opacity-80 transition duration-150 cursor-pointer`}
                    >
                      Đăng Ký ngay
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