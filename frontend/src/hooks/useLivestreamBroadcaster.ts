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
    const handleWatcher = async ({ id }: { id: string }) => {
      try {
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
            socket.emit('candidate', {
              to: id,
              candidate: event.candidate,
              livestreamID,
            });
          }
        };

        pc.onconnectionstatechange = () => {
          // Connection state changed
        };

        pc.oniceconnectionstatechange = () => {
          // ICE connection state changed
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

      // Start recording for saving to R2
      try {
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'video/webm;codecs=vp8,opus',
          videoBitsPerSecond: 2500000, // 2.5 Mbps
        });

        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            // Convert blob to base64 and send to server
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64data = reader.result as string;
              const base64 = base64data.split(',')[1]; // Remove data URL prefix
              
              socket.emit('video-chunk', {
                livestreamID,
                chunk: base64,
                chunkIndex: chunkIndexRef.current++,
              });
              
              console.log(`[Broadcaster] Sent video chunk ${chunkIndexRef.current - 1}`);
            };
            reader.readAsDataURL(event.data);
          }
        };

        mediaRecorder.onerror = (error) => {
          console.error('[Broadcaster] MediaRecorder error:', error);
        };

        // Record in 10-second chunks
        mediaRecorder.start(10000);
        mediaRecorderRef.current = mediaRecorder;
        
        console.log('[Broadcaster] MediaRecorder started');
      } catch (error) {
        console.warn('[Broadcaster] MediaRecorder not supported or failed:', error);
        // Continue without recording - not critical for live streaming
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
    // Stop MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
      console.log('[Broadcaster] MediaRecorder stopped');
    }
    
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

    // Note: stream-ended event is emitted in the parent component with saveRecording flag
    setIsStreaming(false);
    setViewerCount(0);
    chunkIndexRef.current = 0;
  };

  return {
    isStreaming,
    viewerCount,
    localVideoRef,
    startBroadcast,
    stopBroadcast,
  };
}
