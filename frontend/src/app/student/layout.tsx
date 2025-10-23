// components/Layout/MainLayout.jsx

// Tái sử dụng các component đã định nghĩa: Sidebar và Header
import Header from '@/component/student/Headerbar';
import Sidebar from '@/component/student/Sidebar';
import { ReactNode } from 'react';

const BackgroundColor = 'F0F2F9'; // Xanh nhạt, phù hợp với màu chủ đạo #161853

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    // Container chính với màu nền - overflow-hidden để loại bỏ scroll
    <div className={`h-screen w-screen bg-[#${BackgroundColor}] relative overflow-hidden`}>
      
      {/* 1. Sidebar (Fixed - Cột bên trái) */}
      <Sidebar />
      
      {/* 2. Header (Fixed - Thanh ngang trên cùng) */}
      <Header />
      
      {/* 3. Main Content Area */}
      {/* ml-20: Đẩy nội dung sang phải để tránh Sidebar */}
      {/* pt-16: Đẩy nội dung xuống dưới để tránh Header */}
      {/* h-[calc(100vh-64px)]: Chiều cao là 100vh trừ đi chiều cao của Header */}
      {/* overflow-hidden: Không cho phép cuộn để tránh tràn */}
      <main className="ml-20 pt-16 px-4 pb-0 h-[calc(100vh-64px)] w-[calc(100vw-80px)] overflow-hidden">
        {/* NỘI DUNG TRANG ĐƯỢC CHÈN VÀO ĐÂY */}
        {children}
      </main>
      
    </div>
  );
}