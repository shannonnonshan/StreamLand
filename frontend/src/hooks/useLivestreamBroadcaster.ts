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

  useEffect(() => {
    const handleWatcher = async ({ id }: { id: string }) => {
      try {
        console.log('[Broadcaster] New viewer joined:', id);
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        peerConnectionsRef.current.set(id, pc);

        const localStream = localStreamRef.current;
        if (localStream) {
          console.log('[Broadcaster] Adding tracks to peer connection');
          localStream.getTracks().forEach((track) => {
            console.log('[Broadcaster] Adding track:', track.kind);
            pc.addTrack(track, localStream);
          });
        } else {
          console.error('[Broadcaster] No local stream available!');
        }

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            console.log('[Broadcaster] Sending ICE candidate to viewer');
            socket.emit('candidate', {
              to: id,
              candidate: event.candidate,
              livestreamID,
            });
          }
        };

        pc.onconnectionstatechange = () => {
          console.log('[Broadcaster] Connection state for', id, ':', pc.connectionState);
        };

        pc.oniceconnectionstatechange = () => {
          console.log('[Broadcaster] ICE connection state for', id, ':', pc.iceConnectionState);
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        console.log('[Broadcaster] Sending offer to viewer:', id);
        socket.emit('offer', {
          to: id,
          sdp: pc.localDescription,
          livestreamID,
        });

        setViewerCount((prev) => prev + 1);
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
      console.log('[Broadcaster] Received answer from viewer:', from);
      const pc = peerConnectionsRef.current.get(from);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        console.log('[Broadcaster] Answer processed for:', from);
      } else {
        console.error('[Broadcaster] No peer connection found for:', from);
      }
    };

    const handleCandidate = ({
      from,
      candidate,
    }: {
      from: string;
      candidate: RTCIceCandidateInit;
    }) => {
      console.log('[Broadcaster] Received ICE candidate from viewer:', from);
      const pc = peerConnectionsRef.current.get(from);
      if (pc) {
        pc.addIceCandidate(new RTCIceCandidate(candidate)).catch((error) => {
          console.error('[Broadcaster] ICE candidate error:', error);
        });
      }
    };

    const handleDisconnectPeer = ({ id }: { id: string }) => {
      const pc = peerConnectionsRef.current.get(id);
      if (pc) {
        pc.close();
        peerConnectionsRef.current.delete(id);
        setViewerCount((prev) => Math.max(0, prev - 1));
      }
    };

    socket.on('watcher', handleWatcher);
    socket.on('answer', handleAnswer);
    socket.on('candidate', handleCandidate);
    socket.on('disconnectPeer', handleDisconnectPeer);

    return () => {
      socket.off('watcher', handleWatcher);
      socket.off('answer', handleAnswer);
      socket.off('candidate', handleCandidate);
      socket.off('disconnectPeer', handleDisconnectPeer);
    };
  }, [livestreamID, onError]);

  const startBroadcast = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      socket.emit('broadcaster', { livestreamID });
      setIsStreaming(true);
    } catch (error) {
      console.error('Error starting broadcast:', error);
      onError?.(error as Error);
      throw error;
    }
  };

  const stopBroadcast = () => {
    const localStream = localStreamRef.current;
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    socket.emit('stream-ended', { livestreamID });
    setIsStreaming(false);
    setViewerCount(0);
  };

  return {
    isStreaming,
    viewerCount,
    localVideoRef,
    startBroadcast,
    stopBroadcast,
  };
}
