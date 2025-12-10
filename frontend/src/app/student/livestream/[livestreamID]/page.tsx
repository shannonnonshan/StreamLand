'use client';

import { useState, useRef, useEffect } from 'react';
import { raleway } from '@/utils/front';
import { useParams } from 'next/navigation';
import { useLivestreamViewer } from '@/hooks/useLivestreamViewer';
import { trackWatchActivity } from '@/utils/trackActivity';
import { useAuth } from '@/hooks/useAuth';
import { 
  getLivestreamDocuments, 
  saveDocument, 
  removeSavedDocument, 
  isDocumentSaved 
} from '@/lib/api/student';
import toast, { Toaster } from 'react-hot-toast';
import { 
  PlayIcon, 
  PauseIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  ChatBubbleLeftRightIcon,
  XMarkIcon,
  ClockIcon,
  UserGroupIcon,
  HeartIcon,
  ShareIcon,
  FolderIcon,
  CheckIcon,
  EyeSlashIcon,
  ArrowDownTrayIcon,
  DocumentIcon,
  PhotoIcon,
  VideoCameraIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid';

const PrimaryColor = '161853';
const SecondaryColor = 'EC255A';

interface LivestreamInfo {
  title: string;
  description: string;
  category: string;
  teacher: {
    id: string;
    name: string;
    avatar?: string;
    followers: string;
  };
  viewers: number;
  likes: number;
  isLive: boolean;
  startedAt: string;
}

interface SharedDocument {
  id: number;
  name: string;
  type: 'pdf' | 'image' | 'video' | 'doc' | 'ppt';
  url: string;
  uploadedAt: string;
  size?: number;
}

export default function LivestreamViewerPage() {
  const params = useParams();
  const livestreamID = params.livestreamID as string;
  const { user } = useAuth();
  
  // Livestream info from backend
  const [livestreamInfo, setLivestreamInfo] = useState<LivestreamInfo | null>(null);
  
  // Error and status states
  const [streamError, setStreamError] = useState<string | null>(null);
  const [isStreamEnded, setIsStreamEnded] = useState(false);
  
  // WebRTC connection using custom hook
  const { isConnected, isLoading, remoteVideoRef } = useLivestreamViewer({
    livestreamID: livestreamID,
    onError: (error) => {
      setStreamError(error.message || 'Unable to connect to livestream');
    },
    onStreamEnded: () => {
      setIsStreamEnded(true);
      setStreamError('This livestream has ended');
    },
  });
  
  // Video player states
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(80);
  const [isLiked, setIsLiked] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // UI states
  const [showDocuments, setShowDocuments] = useState(false);
  const [showOverlayChat, setShowOverlayChat] = useState(true);
  const [chatMessage, setChatMessage] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{
    id: string;
    username: string;
    userRole: 'teacher' | 'student';
    message: string;
    timestamp: string;
    avatar?: string;
  }>>([]);
  
  // Shared document states
  const [sharedDocument, setSharedDocument] = useState<SharedDocument | null>(null);
  const [showSharedDocument, setShowSharedDocument] = useState(false);
  
  // Documents shared by teacher
  const [teacherDocuments, setTeacherDocuments] = useState<any[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [savedDocuments, setSavedDocuments] = useState<string[]>([]);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  // Set mounted state
  useEffect(() => {
    setIsMuted(false); // Default unmuted so students can hear
  }, []);

  // Track watch activity when livestream loads
  useEffect(() => {
    if (livestreamID && isConnected) {
      trackWatchActivity('livestream', livestreamID);
    }
  }, [livestreamID, isConnected]);

  // Fetch livestream info from backend
  useEffect(() => {
    const fetchLivestreamInfo = async () => {
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
        const response = await fetch(`${API_URL}/livestream/${livestreamID}`);
        if (response.ok) {
          const data = await response.json();
          
          // Map backend data to frontend format
          setLivestreamInfo({
            title: data.title,
            description: data.description || '',
            category: data.category || 'Education',
            teacher: {
              id: data.teacherId,
              name: data.teacher?.fullName || 'Teacher',
              avatar: data.teacher?.avatar || '/avatars/teacher-default.png',
              followers: data.teacher?.followersCount?.toString() || '0',
            },
            viewers: data.currentViewers || 0,
            likes: data.likes || 0,
            isLive: data.status === 'LIVE',
            startedAt: data.startedAt || data.createdAt,
          });
        }
      } catch (error) {
        console.error('Error fetching livestream info:', error);
      }
    };

    fetchLivestreamInfo();
  }, [livestreamID]);

  // Fetch documents from API
  useEffect(() => {
    const fetchDocuments = async () => {
      if (!livestreamID) return;
      
      setDocumentsLoading(true);
      try {
        const docs = await getLivestreamDocuments(livestreamID);
        
        // Map API documents to frontend format
        const mappedDocs = docs.map((doc: any) => ({
          id: doc.id,
          title: doc.title,
          filename: doc.fileName,
          type: doc.fileType.includes('pdf') ? 'pdf' : 
                doc.fileType.includes('doc') ? 'doc' : 
                doc.fileType.includes('ppt') ? 'ppt' : 
                doc.fileType.includes('xls') ? 'xls' : 'file',
          size: formatFileSize(doc.fileSize), // Formatted for display
          rawSize: doc.fileSize, // Raw bytes for saving
          uploadedAt: formatTimeAgo(doc.uploadedAt),
          description: doc.description || '',
          downloadUrl: doc.fileUrl,
          isSaved: false,
        }));
        
        setTeacherDocuments(mappedDocs);
      } catch (error) {
        console.error('Error fetching documents:', error);
      } finally {
        setDocumentsLoading(false);
      }
    };

    fetchDocuments();
  }, [livestreamID]);

  // Load saved document IDs for current livestream
  useEffect(() => {
    const loadSavedDocuments = async () => {
      if (!livestreamID || teacherDocuments.length === 0) return;

      try {
        // Check each document if it's saved
        const checkPromises = teacherDocuments.map(doc => 
          isDocumentSaved(livestreamID, doc.id)
        );
        const results = await Promise.all(checkPromises);
        
        const savedIds = results
          .filter(result => result.isSaved)
          .map((result, index) => teacherDocuments[index].id);
        
        setSavedDocuments(savedIds);
      } catch (error) {
        console.error('Error loading saved documents:', error);
      }
    };

    loadSavedDocuments();
  }, [livestreamID, teacherDocuments]);

  // Listen for livestream info from backend
  useEffect(() => {
    import('@/socket').then((module) => {
      const socket = module.default;
      
      // Request document sync when joining
      socket.emit('sync-documents', { livestreamId: livestreamID });
      
      socket.on('livestream-info', (info: LivestreamInfo) => {
        setLivestreamInfo(info);
      });

      // Listen for viewer count updates
      socket.on('viewerCount', (count: number) => {
        setLivestreamInfo(prev => prev ? { ...prev, viewers: count } : null);
      });

      // Listen for chat messages
      socket.on('chat-message', (message: {
        id: string;
        username: string;
        userRole: 'teacher' | 'student';
        message: string;
        timestamp: string;
        avatar?: string;
      }) => {
        setChatMessages(prev => [...prev, message]);
      });

      // Listen for shared documents from teacher
      socket.on('share-document', (data: { document: SharedDocument }) => {
        setSharedDocument(data.document);
        setShowSharedDocument(true);
        
        // Show browser notification if possible
        if (typeof window !== 'undefined' && 'Notification' in window) {
          if (Notification.permission === 'granted') {
            new Notification('Teacher is sharing a document', {
              body: `${data.document.name}`,
              icon: '/favicon.ico'
            });
          }
        }
      });

      // Listen for document close event
      socket.on('close-document', () => {
        setShowSharedDocument(false);
        setSharedDocument(null);
      });

      // Listen for documents sync when joining or when teacher uploads
      socket.on('sync-documents', (data: { documents: any[] }) => {
        if (data.documents && data.documents.length > 0) {
          // Map documents to frontend format
          const mappedDocs = data.documents.map((doc: any) => ({
            id: doc.id,
            title: doc.name || doc.title,
            filename: doc.name,
            type: doc.type,
            size: doc.size ? formatFileSize(doc.size) : 'Unknown',
            rawSize: doc.size || 0, // Raw bytes
            uploadedAt: 'Just now',
            description: '',
            downloadUrl: doc.url,
            isSaved: false,
          }));
          setTeacherDocuments(mappedDocs);
        }
      });

      // Listen for new document uploads from teacher
      socket.on('document-uploaded', (data: { document: any }) => {
        const newDoc = {
          id: data.document.id,
          title: data.document.name || data.document.title,
          filename: data.document.name,
          type: data.document.type,
          size: data.document.size ? formatFileSize(data.document.size) : 'Unknown',
          rawSize: data.document.size || 0, // Raw bytes
          uploadedAt: 'Just now',
          description: '',
          downloadUrl: data.document.url,
          isSaved: false,
        };
        setTeacherDocuments(prev => [...prev, newDoc]);
      });
    });

    return () => {
      import('@/socket').then((module) => {
        module.default.off('livestream-info');
        module.default.off('viewerCount');
        module.default.off('chat-message');
        module.default.off('share-document');
        module.default.off('close-document');
        module.default.off('sync-documents');
        module.default.off('document-uploaded');
      });
    };
  }, []);

  // Only auto-scroll when receiving new messages from others, not when sending
  const prevMessagesLengthRef = useRef(chatMessages.length);
  
  useEffect(() => {
    // Only scroll if new message is not from current user
    const newMessagesAdded = chatMessages.length > prevMessagesLengthRef.current;
    if (newMessagesAdded) {
      const latestMessage = chatMessages[chatMessages.length - 1];
      // Auto-scroll only for messages from others
      if (latestMessage && latestMessage.username !== 'Student') {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
    prevMessagesLengthRef.current = chatMessages.length;
  }, [chatMessages]);

  const sendChatMessage = () => {
    if (!chatMessage.trim()) return;
    
    // Check authentication
    if (!user) {
      toast.error('Please login to send messages', {
        duration: 3000,
        position: 'top-center',
        icon: '🔒',
      });
      setChatMessage('');
      return;
    }
    
    import('@/socket').then((module) => {
      const socket = module.default;
      
      const message = {
        id: Date.now().toString() + Math.random(),
        username: user?.fullName || 'Student',
        userRole: 'student' as const,
        message: chatMessage,
        timestamp: new Date().toISOString(),
        avatar: user?.avatar || '/student-avatar.png'
      };
      
      // Emit to backend
      socket.emit("send-chat-message", {
        livestreamID,
        message
      });
      
      setChatMessage('');
      // Removed auto-scroll after sending to keep page position
    });
  };

  const handleChatKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  };

  // Helper function to format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Helper function to format time ago
  const formatTimeAgo = (date: string): string => {
    const now = new Date();
    const uploaded = new Date(date);
    const diffMs = now.getTime() - uploaded.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  // Helper function to format livestream start time
  const formatLivestreamStartTime = (date: string): string => {
    try {
      const startDate = new Date(date);
      const now = new Date();
      const diffMs = now.getTime() - startDate.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Started just now';
      if (diffMins < 60) return `Started ${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
      if (diffHours < 24) return `Started ${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      if (diffDays < 7) return `Started ${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
      
      // Format as date and time for older streams
      return startDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      return 'Just started';
    }
  };

  // Save document to student's document library
  const handleSaveDocument = async (docId: string) => {
    const doc = teacherDocuments.find(d => d.id === docId);
    if (!doc) return;

    try {
      // Toggle save status
      if (savedDocuments.includes(docId)) {
        // Unsave - need to get MongoDB ID first
        const checkResult = await isDocumentSaved(livestreamID, String(docId));
        if (checkResult.isSaved && checkResult.document) {
          await removeSavedDocument(checkResult.document.id);
          setSavedDocuments(savedDocuments.filter(id => id !== docId));
          toast.success('Đã xóa khỏi tài liệu đã lưu');
        }
      } else {
        // Save document to MongoDB
        const savedDoc = await saveDocument({
          livestreamId: livestreamID,
          documentId: String(docId), // Convert to string
          title: doc.title || doc.filename,
          filename: doc.filename,
          fileType: doc.type,
          fileUrl: doc.downloadUrl,
          fileSize: doc.rawSize || 0, // Use raw bytes, not formatted string
          folder: 'Livestream Materials',
          tags: ['livestream', livestreamInfo?.category || 'education'],
        });

        setSavedDocuments([...savedDocuments, docId]);
        toast.success('Đã lưu tài liệu thành công');
      }
    } catch (error) {
      console.error('Error saving document:', error);
      toast.error('Không thể lưu tài liệu');
    }
  };

  // Download document
  const handleDownloadDocument = (doc: typeof teacherDocuments[0]) => {
    // In real app, this would trigger actual download
    alert(`Downloading: ${doc.filename}`);
  };

  // Get file icon based on type
  const getFileIcon = (type: string) => {
    switch (type) {
      case 'pdf':
        return <DocumentIcon className="h-8 w-8 text-red-600" />;
      case 'doc':
        return <DocumentIcon className="h-8 w-8 text-blue-600" />;
      case 'ppt':
        return <VideoCameraIcon className="h-8 w-8 text-orange-600" />;
      case 'xls':
        return <FolderIcon className="h-8 w-8 text-green-600" />;
      default:
        return <DocumentIcon className="h-8 w-8 text-gray-600" />;
    }
  };

  const handleToggleMute = () => {
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseInt(e.target.value);
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
    
    // Update video volume in real-time
    if (remoteVideoRef.current) {
      remoteVideoRef.current.volume = newVolume / 100;
    }
  };

      const handleLike = () => {
        setIsLiked(!isLiked);
      };

      const handleFullscreen = () => {
        if (!document.fullscreenElement) {
          videoContainerRef.current?.requestFullscreen();
        } else {
          document.exitFullscreen();
        }
      };

      useEffect(() => {
        const handleFullscreenChange = () => {
          setIsFullscreen(!!document.fullscreenElement);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
    
        // Keyboard shortcut for fullscreen (F key)
        const handleKeyPress = (e: KeyboardEvent) => {
          if (e.key === 'f' || e.key === 'F') {
            handleFullscreen();
          }
        };
    
        document.addEventListener('keydown', handleKeyPress);
    
        return () => {
          document.removeEventListener('fullscreenchange', handleFullscreenChange);
          document.removeEventListener('keydown', handleKeyPress);
        };
      }, []);

      return (
        <div className={`${raleway.className} h-full w-full bg-gray-50`}>
          <Toaster />
          <div className="h-full flex gap-4 p-4">
        
            {/* Main Content Area */}
            <div className="flex-1 flex flex-col gap-4 min-w-0 overflow-y-auto">
            
              {/* Video Player */}
              <div ref={videoContainerRef} className="relative bg-black rounded-2xl overflow-hidden shadow-2xl aspect-video min-h-[600px] group">
            
                {/* Split view: Video + Shared Document */}
                <div className="absolute inset-0 flex">
                  {/* Video Stream - takes full width or 50% if document is shared */}
                  <div className={`relative transition-all duration-300 ${showSharedDocument ? 'w-1/2' : 'w-full'}`}>
                    <video
                      ref={remoteVideoRef}
                      autoPlay
                      playsInline
                      muted={isMuted}
                      className="absolute inset-0 w-full h-full object-contain bg-gray-900"
                      onLoadedMetadata={(e) => {
                        // Handle play promise to avoid AbortError
                        const video = e.currentTarget;
                        video.volume = volume / 100;
                        const playPromise = video.play();
                        if (playPromise !== undefined) {
                          playPromise.catch(error => {
                            // Auto-play was prevented or interrupted
                            if (error.name !== 'AbortError') {
                              console.warn('Video play interrupted:', error);
                            }
                          });
                        }
                      }}
                    />
                  </div>

                  {/* Shared Document Viewer - 50% when active */}
                  {showSharedDocument && sharedDocument && (
                    <div className="w-1/2 bg-white flex flex-col border-l-4 border-green-500 shadow-2xl">
                      {/* Document Header */}
                      <div className="flex items-center justify-between p-3 bg-green-50 border-b-2 border-green-200">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {sharedDocument.type === 'pdf' || sharedDocument.type === 'doc' || sharedDocument.type === 'ppt' ? (
                            <DocumentIcon className="h-5 w-5 text-red-600 flex-shrink-0" />
                          ) : sharedDocument.type === 'image' ? (
                            <PhotoIcon className="h-5 w-5 text-blue-600 flex-shrink-0" />
                          ) : (
                            <VideoCameraIcon className="h-5 w-5 text-purple-600 flex-shrink-0" />
                          )}
                          <h3 className="font-semibold text-sm truncate">{sharedDocument.name}</h3>
                        </div>
                        <span className="text-xs text-white px-3 py-1 bg-green-600 rounded-full flex-shrink-0 font-semibold animate-pulse">
                          🎓 Shared by Teacher
                        </span>
                      </div>
                  
                      {/* Document Content */}
                      <div className="flex-1 overflow-auto p-4 bg-gray-50">
                        {sharedDocument.type === 'image' ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={sharedDocument.url}
                            alt={sharedDocument.name}
                            className="max-w-full h-auto mx-auto"
                          />
                        ) : sharedDocument.type === 'video' ? (
                          <video
                            src={sharedDocument.url}
                            controls
                            className="max-w-full h-auto mx-auto"
                            onLoadedMetadata={(e) => {
                              // Handle play promise for shared document video
                              const video = e.currentTarget;
                              const playPromise = video.play();
                              if (playPromise !== undefined) {
                                playPromise.catch(error => {
                                  if (error.name !== 'AbortError') {
                                    console.warn('Shared document video play interrupted:', error);
                                  }
                                });
                              }
                            }}
                          />
                        ) : sharedDocument.type === 'pdf' ? (
                          <iframe
                            src={sharedDocument.url}
                            className="w-full h-full border-0"
                            title={sharedDocument.name}
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full text-gray-500">
                            <DocumentIcon className="h-16 w-16 mb-4 opacity-50" />
                            <p className="text-lg font-medium mb-2">{sharedDocument.name}</p>
                            <p className="text-sm mb-4">Preview not available</p>
                            <a
                              href={sharedDocument.url}
                              download={sharedDocument.name}
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                            >
                              Download File
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
            
            
                {/* Loading state */}
                {isLoading && (
                  <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center pointer-events-none z-10">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-white mx-auto mb-4"></div>
                      <p className="text-white/70 text-sm">Connecting to stream...</p>
                      <p className="text-white/30 text-xs mt-2">Livestream: {livestreamID}</p>
                    </div>
                  </div>
                )}
            
                {/* No connection state */}
                {!isLoading && !isConnected && (
                  <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center pointer-events-none z-10">
                    <div className="text-center max-w-md px-4">
                      {isStreamEnded ? (
                        <>
                          <div className="text-6xl mb-4">👋</div>
                          <p className="text-white/70 text-lg font-semibold mb-2">Livestream Has Ended</p>
                          <p className="text-white/50 text-sm mb-4">Thanks for watching! The teacher has ended this stream.</p>
                        </>
                      ) : streamError ? (
                        <>
                          {streamError.includes('not streaming') ? (
                            <>
                              <div className="text-6xl mb-4">⏳</div>
                              <p className="text-white/70 text-lg font-semibold mb-2">Waiting for Stream</p>
                              <p className="text-white/50 text-sm mb-4">{streamError}</p>
                              <div className="animate-pulse text-white/40 text-sm mt-4">
                                The stream will start automatically when the teacher goes live
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="text-6xl mb-4">⚠️</div>
                              <p className="text-white/70 text-lg font-semibold mb-2">Connection Error</p>
                              <p className="text-white/50 text-sm mb-4">{streamError}</p>
                              <button
                                onClick={() => window.location.reload()}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-sm"
                              >
                                Try Again
                              </button>
                            </>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="text-6xl mb-4">📹</div>
                          <p className="text-white/70 text-lg font-semibold mb-2">Stream Not Available</p>
                          <p className="text-white/50 text-sm mb-4">The teacher is not currently streaming</p>
                          <div className="animate-pulse text-white/40 text-sm mt-4">
                            Waiting for teacher to go live...
                          </div>
                        </>
                      )}
                      <div className="text-xs text-white/30 space-y-1 mt-6">
                        <p>Livestream ID: {livestreamID}</p>
                        {livestreamInfo?.isLive && !isStreamEnded && (
                          <p className="text-yellow-400/70 mt-2">
                            ⚠️ Teacher is marked as live but stream connection failed
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
            
                {/* Fallback placeholder when no stream and not loading */}
                {!isConnected && !isLoading && (
                  <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center pointer-events-none z-10">
                    <div className="text-center">
                      <PlayIcon className="h-20 w-20 text-white/30 mx-auto mb-4" />
                      <p className="text-white/50 text-sm">Stream not available</p>
                      <p className="text-white/30 text-xs mt-2">The broadcaster may be offline</p>
                    </div>
                  </div>
                )}
            
                {/* Chat Overlay - Right Side */}
                {showOverlayChat && (
                  <div className="absolute top-20 right-4 bottom-10 w-[25%] bg-gray-900/95 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/10 flex flex-col overflow-hidden">
                    {/* Chat Header */}
                    <div className="px-4 py-3 bg-black/40 backdrop-blur-sm border-b border-white/10 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ChatBubbleLeftRightIcon className="h-5 w-5 text-white" />
                        <h3 className="font-bold text-sm text-white">Live Chat</h3>
                        <span className="px-2 py-0.5 bg-red-600 text-white rounded-full text-xs font-bold">
                          {chatMessages.length}
                        </span>
                      </div>
                    </div>
                  
                    {/* Chat Messages */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-2.5 scrollbar-hide">
                      {chatMessages.map((msg) => (
                        <div key={msg.id} className="flex gap-2 animate-slide-up">
                          <div className={`h-7 w-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white shadow-lg ${msg.userRole === 'teacher'
                            ? 'bg-[#EC255A]'
                            : 'bg-[#161853]'
                            }`}>
                            {msg.username.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className={`text-xs font-bold ${msg.userRole === 'teacher' ? 'text-orange-400' : 'text-white'
                                }`}>
                                {msg.username}
                              </span>
                              {msg.userRole === 'teacher' && (
                                <span className="text-[9px] bg-red-600 text-white px-1.5 py-0.5 rounded font-bold">
                                  TEACHER
                                </span>
                              )}
                              <span className="text-[10px] text-gray-400">
                                {new Date(msg.timestamp).toLocaleTimeString('en-US', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                            <p className="text-sm text-white/90 break-words leading-snug">
                              {msg.message}
                            </p>
                          </div>
                        </div>
                      ))}
                      {chatMessages.length === 0 && (
                        <div className="text-center py-12 text-white/40">
                          <ChatBubbleLeftRightIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No messages yet</p>
                          <p className="text-xs mt-1">Say hi to the teacher!</p>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>
                  
                    {/* Chat Input */}
                    <div className="p-2.5 border-t border-white/10 bg-black/30 backdrop-blur-sm">
                      <div className="flex gap-1.5 items-center">
                        <input
                          type="text"
                          value={chatMessage}
                          onChange={(e) => setChatMessage(e.target.value)}
                          onKeyPress={handleChatKeyPress}
                          onFocus={() => {
                            if (!user) {
                              toast.error('Please login to send messages', {
                                duration: 3000,
                                position: 'top-center',
                                icon: '🔒',
                              });
                            }
                          }}
                          placeholder={user ? "Message..." : "Login to chat..."}
                          disabled={!user}
                          className="flex-1 min-w-0 px-2.5 py-1.5 bg-white/10 border border-white/20 rounded-lg text-xs text-white placeholder-white/50 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <button
                          onClick={sendChatMessage}
                          disabled={!chatMessage.trim() || !user}
                          className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg whitespace-nowrap"
                        >
                          Send
                        </button>
                      </div>
                      {!user && (
                        <p className="text-xs text-white/60 mt-1.5 text-center">
                          🔒 Login required to participate in chat
                        </p>
                      )}
                    </div>
                  </div>
                )}
            
                {/* Top Info Bar */}
                <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
                  <div className="flex items-center gap-2">
                    {/* Live Badge */}
                    {livestreamInfo?.isLive && (
                      <div className="flex items-center gap-2.5 px-4 py-2 bg-gradient-to-r from-red-600 to-red-500 rounded-xl shadow-lg">
                        <div className="relative">
                          <div className="h-2.5 w-2.5 bg-white rounded-full"></div>
                          <div className="absolute inset-0 h-2.5 w-2.5 bg-white rounded-full animate-ping"></div>
                        </div>
                        <span className="text-white text-sm font-bold tracking-wide">LIVE</span>
                      </div>
                    )}
                  </div>
                
                  <div className="flex items-center gap-2">
                    {/* Toggle Chat Button */}
                    <button
                      onClick={() => setShowOverlayChat(!showOverlayChat)}
                      className="p-2.5 bg-black/60 hover:bg-black/80 backdrop-blur-md rounded-xl transition-all border border-white/20 shadow-lg"
                      title={showOverlayChat ? "Hide chat" : "Show chat"}
                    >
                      {showOverlayChat ? (
                        <EyeSlashIcon className="h-5 w-5 text-white" />
                      ) : (
                        <ChatBubbleLeftRightIcon className="h-5 w-5 text-white" />
                      )}
                    </button>
                  
                    {/* Toggle Documents Button */}
                    <button
                      onClick={() => {
                        if (!user) {
                          toast.error('Please login to view documents', {
                            duration: 3000,
                            position: 'top-center',
                            icon: '🔒',
                          });
                          return;
                        }
                        setShowDocuments(!showDocuments);
                      }}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl backdrop-blur-md transition-all border shadow-lg font-semibold text-sm ${showDocuments
                        ? 'bg-[#EC255A] border-white/20 text-white'
                        : 'bg-black/60 hover:bg-black/80 border-white/20 text-white'
                        }`}
                      title={user ? (showDocuments ? "Hide documents" : "View documents") : "Login to view documents"}
                    >
                      <FolderIcon className="h-5 w-5" />
                      <span>{showDocuments ? 'Hide' : 'Documents'}</span>
                      {teacherDocuments.length > 0 && (
                        <span className="px-2 py-0.5 bg-white/30 rounded-full text-xs font-bold">
                          {teacherDocuments.length}
                        </span>
                      )}
                    </button>
                  </div>
                </div>
            
                {/* Video Controls - Show on Hover */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <div className="flex items-center gap-4">
                    {/* Volume */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleToggleMute}
                        className="p-2 rounded-full hover:bg-white/20 transition-colors"
                      >
                        {isMuted || volume === 0 ? (
                          <SpeakerXMarkIcon className="h-5 w-5 text-white" />
                        ) : (
                          <SpeakerWaveIcon className="h-5 w-5 text-white" />
                        )}
                      </button>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={volume}
                        onChange={handleVolumeChange}
                        className="w-20 accent-red-600"
                      />
                    </div>
                
                    <div className="flex-1"></div>
                
                    {/* Fullscreen */}
                    <button
                      onClick={handleFullscreen}
                      className="p-2 rounded-full hover:bg-white/20 transition-colors"
                      title={isFullscreen ? "Exit Fullscreen (F)" : "Fullscreen (F)"}
                    >
                      {isFullscreen ? (
                        <ArrowsPointingInIcon className="h-5 w-5 text-white" />
                      ) : (
                        <ArrowsPointingOutIcon className="h-5 w-5 text-white" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
          
              {/* Video Info & Actions */}
              <div className="bg-white rounded-xl shadow-md p-5">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1 min-w-0">
                    <h1 className={`text-2xl font-bold text-[#${PrimaryColor}] mb-2`}>
                      {livestreamInfo?.title || 'Loading...'}
                    </h1>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <UserGroupIcon className="h-4 w-4" />
                        <span className="font-medium">
                          {livestreamInfo?.viewers !== undefined ? livestreamInfo.viewers.toLocaleString('en-US') : '0'} watching
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ClockIcon className="h-4 w-4" />
                        <span>{livestreamInfo?.startedAt ? formatLivestreamStartTime(livestreamInfo.startedAt) : 'Just started'}</span>
                      </div>
                      {livestreamInfo?.category && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">
                          {livestreamInfo.category}
                        </span>
                      )}
                    </div>
                  </div>
                
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleLike}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-medium ${isLiked
                        ? `bg-[#${SecondaryColor}] text-white`
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                      {isLiked ? (
                        <HeartSolidIcon className="h-5 w-5" />
                      ) : (
                        <HeartIcon className="h-5 w-5" />
                      )}
                      <span>{livestreamInfo?.likes ? (livestreamInfo.likes + (isLiked ? 1 : 0)) : (isLiked ? 1 : 0)}</span>
                    </button>
                  
                    <button className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors">
                      <ShareIcon className="h-5 w-5 text-gray-700" />
                    </button>
                  </div>
                </div>
              
                {/* Teacher Info */}
                <div className="pt-4 border-t border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-[#161853] overflow-hidden flex items-center justify-center text-white text-lg font-bold">
                    {livestreamInfo?.teacher?.name ? livestreamInfo.teacher.name.charAt(0) : 'T'}
                  </div>
                    <div>
                      <h3 className={`font-bold text-base text-[#${PrimaryColor}]`}>
                        {livestreamInfo?.teacher?.name || 'Teacher'}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {livestreamInfo?.teacher?.followers || '0'} followers
                      </p>
                    </div>
                  </div>
                
                  <button className={`px-5 py-2 rounded-lg bg-[#${SecondaryColor}] text-white font-medium hover:bg-[#d41f4d] transition-colors`}>
                    Follow
                  </button>
                </div>
              
                {/* Description */}
                <div className="mt-4">
                  <p className="text-gray-700 text-sm leading-relaxed">
                    {livestreamInfo?.description || 'No description available.'}
                  </p>
                </div>
              </div>
            </div>
        
            {/* Documents Sidebar - Teacher's Shared Materials */}
            {showDocuments && (
              <div className="w-96 flex flex-col bg-white rounded-xl shadow-2xl overflow-hidden border border-gray-200">
                {/* Documents Header */}
                <div className="p-4 bg-[#161853] text-white flex items-center justify-between shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                      <FolderIcon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-base">Learning Materials</h3>
                      <p className="text-xs text-white/80">
                        {teacherDocuments.length} document{teacherDocuments.length !== 1 ? 's' : ''} shared
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowDocuments(false)}
                    className="p-2 rounded-lg hover:bg-white/20 transition-all"
                    title="Close documents"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
            
                {/* Documents List */}
                <div className="flex-1 overflow-y-auto">
                  {documentsLoading ? (
                    <div className="p-8 text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#161853] mx-auto mb-3"></div>
                      <p className="text-gray-500 font-medium">Loading documents...</p>
                    </div>
                  ) : teacherDocuments.length === 0 ? (
                    <div className="p-8 text-center">
                      <FolderIcon className="h-16 w-16 mx-auto text-gray-300 mb-3" />
                      <p className="text-gray-500 font-medium">No documents yet</p>
                      <p className="text-xs text-gray-400 mt-1">Teacher hasn&apos;t shared any materials</p>
                    </div>
                  ) : (
                    <div className="p-4 space-y-3">
                      {teacherDocuments.map((doc) => {
                        const isSaved = savedDocuments.includes(doc.id);
                    
                        return (
                          <div
                            key={doc.id}
                            className="bg-white rounded-xl border-2 border-gray-200 hover:border-[#161853] hover:shadow-lg transition-all p-4"
                          >
                            {/* Document Header */}
                            <div className="flex items-start gap-3 mb-3">
                              <div className="flex-shrink-0">
                                {getFileIcon(doc.type)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-gray-800 text-sm mb-1 truncate">
                                  {doc.title}
                                </h4>
                                <p className="text-xs text-gray-500 mb-2">
                                  {doc.filename}
                                </p>
                                <p className="text-xs text-gray-600 leading-relaxed line-clamp-2">
                                  {doc.description}
                                </p>
                              </div>
                            </div>
                        
                            {/* Document Meta */}
                            <div className="flex items-center gap-3 text-xs text-gray-500 mb-3 pb-3 border-b border-gray-100">
                              <span className="flex items-center gap-1">
                                <ClockIcon className="h-3.5 w-3.5" />
                                {doc.uploadedAt}
                              </span>
                              <span>•</span>
                              <span>{doc.size}</span>
                            </div>
                        
                            {/* Action Buttons */}
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleSaveDocument(doc.id)}
                                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-medium text-sm transition-all ${isSaved
                                  ? 'bg-green-500 text-white shadow-md'
                                  : 'bg-gray-100 text-[#161853] hover:bg-gray-200'
                                  }`}
                              >
                                {isSaved ? (
                                  <>
                                    <CheckIcon className="h-4 w-4" />
                                    Saved
                                  </>
                                ) : (
                                  <>
                                    <FolderIcon className="h-4 w-4" />
                                    Save to My Docs
                                  </>
                                )}
                              </button>
                          
                              <button
                                onClick={() => handleDownloadDocument(doc)}
                                className="px-4 py-2 rounded-lg bg-[#EC255A] text-white font-medium text-sm hover:bg-[#d41f4d] transition-all shadow-md hover:shadow-lg"
                                title="Download"
                              >
                                <ArrowDownTrayIcon className="h-4 w-4" />
                              </button>
                            </div>
                        
                            {/* Saved Indicator */}
                            {isSaved && (
                              <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                                <CheckIcon className="h-4 w-4 text-green-600 flex-shrink-0" />
                                <p className="text-xs text-green-700 font-medium">
                                  Available in your Documents library
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
            
                {/* Footer Info */}
                <div className="p-4 border-t-2 border-gray-200 bg-gray-50">
                  <div className="flex items-start gap-2 text-xs text-gray-600">
                    <div className="p-1.5 bg-[#161853]/10 rounded-lg flex-shrink-0">
                      <svg className="h-4 w-4 text-[#161853]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-700 mb-1">Quick Tips:</p>
                      <ul className="space-y-1 text-gray-600">
                        <li>• Click &quot;Save to My Docs&quot; to access later</li>
                        <li>• Download files for offline viewing</li>
                        <li>• Saved docs appear in your Documents page</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Mobile Toggle Buttons */}
          <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50 lg:hidden">
            {!showOverlayChat && (
              <button
                onClick={() => {
                  setShowOverlayChat(true);
                }}
                className="p-4 rounded-full bg-[#161853] text-white shadow-lg hover:bg-[#0a0c29] transition-colors"
              >
                <ChatBubbleLeftRightIcon className="h-6 w-6" />
              </button>
            )}
          </div>
        </div>
      );
    }
  
