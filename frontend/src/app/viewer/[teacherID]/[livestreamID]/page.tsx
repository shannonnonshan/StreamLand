"use client";

import { useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { ICE_SERVERS } from "@/utils/ice";
import socket from "@/socket";

export default function ViewerPage() {
  const params = useParams<{ teacherID?: string; livestreamID?: string }>();

  const teacherID = params?.teacherID ?? "1";
  const livestreamID = params?.livestreamID ?? "1";

  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const broadcasterIdRef = useRef<string | null>(null);

  useEffect(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    // Nhận track từ broadcaster
    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    // Gửi ICE candidate đến broadcaster
    pc.onicecandidate = (event) => {
      if (event.candidate && broadcasterIdRef.current) {
        socket.emit("candidate", {
          to: broadcasterIdRef.current,
          candidate: event.candidate,
          teacherID,
          livestreamID,
        });
      }
    };

    // Khi broadcaster online, gửi watcher
    const handleBroadcaster = () => {
      socket.emit("watcher", { teacherID, livestreamID });
    };

    // Nhận offer từ broadcaster
    const handleOffer = async ({
      from,
      sdp,
    }: {
      from: string;
      sdp: RTCSessionDescriptionInit;
    }) => {
      broadcasterIdRef.current = from;
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("answer", {
        to: from,
        sdp: pc.localDescription,
        teacherID,
        livestreamID,
      });
    };

    // Nhận candidate
    const handleCandidate = ({ candidate }: { candidate: RTCIceCandidateInit }) => {
      pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
    };

    // Khi stream kết thúc
    const handleStreamEnded = () => {
      pcRef.current?.close();
      pcRef.current = null;
      broadcasterIdRef.current = null;
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    };

    socket.on("broadcaster", handleBroadcaster);
    socket.on("offer", handleOffer);
    socket.on("candidate", handleCandidate);
    socket.on("stream-ended", handleStreamEnded);

    // Join ngay khi vào
    socket.emit("watcher", { teacherID, livestreamID });

    return () => {
      socket.off("broadcaster", handleBroadcaster);
      socket.off("offer", handleOffer);
      socket.off("candidate", handleCandidate);
      socket.off("stream-ended", handleStreamEnded);

      pc.close();
    };
  }, [teacherID, livestreamID]);

  return (
    <video
      ref={remoteVideoRef}
      autoPlay
      playsInline
      controls
      className="w-full h-screen bg-black"
    />
  );
}
