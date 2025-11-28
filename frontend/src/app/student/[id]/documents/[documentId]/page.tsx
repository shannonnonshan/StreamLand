"use client";

import { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  DocumentIcon, 
  DocumentTextIcon, 
  ArrowDownTrayIcon, 
  ArrowUturnLeftIcon,
  BookmarkIcon,
  ShareIcon,
  DocumentDuplicateIcon,
  PrinterIcon,
  ClockIcon,
  TagIcon,
  FolderIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  HandThumbUpIcon as HandThumbUpOutline,
} from '@heroicons/react/24/outline';

import { 
  BookmarkIcon as BookmarkSolidIcon,
  HandThumbUpIcon as HandThumbUpSolid,
} from '@heroicons/react/24/solid';

// Giả lập dữ liệu tài liệu
type Document = {
  id: string;
  title: string;
  filename: string;
  type: 'pdf' | 'doc' | 'ppt' | 'xls' | 'img' | 'other';
  size: string; // kích thước file (MB/KB)
  uploadDate: string; // Ngày tải lên
  lastModified: string; // Ngày chỉnh sửa cuối
  pinnedAt: string | null; // Đánh dấu ghim
  tags: string[]; // Thẻ phân loại
  folder: string | null; // Thư mục chứa
  previewUrl?: string; // URL cho xem trước
  downloadUrl: string; // URL để tải xuống
  description?: string; // Mô tả tài liệu
  author?: string; // Tác giả
  totalPages?: number; // Tổng số trang (cho PDF)
  viewCount?: number; // Số lượt xem
  likeCount?: number; // Số lượt thích
  isLiked?: boolean; // Người dùng đã thích chưa
};

