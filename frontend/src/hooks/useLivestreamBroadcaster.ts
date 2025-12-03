import { useEffect, useRef, useState } from 'react';
import { ICE_SERVERS } from '@/utils/ice';
import socket from '@/socket';

interface UseLivestreamBroadcasterOptions {
  livestreamID: string;
  onError?: (error: Error) => void;
}

export function useLivestreamBroadcaster({
  livestreamID,
  onError,
}: UseLivestreamBroadcasterOptions) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunkIndexRef = useRef<number>(0);

  useEffect(() => {
    // Khi có watcher mới
    const handleWatcher = async ({ id }: { id: string }) => {
      try {
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        peerConnectionsRef.current.set(id, pc);

        const localStream = localStreamRef.current;
        if (localStream) {
          localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
        }

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit('candidate', {
              to: id,
              candidate: event.candidate,
              livestreamID,
            });
          }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit('offer', {
          to: id,
          sdp: pc.localDescription,
          livestreamID,
        });
      } catch (error) {
        console.error('[Broadcaster] Error handling watcher:', error);
        onError?.(error as Error);
      }
    };

    const handleAnswer = async ({
      from,
      sdp,
    }: {
      from: string;
      sdp: RTCSessionDescriptionInit;
    }) => {
      const pc = peerConnectionsRef.current.get(from);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      }
    };

    const handleCandidate = ({
      from,
      candidate,
    }: {
      from: string;
      candidate: RTCIceCandidateInit;
    }) => {
      const pc = peerConnectionsRef.current.get(from);
      if (pc) {
        pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
      }
    };

    const handleDisconnectPeer = ({ id }: { id: string }) => {
      const pc = peerConnectionsRef.current.get(id);
      if (pc) {
        pc.close();
        peerConnectionsRef.current.delete(id);
      }
    };

    // **Mới**: cập nhật viewerCount từ server
    const handleViewerCount = (count: number) => {
      setViewerCount(count);
    };

    socket.on('watcher', handleWatcher);
    socket.on('answer', handleAnswer);
    socket.on('candidate', handleCandidate);
    socket.on('disconnectPeer', handleDisconnectPeer);
    socket.on('viewerCount', handleViewerCount);

    return () => {
      socket.off('watcher', handleWatcher);
      socket.off('answer', handleAnswer);
      socket.off('candidate', handleCandidate);
      socket.off('disconnectPeer', handleDisconnectPeer);
      socket.off('viewerCount', handleViewerCount);
    };
  }, [livestreamID, onError]);

  const startBroadcast = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });

      localStreamRef.current = stream;

      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      // MediaRecorder
      try {
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'video/webm;codecs=vp8,opus',
          videoBitsPerSecond: 2500000,
        });

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64data = reader.result as string;
              const base64 = base64data.split(',')[1];
              socket.emit('video-chunk', {
                livestreamID,
                chunk: base64,
                chunkIndex: chunkIndexRef.current++,
              });
            };
            reader.readAsDataURL(event.data);
          }
        };

        mediaRecorder.start(10000);
        mediaRecorderRef.current = mediaRecorder;
      } catch (error) {
        console.warn('[Broadcaster] MediaRecorder not supported or failed:', error);
      }

      socket.emit('broadcaster', { livestreamID });
      setIsStreaming(true);
    } catch (error) {
      console.error('[Broadcaster] startBroadcast error:', error);
      onError?.(error as Error);
      throw error;
    }
  };

  const stopBroadcast = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }

    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;

    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();

    if (localVideoRef.current) localVideoRef.current.srcObject = null;

    setIsStreaming(false);
    setViewerCount(0);
    chunkIndexRef.current = 0;
  };

  return { isStreaming, viewerCount, localVideoRef, startBroadcast, stopBroadcast };
}
