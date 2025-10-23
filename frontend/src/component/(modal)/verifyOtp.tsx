// components/Auth/OTPModal.jsx
import { Dialog, Transition } from '@headlessui/react';
import { Fragment, useState, useRef } from 'react';
import { ShieldCheckIcon } from '@heroicons/react/24/outline';

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
  const [otp, setOtp] = useState(new Array(OTP_LENGTH).fill(''));
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

  const handleVerify = () => {
    const finalOtp = otp.join('');
    if (finalOtp.length === OTP_LENGTH) {
      console.log('OTP đã nhập:', finalOtp);
      // Gửi finalOtp lên API để xác thực
      if (otpPurpose === 'password-reset' && openResetPasswordModal && email) {
        console.log('Xác thực OTP cho việc đặt lại mật khẩu cho email:', email);
        closeModal();
        // Mở modal đặt lại mật khẩu
        openResetPasswordModal(email);
      } else {
        console.log('Xác thực OTP cho việc đăng ký.');
        alert(`Đã xác thực OTP thành công!`);
        closeModal();
      }
    } else {
      alert('Vui lòng nhập đủ 6 chữ số OTP.');
    }
  };
  
  const handleResend = () => {
    // Logic gửi lại mã OTP
    setOtp(new Array(OTP_LENGTH).fill(''));
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
    console.log('Đã gửi lại mã OTP.');
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
                        Xác Thực Mã OTP
                    </Dialog.Title>
                    <p className="mt-2 text-sm text-gray-500">
                        {otpPurpose === 'password-reset' 
                          ? `Mã xác thực đặt lại mật khẩu (6 chữ số) đã được gửi đến ${email || 'Email của bạn'}.`
                          : 'Mã xác thực (6 chữ số) đã được gửi đến Email của bạn.'}
                    </p>
                </div>

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
                        disabled={otp.join('').length !== OTP_LENGTH}
                        className={`flex w-full justify-center rounded-lg px-4 py-2.5 text-base font-semibold text-white shadow-md transition duration-150 ${
                            otp.join('').length === OTP_LENGTH 
                                ? `bg-[#${SecondaryColor}] hover:bg-opacity-90`
                                : 'bg-gray-400 cursor-not-allowed'
                        }`}
                    >
                        Xác Thực
                    </button>
                    
                    <p className="text-center text-sm text-gray-500">
                        Chưa nhận được mã?{' '}
                        <button
                            type="button"
                            onClick={handleResend}
                            className={`font-semibold text-[#${PrimaryColor}] hover:text-opacity-80 transition duration-150`}
                        >
                            Gửi lại mã
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