// Dữ liệu giả
const mockDocuments: Document[] = [
  {
    id: '1',
    title: 'Tài liệu luyện thi IELTS Speaking',
    filename: 'ielts-speaking-2023.pdf',
    type: 'pdf',
    size: '2.4 MB',
    uploadDate: '2025-09-10',
    lastModified: '2025-10-15',
    pinnedAt: '2025-10-15',
    tags: ['IELTS', 'Speaking', 'English'],
    folder: 'Tiếng Anh',
    downloadUrl: '#',
    description: 'Tài liệu toàn diện giúp luyện thi IELTS Speaking với các chiến lược, mẹo và bài mẫu được cập nhật cho năm 2023. Bao gồm phân tích từng phần của bài thi Speaking và các câu hỏi thường gặp.',
    author: 'ThS. Nguyễn Văn A',
    totalPages: 45,
    viewCount: 1243,
    likeCount: 87,
    isLiked: true,
  },
  {
    id: '2',
    title: 'Bài giảng Lập trình Python cơ bản',
    filename: 'python-basics.pdf',
    type: 'pdf',
    size: '5.7 MB',
    uploadDate: '2025-08-22',
    lastModified: '2025-08-22',
    pinnedAt: '2025-10-10',
    tags: ['Programming', 'Python'],
    folder: 'Lập trình',
    downloadUrl: '#',
    description: 'Tổng hợp kiến thức cơ bản về Python, từ cú pháp, biến, vòng lặp đến hàm và xử lý file. Phù hợp cho người mới bắt đầu học lập trình Python.',
    author: 'TS. Trần Văn B',
    totalPages: 78,
    viewCount: 895,
    likeCount: 62,
    isLiked: false,
  },
  {
    id: '3',
    title: 'Slide Toán cao cấp - Phần Đạo hàm',
    filename: 'calculus-derivatives.ppt',
    type: 'ppt',
    size: '3.2 MB',
    uploadDate: '2025-07-15',
    lastModified: '2025-07-15',
    pinnedAt: null,
    tags: ['Toán cao cấp', 'Đạo hàm'],
    folder: 'Toán',
    downloadUrl: '#',
    description: 'Slide trình bày chi tiết về lý thuyết đạo hàm trong toán cao cấp. Bao gồm các định nghĩa, tính chất, các quy tắc tính đạo hàm và ứng dụng thực tế.',
    author: 'PGS.TS. Lê Thị C',
    totalPages: 32,
    viewCount: 567,
    likeCount: 41,
    isLiked: false,
  },
  {
    id: '4',
    title: 'Sơ đồ tư duy Hóa hữu cơ',
    filename: 'organic-chemistry-mindmap.pdf',
    type: 'pdf',
    size: '1.8 MB',
    uploadDate: '2025-10-01',
    lastModified: '2025-10-02',
    pinnedAt: null,
    tags: ['Hóa học', 'Hữu cơ', 'Sơ đồ tư duy'],
    folder: 'Hóa học',
    downloadUrl: '#',
    description: 'Sơ đồ tư duy tổng quan về hóa hữu cơ, giúp học sinh dễ dàng nắm bắt và ghi nhớ các nhóm chất, phản ứng quan trọng và mối liên hệ giữa chúng.',
    author: 'ThS. Phạm Thị D',
    totalPages: 12,
    viewCount: 789,
    likeCount: 53,
    isLiked: true,
  },
  {
    id: '5',
    title: 'Bảng công thức Vật lý',
    filename: 'physics-formulas.doc',
    type: 'doc',
    size: '980 KB',
    uploadDate: '2025-09-28',
    lastModified: '2025-09-28',
    pinnedAt: null,
    tags: ['Vật lý', 'Công thức'],
    folder: 'Vật lý',
    downloadUrl: '#',
    description: 'Tổng hợp các công thức vật lý quan trọng cho các phần Cơ học, Nhiệt học, Điện từ học, Quang học và Vật lý hiện đại.',
    author: 'TS. Hoàng Văn E',
    totalPages: 15,
    viewCount: 432,
    likeCount: 29,
    isLiked: false,
  },
  {
    id: '6',
    title: 'Dữ liệu thống kê bài tập lớn',
    filename: 'project-statistics.xls',
    type: 'xls',
    size: '1.5 MB',
    uploadDate: '2025-10-05',
    lastModified: '2025-10-20',
    pinnedAt: null,
    tags: ['Thống kê', 'Dữ liệu', 'Bài tập lớn'],
    folder: null,
    downloadUrl: '#',
    description: 'Bảng dữ liệu thống kê được thu thập và phân tích cho dự án nghiên cứu xã hội học. Bao gồm các biểu đồ và phân tích xu hướng.',
    author: 'Nhóm Nghiên cứu XH',
    viewCount: 125,
    likeCount: 8,
    isLiked: false,
  },
  {
    id: '7',
    title: 'Hình ảnh minh họa thí nghiệm',
    filename: 'lab-experiment-images.zip',
    type: 'other',
    size: '6.2 MB',
    uploadDate: '2025-10-12',
    lastModified: '2025-10-12',
    pinnedAt: null,
    tags: ['Thí nghiệm', 'Hình ảnh'],
    folder: 'Thí nghiệm',
    downloadUrl: '#',
    description: 'Tập hợp hình ảnh minh họa từ các thí nghiệm vật lý và hóa học. Hữu ích cho việc làm báo cáo thí nghiệm và trình bày.',
    author: 'Phòng thí nghiệm KHTN',
    viewCount: 216,
    likeCount: 18,
    isLiked: false,
  }
];

// Mô phỏng các tài liệu liên quan
const getRelatedDocuments = (doc: Document, allDocs: Document[]): Document[] => {
  // Lấy tài liệu có thẻ tương tự
  return allDocs
    .filter(d => d.id !== doc.id && (
      // Cùng thư mục hoặc có ít nhất 1 thẻ trùng nhau
      d.folder === doc.folder || 
      d.tags.some(tag => doc.tags.includes(tag))
    ))
    .slice(0, 3); // Chỉ lấy tối đa 3 tài liệu liên quan
};

