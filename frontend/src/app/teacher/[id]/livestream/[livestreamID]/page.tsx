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
} from "lucide-react";

interface LivestreamInfo {
  title: string;
  description: string;
  category: string;
  thumbnail?: File;
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
  const [showModal, setShowModal] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [livestreamInfo, setLivestreamInfo] = useState<LivestreamInfo>({
    title: "",
    description: "",
    category: "Education",
  });

  const [comments] = useState<string[]>([
    "abcd: 123456789asdfghjk",
    "efgh: hello world",
    "ijkl: streaming now!",
    "mnop: nice video!",
  ]);

  const [showFiles, setShowFiles] = useState(true);
  const [showComments, setShowComments] = useState(true);

  useEffect(() => {
    socket.on("watcher", handleWatcher);
    socket.on("answer", handleAnswer);
    socket.on("candidate", handleCandidate);
    socket.on("bye", handleBye);
    socket.on("viewerCount", (count: number) => setWatcherCount(count));

    return () => {
      socket.off("watcher", handleWatcher);
      socket.off("answer", handleAnswer);
      socket.off("candidate", handleCandidate);
      socket.off("bye", handleBye);
      socket.off("viewerCount");

      socket.disconnect();
      Object.values(peersRef.current).forEach((pc) => pc.close());
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
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

      // Emit broadcaster with teacherID + livestreamID + info
      socket.emit("broadcaster", { 
        teacherID, 
        livestreamID,
        info: livestreamInfo 
      });
      setIsLive(true);
      setShowModal(false);
    } catch (err) {
      console.error("getUserMedia error:", err);
    }
  }

  function handleStartClick() {
    setShowModal(true);
  }

  function handleModalSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (livestreamInfo.title.trim()) {
      startLive();
    }
  }

  function stopLive() {
    socket.emit("stream-ended", { teacherID, livestreamID });

    Object.values(peersRef.current).forEach((pc) => pc.close());
    peersRef.current = {};

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }

    setIsLive(false);
    setWatcherCount(0);
  }

  async function handleWatcher(data: { id: string } | string) {
    // Handle both object format { id: string } and string format
    const watcherId = typeof data === 'string' ? data : data.id;
    
    console.log('[Broadcaster] New watcher:', watcherId);
    
    // Check if peer connection already exists
    if (peersRef.current[watcherId]) {
      console.log('[Broadcaster] Peer connection already exists for:', watcherId);
      return;
    }

    // Check if local stream is available
    if (!localStreamRef.current) {
      console.error('[Broadcaster] No local stream available! Cannot send to watcher:', watcherId);
      return;
    }

    console.log('[Broadcaster] Creating peer connection for:', watcherId);
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peersRef.current[watcherId] = pc;

    const tracks = localStreamRef.current.getTracks();
    console.log('[Broadcaster] Adding', tracks.length, 'tracks to peer connection');
    
    tracks.forEach((track) => {
      console.log('[Broadcaster] Adding track:', track.kind, track.enabled);
      pc.addTrack(track, localStreamRef.current!);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[Broadcaster] Sending ICE candidate to:', watcherId);
        socket.emit("candidate", {
          to: watcherId,
          candidate: event.candidate,
          teacherID,
          livestreamID,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('[Broadcaster] Connection state for', watcherId, ':', pc.connectionState);
    };

    console.log('[Broadcaster] Creating offer for:', watcherId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    console.log('[Broadcaster] Sending offer to:', watcherId);
    socket.emit("offer", {
      to: watcherId,
      sdp: pc.localDescription,
      teacherID,
      livestreamID,
    });
  }

  function handleAnswer({ from, sdp }: { from: string; sdp: RTCSessionDescriptionInit }) {
    console.log('[Broadcaster] Received answer from:', from);
    const pc = peersRef.current[from];
    if (pc) {
      pc.setRemoteDescription(new RTCSessionDescription(sdp));
      console.log('[Broadcaster] Answer processed for:', from);
    } else {
      console.error('[Broadcaster] No peer connection found for:', from);
    }
  }

  function handleCandidate({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) {
    console.log('[Broadcaster] Received ICE candidate from:', from);
    const pc = peersRef.current[from];
    if (pc) {
      pc.addIceCandidate(new RTCIceCandidate(candidate)).catch((error) => {
        console.error('[Broadcaster] ICE candidate error:', error);
      });
    } else {
      console.error('[Broadcaster] No peer connection found for:', from);
    }
  }

  function handleBye(id: string) {
    const pc = peersRef.current[id];
    if (pc) {
      pc.close();
      delete peersRef.current[id];
    }
  }

  // Toggle Mic
  function toggleMic() {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicOn(audioTrack.enabled);
        console.log('[Broadcaster] Mic', audioTrack.enabled ? 'ON' : 'OFF');
      }
    }
  }

  // Toggle Camera
  function toggleCamera() {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOn(videoTrack.enabled);
        console.log('[Broadcaster] Camera', videoTrack.enabled ? 'ON' : 'OFF');
      }
    }
  }

  // Toggle Screen Share
  async function toggleScreenShare() {
    try {
      if (!isScreenSharing) {
        // Start screen sharing
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });

        const screenTrack = screenStream.getVideoTracks()[0];
        
        // Replace video track in local stream
        const oldVideoTrack = localStreamRef.current?.getVideoTracks()[0];
        if (oldVideoTrack && localStreamRef.current) {
          localStreamRef.current.removeTrack(oldVideoTrack);
          localStreamRef.current.addTrack(screenTrack);
          
          // Update local video display
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
          }

          // Replace track in all peer connections
          Object.values(peersRef.current).forEach((pc) => {
            const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
            if (sender) {
              sender.replaceTrack(screenTrack);
            }
          });

          // Stop old video track
          oldVideoTrack.stop();
        }

        // Handle screen share stop
        screenTrack.onended = async () => {
          await stopScreenShare();
        };

        setIsScreenSharing(true);
        console.log('[Broadcaster] Screen sharing started');
      } else {
        await stopScreenShare();
      }
    } catch (err) {
      console.error('[Broadcaster] Screen share error:', err);
    }
  }

  async function stopScreenShare() {
    try {
      // Get camera stream again
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });

      const cameraTrack = cameraStream.getVideoTracks()[0];
      
      // Replace screen track with camera track
      const oldScreenTrack = localStreamRef.current?.getVideoTracks()[0];
      if (oldScreenTrack && localStreamRef.current) {
        localStreamRef.current.removeTrack(oldScreenTrack);
        localStreamRef.current.addTrack(cameraTrack);
        
        // Update local video display
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }

        // Replace track in all peer connections
        Object.values(peersRef.current).forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(cameraTrack);
          }
        });

        // Stop old screen track
        oldScreenTrack.stop();
      }

      setIsScreenSharing(false);
      setIsCameraOn(true);
      console.log('[Broadcaster] Screen sharing stopped');
    } catch (err) {
      console.error('[Broadcaster] Stop screen share error:', err);
    }
  }

  return (
    <div className="relative w-full h-screen bg-black">
      {/* Video full màn hình */}
      <video
        ref={localVideoRef}
        autoPlay
        muted
        playsInline
        className="w-full h-full object-cover"
      />

      {/* Livestream Info Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Start Livestream</h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleModalSubmit} className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Livestream Title *
                </label>
                <input
                  type="text"
                  value={livestreamInfo.title}
                  onChange={(e) => setLivestreamInfo({ ...livestreamInfo, title: e.target.value })}
                  placeholder="e.g., IELTS Speaking Practice - Part 2"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={livestreamInfo.description}
                  onChange={(e) => setLivestreamInfo({ ...livestreamInfo, description: e.target.value })}
                  placeholder="What will you teach in this session?"
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={livestreamInfo.category}
                  onChange={(e) => setLivestreamInfo({ ...livestreamInfo, category: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="Education">Education</option>
                  <option value="English">English</option>
                  <option value="Math">Math</option>
                  <option value="Science">Science</option>
                  <option value="Programming">Programming</option>
                  <option value="Music">Music</option>
                  <option value="Art">Art</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!livestreamInfo.title.trim()}
                  className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Start Live
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Viewer count overlay */}
      <div className="absolute top-2 left-2 text-white text-sm bg-black/50 px-2 py-1 rounded">
        🔴 {watcherCount.toLocaleString()} views
      </div>

      {/* Upload panel overlay */}
      <div className="absolute top-4 right-4 w-72 bg-white rounded-lg text-black shadow-lg">
        <div
          className="flex justify-between items-center p-2 cursor-pointer"
          onClick={() => setShowFiles(!showFiles)}
        >
          <h3 className="font-bold text-sm">Uploaded files</h3>
          {showFiles ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
        {showFiles && (
          <div className="p-2">
            <div className="flex gap-2 text-xs mb-2">
              <span className="font-semibold">File</span>
              <span>Picture</span>
              <span>Video</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-gray-300 h-16"></div>
              <div className="bg-gray-300 h-16"></div>
              <div className="bg-gray-300 h-16"></div>
              <div className="bg-gray-300 h-16 flex items-center justify-center">
                +
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Comment panel overlay */}
      <div className="absolute top-60 right-4 w-72 max-h-80 bg-transparent text-white rounded-lg shadow-lg">
        <div
          className="flex justify-between items-center p-2 cursor-pointer"
          onClick={() => setShowComments(!showComments)}
        >
          <h3 className="font-bold text-sm">Comment</h3>
          {showComments ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
        {showComments && (
          <div className="p-2 flex flex-col space-y-1 text-xs overflow-y-auto max-h-64">
            {comments.map((c, i) => {
              const [user, message] = c.split(":");
              const colors = [
                "text-red-500/70",
                "text-green-500/70",
                "text-blue-500/70",
                "text-yellow-500/70",
                "text-purple-500/70",
                "text-pink-500/70",
                "text-indigo-500/70",
              ];
              const colorClass = colors[i % colors.length];

              return (
                <div
                  key={i}
                  className={`rounded-lg px-2 py-1 inline-block bg-white ${colorClass}`}
                >
                  <b>{user}:</b> {message}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Control bar (bottom center) */}
      <div className="fixed bottom-4 left-3/5 -translate-x-1/2 flex gap-6 bg-white/80 p-3 rounded-full shadow-lg">
        {/* Mic Toggle */}
        <button 
          onClick={toggleMic}
          disabled={!isLive}
          className={`p-3 rounded-full shadow transition ${
            isMicOn 
              ? 'bg-white text-black hover:bg-gray-100' 
              : 'bg-red-600 text-white hover:bg-red-700'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          title={isMicOn ? 'Tắt mic' : 'Bật mic'}
        >
          {isMicOn ? <Mic /> : <MicOff />}
        </button>

        {/* Camera Toggle */}
        <button 
          onClick={toggleCamera}
          disabled={!isLive || isScreenSharing}
          className={`p-3 rounded-full shadow transition ${
            isCameraOn 
              ? 'bg-white text-black hover:bg-gray-100' 
              : 'bg-red-600 text-white hover:bg-red-700'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          title={isCameraOn ? 'Tắt camera' : 'Bật camera'}
        >
          {isCameraOn ? <Video /> : <VideoOff />}
        </button>

        {/* Start/Stop Live */}
        {!isLive ? (
          <button
            onClick={handleStartClick}
            className="p-3 bg-green-600 rounded-full shadow text-white hover:bg-green-700 transition"
            title="Bắt đầu livestream"
          >
            <Play />
          </button>
        ) : (
          <button
            onClick={stopLive}
            className="p-3 bg-red-600 rounded-full shadow text-white hover:bg-red-700 transition"
            title="Dừng livestream"
          >
            <Square />
          </button>
        )}

        {/* Screen Share Toggle */}
        <button 
          onClick={toggleScreenShare}
          disabled={!isLive}
          className={`p-3 rounded-full shadow transition ${
            isScreenSharing 
              ? 'bg-blue-600 text-white hover:bg-blue-700' 
              : 'bg-white text-black hover:bg-gray-100'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          title={isScreenSharing ? 'Dừng chia sẻ màn hình' : 'Chia sẻ màn hình'}
        >
          <Monitor />
        </button>

        <button 
          className="p-3 bg-white rounded-full shadow hover:bg-gray-100 transition"
          title="Tải file"
        >
          <Upload className="text-black" />
        </button>
        
        <button 
          className="p-3 bg-white rounded-full shadow hover:bg-gray-100 transition"
          title="Thêm tùy chọn"
        >
          <MoreVertical className="text-black" />
        </button>
      </div>
    </div>
  );
}
