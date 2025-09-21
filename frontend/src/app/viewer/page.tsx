"use client";
import { useEffect, useRef } from "react";
import { ICE_SERVERS } from "../../utils/ice";
import socket from "../../socket";

export default function Viewer() {
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const broadcasterIdRef = useRef<string | null>(null);

  useEffect(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    // nhận stream từ broadcaster
    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    // gửi ICE candidate về cho broadcaster
    pc.onicecandidate = (event) => {
      if (event.candidate && broadcasterIdRef.current) {
        socket.emit("candidate", {
          to: broadcasterIdRef.current,
          candidate: event.candidate,
        });
      }
    };

    // khi server báo có broadcaster
    const handleBroadcaster = () => {
      socket.emit("watcher");
    };

    // nhận offer từ broadcaster
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

      socket.emit("answer", { to: from, sdp: pc.localDescription });
    };

    // nhận ICE candidate từ broadcaster
    const handleCandidate = ({
      candidate,
    }: {
      from: string;
      candidate: RTCIceCandidateInit;
    }) => {
      pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
    };

    const handleStreamEnded = () => {
      pcRef.current?.close();
      pcRef.current = null;
      broadcasterIdRef.current = null;
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
    };

    socket.on("broadcaster", handleBroadcaster);
    socket.on("offer", handleOffer);
    socket.on("candidate", handleCandidate);
    socket.on("stream-ended", handleStreamEnded);

    // phát tín hiệu "tôi là watcher" ngay khi vào
    socket.emit("watcher");

    return () => {
      socket.off("broadcaster", handleBroadcaster);
      socket.off("offer", handleOffer);
      socket.off("candidate", handleCandidate);
      socket.off("stream-ended", handleStreamEnded);

      socket.disconnect();
      pc.close();
    };
  }, []);

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
