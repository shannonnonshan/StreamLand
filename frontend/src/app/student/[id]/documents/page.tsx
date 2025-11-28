"use client";

import { useState, useRef } from 'react';
import Link from 'next/link';
import { 
  DocumentIcon, 
  DocumentTextIcon, 
  DocumentArrowUpIcon, 
  DocumentPlusIcon,
  TrashIcon, 
  PencilIcon, 
  BookmarkIcon, 
  MagnifyingGlassIcon,
  FolderPlusIcon,
  ArrowDownTrayIcon,
  ChevronDownIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import { 
  BookmarkIcon as BookmarkSolidIcon 
} from '@heroicons/react/24/solid';

// Application primary colors
// const PrimaryColor = '161853'; // Dark Blue
// const SecondaryColor = 'EC255A'; // Red/Pink

// Document data type
type Document = {
  id: string;
  title: string;
  filename: string;
  type: 'pdf' | 'doc' | 'ppt' | 'xls' | 'img' | 'other';
  size: string; // File size (MB/KB)
  uploadDate: string; // Upload date
  lastModified: string; // Last modified date
  pinnedAt: string | null; // Pinned marker
  tags: string[]; // Classification tags
  folder: string | null; // Containing folder
  previewUrl?: string; // URL for preview
  downloadUrl: string; // URL for download
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
  }
];

// Các folder có sẵn
const mockFolders = [
  'Tiếng Anh',
  'Lập trình',
  'Toán',
  'Hóa học',
  'Vật lý',
  'Thí nghiệm',
  'Tài liệu khác'
];

