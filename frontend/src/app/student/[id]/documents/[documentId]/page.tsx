"use client";

import { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { 
  DocumentIcon, 
  DocumentTextIcon, 
  ArrowDownTrayIcon, 
  ArrowUturnLeftIcon,
  BookmarkIcon,
  ShareIcon,
  PrinterIcon,
  ClockIcon,
  TagIcon,
  ChevronLeftIcon,
  EyeIcon,
  PencilIcon,
} from '@heroicons/react/24/outline';
import { 
  BookmarkIcon as BookmarkSolidIcon,
} from '@heroicons/react/24/solid';
import { Loader2 } from 'lucide-react';
import { getSavedDocuments, updateSavedDocument, togglePinDocument, SavedDocument } from '@/lib/api/student';
import toast from 'react-hot-toast';

const PrimaryColor = '161853';
const SecondaryColor = 'EC255A';

export default function DocumentDetailPage() {
  const router = useRouter();
  const params = useParams<{ documentId: string }>();
  const [document, setDocument] = useState<SavedDocument | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'preview' | 'notes'>('preview');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  useEffect(() => {
    fetchDocument();
  }, [params.documentId]);
  
  const fetchDocument = async () => {
    try {
      setLoading(true);
      const docs = await getSavedDocuments();
      const doc = docs.find(d => d.id === params.documentId);
      
      if (doc) {
        setDocument(doc);
        setIsPinned(doc.isPinned);
        setNotes(doc.notes || '');
        setTags((doc.tags || []).join(', '));
      } else {
        toast.error('Document not found');
        router.push('/student/documents');
      }
    } catch (err) {
      console.error('Failed to fetch document:', err);
      toast.error('Failed to load document');
      router.push('/student/documents');
    } finally {
      setLoading(false);
    }
  };
  
  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) {
      return <DocumentTextIcon className="h-20 w-20 text-red-500" />;
    } else if (type.includes('image')) {
      return <DocumentTextIcon className="h-20 w-20 text-purple-500" />;
    } else if (type.includes('video')) {
      return <DocumentTextIcon className="h-20 w-20 text-blue-500" />;
    } else if (type.includes('presentation') || type.includes('powerpoint')) {
      return <DocumentTextIcon className="h-20 w-20 text-orange-500" />;
    } else if (type.includes('sheet') || type.includes('excel')) {
      return <DocumentTextIcon className="h-20 w-20 text-green-500" />;
    }
    return <DocumentIcon className="h-20 w-20 text-gray-500" />;
  };
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };
  
  const togglePin = async () => {
    if (!document) return;
    
    try {
      await togglePinDocument(document.id);
      setIsPinned(!isPinned);
      toast.success(isPinned ? 'Document unpinned' : 'Document pinned');
    } catch (err) {
      console.error('Failed to toggle pin:', err);
      toast.error('Failed to update pin status');
    }
  };
  
  const handleSaveNotes = async () => {
    if (!document) return;
    
    setIsSaving(true);
    try {
      const tagsArray = tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);
      
      const updated = await updateSavedDocument(document.id, {
        notes: notes || undefined,
        tags: tagsArray.length > 0 ? tagsArray : undefined,
      });
      
      setDocument(updated);
      setIsEditingNotes(false);
      toast.success('Notes saved successfully');
    } catch (err) {
      console.error('Failed to save notes:', err);
      toast.error('Failed to save notes');
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleDownload = () => {
    if (!document) return;
    
    const link = window.document.createElement('a');
    link.href = document.document.fileUrl;
    link.download = document.document.fileName;
    link.click();
    
    toast.success('Download started');
  };
  
  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('Link copied to clipboard!');
  };
  
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-gradient-to-r from-[#161853] to-[#292C6D] flex items-center justify-center mx-auto mb-6 shadow-xl">
              <Loader2 className="w-10 h-10 animate-spin text-white" />
            </div>
            <div className="absolute inset-0 w-20 h-20 mx-auto rounded-full bg-gradient-to-r from-[#161853] to-[#292C6D] blur-xl opacity-30 animate-pulse"></div>
          </div>
          <p className="text-lg font-medium text-gray-700">Loading document...</p>
        </div>
      </div>
    );
  }
  
  if (!document) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex flex-col justify-center items-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-md text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <DocumentIcon className="h-12 w-12 text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Document Not Found</h2>
          <p className="text-gray-600 mb-8">This document doesn't exist or has been removed.</p>
          <Link href="/student/documents" className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-[#161853] to-[#292C6D] text-white rounded-xl hover:shadow-lg transition-all font-semibold hover:scale-105">
            <ArrowUturnLeftIcon className="h-5 w-5 mr-2" />
            Back to Documents
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Breadcrumb */}
        <div className="flex items-center text-sm text-gray-500 mb-6">
          <Link href="/student/documents" className="hover:text-[#161853] flex items-center font-medium transition-colors">
            <ChevronLeftIcon className="h-4 w-4 mr-1" />
            My Documents
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-900 font-semibold truncate max-w-md">{document.document.title}</span>
        </div>
        
        {/* Document Info Section */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 mb-6">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Left: Icon and Actions */}
            <div className="flex-shrink-0 flex flex-col items-center lg:w-64">
              <div className="bg-gradient-to-br from-gray-50 to-blue-50/30 p-8 rounded-2xl mb-6 border border-gray-100 shadow-sm">
                {getFileIcon(document.document.fileType)}
              </div>
              
              <div className="flex flex-col w-full space-y-3">
                <button
                  onClick={handleDownload}
                  className="group w-full flex items-center justify-center px-6 py-3 bg-gradient-to-r from-[#161853] to-[#292C6D] text-white rounded-xl hover:shadow-lg transition-all font-semibold hover:scale-105"
                >
                  <ArrowDownTrayIcon className="h-5 w-5 mr-2 group-hover:animate-bounce" />
                  Download
                </button>
                
                <button
                  onClick={togglePin}
                  className={`w-full flex items-center justify-center px-6 py-3 rounded-xl hover:shadow-lg transition-all font-semibold hover:scale-105 ${
                    isPinned 
                      ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {isPinned ? (
                    <BookmarkSolidIcon className="h-5 w-5 mr-2" />
                  ) : (
                    <BookmarkIcon className="h-5 w-5 mr-2" />
                  )}
                  {isPinned ? 'Pinned' : 'Pin'}
                </button>
                
                <button
                  onClick={handleShare}
                  className="w-full flex items-center justify-center px-6 py-3 bg-gradient-to-r from-[#EC255A] to-[#ff4d7a] text-white rounded-xl hover:shadow-lg transition-all font-semibold hover:scale-105"
                >
                  <ShareIcon className="h-5 w-5 mr-2" />
                  Share
                </button>
                
                <button
                  onClick={() => window.print()}
                  className="w-full flex items-center justify-center px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 hover:shadow-md transition-all font-semibold"
                >
                  <PrinterIcon className="h-5 w-5 mr-2" />
                  Print
                </button>
              </div>
            </div>
            
            {/* Right: Document Details */}
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-3 leading-tight">{document.document.title}</h1>
              <p className="text-gray-500 mb-6 text-lg">{document.document.fileName}</p>
              
              {document.document.description && (
                <div className="bg-gradient-to-br from-gray-50 to-blue-50/30 rounded-xl p-5 mb-6 border border-gray-100">
                  <p className="text-gray-700 leading-relaxed">{document.document.description}</p>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-blue-50 rounded-xl">
                    <ClockIcon className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 mb-1">Saved Date</p>
                    <p className="text-sm text-gray-600">{formatDate(document.savedAt)}</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-purple-50 rounded-xl">
                    <ClockIcon className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 mb-1">Uploaded Date</p>
                    <p className="text-sm text-gray-600">{formatDate(document.document.uploadedAt)}</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-green-50 rounded-xl">
                    <DocumentIcon className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 mb-1">File Size</p>
                    <p className="text-sm text-gray-600">{(document.document.fileSize / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-orange-50 rounded-xl">
                    <TagIcon className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 mb-1">File Type</p>
                    <p className="text-sm text-gray-600">{document.document.mimeType}</p>
                  </div>
                </div>
              </div>
              
              {/* Teacher Info */}
              <div className="flex items-center justify-between p-5 bg-gradient-to-r from-gray-50 to-blue-50/50 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#161853] to-[#292C6D] overflow-hidden shadow-lg">
                    {document.document.teacher.avatar ? (
                      <Image
                        src={document.document.teacher.avatar}
                        alt={document.document.teacher.fullName}
                        width={56}
                        height={56}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white text-lg font-bold">
                        {document.document.teacher.fullName.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Uploaded by</p>
                    <h3 className="text-lg font-bold text-gray-900">{document.document.teacher.fullName}</h3>
                  </div>
                </div>
              </div>
              
              {/* Tags */}
              {document.tags && document.tags.length > 0 && (
                <div className="mt-6">
                  <p className="text-sm font-bold text-gray-900 mb-3">Tags</p>
                  <div className="flex flex-wrap gap-2">
                    {document.tags.map(tag => (
                      <span 
                        key={tag} 
                        className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-50 to-purple-50 text-gray-700 rounded-full text-sm font-semibold border border-gray-200 shadow-sm"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Tabs Section */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="flex border-b border-gray-200 bg-gradient-to-r from-gray-50 to-blue-50/30">
            <button
              className={`px-8 py-4 text-sm font-bold transition-all ${
                activeTab === 'preview' 
                  ? 'text-[#161853] border-b-4 border-[#161853] bg-white' 
                  : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
              }`}
              onClick={() => setActiveTab('preview')}
            >
              <EyeIcon className="h-5 w-5 inline-block mr-2" />
              Preview
            </button>
            <button
              className={`px-8 py-4 text-sm font-bold transition-all ${
                activeTab === 'notes' 
                  ? 'text-[#161853] border-b-4 border-[#161853] bg-white' 
                  : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
              }`}
              onClick={() => setActiveTab('notes')}
            >
              <PencilIcon className="h-5 w-5 inline-block mr-2" />
              My Notes
            </button>
          </div>
          
          <div className="p-8">
            {activeTab === 'preview' ? (
              document.document.fileType.includes('pdf') ? (
                <div className="w-full h-[700px] bg-gray-100 rounded-xl overflow-hidden shadow-inner border border-gray-200">
                  <iframe 
                    ref={iframeRef}
                    src={document.document.fileUrl} 
                    className="w-full h-full border-0"
                    title={document.document.title}
                    onError={() => {
                      if (iframeRef.current) {
                        iframeRef.current.srcdoc = `
                          <div style="display:flex;justify-content:center;align-items:center;height:100%;flex-direction:column;font-family:system-ui,-apple-system,sans-serif;padding:2rem;">
                            <svg width="64" height="64" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" style="color:#9CA3AF;margin-bottom:24px;">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                            </svg>
                            <h3 style="margin:0 0 12px;color:#111827;font-size:20px;font-weight:700;">${document.document.title}</h3>
                            <p style="margin:0;color:#6B7280;text-align:center;max-width:400px;line-height:1.6;">Preview not available. Please download the file to view full content.</p>
                          </div>
                        `;
                      }
                    }}
                  />
                </div>
              ) : document.document.fileType.includes('image') ? (
                <div className="w-full max-h-[700px] bg-gray-100 rounded-xl overflow-hidden shadow-inner border border-gray-200 flex items-center justify-center">
                  <Image
                    src={document.document.fileUrl}
                    alt={document.document.title}
                    width={1200}
                    height={700}
                    className="max-w-full max-h-[700px] object-contain"
                  />
                </div>
              ) : (
                <div className="w-full h-[400px] bg-gradient-to-br from-gray-50 to-blue-50/30 rounded-xl flex flex-col justify-center items-center border border-gray-200">
                  <div className="bg-white p-8 rounded-2xl shadow-lg">
                    {getFileIcon(document.document.fileType)}
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mt-6">{document.document.title}</h3>
                  <p className="text-gray-600 mt-3 text-center max-w-lg px-4">
                    Preview not available for {document.document.mimeType} files. 
                    Please download to view the full content.
                  </p>
                  <button
                    onClick={handleDownload}
                    className="mt-8 px-8 py-3 bg-gradient-to-r from-[#161853] to-[#292C6D] text-white rounded-xl hover:shadow-lg transition-all font-semibold flex items-center hover:scale-105"
                  >
                    <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
                    Download File
                  </button>
                </div>
              )
            ) : (
              <div>
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-bold text-gray-900">Personal Notes</label>
                    {!isEditingNotes && (
                      <button
                        onClick={() => setIsEditingNotes(true)}
                        className="text-sm text-[#161853] hover:text-[#292C6D] font-semibold flex items-center gap-2"
                      >
                        <PencilIcon className="h-4 w-4" />
                        Edit
                      </button>
                    )}
                  </div>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={!isEditingNotes}
                    className={`w-full h-[200px] p-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#161853] focus:border-transparent resize-none transition-all ${
                      !isEditingNotes ? 'bg-gray-50 text-gray-700' : 'bg-white'
                    }`}
                    placeholder="Add your notes about this document..."
                  />
                </div>
                
                <div className="mb-6">
                  <label className="block text-sm font-bold text-gray-900 mb-3">Tags (comma-separated)</label>
                  <input
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    disabled={!isEditingNotes}
                    placeholder="e.g., Math, Chapter 5, Important"
                    className={`w-full p-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#161853] focus:border-transparent transition-all ${
                      !isEditingNotes ? 'bg-gray-50 text-gray-700' : 'bg-white'
                    }`}
                  />
                </div>
                
                {isEditingNotes && (
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => {
                        setIsEditingNotes(false);
                        setNotes(document.notes || '');
                        setTags((document.tags || []).join(', '));
                      }}
                      disabled={isSaving}
                      className="px-6 py-3 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors font-semibold disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveNotes}
                      disabled={isSaving}
                      className="px-6 py-3 bg-gradient-to-r from-[#161853] to-[#292C6D] text-white rounded-xl hover:shadow-lg transition-all font-semibold disabled:opacity-50 flex items-center gap-2"
                    >
                      {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                      Save Changes
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
                 