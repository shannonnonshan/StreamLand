import { useCallback, useEffect, useRef, useState } from 'react';
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
  const livestreamIDRef = useRef(livestreamID);
  livestreamIDRef.current = livestreamID;
  const [isPlayBlocked, setIsPlayBlocked] = useState(false);

  const setupPcHandlers = useCallback((pc: RTCPeerConnection) => {
    pc.ontrack = (event) => {
      console.log(`[Student WebRTC] ontrack - track: ${event.track.kind}`);

      if (event.track.kind !== 'video') return;

      if (!remoteVideoRef.current) return;

      const video = remoteVideoRef.current;
      const stream = event.streams[0] || new MediaStream([event.track]);

      video.srcObject = null;
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;

      const tryPlay = () => {
        video.play()
          .then(() => {
            console.log('[Student WebRTC] play() succeeded');
            setIsPlayBlocked(true);
          })
          .catch((err) => {
            console.log('[Student WebRTC] play() blocked:', err.name);
            setIsPlayBlocked(true);
            const playOnClick = () => {
              video.muted = false;
              video.play().catch(() => {});
              video.removeEventListener('click', playOnClick);
              setIsPlayBlocked(false);
            };
            video.addEventListener('click', playOnClick);
          });
      };

      if (video.readyState >= 1) {
        tryPlay();
      } else {
        video.addEventListener('loadedmetadata', tryPlay, { once: true });
      }

      setIsConnected(true);
      setIsLoading(false);

      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        if (event.candidate.type === 'relay') {
          console.log('✅ [Student WebRTC] Using TURN relay');
        }
        if (broadcasterIdRef.current) {
          socket.emit('candidate', {
            to: broadcasterIdRef.current,
            candidate: event.candidate,
            livestreamID: livestreamIDRef.current,
          });
        }
      } else {
        console.log('[Student WebRTC] ICE gathering complete');
      }
    };

    pc.onicegatheringstatechange = () => {
      console.log(`[Student WebRTC] ICE gathering: ${pc.iceGatheringState}`);
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[Student WebRTC] ICE connection: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === 'failed') {
        try { pc.restartIce(); } catch { /* not supported */ }
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('[Student] connection state:', pc.connectionState);
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setIsConnected(false);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = null;
        }
        broadcasterIdRef.current = null;
        pendingCandidatesRef.current = [];
        setTimeout(() => {
          socket.emit('watcher', { livestreamID: livestreamIDRef.current });
        }, 1000);
      }
    };
  }, []);

  useEffect(() => {
    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      iceTransportPolicy: ICE_TRANSPORT_POLICY,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    });
    setupPcHandlers(pc);
    pcRef.current = pc;

    const handleBroadcaster = () => {
      console.log('[Student WebRTC] Received broadcaster, emitting watcher');
      socket.emit('watcher', { livestreamID });
    };

    const handleOffer = async ({ from, sdp }: { from: string; sdp: RTCSessionDescriptionInit }) => {
      try {
        console.log(`[Student WebRTC] Received offer from: ${from}`);
        broadcasterIdRef.current = from;

        const currentPc = pcRef.current;
        let activePc: RTCPeerConnection;

        if (!currentPc ||
            currentPc.signalingState === 'closed' ||
            currentPc.connectionState === 'failed') {
          console.log('[Student WebRTC] Creating new RTCPeerConnection');
          const newPc = new RTCPeerConnection({
            iceServers: ICE_SERVERS,
            iceTransportPolicy: ICE_TRANSPORT_POLICY,
            bundlePolicy: 'max-bundle',
            rtcpMuxPolicy: 'require',
          });
          setupPcHandlers(newPc);
          if (currentPc) {
            try { currentPc.close(); } catch {}
          }
          pcRef.current = newPc;
          activePc = newPc;
        } else {
          activePc = currentPc;
        }

        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = null;
        }

        pendingCandidatesRef.current = [];

        await activePc.setRemoteDescription(new RTCSessionDescription(sdp));
        console.log('[Student WebRTC] Remote description set');

        const answer = await activePc.createAnswer();
        await activePc.setLocalDescription(answer);
        console.log('[Student WebRTC] Sending answer');

        socket.emit('answer', {
          to: from,
          sdp: activePc.localDescription,
          livestreamID,
        });
      } catch (error) {
        console.error('[Student WebRTC] Offer error:', error);
        onError?.(error as Error);
        setIsLoading(false);
      }
    };

    const handleCandidate = ({ candidate }: { candidate: RTCIceCandidateInit }) => {
      const activePc = pcRef.current;
      if (!activePc || activePc.signalingState === 'closed') return;

      if (activePc.remoteDescription && activePc.remoteDescription.type) {
        activePc.addIceCandidate(new RTCIceCandidate(candidate)).catch((err) => {
          console.error('[Student WebRTC] ICE error:', err);
        });
      } else {
        console.log('[Student WebRTC] Queuing ICE candidate');
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

    const handleSocketReconnect = () => {
      socket.emit('watcher', { livestreamID });
    };

    socket.on('broadcaster', handleBroadcaster);
    socket.on('offer', handleOffer);
    socket.on('candidate', handleCandidate);
    socket.on('stream-ended', handleStreamEnded);
    socket.on('stream-not-found', handleStreamNotFound);
    socket.on('reconnect', handleSocketReconnect);

    const emitWatcher = () => {
      console.log('[Student WebRTC] Emitting watcher for', livestreamID);
      socket.emit('watcher', { livestreamID });
    };

    if (socket.connected) {
      emitWatcher();
    } else {
      socket.connect();
      socket.once('connect', emitWatcher);
    }

    loadingTimeoutRef.current = setTimeout(() => {
      setIsLoading(false);
      loadingTimeoutRef.current = null;
    }, 10000);

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
      socket.off('connect', emitWatcher);
      socket.off('reconnect', handleSocketReconnect);

      pcRef.current?.close();
      pcRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [livestreamID, setupPcHandlers]);

  return {
    isConnected,
    isLoading,
    remoteVideoRef,
    isPlayBlocked,
    setIsPlayBlocked,
  };
}