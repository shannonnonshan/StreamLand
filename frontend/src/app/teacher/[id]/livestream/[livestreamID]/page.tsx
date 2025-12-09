"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ICE_SERVERS } from "@/utils/ice";
import socket from "@/socket";

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
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
  const router = useRouter();

  const teacherID = params?.id ?? "1";
  const livestreamID = params?.livestreamID ?? "1";

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const peersRef = useRef<Record<string, RTCPeerConnection>>({});
  const localStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingChunkCountRef = useRef(0);
  const isLiveRef = useRef(false);
  const recordingStartTimeRef = useRef<number | null>(null);
  const recordingDurationRef = useRef<number | null>(null);
  
  // Canvas recording refs
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const recordingFrameIdRef = useRef<number | null>(null);

  const [isLive, setIsLive] = useState(false);
  const [watcherCount, setWatcherCount] = useState(0);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  // Optimistic default to prevent loading flicker
  const [livestreamInfo, setLivestreamInfo] = useState<LivestreamInfo | null>({
    title: 'Loading...',
    description: '',
    category: 'Education',
    isPublic: true,
    allowComments: true,
  });

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
  const [recordingPreview, setRecordingPreview] = useState<Blob | null>(null);
  const [showRecordingPreview, setShowRecordingPreview] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<{
    file: File;
    url: string;
    type: 'pdf' | 'image' | 'video' | 'doc' | 'ppt';
    originalName: string;
    size: number;
  } | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{
    id: string;
    username: string | { fullName?: string; name?: string };
    userRole: 'teacher' | 'student';
    message: string;
    timestamp: string;
    avatar?: string;
  }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [showCameraSettings, setShowCameraSettings] = useState(false);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [livestreamEnded, setLivestreamEnded] = useState(false);
  const viewerBroadcastIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const cameraToggleByCameraStateRef = useRef(false); // Track if last toggle was from effect, not user

  // Track isLive for internal debugging
  useEffect(() => {
    isLiveRef.current = isLive;
  }, [isLive]);

  const fetchTeacherDocuments = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchTeacherDocuments();
    
    const fetchLivestreamInfo = async () => {
      try {
        // Use default fetch (allows browser caching)
        const response = await fetch(`${API_URL}/livestream/${livestreamID}`);
        if (response.ok) {
          const data = await response.json();
          
          // Check if livestream has ended
          if (data.status === 'ENDED') {
            setLivestreamEnded(true);
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
        // Error fetching livestream info - don't block UI
        console.error('Error fetching livestream info:', error);
      }
    };

    // Fetch saved chat messages
    const fetchSavedChatMessages = async () => {
      try {
        const response = await fetch(`${API_URL}/livestream/${livestreamID}/get-chat?limit=100`);
        if (response.ok) {
          const messages = await response.json();
          // Convert MongoDB messages to UI format
          const formattedMessages = messages.map((msg: any) => ({
            id: msg.id || msg._id,
            username: msg.username,
            userRole: 'teacher',
            message: msg.message,
            timestamp: msg.createdAt || new Date().toISOString(),
            avatar: msg.userAvatar || '/teacher-avatar.png',
          }));
          setChatMessages(formattedMessages);
        }
      } catch (error) {
        console.warn('Error fetching saved chat messages:', error);
      }
    };
    
    // Defer fetch slightly to prioritize rendering
    const timeoutId = setTimeout(() => {
      fetchLivestreamInfo();
      fetchSavedChatMessages();
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [teacherID, livestreamID, router, fetchTeacherDocuments]);

  useEffect(() => {
    socket.on("watcher", handleWatcher);
    socket.on("answer", handleAnswer);
    socket.on("candidate", handleCandidate);
    socket.on("bye", handleBye);
    socket.on("viewerCount", (count: number) => setWatcherCount(count));
    
    // Listen for chat messages
    socket.on("chat-message", (data: any) => {
      // Safely extract username in case it's an object
      const usernameValue = typeof data.username === 'string' 
        ? data.username 
        : (data.username?.fullName || data.username?.name || 'Anonymous');
      
      const message = {
        id: data.id || Date.now().toString(),
        username: usernameValue,
        userRole: data.userRole || 'student',
        message: data.message || '',
        timestamp: data.timestamp || new Date().toISOString(),
        avatar: data.avatar || (typeof data.username === 'object' && data.username?.avatar) || '/teacher-avatar.png',
      };
      setChatMessages(prev => [...prev, message]);
    });

    // Handle page unload (tab/browser close)
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isLive) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    // Handle actual unload
    const handleUnload = async () => {
      if (isLive) {
        const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
        if (token) {
          try {
            // Send end livestream request without saving recording
            await fetch(`${API_URL}/livestream/${livestreamID}/end`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({ saveRecording: false }),
              keepalive: true, // Important: allows request to complete even if page unloads
            });
          } catch (error) {
            console.warn('[Broadcaster] Error ending livestream on unload:', error);
          }
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('unload', handleUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('unload', handleUnload);
      
      socket.off("watcher", handleWatcher);
      socket.off("answer", handleAnswer);
      socket.off("candidate", handleCandidate);
      socket.off("bye", handleBye);
      socket.off("viewerCount");
      socket.off("chat-message");

      // Don't disconnect socket - it's a shared instance
      // socket.disconnect();
      // Only close peer connections, NOT local stream
      // Local stream is managed by confirmEndStream function
      Object.values(peersRef.current).forEach((pc) => pc.close());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive, livestreamID]);

  // Get available cameras when component mounts or stream changes
  useEffect(() => {
    const updateAvailableCameras = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter(device => device.kind === 'videoinput');
        setAvailableCameras(cameras);
        if (cameras.length > 0 && !selectedCameraId) {
          setSelectedCameraId(cameras[0].deviceId);
        }
      } catch (error) {
        console.warn('Error enumerating devices:', error);
      }
    };

    updateAvailableCameras();
    navigator.mediaDevices.addEventListener('devicechange', updateAvailableCameras);
    
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', updateAvailableCameras);
    };
  }, [selectedCameraId]);

  // Setup canvas recording - capture exactly what student sees
  const setupCanvasRecording = useCallback(() => {
    try {
      if (!containerRef.current) {
        console.warn('[Canvas] Container not available');
        return null;
      }

      const width = 1920;
      const height = 1080;

      // Create hidden canvas
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvasRef.current = canvas;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No 2D context');

      console.log(`[Canvas] Created ${width}x${height} canvas for recording`);

      // Draw function - captures entire UI every frame
      let frameCount = 0;
      const drawFrame = () => {
        try {
          frameCount++;
          if (frameCount % 30 === 0) {
            console.log(`[Canvas] Drawing frame #${frameCount}...`);
          }
          
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, width, height);

          // PRIMARY: Draw video element (camera/screen)
          // When screen sharing, localVideoRef has screen track
          // When normal, localVideoRef has camera track
          if (localVideoRef.current && localVideoRef.current.srcObject) {
            try {
              const videoWidth = localVideoRef.current.videoWidth || width;
              const videoHeight = localVideoRef.current.videoHeight || height;
              
              if (videoWidth > 0 && videoHeight > 0) {
                // Calculate aspect ratio fit
                let drawWidth = width;
                let drawHeight = height;
                const videoAspect = videoWidth / videoHeight;
                const canvasAspect = width / height;
                
                if (videoAspect > canvasAspect) {
                  // Video is wider - fit to width
                  drawHeight = width / videoAspect;
                } else {
                  // Video is taller - fit to height
                  drawWidth = height * videoAspect;
                }
                
                const x = (width - drawWidth) / 2;
                const y = (height - drawHeight) / 2;
                
                ctx.drawImage(localVideoRef.current, x, y, drawWidth, drawHeight);
              }
            } catch (e) {
              // Silently handle canvas drawing error
            }
          }

          // SECONDARY: If document viewer active - overlay it on right side
          if (showDocumentViewer && selectedDocument) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
            ctx.fillRect(width * 0.5, 0, width * 0.5, height);

            ctx.fillStyle = '#000';
            ctx.font = 'bold 24px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(selectedDocument.name, width * 0.52, 40);
            
            ctx.fillStyle = '#666';
            ctx.font = '14px Arial';
            ctx.fillText('Document Shared', width * 0.52, 70);
          }

          // FALLBACK: If camera off - show avatar
          if (!isCameraOn && !isScreenSharing) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(0, 0, width, height);

            ctx.fillStyle = '#4a90e2';
            ctx.beginPath();
            ctx.arc(width / 2, height / 2, 100, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#fff';
            ctx.font = 'bold 80px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('T', width / 2, height / 2);
            
            // Show teacher name initials below avatar
            ctx.font = 'bold 24px Arial';
            ctx.fillStyle = '#fff';
            ctx.fillText('Teacher', width / 2, height / 2 + 150);
          }

          recordingFrameIdRef.current = requestAnimationFrame(drawFrame);
        } catch (e) {
          console.error('[Canvas] Draw error:', e);
        }
      };

      // Start drawing
      recordingFrameIdRef.current = requestAnimationFrame(drawFrame);

      // Get canvas stream - 30 FPS video + audio from mic
      const canvasStream = canvas.captureStream(30);
      console.log(`[Canvas] Canvas stream created with ${canvasStream.getVideoTracks().length} video tracks`);
      
      // Check video track state
      const videoTrack = canvasStream.getVideoTracks()[0];
      if (videoTrack) {
        console.log(`[Canvas] Video track: enabled=${videoTrack.enabled}, readyState=${videoTrack.readyState}, muted=${videoTrack.muted}`);
      } else {
        console.error('[Canvas] ERROR: No video track in canvas stream!');
      }

      // Add audio from microphone
      if (localStreamRef.current) {
        const audioTracks = localStreamRef.current.getAudioTracks();
        console.log(`[Canvas] Found ${audioTracks.length} audio tracks to add`);
        audioTracks.forEach(track => {
          canvasStream.addTrack(track);
          console.log('[Canvas] Added audio track');
        });
      }

      console.log(`[Canvas] Canvas stream ready: ${canvasStream.getTracks().length} total tracks`);
      return canvasStream;
    } catch (error) {
      console.error('[Canvas] Setup failed:', error);
      return null;
    }
  }, [isCameraOn, showDocumentViewer, selectedDocument, isScreenSharing]);

  const stopCanvasRecording = useCallback(() => {
    if (recordingFrameIdRef.current) {
      cancelAnimationFrame(recordingFrameIdRef.current);
      recordingFrameIdRef.current = null;
    }
    if (canvasRef.current) {
      canvasRef.current = null;
    }
  }, []);

  const switchCamera = async (cameraId: string) => {
    try {
      if (!localStreamRef.current) return;

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: cameraId } },
        audio: false,
      });

      const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
      const newVideoTrack = newStream.getVideoTracks()[0];

      // Replace track
      localStreamRef.current.removeTrack(oldVideoTrack);
      localStreamRef.current.addTrack(newVideoTrack);

      // Update video element
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }

      // Update peer connections
      Object.values(peersRef.current).forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(newVideoTrack);
        }
      });

      oldVideoTrack.stop();
      setSelectedCameraId(cameraId);
      setShowCameraSettings(false);
    } catch (error) {
      console.error('Error switching camera:', error);
      alert('Failed to switch camera. Please try again.');
    }
  };

  async function startLive() {
    try {
      // Step 1: Request permissions explicitly
      const permissionPrompt = await navigator.permissions.query({ name: 'camera' });
      const micPermissionPrompt = await navigator.permissions.query({ name: 'microphone' });

      // Step 2: Get media stream
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        
        console.log(`[startLive] Got stream: video=${stream.getVideoTracks().length}, audio=${stream.getAudioTracks().length}`);
      } catch (mediaError: any) {
        const errorName = mediaError.name;
        const errorMessage = mediaError.message;
        
        console.error(`[Broadcaster] Media Error (${errorName}): ${errorMessage}`);
        
        // Provide specific error messages
        let userMessage = 'Could not access camera/microphone. ';
        if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
          userMessage += 'Please allow camera and microphone access when prompted. If you blocked it, go to browser settings to unblock StreamLand.';
        } else if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
          userMessage += 'No camera or microphone found. Please check your device.';
        } else if (errorName === 'NotReadableError' || errorName === 'TrackStartError') {
          userMessage += 'Camera/microphone is in use by another application. Please close other apps and try again.';
        } else if (errorName === 'SecurityError') {
          userMessage += 'This page must be accessed over HTTPS for security reasons.';
        }
        
        alert(userMessage);
        throw mediaError;
      }

      localStreamRef.current = stream;
      
      // CRITICAL: Ensure all tracks are enabled before proceeding
      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();
      
      console.log(`[Stream Init] Got ${videoTracks.length} video and ${audioTracks.length} audio tracks`);
      
      videoTracks.forEach(track => {
        track.enabled = true;
        console.log(`[Stream Init] Video track enabled: ${track.readyState}`);
      });
      audioTracks.forEach(track => {
        track.enabled = true;
        console.log(`[Stream Init] Audio track enabled: ${track.readyState}`);
      });
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        
        // Force play immediately
        localVideoRef.current.play().catch(() => {
          // Silently handle initial video play error
        });
      }

      // Step 3: Update livestream status to LIVE in database
      const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
      const startResponse = await fetch(`${API_URL}/livestream/${livestreamID}/start`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!startResponse.ok) {
        const errorText = await startResponse.text();
        try {
          const error = JSON.parse(errorText);
          throw new Error(error?.message || `Failed to start livestream (${startResponse.status})`);
        } catch (e) {
          throw new Error(`Failed to start livestream: ${errorText || startResponse.statusText}`);
        }
      }
      
      const startData = await startResponse.json().catch(() => ({}));

      // Step 4: Start recording - capture what students see
      try {
        console.log(`[Recording] Setting up canvas-based recording...`);
        
        // Setup canvas to capture entire UI (video + document + avatar)
        const canvasStream = setupCanvasRecording();
        
        if (!canvasStream) {
          throw new Error('Failed to setup canvas recording');
        }

        console.log(`[Recording] Canvas stream ready with ${canvasStream.getTracks().length} tracks`);
        
        // Find supported mimeType for MediaRecorder
        let mimeType = 'video/webm;codecs=vp8,opus';
        const mimeTypes = [
          'video/webm;codecs=vp8,opus',
          'video/webm;codecs=vp9,opus',
          'video/webm;codecs=vp8',
          'video/webm;codecs=vp9',
          'video/webm',
        ];
        
        for (const type of mimeTypes) {
          if (MediaRecorder.isTypeSupported(type)) {
            mimeType = type;
            console.log(`[Recorder] Using mimeType: ${mimeType}`);
            break;
          }
        }

        const mediaRecorder = new MediaRecorder(canvasStream, {
          mimeType,
          videoBitsPerSecond: 2500000,
          audioBitsPerSecond: 128000,
        });
        
        console.log(`[Recorder] Created: ${mediaRecorder.mimeType}`);

        mediaRecorder.ondataavailable = async (event) => {
          if (event.data && event.data.size > 0) {
            recordingChunkCountRef.current++;
            console.log(`[Recording] Chunk #${recordingChunkCountRef.current}: ${(event.data.size / 1024).toFixed(2)} KB`);
            recordedChunksRef.current.push(event.data);
            
            // Try to upload chunk in real-time to server
            try {
              const chunkBase64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
                reader.readAsDataURL(event.data);
              });
              
              // Upload chunk to server for backup
              const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
              if (token) {
                fetch(`${API_URL}/livestream/${livestreamID}/upload-chunk`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                  },
                  body: JSON.stringify({
                    chunk: chunkBase64,
                    chunkIndex: recordedChunksRef.current.length - 1,
                    totalSize: event.data.size,
                  }),
                }).catch((err) => {
                  // Fail silently - chunk is still in local buffer
                  console.warn('Failed to upload chunk in real-time:', err);
                });
              }
              
              // Also emit via socket
              socket.emit('video-chunk', {
                livestreamID,
                chunk: chunkBase64,
                chunkIndex: recordedChunksRef.current.length - 1,
                totalSize: event.data.size,
              });
            } catch (error) {
              // Chunk still saved locally in recordedChunksRef
              console.warn('Error processing chunk:', error);
            }
          } else {
            console.warn('[Recording] ondataavailable fired but event.data is empty or 0 bytes');
          }
        };

        mediaRecorder.onerror = (event) => {
          console.error(`[Recording ERROR] ${event.error}`);
        };

        // Start recording with 5-second chunks
        recordingChunkCountRef.current = 0;
        recordingStartTimeRef.current = Date.now();
        mediaRecorder.start(5000);
        mediaRecorderRef.current = mediaRecorder;
        
        console.log(`[Recording] Started - recording what students see`);
      } catch (error) {
        console.warn('MediaRecorder initialization error:', error);
      }

      // Step 5: Connect socket and emit broadcaster event
      if (!socket.connected) {
        socket.connect();
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
      
      // Set camera and mic states to ON
      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];
      
      if (videoTrack) {
        videoTrack.enabled = true;
      }
      if (audioTrack) {
        audioTrack.enabled = true;
      }
      
      setIsCameraOn(true);
      setIsMicOn(true);
      
      // Set isLive LAST - after all setup is complete
      setIsLive(true);
      
      // Verify camera is still enabled after setting isLive
      setTimeout(() => {
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack && !videoTrack.enabled) {
          videoTrack.enabled = true;
        }
      }, 100);
      
      // Broadcast initial viewer count to all clients immediately
      setTimeout(() => {
        socket.emit('updateCurrentViewers', { 
          livestreamID, 
          currentViewers: Object.keys(peersRef.current).length 
        });
      }, 500);
      
      socket.emit("sync-documents", {
        livestreamID,
        documents: documents
      });


    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      
      // Don't show generic alert - specific messages already shown above
      if (!(err instanceof Error && 
            (err.name === 'NotAllowedError' || 
             err.name === 'PermissionDeniedError' ||
             err.name === 'NotFoundError' ||
             err.name === 'DevicesNotFoundError' ||
             err.name === 'NotReadableError' ||
             err.name === 'TrackStartError' ||
             err.name === 'SecurityError'))) {
        alert(`Failed to start livestream: ${errMsg}`);
      }
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
      // Step 0: Stop canvas recording
      stopCanvasRecording();
      
      // Step 1: Stop media recorder
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        console.log(`[Recording] Stopping recorder with ${recordedChunksRef.current.length} chunks`);
        
        await new Promise<void>((resolve) => {
          mediaRecorderRef.current!.onstop = () => {
            console.log(`[Recording] Stopped - total chunks: ${recordedChunksRef.current.length}`);
            resolve();
          };
          mediaRecorderRef.current!.stop();
        });
      }

      // Step 2: Check if should show preview
      console.log(`[Upload] Checking: saveRecording=${saveRecording}, chunks=${recordedChunksRef.current.length}`);
      
      // Log chunk details for debugging
      if (recordedChunksRef.current.length > 0) {
        let totalSize = 0;
        recordedChunksRef.current.forEach((chunk, i) => {
          console.log(`[Upload] Chunk ${i}: ${chunk.size} bytes, type: ${chunk.type}`);
          totalSize += chunk.size;
        });
        console.log(`[Upload] Total chunks size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
      }
      
      if (saveRecording && recordedChunksRef.current.length > 0) {
        try {
          // Determine the mimeType that was used for recording
          let recordingMimeType = 'video/webm';
          if (mediaRecorderRef.current) {
            recordingMimeType = mediaRecorderRef.current.mimeType || 'video/webm';
            console.log(`Recording was captured with mimeType: ${recordingMimeType}`);
          }
          
          // Calculate duration based on actual chunks recorded
          // MediaRecorder.start(5000) = 5 second chunks, so each chunk = 5 seconds
          let durationInSeconds = 0;
          
          // Primary: Use chunk count (most accurate)
          // Each chunk interval is 5000ms, but last chunk may be partial
          // Estimate: (chunks - 1) * 5 + partial last chunk
          if (recordedChunksRef.current.length > 0) {
            durationInSeconds = recordedChunksRef.current.length * 5;
            console.log(`[Upload] Duration (from chunks): ${durationInSeconds}s (${recordedChunksRef.current.length} chunks × 5s)`);
          } else {
            // Fallback: use timestamps if no chunks
            durationInSeconds = recordingStartTimeRef.current 
              ? Math.floor((Date.now() - recordingStartTimeRef.current) / 1000)
              : 0;
            console.log(`[Upload] Duration (fallback from timestamp): ${durationInSeconds}s`);
          }
          
          // Ensure minimum 1 second for safety
          if (durationInSeconds < 1) {
            durationInSeconds = 1;
          }
          
          // Store duration so it can be used later in confirmRecordingUpload
          recordingDurationRef.current = durationInSeconds;
          console.log(`[DEBUG] Stored duration in ref: ${recordingDurationRef.current}s`);
          
          const recordingBlob = new Blob(recordedChunksRef.current, { type: recordingMimeType });
          const recordingSizeInMB = (recordingBlob.size / 1024 / 1024).toFixed(2);
          console.log(`[Upload] Recording blob: ${recordingSizeInMB} MB, ${recordedChunksRef.current.length} chunks`);
          
          if (recordingBlob.size === 0) {
            console.error('[Upload] ERROR: Recording blob is empty (0 bytes)! This means no chunks were recorded.');
            console.error('[Upload] Check console for canvas drawing and MediaRecorder ondataavailable events.');
          }
          
          // Show preview - BEFORE uploading
          console.log(`[Preview] Showing recording preview to user...`);
          setRecordingPreview(recordingBlob);
          setShowRecordingPreview(true);
          
          // Stop here - wait for user to confirm or cancel in preview modal
          return;
        } catch (error) {
          console.error('Error preparing recording:', error);
          alert('Error preparing recording preview. Please try again.');
          setIsEndingStream(false);
          return;
        }
      }

      // If not saving recording, proceed to finish ending stream
      await finishEndingStream();

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to end livestream';
      alert(`Error: ${errorMessage}. Please try again.`);
      setIsEndingStream(false);
    }
  }

  // Handle recording preview - confirm or cancel upload
  const confirmRecordingUpload = async () => {
    if (!recordingPreview) return;

    setShowRecordingPreview(false);
    console.log('[Upload] User confirmed - uploading recording...');

    try {
      const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
      if (!token) throw new Error('No auth token');

      // Calculate duration
      let durationInSeconds = 0;
      console.log(`[DEBUG] confirmRecordingUpload - recordingDurationRef.current = ${recordingDurationRef.current}`);
      if (recordingDurationRef.current && recordingDurationRef.current > 0) {
        durationInSeconds = recordingDurationRef.current;
        console.log(`[DEBUG] Using stored duration: ${durationInSeconds}s`);
      } else if (recordingStartTimeRef.current && recordingStartTimeRef.current > 0) {
        const recordingEndTime = Date.now();
        durationInSeconds = Math.floor((recordingEndTime - recordingStartTimeRef.current) / 1000);
        console.log(`[DEBUG] Duration from timestamps (fallback): ${durationInSeconds}s`);
      } else {
        durationInSeconds = recordedChunksRef.current.length * 5;
        console.log(`[DEBUG] Duration from chunks (fallback): ${durationInSeconds}s (${recordedChunksRef.current.length} chunks)`);
      }
      console.log(`[DEBUG] Final durationInSeconds to send: ${durationInSeconds}s`);

      // Determine mimeType
      let recordingMimeType = 'video/webm';
      if (mediaRecorderRef.current) {
        recordingMimeType = mediaRecorderRef.current.mimeType || 'video/webm';
      }

      // Upload recording blob - always use single upload (backend doesn't support chunk assembly yet)
      console.log('[Upload] Uploading recording...');
      const videoBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          // Find the actual base64 data after "base64,"
          const base64Index = dataUrl.indexOf('base64,');
          if (base64Index === -1) {
            console.error('[Upload] ERROR: Invalid data URL format - no base64 marker found');
            resolve('');
            return;
          }
          const base64 = dataUrl.substring(base64Index + 7); // 7 = length of "base64,"
          console.log(`[Upload] Data URL prefix: ${dataUrl.substring(0, base64Index + 7)}`);
          console.log(`[Upload] Base64 created: ${base64.substring(0, 100)}... (length: ${base64.length})`);
          if (!base64 || base64.length === 0) {
            console.error('[Upload] ERROR: Base64 is empty! Recording blob likely had no data.');
          }
          resolve(base64);
        };
        reader.readAsDataURL(recordingPreview);
      });

      console.log(`[Upload] File size: ${(recordingPreview.size / 1024 / 1024).toFixed(2)} MB`);
      if (recordingPreview.size === 0) {
        console.error('[Upload] ERROR: recordingPreview.size is 0 bytes!');
        throw new Error('Recording file is empty - no video data was captured');
      }
      
      console.log(`[Upload] Sending to backend: duration: ${durationInSeconds}s`);
      console.log(`[Upload] API URL: ${API_URL}/livestream/${livestreamID}/upload-recording`);
      console.log(`[Upload] Token available: ${!!token}`);
      console.log(`[Upload] Body size: ${JSON.stringify({
        video: videoBase64,
        size: recordingPreview.size,
        duration: durationInSeconds,
      }).length} bytes`);

      const uploadResp = await fetch(`${API_URL}/livestream/${livestreamID}/upload-recording`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          video: videoBase64,
          size: recordingPreview.size,
          duration: durationInSeconds,
        }),
      });

      console.log(`[Upload] Response status: ${uploadResp.status}`);
      if (!uploadResp.ok) {
        const err = await uploadResp.json().catch(() => ({}));
        console.error(`[Upload] Error response:`, err);
        throw new Error(err.message || `Upload failed with status ${uploadResp.status}`);
      }

      const result = await uploadResp.json();
      console.log('[Upload] Success:', result.url);
      alert('Recording uploaded successfully!');

      // Now finish ending stream
      await finishEndingStream();
    } catch (error) {
      console.error('[Upload] Error:', error);
      alert('Failed to upload recording: ' + (error instanceof Error ? error.message : 'Unknown error'));
      setIsEndingStream(false);
    }
  };

  const cancelRecordingUpload = async () => {
    console.log('[Upload] User cancelled - discarding recording');
    setShowRecordingPreview(false);
    setRecordingPreview(null);
    await finishEndingStream();
  };

  const finishEndingStream = async () => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('accessToken');

      // Update viewer count
      socket.emit('updateCurrentViewers', { livestreamID, currentViewers: watcherCount });

      // End livestream in database
      const response = await fetch(`${API_URL}/livestream/${livestreamID}/end`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ saveRecording }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to end livestream');
      }

      // Close all peer connections
      Object.values(peersRef.current).forEach((pc) => {
        try {
          pc.close();
        } catch (error) {
          // ignore
        }
      });
      peersRef.current = {};

      // Stop local stream
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch (error) {
            // ignore
          }
        });
        localStreamRef.current = null;
      }

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }

      // Reset states
      recordedChunksRef.current = [];
      mediaRecorderRef.current = null;
      recordingStartTimeRef.current = null;
      recordingDurationRef.current = null;
      setIsLive(false);
      setWatcherCount(0);
      setShowEndConfirm(false);
      setRecordingPreview(null);
      setShowRecordingPreview(false);

      if (viewerBroadcastIntervalRef.current) {
        clearInterval(viewerBroadcastIntervalRef.current);
        viewerBroadcastIntervalRef.current = null;
      }

      await new Promise(resolve => setTimeout(resolve, 500));
      router.push(`/teacher/${teacherID}`);
    } catch (error) {
      console.error('[End Stream] Error:', error);
      alert('Error ending stream: ' + (error instanceof Error ? error.message : 'Unknown error'));
      setIsEndingStream(false);
    }
  };

  async function handleWatcher(data: { id: string } | string) {
    const watcherId = typeof data === 'string' ? data : data.id;    if (peersRef.current[watcherId]) {
      return;
    }

    if (!localStreamRef.current) {
      return;
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peersRef.current[watcherId] = pc;

    const tracks = localStreamRef.current.getTracks();
    
    tracks.forEach((track) => {
      // Ensure track is enabled before adding
      track.enabled = true;
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
    
    // Update currentViewers in database
    const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
    if (token) {
      try {
        const currentViewers = Object.keys(peersRef.current).length;
        
        // Update DB
        await fetch(`${API_URL}/livestream/${livestreamID}/update-viewers`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ totalViewers: currentViewers }),
        }).catch(() => {
          // Silently handle update viewers error
        });
        
        // Update local state
        setWatcherCount(currentViewers);
        
        // Broadcast to all clients immediately
        socket.emit('updateCurrentViewers', { livestreamID, currentViewers: currentViewers });
      } catch (error) {
        // Silently handle error updating viewers
      }
    }
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
      
      const currentViewers = Object.keys(peersRef.current).length;
      setWatcherCount(currentViewers);
      
      // Update totalViewers in database when viewer disconnects
      const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
      if (token) {
        try {
          fetch(`${API_URL}/livestream/${livestreamID}/update-viewers`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ totalViewers: currentViewers }),
          }).catch(() => {
            // Silently handle update viewers on disconnect error
          });
        } catch (error) {
          // Silently handle error updating viewers on disconnect
        }
      }
      
      // Broadcast updated viewer count immediately
      socket.emit('updateCurrentViewers', { livestreamID, currentViewers: currentViewers });
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
        const newState = !videoTrack.enabled;
        videoTrack.enabled = newState;
        setIsCameraOn(newState);
        cameraToggleByCameraStateRef.current = false; // This is user action, not effect
        
        // Notify viewers about camera state change
        socket.emit('camera-toggle', {
          livestreamID,
          isCameraOn: newState
        });
        // Note: Do NOT stop the track - recording should continue
      }
    }
  }

  // Ensure camera stays on after start (prevent auto-disable) - but respect user toggles
  useEffect(() => {
    if (!isLive) return; // Only monitor when live
    
    // Monitor camera track state and ensure it stays enabled (only if not user-disabled)
    const monitorInterval = setInterval(() => {
      if (localStreamRef.current && localVideoRef.current) {
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        const videoElement = localVideoRef.current;
        
        if (videoTrack) {
          // Only force-enable if isCameraOn is true AND track is somehow disabled
          // Don't force-enable if user manually toggled it off (isCameraOn would be false)
          if (isCameraOn && !videoTrack.enabled) {
            videoTrack.enabled = true;
            cameraToggleByCameraStateRef.current = true; // Mark as effect action
          }
          
          // Also ensure video element is not paused
          if (videoElement.paused && !videoElement.ended) {
            videoElement.play().catch(() => {
              // Silently handle video play error
            });
          }
        }
      }
    }, 300); // Check every 300ms

    return () => {
      clearInterval(monitorInterval);
    };
  }, [isLive, isCameraOn]);

  // Broadcast viewer count continuously to keep students updated
  useEffect(() => {
    if (isLive) {
      // Clear any existing interval
      if (viewerBroadcastIntervalRef.current) {
        clearInterval(viewerBroadcastIntervalRef.current);
      }

      // Broadcast viewer count every 2 seconds
      viewerBroadcastIntervalRef.current = setInterval(() => {
        const currentViewers = Object.keys(peersRef.current).length;
        setWatcherCount(currentViewers);
        
        socket.emit('updateCurrentViewers', {
          livestreamID,
          currentViewers: currentViewers
        });
      }, 2000);

      return () => {
        if (viewerBroadcastIntervalRef.current) {
          clearInterval(viewerBroadcastIntervalRef.current);
          viewerBroadcastIntervalRef.current = null;
        }
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive]);

  // Restart media recorder with new stream
  function restartMediaRecorder(stream: MediaStream) {
    try {
      // Stop old recorder if exists
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }

      // Start new recorder with new stream
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp8,opus',
        videoBitsPerSecond: 2500000, // 2.5 Mbps
      });

        mediaRecorder.ondataavailable = async (event) => {
          const chunkSize = event.data?.size || 0;
          const sizeKB = (chunkSize / 1024).toFixed(2);
          const totalChunks = recordedChunksRef.current.length + 1;
          
          console.log(`[Recording] Chunk #${totalChunks}: ${sizeKB} KB, state=${mediaRecorder.state}`);
          
          if (event.data && event.data.size > 0) {
            recordedChunksRef.current.push(event.data);
            console.log(`[Recording] Buffered: ${recordedChunksRef.current.length} total chunks`);          // Send chunk to server during recording for backup
          try {
            const chunkBase64 = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
              reader.readAsDataURL(event.data);
            });
            
            socket.emit('video-chunk', {
              livestreamID,
              chunk: chunkBase64,
              chunkIndex: recordedChunksRef.current.length - 1,
              totalSize: event.data.size,
            });
          } catch (error) {
            // Silently handle chunk send error
          }
        }
      };

      mediaRecorder.onerror = () => {
        // Handle MediaRecorder error silently
      };

      // Record continuously
      mediaRecorder.start(10000); // 10s chunks
      mediaRecorderRef.current = mediaRecorder;
    } catch (error) {
      // Silently handle MediaRecorder restart error
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
        console.log(`[ScreenShare] Got screen video track: ${screenTrack.readyState}`);
        
        const oldVideoTrack = localStreamRef.current?.getVideoTracks()[0];
        if (oldVideoTrack && localStreamRef.current) {
          console.log(`[ScreenShare] Replacing camera track with screen track`);
          localStreamRef.current.removeTrack(oldVideoTrack);
          localStreamRef.current.addTrack(screenTrack);
          
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
          }

          // Update peer connections with screen video
          Object.values(peersRef.current).forEach((pc) => {
            const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
            if (sender) {
              sender.replaceTrack(screenTrack);
              console.log(`[ScreenShare] Updated peer connection with screen track`);
            }
          });

          oldVideoTrack.stop();
          
          // Verify MediaRecorder is recording with screen
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            console.log(`[ScreenShare] MediaRecorder is already recording, stream now has screen`);
            console.log(`[ScreenShare] Recording stream tracks: video=${localStreamRef.current.getVideoTracks().length}, audio=${localStreamRef.current.getAudioTracks().length}`);
          }
          
          setIsScreenSharing(true);
        }

        screenTrack.onended = async () => {
          console.log(`[ScreenShare] Screen share ended by user`);
          await stopScreenShare();
        };

      } else {
        await stopScreenShare();
      }
    } catch (error) {
      console.error(`[ScreenShare] Error:`, error);
    }
  }

  async function stopScreenShare() {
    try {
      console.log(`[ScreenShare] Stopping screen share, switching back to camera`);
      
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });

      const cameraTrack = cameraStream.getVideoTracks()[0];
      console.log(`[ScreenShare] Got camera video track: ${cameraTrack.readyState}`);
      
      const oldScreenTrack = localStreamRef.current?.getVideoTracks()[0];
      if (oldScreenTrack && localStreamRef.current) {
        console.log(`[ScreenShare] Removing screen track, adding camera track`);
        localStreamRef.current.removeTrack(oldScreenTrack);
        localStreamRef.current.addTrack(cameraTrack);
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }

        // Update peer connections with camera video
        Object.values(peersRef.current).forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(cameraTrack);
            console.log(`[ScreenShare] Updated peer connection back to camera`);
          }
        });

        oldScreenTrack.stop();
        
        // Verify MediaRecorder is still recording with camera
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          console.log(`[ScreenShare] MediaRecorder is already recording, stream now has camera`);
          console.log(`[ScreenShare] Recording stream tracks: video=${localStreamRef.current.getVideoTracks().length}, audio=${localStreamRef.current.getAudioTracks().length}`);
        }
      }

      setIsScreenSharing(false);
      setIsCameraOn(true);
      console.log(`[ScreenShare] Screen share stopped`);
    } catch (error) {
      console.error(`[ScreenShare] Error stopping screen share:`, error);
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
    if (!token) {
      alert('Please login to upload documents');
      return;
    }

    const file = files[0]; // Handle one file at a time
    const fileType = file.type.startsWith('image/') ? 'image' : 
                     file.type.startsWith('video/') ? 'video' : 
                     file.type.includes('pdf') ? 'pdf' :
                     file.type.includes('document') || file.type.includes('word') ? 'doc' :
                     file.type.includes('presentation') || file.type.includes('powerpoint') ? 'ppt' : 'doc';
    
    try {
      // Upload to R2 first
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch(`${API_URL}/teacher/${teacherID}/upload-document`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      
      const data = await response.json();
      
      // Show preview with rename option
      setUploadPreview({
        file,
        url: data.url, // R2 public URL for preview
        type: fileType as 'pdf' | 'image' | 'video' | 'doc' | 'ppt',
        originalName: file.name,
        size: data.size || file.size,
      });
      setNewFileName(file.name.replace(/\.[^/.]+$/, '')); // Filename without extension
      
    } catch (error) {
      alert('Failed to upload document. Please try again.');
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const confirmUpload = () => {
    if (!uploadPreview) return;
    
    const fileExtension = uploadPreview.originalName.split('.').pop() || '';
    const finalName = newFileName.trim() 
      ? `${newFileName}.${fileExtension}` 
      : uploadPreview.originalName;
    
    const newDoc: DocumentFile = {
      id: Date.now() + Math.random(),
      name: finalName,
      type: uploadPreview.type,
      url: uploadPreview.url,
      uploadedAt: new Date().toISOString(),
      size: uploadPreview.size
    };
    
    setDocuments(prev => {
      const updatedDocs = [...prev, newDoc];
      
      // Emit only the new document to viewers
      socket.emit('document-uploaded', {
        teacherID,
        livestreamID,
        document: newDoc
      });
      
      return updatedDocs;
    });
    
    // Reset
    setUploadPreview(null);
    setNewFileName('');
  };

  const cancelUpload = () => {
    setUploadPreview(null);
    setNewFileName('');
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

  const sendChatMessage = async () => {
    if (!chatInput.trim()) return;
    
    const message = {
      id: Date.now().toString() + Math.random(),
      username: 'Teacher',
      userRole: 'teacher' as const,
      message: chatInput,
      timestamp: new Date().toISOString(),
      avatar: '/teacher-avatar.png'
    };
    
    // Add to local messages immediately
    setChatMessages(prev => [...prev, message]);
    
    // Save to MongoDB via API
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
      await fetch(`${API_URL}/livestream/${livestreamID}/save-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          username: 'Teacher',
          userAvatar: '/teacher-avatar.png',
          message: chatInput,
          type: 'MESSAGE'
        }),
      }).catch(() => {
        // Silently handle chat save error
      });
    } catch (error) {
      // Silently handle chat save error
    }
    
    // Emit to all viewers in real-time
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
      {/* Livestream Ended Screen */}
      {livestreamEnded && (
        <div className="absolute inset-0 bg-gradient-to-b from-black via-gray-900 to-black flex flex-col items-center justify-center z-50">
          <div className="text-center">
            <div className="mb-6">
              <Square className="w-24 h-24 text-red-500 mx-auto mb-4 opacity-80" />
            </div>
            <h1 className="text-4xl font-bold text-white mb-2">Livestream Ended</h1>
            <p className="text-gray-400 text-lg mb-8">The live broadcast has finished</p>
            
            <button
              onClick={() => router.push(`/teacher/${teacherID}`)}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold text-lg"
            >
              Back to Home
            </button>
          </div>
        </div>
      )}

      <div ref={containerRef} className={`absolute inset-0 transition-all duration-300 ${showDocumentViewer ? 'w-1/2' : 'w-full'}`}>
        {!livestreamEnded && (
          <>
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              onLoadedMetadata={() => {
                if (localVideoRef.current) {
                  localVideoRef.current.play().catch(() => {
                    // Silently handle video play error
                  });
                }
              }}
              onError={() => {
                // Silently handle video element error
              }}
              className={`w-full h-full object-cover bg-black ${!isCameraOn && !isScreenSharing ? 'hidden' : ''}`}
            />
            {/* Avatar overlay when camera is off */}
            {!isCameraOn && !isScreenSharing && (
              <div className="w-full h-full bg-gradient-to-b from-gray-800 to-gray-900 flex flex-col items-center justify-center">
                <div className="w-32 h-32 rounded-full bg-blue-600 flex items-center justify-center mb-4 shadow-lg">
                  <span className="text-white text-5xl font-bold">T</span>
                </div>
                <p className="text-white text-xl font-semibold">Camera Off</p>
                <p className="text-gray-400 text-sm mt-2">Your camera is currently disabled</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Livestream Info Display */}
      {livestreamInfo && !livestreamEnded && (
        <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-md text-white p-3 rounded-xl shadow-lg max-w-sm z-10">
          <h2 className="text-lg font-bold mb-1.5 line-clamp-1">{livestreamInfo.title}</h2>
          <div className="flex items-center gap-1.5 flex-wrap text-sm mb-2">
            <span className="px-2 py-0.5 bg-blue-600 rounded-full text-xs font-semibold">
              {livestreamInfo.category}
            </span>
            {livestreamInfo.isPublic && (
              <span className="px-2 py-0.5 bg-green-600 rounded-full text-xs font-semibold">Public</span>
            )}
            {livestreamInfo.allowComments && (
              <span className="px-2 py-0.5 bg-purple-600 rounded-full text-xs font-semibold">💬 On</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-white/90">
            <span className="flex items-center gap-1">
              👥 <span className="font-semibold">{watcherCount}</span> watching
            </span>
          </div>
        </div>
      )}

      {showDocumentViewer && selectedDocument && !livestreamEnded && (
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

      {/* Recording Preview Modal */}
      {showRecordingPreview && recordingPreview && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Film className="w-6 h-6 text-blue-600" />
                  <h2 className="text-2xl font-bold text-gray-900">Recording Preview</h2>
                </div>
                <button
                  onClick={() => {
                    setShowRecordingPreview(false);
                    setRecordingPreview(null);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Video Player */}
              <div className="mb-6 bg-black rounded-lg overflow-hidden">
                <video
                  src={URL.createObjectURL(recordingPreview)}
                  controls
                  autoPlay
                  className="w-full h-auto max-h-96"
                />
              </div>

              {/* Recording Info */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-700 font-medium">File Size:</span>
                  <span className="text-gray-900">{(recordingPreview.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700 font-medium">Format:</span>
                  <span className="text-gray-900">WebM (VP8 + Opus)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700 font-medium">Chunks:</span>
                  <span className="text-gray-900">{recordedChunksRef.current.length}</span>
                </div>
              </div>

              {/* Info Message */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-800">
                  ℹ️ This preview shows exactly what students saw during the livestream. 
                  If it looks correct, click <strong>Upload & Save</strong> to save it to your stream library.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => cancelRecordingUpload()}
                  className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
                >
                  Discard Recording
                </button>
                <button
                  onClick={() => confirmRecordingUpload()}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium flex items-center justify-center gap-2"
                >
                  <Upload size={18} />
                  Upload & Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Preview & Rename Dialog */}
      {uploadPreview && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Preview & Rename Document</h2>
                <button
                  onClick={cancelUpload}
                  className="p-2 hover:bg-gray-100 rounded-lg transition"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              {/* Preview Section */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3">Preview</label>
                <div className="border-2 border-gray-200 rounded-lg p-4 bg-gray-50">
                  {uploadPreview.type === 'image' && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img 
                      src={uploadPreview.url} 
                      alt="Preview" 
                      className="max-h-64 mx-auto rounded"
                    />
                  )}
                  {uploadPreview.type === 'pdf' && (
                    <div className="flex flex-col items-center gap-3">
                      <FileText className="w-16 h-16 text-red-500" />
                      <a 
                        href={uploadPreview.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline text-sm"
                      >
                        Open PDF in new tab
                      </a>
                    </div>
                  )}
                  {uploadPreview.type === 'video' && (
                    <video 
                      src={uploadPreview.url} 
                      controls 
                      className="max-h-64 mx-auto rounded"
                    />
                  )}
                  {(uploadPreview.type === 'doc' || uploadPreview.type === 'ppt') && (
                    <div className="flex flex-col items-center gap-3">
                      {uploadPreview.type === 'doc' ? (
                        <FileText className="w-16 h-16 text-blue-500" />
                      ) : (
                        <FileText className="w-16 h-16 text-orange-500" />
                      )}
                      <a 
                        href={uploadPreview.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline text-sm"
                      >
                        Open document in new tab
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* File Info */}
              <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-600">Original name:</span>
                    <p className="font-medium text-gray-900 break-all">{uploadPreview.originalName}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Size:</span>
                    <p className="font-medium text-gray-900">
                      {(uploadPreview.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                </div>
              </div>

              {/* Rename Input */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Document Name
                </label>
                <input
                  type="text"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  placeholder="Enter document name (without extension)"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="mt-2 text-sm text-gray-500">
                  Final name: <span className="font-medium text-gray-900">
                    {newFileName.trim() || uploadPreview.originalName.replace(/\\.[^/.]+$/, '')}.{uploadPreview.originalName.split('.').pop()}
                  </span>
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={cancelUpload}
                  className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmUpload}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                >
                  Add to Documents
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={`absolute top-2 left-2 text-white text-sm bg-black/50 px-2 py-1 rounded transition-all duration-300 ${showDocumentViewer ? 'left-2' : 'left-2'} ${livestreamEnded ? 'hidden' : ''}`}>
        🔴 {watcherCount.toLocaleString()} views
      </div>

      <div className={`absolute top-4 right-4 w-80 bg-white rounded-lg text-black shadow-lg max-h-[70vh] overflow-hidden flex flex-col transition-all duration-300 ${showDocumentViewer ? 'right-[calc(50%+1rem)]' : 'right-4'} ${!isLive || livestreamEnded ? 'hidden' : ''}`}>
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

      <div className={`absolute right-4 w-72 max-h-80 bg-transparent text-white rounded-lg shadow-lg transition-all duration-300 ${showDocumentViewer ? 'top-[calc(70vh+2rem)] right-[calc(50%+1rem)]' : 'top-[calc(70vh+2rem)]'} ${!isLive || livestreamEnded ? 'hidden' : ''}`}>
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
              // Safely get username string
              const displayName = typeof msg.username === 'string' ? msg.username : (msg.username?.fullName || 'Anonymous');

              return (
                <div
                  key={msg.id}
                  className={`rounded-lg px-2 py-1 inline-block bg-white/10 backdrop-blur-sm ${colorClass}`}
                >
                  <b>{displayName}:</b> {msg.message}
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
      {!livestreamEnded && (
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
          onClick={() => setShowCameraSettings(!showCameraSettings)}
          disabled={!isLive}
          className="p-3 bg-white rounded-full shadow hover:bg-gray-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
          title="Camera Settings"
        >
          <MoreVertical className="text-black" />
        </button>
      </div>
      )}

      {/* Camera Settings Modal */}
      {showCameraSettings && isLive && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-sm w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Camera Settings</h2>
              <button
                onClick={() => setShowCameraSettings(false)}
                className="p-1 hover:bg-gray-100 rounded-full transition"
              >
                <X className="text-gray-500" size={24} />
              </button>
            </div>

            {availableCameras.length > 0 ? (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700 mb-3">Select Camera</label>
                {availableCameras.map((camera) => (
                  <button
                    key={camera.deviceId}
                    onClick={() => switchCamera(camera.deviceId)}
                    className={`w-full px-4 py-3 rounded-lg border-2 transition text-left ${
                      selectedCameraId === camera.deviceId
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="font-medium text-gray-900">{camera.label || `Camera ${availableCameras.indexOf(camera) + 1}`}</p>
                    {selectedCameraId === camera.deviceId && (
                      <p className="text-sm text-blue-600 mt-1">✓ Currently Active</p>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-6">No cameras found</p>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowCameraSettings(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
