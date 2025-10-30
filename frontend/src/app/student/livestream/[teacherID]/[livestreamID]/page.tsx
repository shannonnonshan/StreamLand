'use client';

import { useState, useRef, useEffect } from 'react';
import { raleway } from '@/utils/front';
import { useParams } from 'next/navigation';
import { useLivestreamViewer } from '@/hooks/useLivestreamViewer';
import { 
  PlayIcon, 
  PauseIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  XMarkIcon,
  ClockIcon,
  UserGroupIcon,
  HeartIcon,
  ShareIcon,
  FolderIcon,
  CheckIcon,
  EyeSlashIcon,
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
  const { teacherID, livestreamID } = params;
  
  // Client-side mount state
  const [isMounted, setIsMounted] = useState(false);
  
  // Livestream info from backend
  const [livestreamInfo, setLivestreamInfo] = useState<LivestreamInfo | null>(null);
  
  // Error and status states
  const [streamError, setStreamError] = useState<string | null>(null);
  const [isStreamEnded, setIsStreamEnded] = useState(false);
  
  // WebRTC connection using custom hook
  const { isConnected, isLoading, remoteVideoRef } = useLivestreamViewer({
    teacherID: teacherID as string,
    livestreamID: livestreamID as string,
    onError: (error) => {
      console.error('Livestream error:', error);
      setStreamError(error.message || 'Unable to connect to livestream');
    },
    onStreamEnded: () => {
      console.log('Stream ended');
      setIsStreamEnded(true);
      setStreamError('This livestream has ended');
    },
  });
  
  // Video player states
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(80);
  const [isLiked, setIsLiked] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // UI states
  const [showNotes, setShowNotes] = useState(false);
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
  
  // Note taking states
  const [documentTitle, setDocumentTitle] = useState('');
  const [documentContent, setDocumentContent] = useState('');
  const [noteTags, setNoteTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [currentVideoTime, setCurrentVideoTime] = useState('00:00');
  
  // Shared document states
  const [sharedDocument, setSharedDocument] = useState<SharedDocument | null>(null);
  const [showSharedDocument, setShowSharedDocument] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const noteTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Set mounted state
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Load document from localStorage on mount
  useEffect(() => {
    if (!isMounted) return;
    
    const savedDoc = localStorage.getItem(`livestream-doc-${livestreamID}`);
    if (savedDoc) {
      const parsed = JSON.parse(savedDoc);
      setDocumentTitle(parsed.title);
      setDocumentContent(parsed.content);
      setNoteTags(parsed.tags || []);
      setLastSaved(parsed.lastSaved ? new Date(parsed.lastSaved) : null);
    }
  }, [livestreamID, isMounted]);

  // Listen for livestream info from backend
  useEffect(() => {
    import('@/socket').then((module) => {
      const socket = module.default;
      
      socket.on('livestream-info', (info: LivestreamInfo) => {
        console.log('Received livestream info:', info);
        setLivestreamInfo(info);
        // Set document title from livestream info
        if (!documentTitle) {
          setDocumentTitle(`${info.title} - Notes`);
        }
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
        console.log('💬 [Student] Received chat:', message);
        setChatMessages(prev => [...prev, message]);
      });

      // Listen for shared documents from teacher
      socket.on('share-document', (data: { document: SharedDocument }) => {
        console.log('✅ [Student] Received share-document event:', data);
        console.log('Document details:', data.document);
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
        console.log('Teacher closed document');
        setShowSharedDocument(false);
        setSharedDocument(null);
      });

      // Listen for documents sync when joining
      socket.on('sync-documents', (data: { documents: SharedDocument[] }) => {
        console.log('Synced documents:', data.documents);
        // If there were documents shared, we could show them in a list
        // For now, just log them
      });
    });

    return () => {
      import('@/socket').then((module) => {
        module.default.off('livestream-info');
        module.default.off('chat-message');
        module.default.off('share-document');
        module.default.off('close-document');
        module.default.off('sync-documents');
      });
    };
  }, [documentTitle]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    // Simulate video time updates
    const interval = setInterval(() => {
      if (isPlaying) {
        const now = new Date();
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const seconds = now.getSeconds().toString().padStart(2, '0');
        setCurrentVideoTime(`${minutes}:${seconds}`);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Auto-save to localStorage
  const handleAutoSave = () => {
    if (!isMounted || !livestreamInfo) return;
    
    const docData = {
      title: documentTitle,
      content: documentContent,
      tags: noteTags,
      lastSaved: new Date().toISOString(),
      livestreamId: livestreamID,
      teacherId: teacherID,
      livestreamTitle: livestreamInfo.title,
      category: livestreamInfo.category
    };
    localStorage.setItem(`livestream-doc-${livestreamID}`, JSON.stringify(docData));
    setLastSaved(new Date());
  };

  const handleSaveToDocuments = () => {
    if (!isMounted || !documentContent.trim() || !livestreamInfo) return;
    
    // Save current state
    handleAutoSave();
    
    // Save to documents list
    const savedDocs = JSON.parse(localStorage.getItem('studentDocuments') || '[]');
    
    // Check if this document already exists
    const existingIndex = savedDocs.findIndex((doc: { livestreamId?: string }) => 
      doc.livestreamId === livestreamID
    );
    
    // Create proper Document object matching the schema
    const docData = {
      // Required fields from Document type
      id: existingIndex >= 0 ? savedDocs[existingIndex].id : Date.now().toString(),
      title: documentTitle,
      filename: `${documentTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.txt`,
      type: 'other' as const, // Use 'other' type for livestream notes
      size: `${(documentContent.length / 1024).toFixed(2)} KB`,
      uploadDate: existingIndex >= 0 ? savedDocs[existingIndex].uploadDate : new Date().toLocaleDateString('en-CA'), // YYYY-MM-DD format
      lastModified: new Date().toLocaleDateString('en-CA'), // YYYY-MM-DD format
      pinnedAt: existingIndex >= 0 ? savedDocs[existingIndex].pinnedAt : null,
      tags: [...noteTags, 'livestream', livestreamInfo.category.toLowerCase()],
      folder: 'Livestream Notes',
      downloadUrl: '#',
      
      // Optional/custom fields for livestream notes
      previewUrl: undefined,
      content: documentContent, // Store the actual content
      livestreamId: livestreamID,
      teacherId: teacherID,
      livestreamTitle: livestreamInfo.title,
      videoTime: currentVideoTime
    };
    
    if (existingIndex >= 0) {
      // Update existing document
      savedDocs[existingIndex] = docData;
    } else {
      // Add new document
      savedDocs.push(docData);
    }
    
    localStorage.setItem('studentDocuments', JSON.stringify(savedDocs));
    
    // Show success message
    setShowSaveSuccess(true);
    setTimeout(() => setShowSaveSuccess(false), 3000);
    
    console.log('Saved to documents:', docData);
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !noteTags.includes(tagInput.trim())) {
      setNoteTags([...noteTags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setNoteTags(noteTags.filter(t => t !== tag));
  };

  const sendChatMessage = () => {
    if (!chatMessage.trim()) return;
    
    import('@/socket').then((module) => {
      const socket = module.default;
      
      const message = {
        id: Date.now().toString() + Math.random(),
        username: 'Student', // TODO: Get from auth
        userRole: 'student' as const,
        message: chatMessage,
        timestamp: new Date().toISOString(),
        avatar: '/student-avatar.png'
      };
      
      // Emit to backend
      socket.emit("send-chat-message", {
        teacherID,
        livestreamID,
        message
      });
      
      setChatMessage('');
    });
  };

  const handleChatKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  };

  const applyFormatting = (format: 'bold' | 'italic' | 'underline') => {
    const textarea = noteTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = documentContent.substring(start, end);

    if (selectedText) {
      let formattedText = selectedText;
      
      // Note: This is a simple demonstration. In a real app, you'd use a rich text editor
      switch (format) {
        case 'bold':
          formattedText = `**${selectedText}**`;
          setIsBold(!isBold);
          break;
        case 'italic':
          formattedText = `*${selectedText}*`;
          setIsItalic(!isItalic);
          break;
        case 'underline':
          formattedText = `__${selectedText}__`;
          setIsUnderline(!isUnderline);
          break;
      }

      const newContent = documentContent.substring(0, start) + formattedText + documentContent.substring(end);
      setDocumentContent(newContent);
      handleAutoSave();
    }
  };

  const handleTogglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const handleToggleMute = () => {
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseInt(e.target.value);
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
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
                  muted
                  className="absolute inset-0 w-full h-full object-contain bg-gray-900"
                  onLoadedMetadata={() => console.log('[Video] Metadata loaded')}
                  onPlay={() => console.log('[Video] Playing')}
                  onPause={() => console.log('[Video] Paused')}
                  onError={(e) => console.error('[Video] Error:', e)}
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
            
            {/* Connection status indicator */}
            {!isLoading && isConnected && (
              <div className="absolute top-4 left-4 px-3 py-1.5 bg-green-600/90 backdrop-blur-sm rounded-lg z-20">
                <p className="text-white text-xs font-semibold">● Connected</p>
              </div>
            )}
            
            {/* Loading state */}
            {isLoading && (
              <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center pointer-events-none z-10">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-white mx-auto mb-4"></div>
                  <p className="text-white/70 text-sm">Connecting to stream...</p>
                  <p className="text-white/30 text-xs mt-2">Teacher: {teacherID} | Live: {livestreamID}</p>
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
                    <p>Teacher ID: {teacherID}</p>
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
                        <div className={`h-7 w-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white shadow-lg ${
                          msg.userRole === 'teacher' 
                            ? 'bg-gradient-to-br from-red-500 to-orange-600' 
                            : 'bg-gradient-to-br from-blue-500 to-purple-600'
                        }`}>
                          {msg.username.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`text-xs font-bold ${
                              msg.userRole === 'teacher' ? 'text-orange-400' : 'text-white'
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
                        placeholder="Message..."
                        className="flex-1 min-w-0 px-2.5 py-1.5 bg-white/10 border border-white/20 rounded-lg text-xs text-white placeholder-white/50 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                      />
                      <button 
                        onClick={sendChatMessage}
                        disabled={!chatMessage.trim()}
                        className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg whitespace-nowrap"
                      >
                        Send
                      </button>
                    </div>
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
                  
                  {/* Debug Status (remove later) */}
                  <div className="px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-lg text-xs text-white/70">
                    Loading: {isLoading ? '✓' : '✗'} | Connected: {isConnected ? '✓' : '✗'}
                  </div>
                  
                  {/* Debug Test Button */}
                  <button
                    onClick={() => {
                      console.log('=== VIDEO DEBUG ===');
                      console.log('Video ref:', remoteVideoRef.current);
                      console.log('Video srcObject:', remoteVideoRef.current?.srcObject);
                      console.log('Video paused:', remoteVideoRef.current?.paused);
                      console.log('Video readyState:', remoteVideoRef.current?.readyState);
                      if (remoteVideoRef.current?.srcObject) {
                        const stream = remoteVideoRef.current.srcObject as MediaStream;
                        console.log('Stream active:', stream.active);
                        console.log('Stream tracks:', stream.getTracks());
                        stream.getTracks().forEach(track => {
                          console.log(`Track ${track.kind}:`, track.enabled, track.readyState);
                        });
                      }
                    }}
                    className="px-3 py-1.5 bg-blue-600/80 hover:bg-blue-600 backdrop-blur-md rounded-lg text-xs text-white font-semibold"
                  >
                    Debug
                  </button>
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
                  
                  {/* Toggle Notes Button */}
                  <button
                    onClick={() => setShowNotes(!showNotes)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl backdrop-blur-md transition-all border shadow-lg font-semibold text-sm ${
                      showNotes 
                        ? 'bg-[#EC255A] border-white/20 text-white' 
                        : 'bg-black/60 hover:bg-black/80 border-white/20 text-white'
                    }`}
                    title={showNotes ? "Hide notes" : "Take notes"}
                  >
                    <DocumentTextIcon className="h-5 w-5" />
                    <span>{showNotes ? 'Hide' : 'Notes'}</span>
                    {documentContent && (
                      <span className="px-2 py-0.5 bg-white/30 rounded-full text-xs font-bold">
                        {documentContent.length > 0 ? '📝' : ''}
                      </span>
                    )}
                  </button>
                </div>
              </div>
            
            {/* Video Controls - Show on Hover */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <div className="flex items-center gap-4">
                {/* Play/Pause */}
                <button 
                  onClick={handleTogglePlay}
                  className="p-2 rounded-full hover:bg-white/20 transition-colors"
                >
                  {isPlaying ? (
                    <PauseIcon className="h-6 w-6 text-white" />
                  ) : (
                    <PlayIcon className="h-6 w-6 text-white" />
                  )}
                </button>
                
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
                
                {/* Time */}
                <div className="flex items-center gap-2 text-white text-sm">
                  <ClockIcon className="h-4 w-4" />
                  <span>{currentVideoTime}</span>
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
                        {livestreamInfo?.viewers ? livestreamInfo.viewers.toLocaleString() : '0'} watching
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ClockIcon className="h-4 w-4" />
                      <span>{livestreamInfo?.startedAt || 'Just started'}</span>
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
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-medium ${
                      isLiked 
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
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 overflow-hidden flex items-center justify-center text-white text-lg font-bold">
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
        
        {/* Notes Sidebar - Single Document (Google Docs style) */}
        {showNotes && (
          <div className="w-96 flex flex-col bg-gradient-to-b from-blue-50 to-white rounded-xl shadow-2xl overflow-hidden border border-blue-100">
            {/* Notes Header */}
            <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <DocumentTextIcon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <input
                    type="text"
                    value={documentTitle}
                    onChange={(e) => setDocumentTitle(e.target.value)}
                    onBlur={handleAutoSave}
                    className="w-full bg-transparent border-none outline-none font-bold text-base text-white placeholder-blue-200 truncate"
                    placeholder="Document Title"
                  />
                  <p className="text-xs text-blue-100">
                    {lastSaved 
                      ? `Saved ${lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                      : 'Auto-saving...'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowNotes(false)}
                className="p-2 rounded-lg hover:bg-white/20 transition-all"
                title="Close notes"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            
            {/* Document Editor */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Toolbar */}
              <div className="p-3 border-b-2 border-blue-100 bg-white">
                {/* Success Message */}
                {showSaveSuccess && (
                  <div className="mb-3 p-3 bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-500 rounded-r-lg flex items-center gap-2 text-green-700 animate-fade-in shadow-sm">
                    <CheckIcon className="h-5 w-5 text-green-600" />
                    <span className="font-semibold">Saved to Documents!</span>
                  </div>
                )}
                
                {/* Current Time Badge */}
                <div className="mb-3 flex items-center gap-2 text-xs font-bold text-blue-700 bg-gradient-to-r from-blue-100 to-blue-50 px-4 py-2.5 rounded-xl border border-blue-200 shadow-sm">
                  <ClockIcon className="h-4 w-4" />
                  <span>Video Time: {currentVideoTime}</span>
                  <button
                    onClick={() => {
                      const timestamp = `\n[${currentVideoTime}] `;
                      setDocumentContent(documentContent + timestamp);
                      noteTextareaRef.current?.focus();
                    }}
                    className="ml-auto px-2 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all text-xs"
                  >
                    Insert Timestamp
                  </button>
                </div>
                
                {/* Formatting Toolbar */}
                <div className="flex items-center gap-1.5 p-2 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl border-2 border-gray-200 shadow-sm">
                  <button
                    onClick={() => applyFormatting('bold')}
                    className={`p-2 rounded-lg transition-all ${isBold ? 'bg-blue-500 text-white shadow-md' : 'bg-white hover:bg-blue-100'}`}
                    title="Bold"
                  >
                    <span className="text-sm font-bold">B</span>
                  </button>
                  <button
                    onClick={() => applyFormatting('italic')}
                    className={`p-2 rounded-lg transition-all ${isItalic ? 'bg-blue-500 text-white shadow-md' : 'bg-white hover:bg-blue-100'}`}
                    title="Italic"
                  >
                    <span className="text-sm italic font-serif">I</span>
                  </button>
                  <button
                    onClick={() => applyFormatting('underline')}
                    className={`p-2 rounded-lg transition-all ${isUnderline ? 'bg-blue-500 text-white shadow-md' : 'bg-white hover:bg-blue-100'}`}
                    title="Underline"
                  >
                    <span className="text-sm underline">U</span>
                  </button>
                  <div className="w-px h-7 bg-gray-300 mx-1"></div>
                  <span className="text-xs font-semibold text-gray-600 ml-auto">
                    {documentContent.length} characters
                  </span>
                </div>
              </div>
              
              {/* Main Document Editor */}
              <textarea
                ref={noteTextareaRef}
                value={documentContent}
                onChange={(e) => setDocumentContent(e.target.value)}
                onBlur={handleAutoSave}
                placeholder="📝 Start writing your notes here...

Tips:
• Click 'Insert Timestamp' to mark specific moments in the video
• Your work is automatically saved
• Use formatting buttons for better organization
• All notes for this livestream are saved in one document"
                className="flex-1 p-6 border-none focus:outline-none resize-none text-sm leading-relaxed bg-white"
              />
              
              {/* Tags and Save Section */}
              <div className="p-4 border-t-2 border-blue-100 bg-white">
                {/* Tags Input */}
                <div className="mb-3">
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                      placeholder="🏷️ Add tags..."
                      className="flex-1 px-3 py-2 border-2 border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-medium hover:border-blue-300 transition-colors"
                    />
                    <button
                      onClick={handleAddTag}
                      className="px-4 py-2 bg-blue-100 hover:bg-blue-200 rounded-lg text-xs font-bold text-blue-700 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                  {noteTags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {noteTags.map((tag, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-full text-xs font-bold shadow-sm hover:shadow-md transition-shadow"
                        >
                          {tag}
                          <button
                            onClick={() => handleRemoveTag(tag)}
                            className="hover:bg-white/20 rounded-full p-0.5 transition-colors"
                          >
                            <XMarkIcon className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={handleAutoSave}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 font-bold hover:from-gray-200 hover:to-gray-300 transition-all shadow-sm hover:shadow-md"
                  >
                    <ClockIcon className="h-5 w-5" />
                    Save Now
                  </button>
                  <button
                    onClick={handleSaveToDocuments}
                    disabled={!documentContent.trim()}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                  >
                    <FolderIcon className="h-5 w-5" />
                    Export
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  💾 Your document is auto-saved as you type
                </p>
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