export default function DocumentsPage() {
  // States
  const [documents, setDocuments] = useState<Document[]>(mockDocuments);
  const [folders, setFolders] = useState<string[]>(mockFolders);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<string>('uploadDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  // State for upload modal functionality - will be implemented in future
  // const [showUploadModal, setShowUploadModal] = useState(false);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [showFolderDropdown, setShowFolderDropdown] = useState(false);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Lấy tất cả tags từ tài liệu
  const allTags = Array.from(
    new Set(documents.flatMap(doc => doc.tags))
  ).sort();
  
  // Lọc tài liệu theo tìm kiếm và bộ lọc
  const filteredDocuments = documents
    .filter(doc => {
      // Lọc theo tìm kiếm
      if (searchQuery && !doc.title.toLowerCase().includes(searchQuery.toLowerCase()) && 
         !doc.filename.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      // Lọc theo thư mục
      if (selectedFolder && doc.folder !== selectedFolder) {
        return false;
      }
      // Lọc theo tags
      if (selectedTags.length > 0 && !selectedTags.some(tag => doc.tags.includes(tag))) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      // Sắp xếp theo field đã chọn
      let valueA: string | null = a[sortBy as keyof Document] as string | null;
      let valueB: string | null = b[sortBy as keyof Document] as string | null;
      
      // Xử lý null values
      if (valueA === null) valueA = '';
      if (valueB === null) valueB = '';
      
      // Sắp xếp tăng hoặc giảm
      const compareResult = valueA.localeCompare(valueB);
      return sortDirection === 'asc' ? compareResult : -compareResult;
    });
  
  // Lấy danh sách tài liệu ghim
  const pinnedDocuments = filteredDocuments.filter(doc => doc.pinnedAt !== null);
  // Lấy danh sách tài liệu không ghim
  const unpinnedDocuments = filteredDocuments.filter(doc => doc.pinnedAt === null);
  
  // Xác định icon cho loại file
  const getFileIcon = (type: string) => {
    switch(type) {
      case 'pdf':
        return <DocumentTextIcon className="h-6 w-6 text-red-500" />;
      case 'doc':
        return <DocumentTextIcon className="h-6 w-6 text-blue-500" />;
      case 'ppt':
        return <DocumentTextIcon className="h-6 w-6 text-orange-500" />;
      case 'xls':
        return <DocumentTextIcon className="h-6 w-6 text-green-500" />;
      case 'img':
        return <DocumentTextIcon className="h-6 w-6 text-purple-500" />;
      default:
        return <DocumentIcon className="h-6 w-6 text-gray-500" />;
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
  
  // Ghim/bỏ ghim tài liệu
  const togglePin = (id: string) => {
    setDocuments(prevDocs => {
      return prevDocs.map(doc => {
        if (doc.id === id) {
          return {
            ...doc,
            pinnedAt: doc.pinnedAt ? null : new Date().toISOString().split('T')[0]
          };
        }
        return doc;
      });
    });
  };
  
  // Xóa tài liệu
  const deleteDocument = (id: string) => {
    if (confirm('Are you sure you want to delete this document?')) {
      setDocuments(prevDocs => prevDocs.filter(doc => doc.id !== id));
    }
  };
  
  // Mở modal chỉnh sửa
  const openEditModal = (doc: Document) => {
    setEditingDocument(doc);
  };
  
  // Chọn/bỏ chọn tài liệu
  const toggleSelectDocument = (id: string) => {
    setSelectedDocuments(prev => {
      if (prev.includes(id)) {
        return prev.filter(docId => docId !== id);
      } else {
        return [...prev, id];
      }
    });
  };
  
  // Chọn/bỏ chọn tất cả
  const toggleSelectAll = () => {
    if (selectedDocuments.length === filteredDocuments.length) {
      setSelectedDocuments([]);
    } else {
      setSelectedDocuments(filteredDocuments.map(doc => doc.id));
    }
  };
  
  // Xóa tài liệu đã chọn
  const deleteSelectedDocuments = () => {
    if (selectedDocuments.length === 0) return;
    
    if (confirm(`Are you sure you want to delete ${selectedDocuments.length} selected documents?`)) {
      setDocuments(prevDocs => 
        prevDocs.filter(doc => !selectedDocuments.includes(doc.id))
      );
      setSelectedDocuments([]);
    }
  };
  
  // Trigger file upload dialog
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };
  
  // Xử lý file khi chọn file
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    // Giả lập tải lên và thêm file mới
    Array.from(files).forEach(file => {
      const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';
      let fileType: Document['type'] = 'other';
      
      if (fileExtension === 'pdf') fileType = 'pdf';
      else if (['doc', 'docx'].includes(fileExtension)) fileType = 'doc';
      else if (['ppt', 'pptx'].includes(fileExtension)) fileType = 'ppt';
      else if (['xls', 'xlsx'].includes(fileExtension)) fileType = 'xls';
      else if (['jpg', 'jpeg', 'png', 'gif'].includes(fileExtension)) fileType = 'img';
      
      const newDoc: Document = {
        id: Math.random().toString(36).substr(2, 9),
        title: file.name.split('.')[0],
        filename: file.name,
        type: fileType,
        size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
        uploadDate: new Date().toISOString().split('T')[0],
        lastModified: new Date().toISOString().split('T')[0],
        pinnedAt: null,
        tags: [],
        folder: null,
        downloadUrl: '#'
      };
      
      setDocuments(prev => [newDoc, ...prev]);
    });
    
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  
  // Tạo folder mới
  const handleCreateFolder = () => {
    if (!newFolderName.trim()) {
      alert('Vui lòng nhập tên thư mục!');
      return;
    }
    
    if (folders.includes(newFolderName.trim())) {
      alert('Thư mục này đã tồn tại!');
      return;
    }
    
    setFolders(prev => [...prev, newFolderName.trim()]);
    setNewFolderName('');
    setShowNewFolderModal(false);
  };
  
  // Render UI
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-2xl font-bold text-[#161853] mb-6">My Documents</h1>
      
      {/* Toolbar */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap gap-4 justify-between items-center">
          {/* Tìm kiếm */}
          <div className="relative w-full md:w-auto flex-grow md:max-w-md">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full rounded-lg border-0 py-2.5 pl-10 pr-3 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-[#161853] sm:text-sm"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2 flex-wrap md:flex-nowrap">
            {/* Upload Button */}
            <button
              onClick={handleUploadClick}
              className="flex items-center px-4 py-2 bg-[#161853] text-white rounded-lg hover:bg-opacity-90 transition"
            >
              <DocumentArrowUpIcon className="h-5 w-5 mr-2" />
              Tải lên
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              multiple
            />
            
            {/* Filter by Folder */}
            <div className="relative">
              <button
                onClick={() => setShowFolderDropdown(!showFolderDropdown)}
                className="flex items-center px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition"
              >
                <FolderPlusIcon className="h-5 w-5 mr-2 text-gray-600" />
                {selectedFolder || 'Thư mục'}
                <ChevronDownIcon className="h-4 w-4 ml-2" />
              </button>
              
              {showFolderDropdown && (
                <div className="absolute z-10 mt-1 right-0 w-56 bg-white border border-gray-200 rounded-lg shadow-lg">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setSelectedFolder(null);
                        setShowFolderDropdown(false);
                      }}
                      className={`${!selectedFolder ? 'bg-gray-100 text-[#161853]' : 'text-gray-700'} w-full text-left px-4 py-2 hover:bg-gray-50`}
                    >
                      Tất cả thư mục
                    </button>
                    {folders.map(folder => (
                      <button
                        key={folder}
                        onClick={() => {
                          setSelectedFolder(folder);
                          setShowFolderDropdown(false);
                        }}
                        className={`${selectedFolder === folder ? 'bg-gray-100 text-[#161853]' : 'text-gray-700'} w-full text-left px-4 py-2 hover:bg-gray-50`}
                      >
                        {folder}
                      </button>
                    ))}
                    <div className="border-t border-gray-200 my-1"></div>
                    <button
                      onClick={() => {
                        setShowFolderDropdown(false);
                        setShowNewFolderModal(true);
                      }}
                      className="w-full text-left px-4 py-2 text-[#161853] hover:bg-gray-50 flex items-center font-medium"
                    >
                      <FolderPlusIcon className="h-4 w-4 mr-2" />
                      Tạo thư mục mới
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            {/* Sort by */}
            <select 
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition"
            >
              <option value="uploadDate">Ngày tải lên</option>
              <option value="title">Tên tài liệu</option>
              <option value="size">Kích thước</option>
              <option value="lastModified">Lần chỉnh sửa cuối</option>
            </select>
            
            {/* Sort direction */}
            <button
              onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition"
              title={sortDirection === 'asc' ? 'Sắp xếp tăng dần' : 'Sắp xếp giảm dần'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-5 h-5 ${sortDirection === 'asc' ? '' : 'rotate-180'} text-gray-600`}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4.5h14.25M3 9h9.75M3 13.5h9.75m4.5-4.5v12m0 0l-3.75-3.75M17.25 21L21 17.25" />
              </svg>
            </button>
            
            {/* Bulk actions - only show when documents are selected */}
            {selectedDocuments.length > 0 && (
              <button
                onClick={deleteSelectedDocuments}
                className="flex items-center px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
              >
                <TrashIcon className="h-5 w-5 mr-2" />
                Xóa ({selectedDocuments.length})
              </button>
            )}
          </div>
        </div>
        
        {/* Filter tags */}
        {allTags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => {
                  setSelectedTags(prev => 
                    prev.includes(tag) 
                      ? prev.filter(t => t !== tag) 
                      : [...prev, tag]
                  );
                }}
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  selectedTags.includes(tag)
                    ? 'bg-[#161853] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>
      
      {/* Document List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-12 gap-4 p-4 bg-gray-50 border-b border-gray-200">
          <div className="col-span-1">
            <input 
              type="checkbox"
              checked={selectedDocuments.length > 0 && selectedDocuments.length === filteredDocuments.length}
              onChange={toggleSelectAll}
              className="rounded text-[#161853] focus:ring-[#161853]"
            />
          </div>
          <div className="col-span-6 sm:col-span-5 font-medium">Tên tài liệu</div>
          <div className="hidden sm:block sm:col-span-2 font-medium">Ngày tải lên</div>
          <div className="col-span-3 sm:col-span-2 font-medium">Kích thước</div>
          <div className="col-span-2 font-medium text-right">Hành động</div>
        </div>
        
        {/* Pinned Documents Section */}
        {pinnedDocuments.length > 0 && (
          <div>
            <div className="p-2 px-4 bg-gray-100 border-b border-gray-200">
              <h3 className="text-sm font-medium text-gray-500">Đã ghim ({pinnedDocuments.length})</h3>
            </div>
            
            {pinnedDocuments.map(doc => (
              <div key={doc.id} className="grid grid-cols-12 gap-4 p-4 border-b border-gray-100 hover:bg-blue-50 group">
                <div className="col-span-1 flex items-center">
                  <input 
                    type="checkbox"
                    checked={selectedDocuments.includes(doc.id)}
                    onChange={() => toggleSelectDocument(doc.id)}
                    className="rounded text-[#161853] focus:ring-[#161853]"
                  />
                </div>
                
                <div className="col-span-6 sm:col-span-5 flex items-center">
                  <div className="flex-shrink-0 mr-3">
                    {getFileIcon(doc.type)}
                  </div>
                  <div className="min-w-0">
                    <Link href={`/student/documents/${doc.id}`}>
                      <p className="text-sm font-medium text-gray-900 truncate hover:text-[#161853] hover:underline cursor-pointer">{doc.title}</p>
                    </Link>
                    <p className="text-xs text-gray-500 truncate">{doc.filename}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {doc.tags.map(tag => (
                        <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="hidden sm:flex sm:col-span-2 items-center text-sm text-gray-500">
                  {formatDate(doc.uploadDate)}
                </div>
                
                <div className="col-span-3 sm:col-span-2 flex items-center text-sm text-gray-500">
                  {doc.size}
                </div>
                
                <div className="col-span-2 flex items-center justify-end space-x-2">
                  <Link 
                    href={`/student/documents/${doc.id}`}
                    className="text-gray-400 hover:text-[#161853]"
                    title="Xem chi tiết"
                  >
                    <EyeIcon className="h-5 w-5" />
                  </Link>
                
                  <button 
                    onClick={() => togglePin(doc.id)}
                    className="text-gray-400 hover:text-yellow-500"
                    title="Bỏ ghim"
                  >
                    <BookmarkSolidIcon className="h-5 w-5" />
                  </button>
                  
                  <a 
                    href={doc.downloadUrl} 
                    className="text-gray-400 hover:text-[#161853]"
                    title="Tải xuống"
                  >
                    <ArrowDownTrayIcon className="h-5 w-5" />
                  </a>
                  
                  <button 
                    onClick={() => openEditModal(doc)}
                    className="text-gray-400 hover:text-[#161853]"
                    title="Chỉnh sửa"
                  >
                    <PencilIcon className="h-5 w-5" />
                  </button>
                  
                  <button 
                    onClick={() => deleteDocument(doc.id)}
                    className="text-gray-400 hover:text-red-500"
                    title="Xóa"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Regular Documents */}
        {unpinnedDocuments.length > 0 && (
          <div>
            {pinnedDocuments.length > 0 && (
              <div className="p-2 px-4 bg-gray-100 border-b border-gray-200">
                <h3 className="text-sm font-medium text-gray-500">Tất cả tài liệu ({unpinnedDocuments.length})</h3>
              </div>
            )}
            
            {unpinnedDocuments.map(doc => (
              <div key={doc.id} className="grid grid-cols-12 gap-4 p-4 border-b border-gray-100 hover:bg-blue-50 group">
                <div className="col-span-1 flex items-center">
                  <input 
                    type="checkbox"
                    checked={selectedDocuments.includes(doc.id)}
                    onChange={() => toggleSelectDocument(doc.id)}
                    className="rounded text-[#161853] focus:ring-[#161853]"
                  />
                </div>
                
                <div className="col-span-6 sm:col-span-5 flex items-center">
                  <div className="flex-shrink-0 mr-3">
                    {getFileIcon(doc.type)}
                  </div>
                  <div className="min-w-0">
                    <Link href={`/student/documents/${doc.id}`}>
                      <p className="text-sm font-medium text-gray-900 truncate hover:text-[#161853] hover:underline cursor-pointer">{doc.title}</p>
                    </Link>
                    <p className="text-xs text-gray-500 truncate">{doc.filename}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {doc.tags.map(tag => (
                        <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="hidden sm:flex sm:col-span-2 items-center text-sm text-gray-500">
                  {formatDate(doc.uploadDate)}
                </div>
                
                <div className="col-span-3 sm:col-span-2 flex items-center text-sm text-gray-500">
                  {doc.size}
                </div>
                
                <div className="col-span-2 flex items-center justify-end space-x-2">
                  <Link 
                    href={`/student/documents/${doc.id}`}
                    className="text-gray-400 hover:text-[#161853]"
                    title="Xem chi tiết"
                  >
                    <EyeIcon className="h-5 w-5" />
                  </Link>

                  <button 
                    onClick={() => togglePin(doc.id)}
                    className="text-gray-400 hover:text-yellow-500"
                    title="Ghim"
                  >
                    <BookmarkIcon className="h-5 w-5" />
                  </button>
                  
                  <a 
                    href={doc.downloadUrl} 
                    className="text-gray-400 hover:text-[#161853]"
                    title="Tải xuống"
                  >
                    <ArrowDownTrayIcon className="h-5 w-5" />
                  </a>
                  
                  <button 
                    onClick={() => openEditModal(doc)}
                    className="text-gray-400 hover:text-[#161853]"
                    title="Chỉnh sửa"
                  >
                    <PencilIcon className="h-5 w-5" />
                  </button>
                  
                  <button 
                    onClick={() => deleteDocument(doc.id)}
                    className="text-gray-400 hover:text-red-500"
                    title="Xóa"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Empty state */}
        {filteredDocuments.length === 0 && (
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <DocumentPlusIcon className="h-16 w-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">Không tìm thấy tài liệu nào</h3>
            {searchQuery || selectedFolder || selectedTags.length > 0 ? (
              <p className="text-gray-500 mb-6">Hãy thử thay đổi bộ lọc hoặc tìm kiếm.</p>
            ) : (
              <p className="text-gray-500 mb-6">Tải lên tài liệu mới để bắt đầu.</p>
            )}
            <button 
              onClick={handleUploadClick}
              className="flex items-center px-4 py-2 bg-[#161853] text-white rounded-lg hover:bg-opacity-90 transition"
            >
              <DocumentArrowUpIcon className="h-5 w-5 mr-2" />
              Tải lên tài liệu mới
            </button>
          </div>
        )}
      </div>
      
      {/* Edit Document Modal */}
      {editingDocument && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Chỉnh sửa tài liệu</h3>
              
              <div className="space-y-4">
                {/* Tên tài liệu */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tên tài liệu
                  </label>
                  <input
                    type="text"
                    value={editingDocument.title}
                    onChange={e => setEditingDocument({...editingDocument, title: e.target.value})}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-[#161853] focus:ring-[#161853]"
                  />
                </div>
                
                {/* Thư mục */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Thư mục
                  </label>
                  <select
                    value={editingDocument.folder || ''}
                    onChange={e => setEditingDocument({
                      ...editingDocument, 
                      folder: e.target.value === '' ? null : e.target.value
                    })}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-[#161853] focus:ring-[#161853]"
                  >
                    <option value="">-- Không có thư mục --</option>
                    {mockFolders.map(folder => (
                      <option key={folder} value={folder}>{folder}</option>
                    ))}
                  </select>
                </div>
                
                {/* Tags */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Thẻ (phân cách bằng dấu phẩy)
                  </label>
                  <input
                    type="text"
                    value={editingDocument.tags.join(', ')}
                    onChange={e => {
                      const tagsString = e.target.value;
                      const tagsArray = tagsString
                        .split(',')
                        .map(tag => tag.trim())
                        .filter(tag => tag.length > 0);
                      setEditingDocument({...editingDocument, tags: tagsArray});
                    }}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-[#161853] focus:ring-[#161853]"
                  />
                </div>
                
                {/* File info */}
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Tên file:</span> {editingDocument.filename}
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Kích thước:</span> {editingDocument.size}
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Ngày tải lên:</span> {formatDate(editingDocument.uploadDate)}
                  </p>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setEditingDocument(null)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
                >
                  Hủy
                </button>
                <button
                  onClick={() => {
                    // Cập nhật tài liệu
                    setDocuments(prev => prev.map(doc => 
                      doc.id === editingDocument.id ? {...editingDocument, lastModified: new Date().toISOString().split('T')[0]} : doc
                    ));
                    setEditingDocument(null);
                  }}
                  className="px-4 py-2 bg-[#161853] text-white rounded-lg hover:bg-opacity-90 transition"
                >
                  Lưu thay đổi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal tạo thư mục mới */}
      {showNewFolderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-xl font-bold text-[#161853] mb-4">Tạo thư mục mới</h3>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tên thư mục
              </label>
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateFolder();
                  }
                }}
                placeholder="Enter folder name..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#161853] focus:border-transparent"
                autoFocus
              />
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowNewFolderModal(false);
                  setNewFolderName('');
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                Hủy
              </button>
              <button
                onClick={handleCreateFolder}
                className="px-4 py-2 bg-[#161853] text-white rounded-lg hover:bg-opacity-90 transition flex items-center"
              >
                <FolderPlusIcon className="h-5 w-5 mr-2" />
                Tạo thư mục
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
