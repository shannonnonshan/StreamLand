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
      console.log(`[Student WebRTC] ontrack fired - received ${event.streams.length} streams`);
      if (event.streams[0]) {
        console.log(`[Student WebRTC] Stream has ${event.streams[0].getTracks().length} tracks`);
        event.streams[0].getTracks().forEach((track, i) => {
          console.log(`[Student WebRTC] Track ${i}: kind=${track.kind}, enabled=${track.enabled}, readyState=${track.readyState}`);
        });
      }
      
      if (remoteVideoRef.current) {
        const video = remoteVideoRef.current;
        video.srcObject = event.streams[0];
        
        // Set initial properties
        video.muted = true; // Start muted for autoplay
        video.playsInline = true;
        
        // Wait for loadedmetadata before playing
        const handleLoadedMetadata = () => {
          console.log('[Student WebRTC] Video metadata loaded, attempting play');
          video.play()
            .then(() => {
              console.log('[Student WebRTC] Video playing successfully');
              // Try to unmute after successful play
              setTimeout(() => {
                video.muted = false;
                console.log('[Student WebRTC] Audio unmuted');
              }, 100);
            })
            .catch((error) => {
              console.warn('[Student WebRTC] Autoplay blocked, keeping muted:', error.name);
            });
          
          video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        };
        
        video.addEventListener('loadedmetadata', handleLoadedMetadata);
        
        setIsConnected(true);
        setIsLoading(false);
        console.log('[Student WebRTC] Stream connected!');
        
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
      console.log(`[Student WebRTC] Connection state: ${pc.connectionState}`);
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
      console.log('[Student WebRTC] Received broadcaster event, emitting watcher');
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
        console.log(`[Student WebRTC] Received offer from broadcaster: ${from}`);
        broadcasterIdRef.current = from;
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        console.log('[Student WebRTC] Remote description set');

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        console.log('[Student WebRTC] Sending answer back to broadcaster');
        socket.emit('answer', {
          to: from,
          sdp: pc.localDescription,
          livestreamID,
        });
      } catch (error) {
        console.error('[Student WebRTC] Offer error:', error);
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
