'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDownIcon, UserCircleIcon, ShieldCheckIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import { ChevronDown, UserCircle, Settings, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import Image from 'next/image';

interface AccountMenuProps {
  /** User role: 'student', 'teacher', or 'admin' */
  role: 'student' | 'teacher' | 'admin';
  /** Base path for navigation (e.g., '/student', '/teacher/1', '/admin/1') */
  basePath: string;
  /** Whether to use framer-motion animations (for student) */
  useAnimation?: boolean;
  /** Optional: Show 2FA toggle (only for student) */
  show2FA?: boolean;
}

export default function AccountMenu({ role, basePath, useAnimation = false, show2FA = false }: AccountMenuProps) {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getRoleDisplay = () => {
    return user?.role || role.toUpperCase();
  };

  const getDefaultName = () => {
    switch (role) {
      case 'teacher': return 'Teacher';
      case 'admin': return 'Admin';
      default: return 'User';
    }
  };

  const handleLogout = () => {
    setIsUserMenuOpen(false);
    logout();
    router.push('/');
  };

  const handleProfileClick = () => {
    setIsUserMenuOpen(false);
    router.push(`${basePath}/profile`);
  };

  const handleSettingsClick = () => {
    setIsUserMenuOpen(false);
    router.push(`${basePath}/settings`);
  };

  if (!isAuthenticated || !user) {
    return (
      <button
        onClick={() => router.push('/auth/login')}
        className="px-4 py-2 bg-[#161853] text-white rounded-lg hover:bg-[#292C6D] transition-colors font-medium text-sm"
      >
        Login
      </button>
    );
  }

  // Student style with Heroicons and framer-motion
  if (role === 'student' && useAnimation) {
    return (
      <div className="relative" ref={userMenuRef}>
        <div
          className="flex items-center space-x-2 cursor-pointer hover:opacity-80 transition-all duration-300 px-2 py-1 rounded-lg hover:bg-gray-50"
          onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
        >
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 border-2 border-white shadow-sm overflow-hidden flex items-center justify-center text-white font-semibold">
            {user.avatar ? (
              <Image src={user.avatar} alt={user.fullName || 'User'} width={32} height={32} className="w-full h-full object-cover" />
            ) : (
              <span>{user.fullName?.charAt(0)?.toUpperCase() || 'U'}</span>
            )}
          </div>
          <div className="hidden md:block text-left">
            <p className="text-sm font-semibold text-gray-800">{user.fullName || getDefaultName()}</p>
            <p className="text-xs text-gray-500">{getRoleDisplay()}</p>
          </div>
          <ChevronDownIcon className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
        </div>

        <AnimatePresence>
          {isUserMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-100 py-2 z-50"
            >
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-800">{user.fullName || getDefaultName()}</p>
                <p className="text-xs text-gray-500">{user.email}</p>
              </div>

              <button
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                onClick={handleProfileClick}
              >
                <UserCircleIcon className="h-5 w-5 text-gray-500" />
                <span>Personal Information</span>
              </button>

              {show2FA && (
                <div className="px-4 py-2 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ShieldCheckIcon className="h-5 w-5 text-gray-500" />
                      <span className="text-sm text-gray-700">Two-Factor Authentication</span>
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
                    {twoFactorEnabled ? '2FA security enabled' : 'Enhance account security'}
                  </p>
                </div>
              )}

              <button
                onClick={handleLogout}
                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 border-t border-gray-100 mt-1"
              >
                <ArrowRightOnRectangleIcon className="h-5 w-5" />
                <span>Logout</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Teacher/Admin style with Lucide icons and simple CSS transitions
  const bgColor = role === 'admin' ? 'bg-[#292C6D]' : 'bg-[#161853]';
  const badgeBg = role === 'admin' ? 'bg-[#FAEDF0] text-[#292C6D]' : 'bg-[#FAEF5D] text-[#161853]';

  return (
    <div className="relative" ref={userMenuRef}>
      <div
        onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
        className="flex items-center space-x-2 cursor-pointer hover:opacity-80 transition-all duration-300 px-2 py-1 rounded-lg hover:bg-gray-50"
      >
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 border-2 border-white shadow-sm overflow-hidden flex items-center justify-center text-white font-semibold">
          {user.avatar ? (
            <Image src={user.avatar} alt={user.fullName || getDefaultName()} width={32} height={32} className="w-full h-full object-cover" />
          ) : (
            <span>{user.fullName?.charAt(0)?.toUpperCase() || getDefaultName().charAt(0)}</span>
          )}
        </div>
        <div className="hidden md:block text-left">
          <p className="text-sm font-semibold text-gray-800">{user.fullName || getDefaultName()}</p>
          <p className="text-xs text-gray-500">{getRoleDisplay()}</p>
        </div>
        <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
      </div>

      {isUserMenuOpen && (
        <div className="absolute right-0 top-12 w-64 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-50">
          <div className={`p-4 ${bgColor} text-white`}>
            <p className="text-sm font-semibold">{user.fullName || getDefaultName()}</p>
            <p className="text-xs opacity-80 truncate">{user.email}</p>
            <span className={`inline-block mt-2 px-2 py-1 ${badgeBg} rounded text-xs font-bold`}>
              {getRoleDisplay()}
            </span>
          </div>

          <div className="py-2">
            {role !== 'admin' && (
              <button
                onClick={handleProfileClick}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
              >
                <UserCircle className="h-5 w-5 text-gray-600" />
                <span className="text-sm text-gray-700">Personal Information</span>
              </button>
            )}
            <button
              onClick={handleSettingsClick}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
            >
              <Settings className="h-5 w-5 text-gray-600" />
              <span className="text-sm text-gray-700">Settings</span>
            </button>
          </div>

          <div className="border-t border-gray-200">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-3 w-full hover:bg-red-50 transition-colors text-left"
            >
              <LogOut className="h-5 w-5 text-red-600" />
              <span className="text-sm text-red-600 font-medium">Logout</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
