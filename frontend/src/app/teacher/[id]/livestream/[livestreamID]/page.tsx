"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { ICE_SERVERS } from "@/utils/ice";
import socket from "@/socket";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Upload,
  MoreVertical,
  Play,
  Square,
  ChevronDown,
  ChevronUp,
  X,
  Monitor,
  FileText,
  Image as ImageIcon,
  Film,
  Maximize2,
  Minimize2,
} from "lucide-react";

interface DocumentFile {
  id: number;
  name: string;
  type: 'pdf' | 'image' | 'video' | 'doc' | 'ppt';
  url: string;
  uploadedAt: string;
  size?: number;
}

interface LivestreamInfo {
  title: string;
  description: string;
  category: string;
  isPublic: boolean;
  allowComments: boolean;
}

export default function BroadcasterPage() {
  const params = useParams<{ id?: string; livestreamID?: string }>();

  const teacherID = params?.id ?? "1";
  const livestreamID = params?.livestreamID ?? "1";

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const peersRef = useRef<Record<string, RTCPeerConnection>>({});
  const localStreamRef = useRef<MediaStream | null>(null);

  const [isLive, setIsLive] = useState(false);
  const [watcherCount, setWatcherCount] = useState(0);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [livestreamInfo, setLivestreamInfo] = useState<LivestreamInfo | null>(null);

  const [showFiles, setShowFiles] = useState(true);
  const [showComments, setShowComments] = useState(true);
  const [documents, setDocuments] = useState<DocumentFile[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<DocumentFile | null>(null);
  const [showDocumentViewer, setShowDocumentViewer] = useState(false);
  const [pendingDocument, setPendingDocument] = useState<DocumentFile | null>(null);
  const [showShareConfirm, setShowShareConfirm] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [saveRecording, setSaveRecording] = useState(false);
  const [isEndingStream, setIsEndingStream] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{
    id: string;
    username: string;
    userRole: 'teacher' | 'student';
    message: string;
    timestamp: string;
    avatar?: string;
  }>>([]);
  const [chatInput, setChatInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchTeacherDocuments();
    
    const fetchLivestreamInfo = async () => {
      try {
        const response = await fetch(`http://localhost:4000/livestream/${livestreamID}`);
        if (response.ok) {
          const data = await response.json();
          
          // Check if livestream has ended
          if (data.status === 'ENDED') {
            // If recording was saved, redirect to recording page
            if (data.isRecorded && data.recordingUrl) {
              window.location.href = `/teacher/${teacherID}/recordings/${livestreamID}`;
            } else {
              // No recording, redirect to home
              window.location.href = `/teacher/${teacherID}`;
            }
            return;
          }
          
          setLivestreamInfo({
            title: data.title,
            description: data.description,
            category: data.category,
            isPublic: data.isPublic,
            allowComments: data.allowComments,
          });
        }
      } catch (error) {
        // Error fetching livestream info

      }
    };
    
    fetchLivestreamInfo();
  }, [teacherID, livestreamID]);

  const fetchTeacherDocuments = async () => {
    try {
      // TODO: Replace with actual API call when backend is ready
      // const response = await fetch(`/api/teachers/${teacherID}/documents`);
      // const data = await response.json();
      // setDocuments(data);
      
      // No documents initially - user needs to upload
      setDocuments([]);
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  useEffect(() => {
    socket.on("watcher", handleWatcher);
    socket.on("answer", handleAnswer);
    socket.on("candidate", handleCandidate);
    socket.on("bye", handleBye);
    socket.on("viewerCount", (count: number) => setWatcherCount(count));
    
    // Listen for chat messages
    socket.on("chat-message", (message: {
      id: string;
      username: string;
      userRole: 'teacher' | 'student';
      message: string;
      timestamp: string;
      avatar?: string;
    }) => {
      setChatMessages(prev => [...prev, message]);
    });

    return () => {
      socket.off("watcher", handleWatcher);
      socket.off("answer", handleAnswer);
      socket.off("candidate", handleCandidate);
      socket.off("bye", handleBye);
      socket.off("viewerCount");
      socket.off("chat-message");

      // Don't disconnect socket - it's a shared instance
      // socket.disconnect();
      Object.values(peersRef.current).forEach((pc) => pc.close());
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startLive() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Ensure socket is connected before emitting
      if (!socket.connected) {
        socket.connect();
        // Wait for connection
        await new Promise((resolve) => {
          if (socket.connected) {
            resolve(true);
          } else {
            socket.once('connect', resolve);
          }
        });
      }
      
      socket.emit("broadcaster", { 
        livestreamID
      });
      
      setIsLive(true);
      
      // Share uploaded documents with new viewers
      socket.emit("sync-documents", {
        livestreamID,
        documents: documents
      });
    } catch (err) {
      console.error('Failed to start livestream:', err);
      alert('Could not access camera/microphone. Please check permissions.');
    }
  }

  function handleStartClick() {
    startLive();
  }

  function handleStopClick() {
    setShowEndConfirm(true);
  }

  async function confirmEndStream() {
    setIsEndingStream(true);
    
    try {
      // Update livestream status in database
      const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
      
      const response = await fetch(`http://localhost:4000/livestream/${livestreamID}/end`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          saveRecording: saveRecording,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to end livestream');
      }

      // Stop WebRTC connections
      socket.emit("stream-ended", { livestreamID });

      Object.values(peersRef.current).forEach((pc) => pc.close());
      peersRef.current = {};

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }

      setIsLive(false);
      setWatcherCount(0);
      setShowEndConfirm(false);
      
      // Redirect to home page
      window.location.href = `/teacher/${teacherID}`;
    } catch (error) {
      console.error('Failed to end livestream:', error);
      alert('Failed to end livestream. Please try again.');
    } finally {
      setIsEndingStream(false);
    }
  }

  async function handleWatcher(data: { id: string } | string) {
    const watcherId = typeof data === 'string' ? data : data.id;
    
    if (peersRef.current[watcherId]) {
      return;
    }

    if (!localStreamRef.current) {
      return;
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peersRef.current[watcherId] = pc;

    const tracks = localStreamRef.current.getTracks();
    
    tracks.forEach((track) => {
      pc.addTrack(track, localStreamRef.current!);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("candidate", {
          to: watcherId,
          candidate: event.candidate,
          livestreamID,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        // Connection failed
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socket.emit("offer", {
      to: watcherId,
      sdp: pc.localDescription,
      teacherID,
      livestreamID,
    });
  }

  function handleAnswer({ from, sdp }: { from: string; sdp: RTCSessionDescriptionInit }) {
    const pc = peersRef.current[from];
    if (pc) {
      pc.setRemoteDescription(new RTCSessionDescription(sdp));
    }
  }

  function handleCandidate({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) {
    const pc = peersRef.current[from];
    if (pc) {
      pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {
        // ICE candidate error
      });
    }
  }

  function handleBye(id: string) {
    const pc = peersRef.current[id];
    if (pc) {
      pc.close();
      delete peersRef.current[id];
    }
  }

  function toggleMic() {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicOn(audioTrack.enabled);
      }
    }
  }

  function toggleCamera() {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOn(videoTrack.enabled);
      }
    }
  }

  async function toggleScreenShare() {
    try {
      if (!isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });

        const screenTrack = screenStream.getVideoTracks()[0];
        
        const oldVideoTrack = localStreamRef.current?.getVideoTracks()[0];
        if (oldVideoTrack && localStreamRef.current) {
          localStreamRef.current.removeTrack(oldVideoTrack);
          localStreamRef.current.addTrack(screenTrack);
          
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
          }

          Object.values(peersRef.current).forEach((pc) => {
            const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
            if (sender) {
              sender.replaceTrack(screenTrack);
            }
          });

          oldVideoTrack.stop();
        }

        screenTrack.onended = async () => {
          await stopScreenShare();
        };

        setIsScreenSharing(true);
      } else {
        await stopScreenShare();
      }
    } catch (error) {
      console.error('Screen share error:', error);
    }
  }

  async function stopScreenShare() {
    try {
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });

      const cameraTrack = cameraStream.getVideoTracks()[0];
      
      const oldScreenTrack = localStreamRef.current?.getVideoTracks()[0];
      if (oldScreenTrack && localStreamRef.current) {
        localStreamRef.current.removeTrack(oldScreenTrack);
        localStreamRef.current.addTrack(cameraTrack);
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }

        Object.values(peersRef.current).forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(cameraTrack);
          }
        });

        oldScreenTrack.stop();
      }

      setIsScreenSharing(false);
      setIsCameraOn(true);
    } catch (error) {
      console.error('Stop screen share error:', error);
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach(async (file) => {
      const fileType = file.type.startsWith('image/') ? 'image' : 
                       file.type.startsWith('video/') ? 'video' : 
                       file.type.includes('pdf') ? 'pdf' :
                       file.type.includes('document') || file.type.includes('word') ? 'doc' :
                       file.type.includes('presentation') || file.type.includes('powerpoint') ? 'ppt' : 'doc';
      
      const fileUrl = URL.createObjectURL(file);
      
      // TODO: Upload to backend when API is ready
      // const formData = new FormData();
      // formData.append('file', file);
      // formData.append('teacherId', teacherID);
      // formData.append('livestreamId', livestreamID);
      // 
      // try {
      //   const response = await fetch('/api/upload/document', {
      //     method: 'POST',
      //     body: formData,
      //   });
      //   const data = await response.json();
      //   
      //   const newDoc: DocumentFile = {
      //     id: data.id,
      //     name: file.name,
      //     type: fileType as any,
      //     url: data.url,
      //     uploadedAt: new Date().toISOString(),
      //     size: file.size
      //   };
      //   setDocuments(prev => [...prev, newDoc]);
      // } catch (error) {
      //   console.error('Upload failed:', error);
      // }

      // Mock: Add to local state for now
      const newDoc: DocumentFile = {
        id: Date.now() + Math.random(),
        name: file.name,
        type: fileType as 'pdf' | 'image' | 'video' | 'doc' | 'ppt',
        url: fileUrl,
        uploadedAt: new Date().toISOString(),
        size: file.size
      };
      setDocuments(prev => [...prev, newDoc]);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const removeFile = (fileId: number) => {
    setDocuments((prev) => prev.filter((f) => f.id !== fileId));
  };

  const handleDocumentClick = (doc: DocumentFile) => {
    // Show confirmation dialog
    setPendingDocument(doc);
    setShowShareConfirm(true);
  };

  const confirmShareDocument = () => {
    if (!pendingDocument) return;
    
    setSelectedDocument(pendingDocument);
    setShowDocumentViewer(true);
    
    // Share document with all viewers
    socket.emit("share-document", {
      teacherID,
      livestreamID,
      document: pendingDocument
    });
    
    setShowShareConfirm(false);
    setPendingDocument(null);
  };

  const cancelShareDocument = () => {
    setShowShareConfirm(false);
    setPendingDocument(null);
  };

  const closeDocumentViewer = () => {
    setShowDocumentViewer(false);
    setSelectedDocument(null);
    
    // Notify viewers to close document
    socket.emit("close-document", {
      teacherID,
      livestreamID
    });
  };

  const sendChatMessage = () => {
    if (!chatInput.trim()) return;
    
    const message = {
      id: Date.now().toString() + Math.random(),
      username: 'Teacher', // TODO: Get from auth
      userRole: 'teacher' as const,
      message: chatInput,
      timestamp: new Date().toISOString(),
      avatar: '/teacher-avatar.png'
    };
    
    // Emit to backend
    socket.emit("send-chat-message", {
      teacherID,
      livestreamID,
      message
    });
    
    setChatInput('');
  };

  const handleChatKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'pdf':
      case 'doc':
      case 'ppt':
        return <FileText size={20} className="text-red-600" />;
      case 'image':
        return <ImageIcon size={20} className="text-blue-600" />;
      case 'video':
        return <Film size={20} className="text-purple-600" />;
      default:
        return <FileText size={20} className="text-gray-600" />;
    }
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      <div className={`absolute inset-0 transition-all duration-300 ${showDocumentViewer ? 'w-1/2' : 'w-full'}`}>
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover"
        />
      </div>

      {/* Livestream Info Display */}
      {livestreamInfo && (
        <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md text-white p-4 rounded-lg shadow-lg max-w-md z-10">
          <h2 className="text-xl font-bold mb-2">{livestreamInfo.title}</h2>
          <div className="flex items-center gap-2 mb-2 text-sm">
            <span className="px-2 py-1 bg-blue-600 rounded-full text-xs font-semibold">
              {livestreamInfo.category}
            </span>
            {livestreamInfo.isPublic ? (
              <span className="px-2 py-1 bg-green-600 rounded-full text-xs font-semibold">Public</span>
            ) : (
              <span className="px-2 py-1 bg-gray-600 rounded-full text-xs font-semibold">Private</span>
            )}
            {livestreamInfo.allowComments && (
              <span className="px-2 py-1 bg-purple-600 rounded-full text-xs font-semibold">💬 Comments On</span>
            )}
          </div>
          {livestreamInfo.description && (
            <p className="text-sm text-white/80 line-clamp-2">{livestreamInfo.description}</p>
          )}
        </div>
      )}

      {showDocumentViewer && selectedDocument && (
        <div className="absolute top-0 right-0 w-1/2 h-full bg-white flex flex-col">
          <div className="flex items-center justify-between p-4 border-b bg-gray-50">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {getFileIcon(selectedDocument.type)}
              <h3 className="font-semibold text-sm truncate">{selectedDocument.name}</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDocumentViewer(false)}
                className="p-2 hover:bg-gray-200 rounded-full transition"
                title="Minimize"
              >
                <Minimize2 size={18} />
              </button>
              <button
                onClick={closeDocumentViewer}
                className="p-2 hover:bg-gray-200 rounded-full transition"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-auto p-4 bg-gray-100">
            {selectedDocument.type === 'image' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img 
                src={selectedDocument.url} 
                alt={selectedDocument.name}
                className="max-w-full h-auto mx-auto"
              />
            ) : selectedDocument.type === 'video' ? (
              <video 
                src={selectedDocument.url}
                controls
                className="max-w-full h-auto mx-auto"
              />
            ) : selectedDocument.type === 'pdf' ? (
              <iframe
                src={selectedDocument.url}
                className="w-full h-full border-0"
                title={selectedDocument.name}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <FileText size={64} className="mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">{selectedDocument.name}</p>
                <p className="text-sm mb-4">Preview not available</p>
                <a
                  href={selectedDocument.url}
                  download={selectedDocument.name}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Download File
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Share Document Confirmation Modal */}
      {showShareConfirm && pendingDocument && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b">
              <div className="flex items-center gap-3 mb-2">
                <Monitor className="w-6 h-6 text-blue-600" />
                <h2 className="text-xl font-bold text-gray-900">Share Document?</h2>
              </div>
            </div>
            
            <div className="p-6">
              <div className="mb-4 p-4 bg-gray-50 rounded-lg border">
                <div className="flex items-center gap-3 mb-1">
                  {getFileIcon(pendingDocument.type)}
                  <p className="font-semibold text-gray-800">{pendingDocument.name}</p>
                </div>
                <p className="text-sm text-gray-500 ml-8">
                  {pendingDocument.type.toUpperCase()} • {
                    pendingDocument.size 
                      ? `${(pendingDocument.size / 1024 / 1024).toFixed(2)} MB` 
                      : 'Unknown size'
                  }
                </p>
              </div>

              <p className="text-gray-700 mb-6">
                This document will be shared with all students watching your livestream. 
                They will see it alongside your video.
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={cancelShareDocument}
                  className="flex-1 px-4 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmShareDocument}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                >
                  Share with Students
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* End Livestream Confirmation Modal */}
      {showEndConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-red-100 rounded-full">
                  <Square className="w-6 h-6 text-red-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">End Livestream?</h2>
              </div>
            </div>
            
            <div className="p-6">
              <p className="text-gray-700 mb-6">
                Are you sure you want to end this livestream? All viewers will be disconnected.
              </p>

              <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveRecording}
                    onChange={(e) => setSaveRecording(e.target.checked)}
                    className="mt-1 w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <div>
                    <p className="font-semibold text-gray-900">Save Recording</p>
                    <p className="text-sm text-gray-600 mt-1">
                      Save this livestream to Cloudflare Stream. You can review and share it later with your students.
                    </p>
                  </div>
                </label>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex gap-2">
                  <div className="text-blue-600 mt-0.5">ℹ️</div>
                  <div className="text-sm text-blue-800">
                    <p className="font-semibold mb-1">What happens next:</p>
                    <ul className="list-disc list-inside space-y-1 text-blue-700">
                      <li>All students will be disconnected</li>
                      <li>Livestream status will be updated to &quot;Ended&quot;</li>
                      {saveRecording ? (
                        <li>Recording will be processed and saved (may take a few minutes)</li>
                      ) : (
                        <li>Stream will not be saved</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowEndConfirm(false)}
                  disabled={isEndingStream}
                  className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmEndStream}
                  disabled={isEndingStream}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isEndingStream ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Ending...
                    </>
                  ) : (
                    'End Livestream'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={`absolute top-2 left-2 text-white text-sm bg-black/50 px-2 py-1 rounded transition-all duration-300 ${showDocumentViewer ? 'left-2' : 'left-2'}`}>
        🔴 {watcherCount.toLocaleString()} views
      </div>

      <div className={`absolute top-4 right-4 w-80 bg-white rounded-lg text-black shadow-lg max-h-[70vh] overflow-hidden flex flex-col transition-all duration-300 ${showDocumentViewer ? 'right-[calc(50%+1rem)]' : 'right-4'}`}>
        <div
          className="flex justify-between items-center p-3 cursor-pointer border-b"
          onClick={() => setShowFiles(!showFiles)}
        >
          <h3 className="font-bold text-sm">Documents & Files</h3>
          {showFiles ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
        {showFiles && (
          <div className="p-3 overflow-y-auto">
            <div className="mb-3">
              <button
                onClick={handleUploadClick}
                className="w-full bg-blue-600 text-white py-2 px-3 rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 text-sm font-medium"
              >
                <Upload size={16} />
                Upload New File
              </button>
            </div>

            <div className="space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => handleDocumentClick(doc)}
                  className="flex items-center gap-2 p-2 bg-gray-50 hover:bg-gray-100 rounded-lg cursor-pointer transition group"
                >
                  <div className="flex-shrink-0">
                    {getFileIcon(doc.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{doc.name}</p>
                    <p className="text-xs text-gray-500">
                      {doc.size ? `${(doc.size / 1024).toFixed(0)} KB` : 'N/A'}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(doc.id);
                    }}
                    className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition"
                  >
                    <X size={14} className="text-red-600" />
                  </button>
                </div>
              ))}
              
              {documents.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <FileText size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-xs">No documents yet</p>
                  <p className="text-xs">Upload files to share</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*,.pdf,.doc,.docx,.ppt,.pptx"
        onChange={handleFileUpload}
        className="hidden"
      />

      <div className={`absolute right-4 w-72 max-h-80 bg-transparent text-white rounded-lg shadow-lg transition-all duration-300 ${showDocumentViewer ? 'top-[calc(70vh+2rem)] right-[calc(50%+1rem)]' : 'top-[calc(70vh+2rem)]'}`}>
        <div
          className="flex justify-between items-center p-2 cursor-pointer"
          onClick={() => setShowComments(!showComments)}
        >
          <h3 className="font-bold text-sm">Live Chat</h3>
          {showComments ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
        {showComments && (
          <div className="p-2 flex flex-col space-y-1 text-xs overflow-y-auto max-h-64">
            {chatMessages.map((msg, i) => {
              const colors = [
                "text-red-500/70",
                "text-green-500/70",
                "text-blue-500/70",
                "text-yellow-500/70",
                "text-purple-500/70",
                "text-pink-500/70",
                "text-indigo-500/70",
              ];
              const colorClass = msg.userRole === 'teacher' ? 'text-orange-400/90' : colors[i % colors.length];

              return (
                <div
                  key={msg.id}
                  className={`rounded-lg px-2 py-1 inline-block bg-white/10 backdrop-blur-sm ${colorClass}`}
                >
                  <b>{msg.username}:</b> {msg.message}
                  {msg.userRole === 'teacher' && <span className="ml-1 text-[9px] bg-red-600/80 px-1 rounded">👨‍🏫</span>}
                </div>
              );
            })}
            {chatMessages.length === 0 && (
              <div className="text-center py-4 text-white/40 text-xs">
                No messages yet
              </div>
            )}
            <div ref={chatEndRef} />
            
            {/* Input inline */}
            <div className="flex gap-1 pt-2 border-t border-white/20">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={handleChatKeyPress}
                placeholder="Type message..."
                className="flex-1 px-2 py-1 text-xs bg-white/10 border border-white/20 rounded text-white placeholder-white/50 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                onClick={sendChatMessage}
                disabled={!chatInput.trim()}
                className="px-2 py-1 bg-blue-600/80 text-white rounded text-xs hover:bg-blue-700/80 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Control bar (bottom center) */}
      <div className="fixed bottom-4 left-3/5 -translate-x-1/2 flex gap-6 bg-white/80 p-3 rounded-full shadow-lg">
        <button 
          onClick={toggleMic}
          disabled={!isLive}
          className={`p-3 rounded-full shadow transition ${
            isMicOn 
              ? 'bg-white text-black hover:bg-gray-100' 
              : 'bg-red-600 text-white hover:bg-red-700'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          title={isMicOn ? 'Mute' : 'Unmute'}
        >
          {isMicOn ? <Mic /> : <MicOff />}
        </button>

        <button 
          onClick={toggleCamera}
          disabled={!isLive || isScreenSharing}
          className={`p-3 rounded-full shadow transition ${
            isCameraOn 
              ? 'bg-white text-black hover:bg-gray-100' 
              : 'bg-red-600 text-white hover:bg-red-700'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          title={isCameraOn ? 'Turn Off Camera' : 'Turn On Camera'}
        >
          {isCameraOn ? <Video /> : <VideoOff />}
        </button>

        {!isLive ? (
          <button
            onClick={handleStartClick}
            className="p-3 bg-green-600 rounded-full shadow text-white hover:bg-green-700 transition"
            title="Start Livestream"
          >
            <Play />
          </button>
        ) : (
          <button
            onClick={handleStopClick}
            className="p-3 bg-red-600 rounded-full shadow text-white hover:bg-red-700 transition"
            title="Stop Livestream"
          >
            <Square />
          </button>
        )}

        <button 
          onClick={toggleScreenShare}
          disabled={!isLive}
          className={`p-3 rounded-full shadow transition ${
            isScreenSharing 
              ? 'bg-blue-600 text-white hover:bg-blue-700' 
              : 'bg-white text-black hover:bg-gray-100'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
        >
          <Monitor />
        </button>

        <button 
          onClick={handleUploadClick}
          className="p-3 bg-white rounded-full shadow hover:bg-gray-100 transition"
          title="Upload File"
        >
          <Upload className="text-black" />
        </button>
        
        {selectedDocument && !showDocumentViewer && (
          <button
            onClick={() => setShowDocumentViewer(true)}
            className="p-3 bg-green-600 rounded-full shadow hover:bg-green-700 transition text-white animate-pulse"
            title="Show Document"
          >
            <Maximize2 />
          </button>
        )}
        
        <button 
          className="p-3 bg-white rounded-full shadow hover:bg-gray-100 transition"
          title="More Options"
        >
          <MoreVertical className="text-black" />
        </button>
      </div>
    </div>
  );
}
