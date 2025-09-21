"use client";

import { useEffect, useRef, useState } from "react";
import { ICE_SERVERS } from "../../../utils/ice";
import socket from "../../../socket";

export default function Broadcaster() {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const peersRef = useRef<Record<string, RTCPeerConnection>>({});
  const localStreamRef = useRef<MediaStream | null>(null);

  const [isLive, setIsLive] = useState(false);
  const [watcherCount, setWatcherCount] = useState(0);

  useEffect(() => {
    socket.on("watcher", handleWatcher);
    socket.on("answer", handleAnswer);
    socket.on("candidate", handleCandidate);
    socket.on("bye", handleBye);

    return () => {
      socket.off("watcher", handleWatcher);
      socket.off("answer", handleAnswer);
      socket.off("candidate", handleCandidate);
      socket.off("bye", handleBye);

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

      socket.emit("broadcaster");
      setIsLive(true);
    } catch (err) {
      console.error("getUserMedia error:", err);
    }
  }

  function stopLive() {
    // báo cho viewer biết stream đã kết thúc
    socket.emit("stream-ended");

    // đóng tất cả peer
    Object.values(peersRef.current).forEach((pc) => pc.close());
    peersRef.current = {};

    // tắt camera/mic
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }

    setIsLive(false);
    setWatcherCount(0);
  }

  async function handleWatcher(watcherId: string) {
    setWatcherCount((prev) => prev + 1);
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peersRef.current[watcherId] = pc;

    localStreamRef.current?.getTracks().forEach((track) => {
      if (localStreamRef.current) pc.addTrack(track, localStreamRef.current);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("candidate", { to: watcherId, candidate: event.candidate });
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("offer", { to: watcherId, sdp: pc.localDescription });
  }

  function handleAnswer({
    from,
    sdp,
  }: {
    from: string;
    sdp: RTCSessionDescriptionInit;
  }) {
    const pc = peersRef.current[from];
    if (pc) {
      pc.setRemoteDescription(new RTCSessionDescription(sdp));
    }
  }

  function handleCandidate({
    from,
    candidate,
  }: {
    from: string;
    candidate: RTCIceCandidateInit;
  }) {
    const pc = peersRef.current[from];
    if (pc) {
      pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
    }
  }

  function handleBye(id: string) {
    setWatcherCount((prev) => Math.max(prev - 1, 0));
    const pc = peersRef.current[id];
    if (pc) {
      pc.close();
      delete peersRef.current[id];
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <video
        ref={localVideoRef}
        autoPlay
        muted
        playsInline
        className="w-full max-w-lg bg-black rounded-md"
      />

      <div className="flex gap-3">
        {!isLive ? (
          <button
            onClick={startLive}
            className="px-4 py-2 bg-green-600 text-white rounded"
          >
            Start Live
          </button>
        ) : (
          <button
            onClick={stopLive}
            className="px-4 py-2 bg-red-600 text-white rounded"
          >
            Stop Live
          </button>
        )}
      </div>

      <div className="text-gray-700">
        👀 Viewers: <b>{watcherCount}</b>
      </div>
    </div>
  );
}
