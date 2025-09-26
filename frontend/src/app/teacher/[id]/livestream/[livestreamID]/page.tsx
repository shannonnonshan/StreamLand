"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { ICE_SERVERS } from "@/utils/ice";
import socket from "@/socket";
import {
  Mic,
  Video,
  Upload,
  MoreVertical,
  Play,
  Square,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

export default function BroadcasterPage() {
  const params = useParams<{ id?: string; livestreamID?: string }>();

  // fallback mặc định 1/1
  const teacherID = params?.id ?? "1";
  const livestreamID = params?.livestreamID ?? "1";

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const peersRef = useRef<Record<string, RTCPeerConnection>>({});
  const localStreamRef = useRef<MediaStream | null>(null);

  const [isLive, setIsLive] = useState(false);
  const [watcherCount, setWatcherCount] = useState(0);

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

      // Emit broadcaster with teacherID + livestreamID
      socket.emit("broadcaster", { teacherID, livestreamID });
      setIsLive(true);
    } catch (err) {
      console.error("getUserMedia error:", err);
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

  async function handleWatcher(watcherId: string) {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peersRef.current[watcherId] = pc;

    localStreamRef.current?.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current!);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("candidate", {
          to: watcherId,
          candidate: event.candidate,
          teacherID,
          livestreamID,
        });
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
    if (pc) pc.setRemoteDescription(new RTCSessionDescription(sdp));
  }

  function handleCandidate({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) {
    const pc = peersRef.current[from];
    if (pc) pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
  }

  function handleBye(id: string) {
    const pc = peersRef.current[id];
    if (pc) {
      pc.close();
      delete peersRef.current[id];
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
        <button className="p-3 bg-white rounded-full shadow">
          <Mic className="text-black" />
        </button>
        <button className="p-3 bg-white rounded-full shadow">
          <Video className="text-black" />
        </button>
        {!isLive ? (
          <button
            onClick={startLive}
            className="p-3 bg-green-600 rounded-full shadow text-white"
          >
            <Play />
          </button>
        ) : (
          <button
            onClick={stopLive}
            className="p-3 bg-red-600 rounded-full shadow text-white"
          >
            <Square />
          </button>
        )}
        <button className="p-3 bg-white rounded-full shadow">
          <Upload className="text-black" />
        </button>
        <button className="p-3 bg-white rounded-full shadow">
          <MoreVertical className="text-black" />
        </button>
      </div>
    </div>
  );
}