export default function DocumentDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [document, setDocument] = useState<Document | null>(null);
  const [relatedDocs, setRelatedDocs] = useState<Document[]>([]);
  const [isPinned, setIsPinned] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'preview' | 'notes'>('preview');
  const [notes, setNotes] = useState('');
  
  // Hiệu ứng xem trước PDF, dùng iframe tạm thời
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  useEffect(() => {
    // Mô phỏng việc lấy dữ liệu từ API
    setTimeout(() => {
      const doc = mockDocuments.find(doc => doc.id === params.id);
      if (doc) {
        setDocument(doc);
        setIsPinned(!!doc.pinnedAt);
        setIsLiked(!!doc.isLiked);
        setRelatedDocs(getRelatedDocuments(doc, mockDocuments));
      } else {
        // Không tìm thấy tài liệu, chuyển hướng về trang danh sách
        router.push('/student/documents');
      }
      setLoading(false);
    }, 300);
  }, [params.id, router]);
  
  const getFileIcon = (type: string) => {
    switch(type) {
      case 'pdf':
        return <DocumentTextIcon className="h-16 w-16 text-red-500" />;
      case 'doc':
        return <DocumentTextIcon className="h-16 w-16 text-blue-500" />;
      case 'ppt':
        return <DocumentTextIcon className="h-16 w-16 text-orange-500" />;
      case 'xls':
        return <DocumentTextIcon className="h-16 w-16 text-green-500" />;
      case 'img':
        return <DocumentTextIcon className="h-16 w-16 text-purple-500" />;
      default:
        return <DocumentIcon className="h-16 w-16 text-gray-500" />;
    }
  };
  
  // Định dạng ngày tháng
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };
  
  // Ghim tài liệu
  const togglePin = () => {
    setIsPinned(!isPinned);
    // Trong thực tế, sẽ gọi API để cập nhật trạng thái ghim
  };
  
  // Thích tài liệu
  const toggleLike = () => {
    setIsLiked(!isLiked);
    if (document) {
      // Trong thực tế, sẽ gọi API để cập nhật lượt thích
      setDocument({
        ...document,
        likeCount: isLiked ? (document.likeCount || 0) - 1 : (document.likeCount || 0) + 1,
        isLiked: !isLiked
      });
    }
  };
  
  // Tải tài liệu
  const handleDownload = () => {
    // Trong thực tế sẽ kích hoạt tải xuống thật
    alert('Đang tải xuống tài liệu: ' + document?.filename);
  };
  
  if (loading) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-[#161853]"></div>
      </div>
    );
  }
  
  if (!document) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-gray-50">
        <DocumentIcon className="h-24 w-24 text-gray-400 mb-4" />
        <h2 className="text-2xl font-semibold text-gray-700">Không tìm thấy tài liệu</h2>
        <p className="mt-2 text-gray-500">Tài liệu này không tồn tại hoặc đã bị xóa.</p>
        <Link href="/student/documents" className="mt-6 px-4 py-2 bg-[#161853] text-white rounded-lg hover:bg-opacity-90 transition flex items-center">
          <ArrowUturnLeftIcon className="h-5 w-5 mr-2" />
          Quay lại danh sách tài liệu
        </Link>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Thanh điều hướng */}
      <div className="flex items-center text-sm text-gray-500 mb-4">
        <Link href="/student/documents" className="hover:text-[#161853] flex items-center">
          <ChevronLeftIcon className="h-4 w-4 mr-1" />
          My Documents
        </Link>
        <ChevronRightIcon className="h-4 w-4 mx-1" />
        <span className="truncate max-w-md">{document.title}</span>
      </div>
      
      {/* Phần trên: Thông tin tài liệu */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <div className="flex flex-col md:flex-row">
          {/* Icon và các nút tác vụ */}
          <div className="flex-shrink-0 flex flex-col items-center mr-8 mb-6 md:mb-0">
            <div className="bg-gray-50 p-6 rounded-lg mb-4 border border-gray-100">
              {getFileIcon(document.type)}
            </div>
            
            <div className="flex flex-col w-full space-y-3">
              <button
                onClick={handleDownload}
                className="w-full flex items-center justify-center px-4 py-2 bg-[#161853] text-white rounded-lg hover:bg-opacity-90 transition"
              >
                <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
                Tải xuống
              </button>
              
              <button
                onClick={togglePin}
                className={`w-full flex items-center justify-center px-4 py-2 ${
                  isPinned 
                    ? 'bg-[#EC255A]/10 text-[#EC255A]' 
                    : 'bg-gray-100 text-gray-600'
                } rounded-lg hover:bg-opacity-90 transition`}
              >
                {isPinned ? (
                  <BookmarkSolidIcon className="h-5 w-5 mr-2" />
                ) : (
                  <BookmarkIcon className="h-5 w-5 mr-2" />
                )}
                {isPinned ? 'Đã ghim' : 'Ghim'}
              </button>
              
              <button
                onClick={() => {
                  // Giả lập chia sẻ tài liệu
                  navigator.clipboard.writeText(window.location.href);
                  alert('Đã sao chép liên kết tài liệu!');
                }}
                className="w-full flex items-center justify-center px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition"
              >
                <ShareIcon className="h-5 w-5 mr-2" />
                Chia sẻ
              </button>
              
              <button
                onClick={() => window.print()}
                className="w-full flex items-center justify-center px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition"
              >
                <PrinterIcon className="h-5 w-5 mr-2" />
                In
              </button>
            </div>
          </div>
          
          {/* Thông tin chi tiết */}
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{document.title}</h1>
            <p className="text-gray-500 mb-6">{document.filename}</p>
            
            <div className="prose max-w-none mb-6">
              <p>{document.description}</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="flex items-center text-gray-600">
                <ClockIcon className="h-5 w-5 mr-2 text-gray-400" />
                <div>
                  <p className="text-sm font-medium">Ngày tải lên</p>
                  <p className="text-sm">{formatDate(document.uploadDate)}</p>
                </div>
              </div>
              
              <div className="flex items-center text-gray-600">
                <FolderIcon className="h-5 w-5 mr-2 text-gray-400" />
                <div>
                  <p className="text-sm font-medium">Thư mục</p>
                  <p className="text-sm">{document.folder || 'Chưa phân loại'}</p>
                </div>
              </div>
              
              <div className="flex items-center text-gray-600">
                <TagIcon className="h-5 w-5 mr-2 text-gray-400" />
                <div>
                  <p className="text-sm font-medium">Thẻ</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {document.tags.map(tag => (
                      <span 
                        key={tag} 
                        className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center text-gray-600">
                <DocumentDuplicateIcon className="h-5 w-5 mr-2 text-gray-400" />
                <div>
                  <p className="text-sm font-medium">Kích thước / Trang</p>
                  <p className="text-sm">
                    {document.size}
                    {document.totalPages && ` • ${document.totalPages} trang`}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between border-t border-gray-100 pt-4">
              <div className="flex items-center space-x-6">
                <div className="flex items-center text-gray-600">
                  <EyeIcon className="h-5 w-5 mr-1 text-gray-400" />
                  <span className="text-sm">{document.viewCount || 0}</span>
                </div>
                <button
                  onClick={toggleLike}
                  className="flex items-center text-gray-600 hover:text-[#EC255A]"
                >
                  {isLiked ? (
                    <HandThumbUpSolid className="h-5 w-5 mr-1 text-[#EC255A]" />
                  ) : (
                    <HandThumbUpOutline className="h-5 w-5 mr-1" />
                  )}
                  <span className="text-sm">{document.likeCount || 0}</span>
                </button>
              </div>
              
              {document.author && (
                <div className="text-sm text-gray-600">
                  <span className="font-medium">Tác giả:</span> {document.author}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Tab xem trước và ghi chú */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-6">
        <div className="flex border-b border-gray-200">
          <button
            className={`px-6 py-3 text-sm font-medium ${
              activeTab === 'preview' 
                ? 'text-[#161853] border-b-2 border-[#161853]' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('preview')}
          >
            Xem trước
          </button>
          <button
            className={`px-6 py-3 text-sm font-medium ${
              activeTab === 'notes' 
                ? 'text-[#161853] border-b-2 border-[#161853]' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('notes')}
          >
            Ghi chú
          </button>
        </div>
        
        <div className="p-6">
          {activeTab === 'preview' ? (
            document.type === 'pdf' ? (
              // Giả lập xem trước PDF với iframe
              <div className="w-full h-[600px] bg-gray-100 rounded-lg flex justify-center items-center">
                <iframe 
                  ref={iframeRef}
                  src="/placeholder-pdf.html" 
                  className="w-full h-full border-0"
                  title={document.title}
                  onError={() => {
                    if (iframeRef.current) {
                      iframeRef.current.srcdoc = `
                        <div style="display:flex;justify-content:center;align-items:center;height:100%;flex-direction:column;font-family:sans-serif;">
                          <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" style="color:#9CA3AF;margin-bottom:16px;">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                          </svg>
                          <h3 style="margin:0 0 8px;color:#4B5563;font-size:18px;font-weight:600;">${document.title}</h3>
                          <p style="margin:0;color:#6B7280;text-align:center;">Xem trước không khả dụng. Vui lòng tải về để xem đầy đủ nội dung.</p>
                        </div>
                      `;
                    }
                  }}
                />
              </div>
            ) : document.type === 'img' ? (
              // Giả lập xem trước hình ảnh
              <div className="w-full h-[600px] bg-gray-100 rounded-lg flex justify-center items-center">
                <p className="text-gray-500">Xem trước hình ảnh không khả dụng. Vui lòng tải về để xem đầy đủ nội dung.</p>
              </div>
            ) : (
              // Các loại file khác không có xem trước
              <div className="w-full h-[300px] bg-gray-100 rounded-lg flex flex-col justify-center items-center">
                {getFileIcon(document.type)}
                <h3 className="text-lg font-medium text-gray-700 mt-4">{document.title}</h3>
                <p className="text-gray-500 mt-2 text-center max-w-lg">
                  Không thể xem trước tài liệu dạng {document.type.toUpperCase()}. 
                  Vui lòng tải về để xem đầy đủ nội dung.
                </p>
                <button
                  onClick={handleDownload}
                  className="mt-6 px-4 py-2 bg-[#161853] text-white rounded-lg hover:bg-opacity-90 transition flex items-center"
                >
                  <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
                  Tải xuống
                </button>
              </div>
            )
          ) : (
            // Tab ghi chú
            <div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full h-[300px] p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#161853] focus:border-transparent resize-none"
                placeholder="Enter your notes about this document..."
              />
              <div className="flex justify-end mt-4">
                <button
                  onClick={() => alert('Đã lưu ghi chú!')}
                  className="px-4 py-2 bg-[#161853] text-white rounded-lg hover:bg-opacity-90 transition"
                >
                  Lưu ghi chú
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Tài liệu liên quan */}
      {relatedDocs.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Tài liệu liên quan</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {relatedDocs.map(doc => (
              <Link 
                href={`/student/documents/${doc.id}`}
                key={doc.id}
                className="flex items-start p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition"
              >
                <div className="flex-shrink-0 mr-4">
                  {doc.type === 'pdf' && <DocumentTextIcon className="h-10 w-10 text-red-500" />}
                  {doc.type === 'doc' && <DocumentTextIcon className="h-10 w-10 text-blue-500" />}
                  {doc.type === 'ppt' && <DocumentTextIcon className="h-10 w-10 text-orange-500" />}
                  {doc.type === 'xls' && <DocumentTextIcon className="h-10 w-10 text-green-500" />}
                  {doc.type === 'img' && <DocumentTextIcon className="h-10 w-10 text-purple-500" />}
                  {doc.type === 'other' && <DocumentIcon className="h-10 w-10 text-gray-500" />}
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 line-clamp-2">{doc.title}</h3>
                  <p className="text-gray-500 text-sm mt-1">{doc.folder || 'Chưa phân loại'}</p>
                  <div className="flex items-center mt-2 text-xs text-gray-500">
                    <EyeIcon className="h-3 w-3 mr-1" />
                    <span className="mr-3">{doc.viewCount || 0}</span>
                    <HandThumbUpOutline className="h-3 w-3 mr-1" />
                    <span>{doc.likeCount || 0}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
