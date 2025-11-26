import { useEffect, useRef, useState } from 'react';
import { ICE_SERVERS } from '@/utils/ice';
import socket from '@/socket';

interface UseLivestreamViewerOptions {
  livestreamID: string;
  onError?: (error: Error) => void;
  onStreamEnded?: () => void;
}

export function useLivestreamViewer({
  livestreamID,
  onError,
  onStreamEnded,
}: UseLivestreamViewerOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const broadcasterIdRef = useRef<string | null>(null);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const pc = new RTCPeerConnection({ 
      iceServers: ICE_SERVERS,
      // Optimize for faster connection
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    });
    pcRef.current = pc;

    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
        
        // Optimize video playback
        remoteVideoRef.current.preload = 'auto';
        remoteVideoRef.current.playsInline = true;
        
        // Force play the video
        remoteVideoRef.current.play().catch((error) => {
          console.error('Video play error:', error);
        });
        
        setIsConnected(true);
        setIsLoading(false);
        // Clear timeout since stream was received
        if (loadingTimeoutRef.current) {
          clearTimeout(loadingTimeoutRef.current);
          loadingTimeoutRef.current = null;
        }
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && broadcasterIdRef.current) {
        socket.emit('candidate', {
          to: broadcasterIdRef.current,
          candidate: event.candidate,
          livestreamID,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setIsConnected(true);
        setIsLoading(false);
        // Clear timeout since connection succeeded
        if (loadingTimeoutRef.current) {
          clearTimeout(loadingTimeoutRef.current);
          loadingTimeoutRef.current = null;
        }
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setIsConnected(false);
      }
    };

    const handleBroadcaster = () => {
      socket.emit('watcher', { livestreamID });
    };

    const handleOffer = async ({
      from,
      sdp,
    }: {
      from: string;
      sdp: RTCSessionDescriptionInit;
    }) => {
      try {
        broadcasterIdRef.current = from;
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('answer', {
          to: from,
          sdp: pc.localDescription,
          livestreamID,
        });
      } catch (error) {
        console.error('Offer error:', error);
        onError?.(error as Error);
        setIsLoading(false);
      }
    };

    const handleCandidate = ({ candidate }: { candidate: RTCIceCandidateInit }) => {
      pc.addIceCandidate(new RTCIceCandidate(candidate)).catch((error) => {
        console.error('ICE error:', error);
        onError?.(error as Error);
      });
    };

    const handleStreamEnded = () => {
      pcRef.current?.close();
      pcRef.current = null;
      broadcasterIdRef.current = null;
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
      setIsConnected(false);
      setIsLoading(false);
      onStreamEnded?.();
    };

    const handleStreamNotFound = () => {
      setIsLoading(false);
      setIsConnected(false);
      onError?.(new Error('Teacher is not streaming yet. Please wait...'));
    };

    socket.on('broadcaster', handleBroadcaster);
    socket.on('offer', handleOffer);
    socket.on('candidate', handleCandidate);
    socket.on('stream-ended', handleStreamEnded);
    socket.on('stream-not-found', handleStreamNotFound);

    // Join immediately when entering
    socket.emit('watcher', { livestreamID });

    // Set timeout for loading state
    loadingTimeoutRef.current = setTimeout(() => {
      setIsLoading(false);
      loadingTimeoutRef.current = null;
    }, 10000); // 10 seconds timeout

    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
      socket.off('broadcaster', handleBroadcaster);
      socket.off('offer', handleOffer);
      socket.off('candidate', handleCandidate);
      socket.off('stream-ended', handleStreamEnded);
      socket.off('stream-not-found', handleStreamNotFound);

      pc.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [livestreamID]);

  return {
    isConnected,
    isLoading,
    remoteVideoRef,
  };
}
