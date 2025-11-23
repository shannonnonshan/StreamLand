'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { 
  AcademicCapIcon, 
  UserGroupIcon, 
  VideoCameraIcon,
  ChartBarIcon,
  SparklesIcon,
  PlayCircleIcon,
  CheckCircleIcon,
  SignalIcon,
  UserIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
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
      title: 'Interactive Livestream',
      description: 'Learn directly with teachers through high-quality video with real-time interaction'
    },
    {
      icon: AcademicCapIcon,
      title: 'Quality Instructors',
      description: 'Team of experienced, enthusiastic and dedicated teachers'
    },
    {
      icon: ChartBarIcon,
      title: 'Progress Tracking',
      description: 'Detailed reports on learning progress and achievements'
    },
    {
      icon: UserGroupIcon,
      title: 'Learning Community',
      description: 'Connect with thousands of students and teachers nationwide'
    }
  ];

  const stats = [
    { number: '10,000+', label: 'Students' },
    { number: '500+', label: 'Teachers' },
    { number: '1,000+', label: 'Courses' },
    { number: '95%', label: 'Satisfaction' }
  ];

  const liveStreams = [
    {
      id: 1,
      title: 'Basic Mathematics - Quadratic Equations',
      teacher: 'Mr. Nguyen Van A',
      viewers: 234,
      thumbnail: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?w=800&h=450&fit=crop',
      subject: 'Math',
      isLive: true
    },
    {
      id: 2,
      title: 'Organic Chemistry - Alcohols and Phenols',
      teacher: 'Ms. Tran Thi B',
      viewers: 189,
      thumbnail: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=800&h=450&fit=crop',
      subject: 'Chemistry',
      isLive: true
    },
    {
      id: 3,
      title: 'Physics - Harmonic Oscillation',
      teacher: 'Mr. Le Van C',
      viewers: 156,
      thumbnail: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800&h=450&fit=crop',
      subject: 'Physics',
      isLive: false
    }
  ];

  const testimonials = [
    {
      name: 'Nguyen Thi Mai',
      role: '12th Grade Student',
      avatar: 'https://i.pravatar.cc/150?img=1',
      rating: 5,
      comment: 'StreamLand helped me improve my grades significantly. The teachers are very dedicated and easy to understand!'
    },
    {
      name: 'Tran Van Nam',
      role: 'Parent',
      avatar: 'https://i.pravatar.cc/150?img=2',
      rating: 5,
      comment: 'My child loves learning on StreamLand. This platform is truly effective and convenient.'
    },
    {
      name: 'Le Thu Huong',
      role: '11th Grade Student',
      avatar: 'https://i.pravatar.cc/150?img=3',
      rating: 5,
      comment: 'Direct interaction with teachers helps me understand lessons much faster. Definitely worth trying!'
    }
  ];

  const [activeVideoIndex, setActiveVideoIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveVideoIndex((prev) => (prev + 1) % liveStreams.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [liveStreams.length]);

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
            Leading Learning Platform
            <br />
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              #1 Livestream Education
            </span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-xl text-gray-600 mb-12 max-w-3xl mx-auto"
          >
            Connecting students and teachers through interactive livestream. 
            Learn anytime, anywhere with the highest quality.
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
              Start Learning Now
              <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 rounded-full transition-opacity"></div>
            </button>
            
            <button
              onClick={openLoginModal}
              className="px-8 py-4 bg-white text-gray-800 rounded-full font-semibold text-lg shadow-lg hover:shadow-xl border-2 border-gray-200 hover:border-purple-300 transform hover:scale-105 transition-all duration-300 flex items-center gap-2"
            >
              <PlayCircleIcon className="h-6 w-6" />
              Sign In
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

      {/* Live Showcase Section */}
      <section className="py-20 bg-gradient-to-b from-gray-50 to-white relative overflow-hidden">
        {/* Background Decoration */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500 rounded-full filter blur-3xl"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500 rounded-full filter blur-3xl"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-full mb-4">
              <div className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </div>
              <span className="text-sm font-semibold text-red-600">LIVE NOW</span>
            </div>
            <h2 className="text-4xl font-extrabold text-gray-900 mb-4">
              Experience Online Classroom
            </h2>
            <p className="text-xl text-gray-600">
              Join live learning sessions happening now
            </p>
          </motion.div>

          {/* Main Video Showcase */}
          <div className="grid lg:grid-cols-2 gap-8 items-center mb-12">
            {/* Video Player */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
              className="relative group"
            >
              <div className="relative rounded-2xl overflow-hidden shadow-2xl">
                {/* Video/Image */}
                <div className="aspect-video bg-gradient-to-br from-gray-800 to-gray-900 relative">
                  <Image 
                    src={liveStreams[activeVideoIndex].thumbnail}
                    alt={liveStreams[activeVideoIndex].title}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                  
                  {/* Live Badge */}
                  {liveStreams[activeVideoIndex].isLive && (
                    <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-red-600 rounded-full">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                      <span className="text-white font-bold text-sm">LIVE</span>
                    </div>
                  )}

                  {/* Viewer Count */}
                  <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 bg-black/50 backdrop-blur-sm rounded-full">
                    <UserIcon className="h-4 w-4 text-white" />
                    <span className="text-white font-semibold text-sm">{liveStreams[activeVideoIndex].viewers}</span>
                  </div>

                  {/* Play Overlay */}
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center">
                    <motion.div
                      whileHover={{ scale: 1.1 }}
                      className="w-20 h-20 bg-white/90 rounded-full flex items-center justify-center cursor-pointer shadow-lg"
                    >
                      <PlayCircleIcon className="h-12 w-12 text-purple-600" />
                    </motion.div>
                  </div>

                  {/* Chat Overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <div className="w-6 h-6 bg-blue-500 rounded-full flex-shrink-0"></div>
                        <div className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-lg">
                          <p className="text-white text-sm">Great lesson! 🔥</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="w-6 h-6 bg-purple-500 rounded-full flex-shrink-0"></div>
                        <div className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-lg">
                          <p className="text-white text-sm">I understand now, thank you! ❤️</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Video Info */}
                <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black/80 to-transparent">
                  <h3 className="text-xl font-bold text-white mb-2">
                    {liveStreams[activeVideoIndex].title}
                  </h3>
                  <div className="flex items-center gap-3 text-gray-200">
                    <span className="font-medium">{liveStreams[activeVideoIndex].teacher}</span>
                    <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                    <span className="text-sm">{liveStreams[activeVideoIndex].subject}</span>
                  </div>
                </div>
              </div>

              {/* Floating Stats */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="absolute -bottom-6 -right-6 bg-white rounded-2xl shadow-xl p-6 hidden lg:block"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-green-600 rounded-xl flex items-center justify-center">
                    <SignalIcon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">99.9%</p>
                    <p className="text-sm text-gray-500">Uptime</p>
                  </div>
                </div>
              </motion.div>
            </motion.div>

            {/* Live Stream List */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
              className="space-y-4"
            >
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Ongoing Live Sessions</h3>
              
              {liveStreams.map((stream, index) => (
                <motion.div
                  key={stream.id}
                  whileHover={{ scale: 1.02, x: 10 }}
                  onClick={() => setActiveVideoIndex(index)}
                  className={`cursor-pointer rounded-xl p-4 transition-all duration-300 ${
                    activeVideoIndex === index 
                      ? 'bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-purple-300 shadow-lg' 
                      : 'bg-white border-2 border-gray-100 hover:border-purple-200 shadow-sm'
                  }`}
                >
                  <div className="flex gap-4">
                    {/* Thumbnail */}
                    <div className="relative w-32 h-20 rounded-lg overflow-hidden flex-shrink-0">
                      <Image 
                        src={stream.thumbnail}
                        alt={stream.title}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                      {stream.isLive && (
                        <div className="absolute top-1 left-1 px-2 py-0.5 bg-red-600 rounded text-white text-xs font-bold">
                          LIVE
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900 mb-1 line-clamp-1">
                        {stream.title}
                      </h4>
                      <p className="text-sm text-gray-600 mb-2">{stream.teacher}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <UserIcon className="h-3 w-3" />
                          <span>{stream.viewers}</span>
                        </div>
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium">
                          {stream.subject}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}

              {/* View All Button */}
              <button 
                onClick={() => window.location.href = '/student'}
                className="w-full mt-4 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-300"
              >
                View All Livestreams
              </button>
            </motion.div>
          </div>
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
              Why Choose StreamLand?
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Modern learning experience with advanced technology
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
              How It Works
            </h2>
            <p className="text-xl text-gray-600">
              Just 3 simple steps to get started
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-12">
            {[
              { step: '01', title: 'Create Account', desc: 'Sign up for free in just seconds' },
              { step: '02', title: 'Choose Course', desc: 'Find and select the course that suits you' },
              { step: '03', title: 'Start Learning', desc: 'Join livestreams and learn with teachers' }
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

      {/* Testimonials Section */}
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
              What Students Say About Us
            </h2>
            <p className="text-xl text-gray-600">
              Thousands of students have trusted and succeeded with StreamLand
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ y: -10 }}
                className="bg-gradient-to-br from-white to-gray-50 p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-100"
              >
                {/* Stars */}
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <StarIconSolid key={i} className="h-5 w-5 text-yellow-400" />
                  ))}
                </div>

                {/* Comment */}
                <p className="text-gray-700 mb-6 italic leading-relaxed">
                  &quot;{testimonial.comment}&quot;
                </p>

                {/* User Info */}
                <div className="flex items-center gap-4">
                  <div className="relative w-12 h-12">
                    <Image 
                      src={testimonial.avatar}
                      alt={testimonial.name}
                      fill
                      className="rounded-full object-cover"
                      unoptimized
                    />
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white"></div>
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">{testimonial.name}</h4>
                    <p className="text-sm text-gray-500">{testimonial.role}</p>
                  </div>
                </div>

                {/* Decoration */}
                <div className="absolute top-6 right-6 text-6xl text-purple-100 font-serif">&quot;</div>
              </motion.div>
            ))}
          </div>

          {/* Success Stories Counter */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            viewport={{ once: true }}
            className="mt-16 text-center"
          >
            <div className="inline-flex items-center gap-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-full shadow-xl">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="relative w-10 h-10">
                    <Image 
                      src={`https://i.pravatar.cc/40?img=${i + 10}`}
                      alt={`User ${i}`}
                      fill
                      className="rounded-full border-2 border-white object-cover"
                      unoptimized
                    />
                  </div>
                ))}
              </div>
              <div className="text-left">
                <p className="font-bold text-lg">10,000+ Satisfied Students</p>
                <p className="text-sm text-blue-100">Join the community today</p>
              </div>
            </div>
          </motion.div>
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
              Ready to Start Your Learning Journey?
            </h2>
            <p className="text-xl text-blue-100 mb-8">
              Join thousands of students learning every day
            </p>
            <button
              onClick={() => window.location.href = '/student'}
              className="px-10 py-4 bg-white text-purple-600 rounded-full font-bold text-lg shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300"
            >
              Sign Up Free Now
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
            Leading livestream learning platform
          </p>
          <div className="flex justify-center gap-6 text-sm text-gray-400">
            <a href="#" className="hover:text-white transition-colors">About Us</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
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
