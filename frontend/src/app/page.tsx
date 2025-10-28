'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  AcademicCapIcon, 
  UserGroupIcon, 
  VideoCameraIcon,
  ChartBarIcon,
  SparklesIcon,
  PlayCircleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import LoginModal from '@/component/(modal)/login';
import RegisterModal from '@/component/(modal)/register';
import OTPModal from '@/component/(modal)/verifyOtp';

export default function Home() {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isOTPModalOpen, setIsOTPModalOpen] = useState(false);
  const [otpEmail, setOtpEmail] = useState('');
  const [otpPurpose, setOtpPurpose] = useState<'registration' | 'password-reset'>('registration');

  const openLoginModal = () => {
    setIsLoginModalOpen(true);
    setIsRegisterModalOpen(false);
  };

  const closeLoginModal = () => {
    setIsLoginModalOpen(false);
  };

  const openRegisterModal = () => {
    setIsLoginModalOpen(false);
    setIsRegisterModalOpen(true);
  };

  const closeRegisterModal = () => {
    setIsRegisterModalOpen(false);
  };

  const openOTPModal = (email: string = '', purpose: 'registration' | 'password-reset' = 'registration') => {
    setOtpEmail(email);
    setOtpPurpose(purpose);
    setIsRegisterModalOpen(false);
    setIsOTPModalOpen(true);
  };

  const closeOTPModal = () => {
    setIsOTPModalOpen(false);
  };

  const features = [
    {
      icon: VideoCameraIcon,
      title: 'Livestream Tương Tác',
      description: 'Học trực tiếp với giáo viên qua video chất lượng cao, tương tác real-time'
    },
    {
      icon: AcademicCapIcon,
      title: 'Giảng Viên Chất Lượng',
      description: 'Đội ngũ giáo viên giàu kinh nghiệm, nhiệt tình và tâm huyết'
    },
    {
      icon: ChartBarIcon,
      title: 'Theo Dõi Tiến Độ',
      description: 'Báo cáo chi tiết về quá trình học tập và kết quả đạt được'
    },
    {
      icon: UserGroupIcon,
      title: 'Cộng Đồng Học Tập',
      description: 'Kết nối với hàng ngàn học viên và giáo viên trên toàn quốc'
    }
  ];

  const stats = [
    { number: '10,000+', label: 'Học Viên' },
    { number: '500+', label: 'Giáo Viên' },
    { number: '1,000+', label: 'Khóa Học' },
    { number: '95%', label: 'Hài Lòng' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
          <div className="absolute top-40 left-40 w-80 h-80 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 text-center">
          {/* Logo & Brand */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-8"
          >
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="relative">
                <SparklesIcon className="h-12 w-12 text-purple-600" />
                <div className="absolute inset-0 bg-purple-600 blur-xl opacity-50"></div>
              </div>
              <h1 className="text-5xl font-extrabold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                StreamLand
              </h1>
            </div>
          </motion.div>

          {/* Hero Title */}
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-5xl md:text-6xl font-extrabold text-gray-900 mb-6"
          >
            Nền Tảng Học Tập
            <br />
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Livestream Số 1 Việt Nam
            </span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-xl text-gray-600 mb-12 max-w-3xl mx-auto"
          >
            Kết nối học viên và giáo viên qua livestream tương tác. 
            Học mọi lúc, mọi nơi với chất lượng cao nhất.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16"
          >
            <button
              onClick={() => window.location.href = '/student'}
              className="group relative px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full font-semibold text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 flex items-center gap-2"
            >
              <AcademicCapIcon className="h-6 w-6" />
              Bắt Đầu Học Ngay
              <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 rounded-full transition-opacity"></div>
            </button>
            
            <button
              onClick={openLoginModal}
              className="px-8 py-4 bg-white text-gray-800 rounded-full font-semibold text-lg shadow-lg hover:shadow-xl border-2 border-gray-200 hover:border-purple-300 transform hover:scale-105 transition-all duration-300 flex items-center gap-2"
            >
              <PlayCircleIcon className="h-6 w-6" />
              Đăng Nhập
            </button>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto"
          >
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-4xl font-extrabold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                  {stat.number}
                </div>
                <div className="text-gray-600 font-medium">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-extrabold text-gray-900 mb-4">
              Tại Sao Chọn StreamLand?
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Trải nghiệm học tập hiện đại với công nghệ tiên tiến
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="group relative bg-gradient-to-br from-white to-gray-50 p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-100 hover:border-purple-200"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-purple-600/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <feature.icon className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600">
                    {feature.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-extrabold text-gray-900 mb-4">
              Cách Thức Hoạt Động
            </h2>
            <p className="text-xl text-gray-600">
              Chỉ 3 bước đơn giản để bắt đầu
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-12">
            {[
              { step: '01', title: 'Đăng Ký Tài Khoản', desc: 'Tạo tài khoản miễn phí chỉ trong vài giây' },
              { step: '02', title: 'Chọn Khóa Học', desc: 'Tìm kiếm và chọn khóa học phù hợp với bạn' },
              { step: '03', title: 'Bắt Đầu Học', desc: 'Tham gia livestream và học cùng giáo viên' }
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: index * 0.2 }}
                viewport={{ once: true }}
                className="relative"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center mb-6 shadow-lg">
                    <span className="text-3xl font-bold text-white">{item.step}</span>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">
                    {item.title}
                  </h3>
                  <p className="text-gray-600">
                    {item.desc}
                  </p>
                  <CheckCircleIcon className="h-8 w-8 text-green-500 mt-4" />
                </div>
                {index < 2 && (
                  <div className="hidden md:block absolute top-10 left-full w-full h-0.5 bg-gradient-to-r from-blue-300 to-purple-300 -translate-x-1/2"></div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl font-extrabold text-white mb-6">
              Sẵn Sàng Bắt Đầu Hành Trình Học Tập?
            </h2>
            <p className="text-xl text-blue-100 mb-8">
              Tham gia cùng hàng ngàn học viên đang học tập mỗi ngày
            </p>
            <button
              onClick={() => window.location.href = '/student'}
              className="px-10 py-4 bg-white text-purple-600 rounded-full font-bold text-lg shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300"
            >
              Đăng Ký Miễn Phí Ngay
            </button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <SparklesIcon className="h-8 w-8 text-purple-400" />
            <span className="text-2xl font-bold">StreamLand</span>
          </div>
          <p className="text-gray-400 mb-4">
            Nền tảng học tập livestream hàng đầu Việt Nam
          </p>
          <div className="flex justify-center gap-6 text-sm text-gray-400">
            <a href="#" className="hover:text-white transition-colors">Về chúng tôi</a>
            <a href="#" className="hover:text-white transition-colors">Điều khoản</a>
            <a href="#" className="hover:text-white transition-colors">Chính sách</a>
            <a href="#" className="hover:text-white transition-colors">Liên hệ</a>
          </div>
          <p className="text-gray-500 text-sm mt-6">
            © 2025 StreamLand. All rights reserved.
          </p>
        </div>
      </footer>

      {/* Modals */}
      <LoginModal 
        isOpen={isLoginModalOpen}
        closeModal={closeLoginModal}
        openRegisterModal={openRegisterModal} openForgotPasswordModal={function (): void {
          throw new Error('Function not implemented.');
        } }      />
      
      <RegisterModal 
        isOpen={isRegisterModalOpen} 
        closeModal={closeRegisterModal} 
        openOTPModal={openOTPModal}
        openLoginModal={openLoginModal}
      />
      
      <OTPModal 
        isOpen={isOTPModalOpen} 
        closeModal={closeOTPModal}
        email={otpEmail}
        otpPurpose={otpPurpose}
      />
    </div>
  );
}
