import { useEffect, useRef, useState } from 'react';
import { ICE_SERVERS } from '@/utils/ice';
import socket from '@/socket';

interface UseLivestreamViewerOptions {
  teacherID: string;
  livestreamID: string;
  onError?: (error: Error) => void;
  onStreamEnded?: () => void;
}

export function useLivestreamViewer({
  teacherID,
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
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    pc.ontrack = (event) => {
      console.log('[Viewer] Stream received. Tracks:', event.streams[0].getTracks().length);
      console.log('[Viewer] Video tracks:', event.streams[0].getVideoTracks());
      console.log('[Viewer] Audio tracks:', event.streams[0].getAudioTracks());
      
      if (remoteVideoRef.current) {
        console.log('[Viewer] Setting srcObject to video element');
        remoteVideoRef.current.srcObject = event.streams[0];
        
        // Force play the video
        remoteVideoRef.current.play().then(() => {
          console.log('[Viewer] Video playing successfully');
        }).catch((error) => {
          console.error('[Viewer] Video play error:', error);
        });
        
        setIsConnected(true);
        setIsLoading(false);
        // Clear timeout since stream was received
        if (loadingTimeoutRef.current) {
          clearTimeout(loadingTimeoutRef.current);
          loadingTimeoutRef.current = null;
        }
      } else {
        console.error('[Viewer] remoteVideoRef.current is null!');
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && broadcasterIdRef.current) {
        console.log('[Viewer] Sending ICE candidate');
        socket.emit('candidate', {
          to: broadcasterIdRef.current,
          candidate: event.candidate,
          teacherID,
          livestreamID,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('[Viewer] Connection state:', pc.connectionState);
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

    pc.onicegatheringstatechange = () => {
      console.log('[Viewer] ICE gathering:', pc.iceGatheringState);
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[Viewer] ICE connection:', pc.iceConnectionState);
    };

    const handleBroadcaster = () => {
      console.log('[Viewer] Broadcaster detected, joining...');
      socket.emit('watcher', { teacherID, livestreamID });
    };

    const handleOffer = async ({
      from,
      sdp,
    }: {
      from: string;
      sdp: RTCSessionDescriptionInit;
    }) => {
      try {
        console.log('[Viewer] Received offer from:', from);
        console.log('[Viewer] Offer SDP:', sdp);
        broadcasterIdRef.current = from;
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        console.log('[Viewer] Sending answer back');
        socket.emit('answer', {
          to: from,
          sdp: pc.localDescription,
          teacherID,
          livestreamID,
        });
      } catch (error) {
        console.error('[Viewer] Offer error:', error);
        onError?.(error as Error);
        setIsLoading(false);
      }
    };

    const handleCandidate = ({ candidate }: { candidate: RTCIceCandidateInit }) => {
      console.log('[Viewer] Received ICE candidate');
      pc.addIceCandidate(new RTCIceCandidate(candidate)).catch((error) => {
        console.error('[Viewer] ICE error:', error);
        onError?.(error as Error);
      });
    };

    const handleStreamEnded = () => {
      console.log('[Viewer] Stream ended');
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
      console.log('[Viewer] Stream not found - broadcaster not available');
      setIsLoading(false);
      setIsConnected(false);
      onError?.(new Error('Stream not available'));
    };

    socket.on('broadcaster', handleBroadcaster);
    socket.on('offer', handleOffer);
    socket.on('candidate', handleCandidate);
    socket.on('stream-ended', handleStreamEnded);
    socket.on('stream-not-found', handleStreamNotFound);

    console.log('[Viewer] Initializing connection to:', teacherID, livestreamID);
    console.log('[Viewer] Socket connected:', socket.connected);
    console.log('[Viewer] Socket ID:', socket.id);
    
    // Join immediately when entering
    socket.emit('watcher', { teacherID, livestreamID });
    console.log('[Viewer] Emitted watcher event');

    // Set timeout for loading state
    loadingTimeoutRef.current = setTimeout(() => {
      console.log('[Viewer] Connection timeout - no stream received');
      setIsLoading(false);
      loadingTimeoutRef.current = null;
    }, 10000); // 10 seconds timeout

    return () => {
      console.log('[Viewer] Cleaning up connection');
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
  }, [teacherID, livestreamID]);

  return {
    isConnected,
    isLoading,
    remoteVideoRef,
  };
}
