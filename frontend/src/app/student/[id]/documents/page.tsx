"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  DocumentIcon, 
  DocumentTextIcon, 
  TrashIcon, 
  BookmarkIcon, 
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
  ChevronDownIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import { 
  BookmarkIcon as BookmarkSolidIcon 
} from '@heroicons/react/24/solid';
import { Loader2 } from 'lucide-react';
import { getSavedDocuments, removeSavedDocument, updateSavedDocument, togglePinDocument, SavedDocument } from '@/lib/api/student';
import toast from 'react-hot-toast';

// Simple date formatter
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const PrimaryColor = '161853';
const SecondaryColor = 'EC255A';

const fileTypeOptions = [
  { value: '', label: 'All Files' },
  { value: 'pdf', label: 'PDF Documents' },
  { value: 'image', label: 'Images' },
  { value: 'video', label: 'Videos' },
];

export default function StudentDocumentsPage() {
  const [documents, setDocuments] = useState<SavedDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFileType, setSelectedFileType] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'savedAt' | 'title' | 'fileSize'>('savedAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showFileTypeDropdown, setShowFileTypeDropdown] = useState(false);
  
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  
  // Fetch saved documents from backend
  useEffect(() => {
    fetchDocuments();
  }, [selectedFileType]);
  
  const fetchDocuments = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getSavedDocuments();
      setDocuments(data);
    } catch (err) {
      console.error('Failed to fetch documents:', err);
      setError('Failed to load documents');
      toast.error('Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Get all unique tags from documents
  const allTags = Array.from(
    new Set(documents.flatMap(doc => doc.tags || []))
  ).sort();
  
  // Filter documents
  const filteredDocuments = documents
    .filter(doc => {
      // Search filter
      if (searchQuery && 
          !doc.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !doc.filename.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      // Tags filter
      if (selectedTags.length > 0 && !selectedTags.some(tag => doc.tags?.includes(tag))) {
        return false;
      }
      
      return true;
    })
    .sort((a, b) => {
      let compareValue = 0;
      
      switch (sortBy) {
        case 'savedAt':
          compareValue = new Date(a.savedAt).getTime() - new Date(b.savedAt).getTime();
          break;
        case 'title':
          compareValue = a.title.localeCompare(b.title);
          break;
        case 'fileSize':
          compareValue = (a.fileSize || 0) - (b.fileSize || 0);
          break;
      }
      
      return sortDirection === 'asc' ? compareValue : -compareValue;
    });
  
  // Separate pinned and unpinned documents
  const pinnedDocuments = filteredDocuments.filter(doc => doc.isPinned);
  const unpinnedDocuments = filteredDocuments.filter(doc => !doc.isPinned);
  
  // Get file icon based on type
  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) {
      return <DocumentTextIcon className="h-6 w-6 text-red-500" />;
    } else if (fileType.includes('image')) {
      return <DocumentTextIcon className="h-6 w-6 text-purple-500" />;
    } else if (fileType.includes('video')) {
      return <DocumentTextIcon className="h-6 w-6 text-blue-500" />;
    } else if (fileType.includes('doc')) {
      return <DocumentTextIcon className="h-6 w-6 text-blue-600" />;
    } else if (fileType.includes('sheet') || fileType.includes('excel')) {
      return <DocumentTextIcon className="h-6 w-6 text-green-500" />;
    }
    return <DocumentIcon className="h-6 w-6 text-gray-500" />;
  };
  
  // Toggle pin
  const handleTogglePin = async (id: string) => {
    try {
      const doc = documents.find(d => d.id === id);
      if (doc) {
        await togglePinDocument(id, doc.isPinned);
      }
      setDocuments(prev => prev.map(doc => 
        doc.id === id ? { ...doc, isPinned: !doc.isPinned } : doc
      ));
      toast.success('Document pin status updated');
    } catch (err) {
      console.error('Failed to toggle pin:', err);
      toast.error('Failed to update pin status');
    }
  };
  
  // Delete document
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this document from your saved list?')) return;
    
    try {
      await removeSavedDocument(id);
      setDocuments(prev => prev.filter(doc => doc.id !== id));
      toast.success('Document removed successfully');
    } catch (err) {
      console.error('Failed to delete document:', err);
      toast.error('Failed to remove document');
    }
  };
  
  // Toggle document selection
  const toggleSelectDocument = (id: string) => {
    setSelectedDocuments(prev => 
      prev.includes(id) ? prev.filter(docId => docId !== id) : [...prev, id]
    );
  };
  
  // Toggle select all
  const toggleSelectAll = () => {
    if (selectedDocuments.length === filteredDocuments.length) {
      setSelectedDocuments([]);
    } else {
      setSelectedDocuments(filteredDocuments.map(doc => doc.id));
    }
  };
  
  // Delete selected documents
  const deleteSelectedDocuments = async () => {
    if (selectedDocuments.length === 0) return;
    
    if (!confirm(`Are you sure you want to remove ${selectedDocuments.length} selected documents?`)) return;
    
    try {
      await Promise.all(selectedDocuments.map(id => removeSavedDocument(id)));
      setDocuments(prev => prev.filter(doc => !selectedDocuments.includes(doc.id)));
      setSelectedDocuments([]);
      toast.success(`${selectedDocuments.length} documents removed successfully`);
    } catch (err) {
      console.error('Failed to delete documents:', err);
      toast.error('Failed to remove some documents');
    }
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-gradient-to-r from-[#161853] to-[#292C6D] flex items-center justify-center mx-auto mb-6 shadow-xl">
              <Loader2 className="w-10 h-10 animate-spin text-white" />
            </div>
            <div className="absolute inset-0 w-20 h-20 mx-auto rounded-full bg-gradient-to-r from-[#161853] to-[#292C6D] blur-xl opacity-30 animate-pulse"></div>
          </div>
          <p className="text-lg font-medium text-gray-700">Loading documents...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-[#161853] mb-6 flex items-center gap-3">
          <div className="w-1.5 h-8 bg-gradient-to-b from-[#161853] to-[#292C6D] rounded-full"></div>
          My Saved Documents
        </h1>
        
        {/* Toolbar */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 mb-6">
          <div className="flex flex-wrap gap-4 justify-between items-center">
            {/* Search */}
            <div className="relative w-full md:w-auto flex-grow md:max-w-md">
              <div className="absolute inset-y-0 left-0 flex items-center pl-4">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                className="block w-full rounded-xl border-0 py-3 pl-12 pr-3 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-[#161853] sm:text-sm transition-all"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="flex gap-3 flex-wrap md:flex-nowrap">
              {/* File Type Filter */}
              <div className="relative">
                <button
                  onClick={() => setShowFileTypeDropdown(!showFileTypeDropdown)}
                  className="flex items-center px-4 py-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all shadow-sm hover:shadow-md font-medium"
                >
                  <DocumentIcon className="h-5 w-5 mr-2 text-gray-600" />
                  {fileTypeOptions.find(opt => opt.value === selectedFileType)?.label || 'All Files'}
                  <ChevronDownIcon className="h-4 w-4 ml-2 text-gray-500" />
                </button>
                
                {showFileTypeDropdown && (
                  <div className="absolute z-10 mt-2 right-0 w-56 bg-white border border-gray-200 rounded-xl shadow-xl">
                    <div className="py-1">
                      {fileTypeOptions.map(option => (
                        <button
                          key={option.value}
                          onClick={() => {
                            setSelectedFileType(option.value);
                            setShowFileTypeDropdown(false);
                          }}
                          className={`${selectedFileType === option.value ? 'bg-gradient-to-r from-blue-50 to-purple-50 text-[#161853] font-semibold' : 'text-gray-700'} w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Sort by */}
              <select 
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-4 py-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all shadow-sm hover:shadow-md font-medium cursor-pointer"
              >
                <option value="savedAt">Saved Date</option>
                <option value="title">Title</option>
                <option value="fileSize">File Size</option>
              </select>
              
              {/* Sort direction */}
              <button
                onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
                className="p-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all shadow-sm hover:shadow-md"
                title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-5 h-5 ${sortDirection === 'asc' ? '' : 'rotate-180'} text-gray-600 transition-transform`}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 4.5h14.25M3 9h9.75M3 13.5h9.75m4.5-4.5v12m0 0l-3.75-3.75M17.25 21L21 17.25" />
                </svg>
              </button>
              
              {/* Bulk delete */}
              {selectedDocuments.length > 0 && (
                <button
                  onClick={deleteSelectedDocuments}
                  className="flex items-center px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:shadow-lg transition-all font-semibold hover:scale-105"
                >
                  <TrashIcon className="h-5 w-5 mr-2" />
                  Remove ({selectedDocuments.length})
                </button>
              )}
            </div>
          </div>
          
          {/* Tag filters */}
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
                  className={`px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                    selectedTags.includes(tag)
                      ? 'bg-gradient-to-r from-[#161853] to-[#292C6D] text-white shadow-md'
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
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          {/* Header row */}
          <div className="grid grid-cols-12 gap-4 p-5 bg-gradient-to-r from-gray-50 to-blue-50/30 border-b border-gray-200">
            <div className="col-span-1">
              <input 
                type="checkbox"
                checked={selectedDocuments.length > 0 && selectedDocuments.length === filteredDocuments.length}
                onChange={toggleSelectAll}
                className="rounded text-[#161853] focus:ring-[#161853] cursor-pointer"
              />
            </div>
            <div className="col-span-6 sm:col-span-4 font-bold text-gray-700">Document</div>
            <div className="hidden sm:block sm:col-span-2 font-bold text-gray-700">Folder</div>
            <div className="hidden sm:block sm:col-span-2 font-bold text-gray-700">Saved Date</div>
            <div className="col-span-3 sm:col-span-1 font-bold text-gray-700">Size</div>
            <div className="col-span-2 font-bold text-gray-700 text-right">Actions</div>
          </div>
          
          {/* Pinned Documents */}
          {pinnedDocuments.length > 0 && (
            <div>
              <div className="p-3 px-5 bg-gradient-to-r from-yellow-50 to-amber-50 border-b border-yellow-100">
                <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <BookmarkSolidIcon className="h-4 w-4 text-yellow-600" />
                  Pinned ({pinnedDocuments.length})
                </h3>
              </div>
              
              {pinnedDocuments.map(doc => (
                <DocumentRow
                  key={doc.id}
                  doc={doc}
                  isSelected={selectedDocuments.includes(doc.id)}
                  onToggleSelect={() => toggleSelectDocument(doc.id)}
                  onTogglePin={() => handleTogglePin(doc.id)}
                  onDelete={() => handleDelete(doc.id)}
                  getFileIcon={getFileIcon}
                />
              ))}
            </div>
          )}
          
          {/* Regular Documents */}
          {unpinnedDocuments.length > 0 && (
            <div>
              {pinnedDocuments.length > 0 && (
                <div className="p-3 px-5 bg-gray-50 border-b border-gray-200">
                  <h3 className="text-sm font-bold text-gray-700">All Documents ({unpinnedDocuments.length})</h3>
                </div>
              )}
              
              {unpinnedDocuments.map(doc => (
                <DocumentRow
                  key={doc.id}
                  doc={doc}
                  isSelected={selectedDocuments.includes(doc.id)}
                  onToggleSelect={() => toggleSelectDocument(doc.id)}
                  onTogglePin={() => handleTogglePin(doc.id)}
                  onDelete={() => handleDelete(doc.id)}
                  getFileIcon={getFileIcon}
                />
              ))}
            </div>
          )}
          
          {/* Empty state */}
          {filteredDocuments.length === 0 && !isLoading && (
            <div className="py-16 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center mb-4">
                <DocumentIcon className="h-10 w-10 text-gray-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">No documents found</h3>
              {searchQuery || selectedFileType || selectedTags.length > 0 ? (
                <p className="text-gray-500 mb-6">Try changing your filters or search query.</p>
              ) : (
                <p className="text-gray-500 mb-6">Save documents from livestreams to see them here.</p>
              )}
            </div>
          )}
        </div>
        

      </div>
    </div>
  );
}

// Document Row Component
function DocumentRow({ 
  doc, 
  isSelected, 
  onToggleSelect, 
  onTogglePin, 
  onDelete, 
  getFileIcon 
}: {
  doc: SavedDocument;
  isSelected: boolean;
  onToggleSelect: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
  getFileIcon: (fileType: string) => React.ReactElement;
}) {
  return (
    <div className="grid grid-cols-12 gap-4 p-5 border-b border-gray-100 hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-purple-50/30 group transition-all">
      <div className="col-span-1 flex items-center">
        <input 
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          className="rounded text-[#161853] focus:ring-[#161853] cursor-pointer"
        />
      </div>
      
      <div className="col-span-6 sm:col-span-4 flex items-center">
        <div className="flex-shrink-0 mr-3">
          {getFileIcon(doc.fileType)}
        </div>
        <div className="min-w-0">
          <Link href={`/student/${doc.studentId}/documents/${doc.id}`}>
            <p className="text-sm font-semibold text-gray-900 truncate hover:text-[#161853] hover:underline cursor-pointer">
              {doc.title}
            </p>
          </Link>
          <p className="text-xs text-gray-500 truncate">{doc.filename}</p>
          {doc.tags && doc.tags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {doc.tags.map(tag => (
                <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      
      <div className="hidden sm:flex sm:col-span-2 items-center">
        <div className="text-sm text-gray-700">
          <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
            {doc.folder || 'Livestream'}
          </span>
        </div>
      </div>
      
      <div className="hidden sm:flex sm:col-span-2 items-center text-sm text-gray-600">
        {formatDate(doc.savedAt.toString())}
      </div>
      
      <div className="col-span-3 sm:col-span-1 flex items-center text-sm text-gray-600 font-medium">
        {doc.fileSize ? (doc.fileSize / 1024 / 1024).toFixed(2) + ' MB' : 'N/A'}
      </div>
      
      <div className="col-span-2 flex items-center justify-end space-x-2">
        <Link 
          href={`/student/${doc.studentId}/documents/${doc.id}`}
          className="text-gray-400 hover:text-[#161853] transition-colors"
          title="View details"
        >
          <EyeIcon className="h-5 w-5" />
        </Link>
      
        <button 
          onClick={onTogglePin}
          className={`${doc.isPinned ? 'text-yellow-500' : 'text-gray-400'} hover:text-yellow-600 transition-colors`}
          title={doc.isPinned ? 'Unpin' : 'Pin'}
        >
          {doc.isPinned ? <BookmarkSolidIcon className="h-5 w-5" /> : <BookmarkIcon className="h-5 w-5" />}
        </button>
        
        <a 
          href={doc.fileUrl}
          download={doc.filename}
          className="text-gray-400 hover:text-[#161853] transition-colors"
          title="Download"
        >
          <ArrowDownTrayIcon className="h-5 w-5" />
        </a>
        
        <button 
          onClick={onDelete}
          className="text-gray-400 hover:text-red-500 transition-colors"
          title="Remove"
        >
          <TrashIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
