import { useEffect, useRef, useState } from 'react';
import { ICE_SERVERS, ICE_TRANSPORT_POLICY } from '@/utils/ice';
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
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  useEffect(() => {
    const pc = new RTCPeerConnection({ 
      iceServers: ICE_SERVERS,
      // Use configured ICE transport policy
      iceTransportPolicy: ICE_TRANSPORT_POLICY,
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
      if (event.candidate) {
        const candidateType = event.candidate.type; // host, srflx (STUN), or relay (TURN)
        console.log(`[Student WebRTC] ICE candidate (${candidateType}):`, {
          type: event.candidate.type,
          protocol: event.candidate.protocol,
          address: event.candidate.address,
          port: event.candidate.port,
        });
        
        // Log TURN usage for cross-network debugging
        if (candidateType === 'relay') {
          console.log('✅ [Student WebRTC] Using TURN relay - good for cross-network!');
        }
        
        if (broadcasterIdRef.current) {
          socket.emit('candidate', {
            to: broadcasterIdRef.current,
            candidate: event.candidate,
            livestreamID,
          });
        }
      } else {
        console.log('[Student WebRTC] ICE gathering complete (null candidate)');
      }
    };
    
    pc.onicegatheringstatechange = () => {
      console.log(`[Student WebRTC] ICE gathering state: ${pc.iceGatheringState}`);
    };
    
    pc.oniceconnectionstatechange = () => {
      console.log(`[Student WebRTC] ICE connection state: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === 'failed') {
        try { pc.restartIce(); } catch { /* not supported */ }
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
        setTimeout(() => {
          if (pcRef.current?.connectionState !== 'connected') {
            socket.emit('watcher', { livestreamID });
          }
        }, 2000);
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

        // Process any pending ICE candidates
        if (pendingCandidatesRef.current.length > 0) {
          console.log(`[Student WebRTC] Processing ${pendingCandidatesRef.current.length} pending ICE candidates`);
          for (const candidate of pendingCandidatesRef.current) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (err) {
              console.error('[Student WebRTC] Error adding pending candidate:', err);
            }
          }
          pendingCandidatesRef.current = [];
        }

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
      if (pc.remoteDescription && pc.remoteDescription.type) {
        // Remote description is set - add candidate now
        pc.addIceCandidate(new RTCIceCandidate(candidate)).catch((error) => {
          console.error('[Student WebRTC] ICE error:', error);
          onError?.(error as Error);
        });
      } else {
        // Remote description not yet set - queue candidate
        console.log('[Student WebRTC] Queuing ICE candidate (remote description not set)');
        pendingCandidatesRef.current.push(candidate);
      }
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

    const handleSocketReconnect = () => {
      socket.emit('watcher', { livestreamID });
    };
    socket.on('reconnect', handleSocketReconnect);

    // Ensure socket is connected before emitting (autoConnect is false in socket.ts)
    const emitWatcher = () => {
      console.log('[Student WebRTC] Emitting watcher event for', livestreamID);
      socket.emit('watcher', { livestreamID });
    };

    if (socket.connected) {
      emitWatcher();
    } else {
      socket.connect();
      socket.once('connect', emitWatcher);
    }

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
      // Remove the once('connect') listener in case cleanup runs before socket connected
      socket.off('connect', emitWatcher);
      socket.off('reconnect', handleSocketReconnect);

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