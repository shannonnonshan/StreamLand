"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import Image from "next/image";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Settings,
  ThumbsUp,
  ThumbsDown,
  Share2,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { Captions } from "lucide-react";
import LoginModal from "@/component/(modal)/login";
import RegisterModal from "@/component/(modal)/register";

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface VideoInfo {
  id: string;
  title: string;
  description: string;
  teacher: {
    id: string;
    fullName: string;
    avatar?: string;
  };
  totalViews: number;
  likes: number;
  dislikes: number;
  endedAt: string;
  duration: number;
  category: string;
  recordingUrl: string;
  thumbnailUrl?: string;
}

interface RelatedVideo {
  id: string;
  title: string;
  thumbnail: string;
  category: string;
  totalViews: number;
  duration: number;
  endedAt: string;
  teacher: {
    id: string;
    fullName: string;
    avatar?: string;
  };
}

interface SubtitleCue {
  id: string;
  start: number;
  end: number;
  text: string;
}

interface VideoComment {
  id: string;
  author: string;
  authorAvatar?: string;
  content: string;
  createdAt: string;
  likes: number;
  dislikes: number;
  myReaction?: 'like' | 'dislike' | null;
}

interface CurrentStudentProfile {
  id?: string;
  fullName: string;
  avatar?: string;
}

interface WatchProgressResponse {
  userId: string;
  livestreamId: string;
  watchedAt: string;
  duration: number;
  completed: boolean;
  progress: number;
  lastPosition: number;
}

interface LocalVideoProgressSnapshot {
  videoId: string;
  userId: string;
  currentTime: number;
  duration: number;
  updatedAt: number;
}

export default function VideoPlayerPage() {
  const params = useParams<{ livestreamID?: string }>();
  const router = useRouter();
  const livestreamID = params?.livestreamID;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [videoReaction, setVideoReaction] = useState<'like' | 'dislike' | null>(null);
  const [videoLikeCount, setVideoLikeCount] = useState(0);
  const [videoDislikeCount, setVideoDislikeCount] = useState(0);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [showSubs, setShowSubs] = useState(true);
  const [activeCueId, setActiveCueId] = useState<string | null>(null);

  // Subtitles and transcript panel
  const [subtitleCues, setSubtitleCues] = useState<SubtitleCue[]>([]);
  const [selectedCueId, setSelectedCueId] = useState<string | null>(null);
  const [showTranscriptPanel, setShowTranscriptPanel] = useState(false);
  const [transcriptionComplete, setTranscriptionComplete] = useState(false);
  const [summary, setSummary] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);

  // Comments and auth
  const [comments, setComments] = useState<VideoComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [currentStudent, setCurrentStudent] = useState<CurrentStudentProfile | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [relatedVideos, setRelatedVideos] = useState<RelatedVideo[]>([]);
  const [displayedVideos, setDisplayedVideos] = useState(5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportedView, setReportedView] = useState(false);
  const autoPlayAttemptedRef = useRef(false);
  const progressSyncRef = useRef(false);
  const pendingSeekRef = useRef<number | null>(null);
  const lastProgressPostRef = useRef(0);
  const restoreCompletedRef = useRef(false);
  const reportWatchInFlightRef = useRef(false);

  const getViewerIdForStorage = () => {
    if (currentStudent?.id) return currentStudent.id;

    try {
      const storedUser = localStorage.getItem('user');
      if (!storedUser) return 'anon';
      const parsed = JSON.parse(storedUser) as { id?: string; userId?: string; email?: string };
      return parsed.id || parsed.userId || parsed.email || 'anon';
    } catch {
      return 'anon';
    }
  };

  const writeLocalProgressSnapshot = (position: number, totalDuration: number, force = false) => {
    if (!videoInfo?.id || totalDuration <= 0) return;

    const viewerId = getViewerIdForStorage();
    const key = `streamland:video-progress:${viewerId}:${videoInfo.id}`;

    // Do not overwrite a later saved position with an earlier one during initial autoplay startup.
    try {
      const existingRaw = localStorage.getItem(key);
      if (existingRaw) {
        const existing = JSON.parse(existingRaw) as LocalVideoProgressSnapshot;
        if (!force && existing && typeof existing.currentTime === 'number' && existing.currentTime > position + 5) {
          return;
        }
      }
    } catch {
      // ignore malformed existing snapshots
    }

    const payload: LocalVideoProgressSnapshot = {
      videoId: videoInfo.id,
      userId: viewerId,
      currentTime: Math.max(0, Math.floor(position)),
      duration: Math.max(1, Math.floor(totalDuration)),
      updatedAt: Date.now(),
    };

    try {
      localStorage.setItem(key, JSON.stringify(payload));
    } catch (err) {
      console.error('Failed to write local progress snapshot:', err);
    }
  };

  const readLocalProgressSnapshot = () => {
    if (!videoInfo?.id) return null;

    const candidateViewerIds: string[] = [];
    if (currentStudent?.id) candidateViewerIds.push(currentStudent.id);

    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser) as { id?: string; userId?: string; email?: string };
        if (parsed.id) candidateViewerIds.push(parsed.id);
        if (parsed.userId) candidateViewerIds.push(parsed.userId);
        if (parsed.email) candidateViewerIds.push(parsed.email);
      }
    } catch {
      // ignore invalid storage payloads
    }

    candidateViewerIds.push('anon');

    let best: LocalVideoProgressSnapshot | null = null;

    for (const viewerId of Array.from(new Set(candidateViewerIds))) {
      const key = `streamland:video-progress:${viewerId}:${videoInfo.id}`;
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw) as LocalVideoProgressSnapshot;
        if (!parsed || typeof parsed.currentTime !== 'number' || typeof parsed.duration !== 'number') continue;

        if (!best || (parsed.updatedAt || 0) > (best.updatedAt || 0)) {
          best = parsed;
        }
      } catch {
        // ignore malformed snapshots
      }
    }

    return best;
  };

  const syncProgressToServer = async (position: number, totalDuration: number, force = false) => {
    if (!videoInfo?.id || totalDuration <= 0) return;

    // Always write local immediately so dashboard card reflects progress instantly
    writeLocalProgressSnapshot(position, totalDuration, force);

    // Wait until at least one restore pass completes to avoid posting near-zero progress too early.
    if (!restoreCompletedRef.current && !force) {
      return;
    }

    if (!isAuthenticated) return;
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const now = Date.now();
    if (!force && now - lastProgressPostRef.current < 8000) {
      return;
    }

    lastProgressPostRef.current = now;

    try {
      const completed = position / totalDuration >= 0.95;
      await fetch(`${API_URL}/student/track-activity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          contentType: 'video',
          contentId: videoInfo.id,
          lastPosition: Math.max(0, Math.floor(position)),
          duration: Math.max(1, Math.floor(totalDuration)),
          progress: (position / totalDuration) * 100,
          completed,
        }),
      });
    } catch (err) {
      console.error('Failed to sync progress to server:', err);
    }
  };

  // Fetch video data
  useEffect(() => {
    const fetchVideoData = async () => {
      if (!livestreamID) return;

      try {
        const response = await fetch(`${API_URL}/livestream/${livestreamID}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch video data');
        }

        const data = await response.json();
        
        // Check if video has recording
        if (!data.recordingUrl || data.status !== 'ENDED') {
          throw new Error('This video is not available');
        }

        setVideoInfo({
          id: data.id,
          title: data.title,
          description: data.description || '',
          teacher: {
            id: data.teacher.id,
            fullName: data.teacher.fullName,
            avatar: data.teacher.avatar,
          },
          totalViews: data.totalViews || 0,
          likes: 0, // TODO: Implement likes system
          dislikes: 0, // TODO: Implement dislikes system
          endedAt: data.endedAt,
          duration: data.duration || 0,
          category: data.category || 'Education',
          recordingUrl: data.recordingUrl,
          thumbnailUrl: data.thumbnail,
        });
        
        console.log('[Fetch] VideoInfo set with recording URL:', data.recordingUrl);

        // Fetch related videos
        try {
          const relatedResponse = await fetch(`${API_URL}/livestream/${livestreamID}/related?limit=10`);
          if (relatedResponse.ok) {
            const relatedData = await relatedResponse.json();
            setRelatedVideos(relatedData);
          }
        } catch (relatedErr) {
          console.error('Error fetching related videos:', relatedErr);
          // Don't fail the whole page if related videos fail
        }
      } catch (err) {
        console.error('Error fetching video:', err);
        setError(err instanceof Error ? err.message : 'Failed to load video');
      } finally {
        setLoading(false);
      }
    };

    fetchVideoData();
  }, [livestreamID]);

  // Generate simple subtitle cues from description
  const createSubtitleCues = (text: string, totalDuration = 120): SubtitleCue[] => {
    const source = (text || '').replace(/\s+/g, ' ').trim();
    if (!source) return [];
    const parts = source.split(/(?<=[.!?])\s+/).filter(Boolean).slice(0, 24);
    const cueDuration = Math.max(3, Math.floor((totalDuration || 120) / Math.max(1, parts.length)));
    return parts.map((p, i) => ({ id: `cue-${i+1}`, start: i * cueDuration, end: (i+1) * cueDuration, text: p }));
  };

  useEffect(() => {
    if (!videoInfo) return;
    const cues = createSubtitleCues(videoInfo.description || '', videoInfo.duration || 120);
    setSubtitleCues(cues);
    setSelectedCueId(cues[cues.length - 1]?.id || null);
  }, [videoInfo]);

  useEffect(() => {
    if (!subtitleCues || subtitleCues.length === 0) { setActiveCueId(null); return; }
    const cue = subtitleCues.find(c => currentTime >= c.start && currentTime < c.end) || null;
    setActiveCueId(cue?.id || null);
    if (subtitleCues.length > 0 && currentTime >= (subtitleCues[subtitleCues.length-1].end || 0)) {
      setTranscriptionComplete(true);
    }
  }, [currentTime, subtitleCues]);

  // Load current student profile and comments
  useEffect(() => {
    const loadProfileAndComments = async () => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        try {
          const p = await fetch(`${API_URL}/auth/profile`, { headers: { Authorization: `Bearer ${token}` } });
          if (p.ok) {
            const jd = await p.json();
            setCurrentStudent({ id: jd.id || jd.userId || jd.sub || '', fullName: jd.fullName || 'Student', avatar: jd.avatar });
            setIsAuthenticated(true);
          }
        } catch (e) {
          console.error('Profile load failed', e);
        }
      }

      if (!videoInfo?.id) return;
      try {
        const r = await fetch(`${API_URL}/livestream/${videoInfo.id}/comments?limit=50`);
        if (r.ok) {
          const data = await r.json();
          setComments((data || []).map((c: any) => ({
            id: c.id,
            author: c.author || 'Student',
            authorAvatar: c.authorAvatar || undefined,
            content: c.content,
            createdAt: c.createdAt,
            likes: c.likes || 0,
            dislikes: c.dislikes || 0,
            myReaction: null,
          })));
        }
      } catch (e) {
        console.error('Comments load failed', e);
      }
    };
    loadProfileAndComments();
  }, [videoInfo?.id]);

  useEffect(() => {
    const refreshProfile = async () => {
      if (showLoginModal || showRegisterModal) return;
      const token = localStorage.getItem('accessToken');
      if (!token) return;
      try {
        const resp = await fetch(`${API_URL}/auth/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!resp.ok) return;
        const data = await resp.json();
        setCurrentStudent({
          id: data?.id || data?.userId || data?.sub || '',
          fullName: data?.fullName || 'Student',
          avatar: data?.avatar || undefined,
        });
        setIsAuthenticated(true);
      } catch (err) {
        console.error('Failed to refresh auth profile:', err);
      }
    };

    refreshProfile();
  }, [showLoginModal, showRegisterModal]);

  useEffect(() => {
    const fetchVideoReactionData = async () => {
      if (!videoInfo?.id) return;

      try {
        const statsResp = await fetch(`${API_URL}/livestream/${videoInfo.id}/reaction-stats`);
        if (statsResp.ok) {
          const stats = await statsResp.json();
          setVideoLikeCount(stats.likes || 0);
          setVideoDislikeCount(stats.dislikes || 0);
        }

        if (isAuthenticated) {
          const token = localStorage.getItem('accessToken');
          if (token) {
            const myReactionResp = await fetch(`${API_URL}/livestream/${videoInfo.id}/user-reaction`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (myReactionResp.ok) {
              const data = await myReactionResp.json();
              setVideoReaction(data.reactionType || null);
            }
          }
        } else {
          setVideoReaction(null);
        }
      } catch (err) {
        console.error('Failed to fetch video reactions:', err);
      }
    };

    fetchVideoReactionData();
  }, [videoInfo?.id, isAuthenticated]);

  useEffect(() => {
    if (!videoInfo?.recordingUrl) {
      console.log('[Video] Waiting for recording URL...');
      return;
    }
    
    let cleanupFns: (() => void)[] = [];
    
    // Wait for video element to be rendered
    const setupVideo = () => {
      const video = videoRef.current;
      if (!video) {
        console.log('[Video] Video element not ready, retrying...');
        const timer = setTimeout(setupVideo, 100); // Retry after 100ms
        cleanupFns.push(() => clearTimeout(timer));
        return;
      }

      // Seed resume target before media events start firing.
      const initialSnapshot = readLocalProgressSnapshot();
      if (initialSnapshot && initialSnapshot.currentTime > 0) {
        pendingSeekRef.current = initialSnapshot.currentTime;
      }

      const applyPendingSeek = () => {
        const seekTo = pendingSeekRef.current;
        if (seekTo === null || seekTo <= 0) return;

        const maxDuration = video.duration && isFinite(video.duration) && video.duration > 0
          ? video.duration
          : (videoInfo?.duration || seekTo);

        const target = Math.min(seekTo, Math.max(0, maxDuration - 1));
        if (video.currentTime < target - 0.5) {
          video.currentTime = target;
          setCurrentTime(target);
        }

        pendingSeekRef.current = null;
      };

      const updateTime = () => {
        setCurrentTime(video.currentTime);
        console.log('[Video] Time update:', video.currentTime, 'Duration:', video.duration); // Debug

        if (!progressSyncRef.current) {
          progressSyncRef.current = true;
        }

        // Report view when watched >= 2/3 for recorded videos only
        try {
          if (!reportedView && !reportWatchInFlightRef.current && video.duration && isFinite(video.duration) && video.duration > 0) {
            const fraction = video.currentTime / video.duration;
            if (fraction > 2 / 3) {
              // Generate or reuse anonymous viewer id for unauthenticated users
              const token = localStorage.getItem('accessToken');
              let viewerId: string | undefined = undefined;
              if (!token) {
                viewerId = localStorage.getItem('streamland_anon_viewer_id') || undefined;
                if (!viewerId) {
                  viewerId = 'anon-' + Math.random().toString(36).slice(2, 12);
                  try { localStorage.setItem('streamland_anon_viewer_id', viewerId); } catch (e) { /* ignore */ }
                }
              }

              // Send report (do not await to avoid blocking UI)
              (async () => {
                reportWatchInFlightRef.current = true;
                try {
                  const body: any = { watchedSeconds: Math.floor(video.currentTime), duration: Math.floor(video.duration) };
                  if (viewerId) body.viewerId = viewerId;
                  const resp = await fetch(`${API_URL}/livestream/${videoInfo!.id}/report-watch`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
                    body: JSON.stringify(body),
                  });
                  if (resp.ok) {
                    const data = await resp.json();
                    if (data?.counted) {
                      setReportedView(true);
                      // Optionally update local totalViews
                      setVideoInfo((prev) => prev ? { ...prev, totalViews: (data.totalViews ?? prev.totalViews) } : prev);
                      console.log('[Video] View counted on server', data);
                    } else {
                      console.log('[Video] Reported but not counted:', data);
                      if (data?.reason === 'already_counted') {
                        setReportedView(true);
                      }
                    }
                  }
                } catch (err) {
                  console.error('Failed to report watch:', err);
                } finally {
                  reportWatchInFlightRef.current = false;
                }
              })();
            }
          }
        } catch (e) {
          console.error('Error in report check:', e);
        }

        const effectiveDuration = video.duration && isFinite(video.duration) && video.duration > 0
          ? video.duration
          : (videoInfo?.duration || 0);
        if (effectiveDuration > 0) {
          void syncProgressToServer(video.currentTime, effectiveDuration);
        }
      };
      const updateDuration = () => {
        if (video.duration && isFinite(video.duration) && !isNaN(video.duration) && video.duration > 0) {
          setDuration(video.duration);
          console.log('[Video] Duration from video element:', video.duration);
        }
        applyPendingSeek();
      };
      const handlePlay = () => {
        setIsPlaying(true);
      };
      const handlePause = () => {
        setIsPlaying(false);
        const effectiveDuration = video.duration && isFinite(video.duration) && video.duration > 0
          ? video.duration
          : (videoInfo?.duration || 0);
        if (effectiveDuration > 0) {
          void syncProgressToServer(video.currentTime, effectiveDuration, true);
        }
      };
      const handleEnded = () => {
        setIsPlaying(false);
        const effectiveDuration = video.duration && isFinite(video.duration) && video.duration > 0
          ? video.duration
          : (videoInfo?.duration || 0);
        if (effectiveDuration > 0) {
          void syncProgressToServer(effectiveDuration, effectiveDuration, true);
        }
      };
      const handleCanPlay = () => {
        if (video.duration && isFinite(video.duration) && !isNaN(video.duration) && video.duration > 0) {
          setDuration(video.duration);
          console.log('[Video] Duration from canplay event:', video.duration);
        }

        applyPendingSeek();

        if (!autoPlayAttemptedRef.current) {
          autoPlayAttemptedRef.current = true;
          video.play()
            .then(() => {
              setIsPlaying(true);
              console.log('[Video] Auto-play started');
            })
            .catch((error) => {
              console.warn('[Video] Auto-play blocked or failed:', error);
              setIsPlaying(false);
            });
        }
      };

      console.log('[Video] Setting up event listeners for:', videoInfo.recordingUrl);
      video.addEventListener("timeupdate", updateTime);
      video.addEventListener("loadedmetadata", updateDuration);
      video.addEventListener("durationchange", updateDuration);
      video.addEventListener("canplay", handleCanPlay);
      video.addEventListener("play", handlePlay);
      video.addEventListener("pause", handlePause);
      video.addEventListener("ended", handleEnded);

      // Store cleanup functions
      cleanupFns.push(() => {
        console.log('[Video] Cleaning up event listeners');
        video.removeEventListener("timeupdate", updateTime);
        video.removeEventListener("loadedmetadata", updateDuration);
        video.removeEventListener("durationchange", updateDuration);
        video.removeEventListener("canplay", handleCanPlay);
        video.removeEventListener("play", handlePlay);
        video.removeEventListener("pause", handlePause);
        video.removeEventListener("ended", handleEnded);
      });

      // Do not force `load()` here; it can reset currentTime and fight resume logic.

      // Try to get duration immediately if already loaded
      if (video.readyState >= 1) {
        if (video.duration && isFinite(video.duration) && !isNaN(video.duration) && video.duration > 0) {
          setDuration(video.duration);
          console.log('[Video] Duration immediately available:', video.duration);
        }
      }
    };
    
    setupVideo();

    return () => {
      cleanupFns.forEach(fn => fn());
    };
  }, [videoInfo]);

  useEffect(() => {
    const syncWatchProgress = async () => {
      if (!videoInfo?.id || !isAuthenticated) return;

      const token = localStorage.getItem('accessToken');
      if (!token) return;

      try {
        const resp = await fetch(`${API_URL}/student/watch-progress/${videoInfo.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!resp.ok) return;

        const progress = (await resp.json()) as WatchProgressResponse | null;
        if (!progress || typeof progress.lastPosition !== 'number' || progress.lastPosition <= 0) return;

        const video = videoRef.current;
        if (!video) {
          pendingSeekRef.current = progress.lastPosition;
          return;
        }

        const target = Math.max(0, Math.min(progress.lastPosition, (progress.duration || video.duration || 0) - 1));
        pendingSeekRef.current = target;
        if ((progress.duration || 0) > 0) {
          writeLocalProgressSnapshot(target, progress.duration);
        }

        if (video.readyState >= 1 && video.currentTime < target - 1) {
          video.currentTime = target;
          setCurrentTime(target);
        }
      } catch (err) {
        console.error('Failed to sync watch progress:', err);
      } finally {
        restoreCompletedRef.current = true;
      }
    };

    syncWatchProgress();
  }, [videoInfo?.id, isAuthenticated]);

  // Restore local progress immediately so resume works even before auth/profile round-trip finishes
  useEffect(() => {
    if (!videoInfo?.id) return;

    const snapshot = readLocalProgressSnapshot();
    if (!snapshot || snapshot.currentTime <= 0) return;

    const video = videoRef.current;
    if (!video) {
      pendingSeekRef.current = snapshot.currentTime;
      return;
    }

    const target = Math.max(0, Math.min(snapshot.currentTime, (snapshot.duration || video.duration || 0) - 1));
    pendingSeekRef.current = target;

    if (video.readyState >= 1 && video.currentTime < target - 1) {
      video.currentTime = target;
      setCurrentTime(target);
    }

    restoreCompletedRef.current = true;
  }, [videoInfo?.id, currentStudent?.id]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      const video = videoRef.current;
      if (!video || !videoInfo?.id) return;

      const effectiveDuration = video.duration && isFinite(video.duration) && video.duration > 0
        ? video.duration
        : (videoInfo.duration || 0);

      if (effectiveDuration > 0) {
        void syncProgressToServer(video.currentTime, effectiveDuration, true);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [videoInfo?.duration, videoInfo?.id, isAuthenticated]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const newVolume = parseFloat(e.target.value);
    video.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const newTime = parseFloat(e.target.value);
    
    // Validate the new time is within bounds
    if (isNaN(newTime)) return;
    
    // Ensure video duration is valid before seeking
    const videoDuration = video.duration;
    if (!videoDuration || isNaN(videoDuration) || !isFinite(videoDuration)) {
      console.warn('[Video] Cannot seek - invalid duration:', videoDuration);
      return;
    }
    
    // Clamp the time to valid range
    const clampedTime = Math.max(0, Math.min(newTime, videoDuration));
    
    try {
      video.currentTime = clampedTime;
      setCurrentTime(clampedTime);
    } catch (error) {
      console.error('[Video] Seek error:', error);
    }
  };

  const toggleFullscreen = () => {
    const container = playerContainerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const formatTime = (time: number) => {
    // Handle NaN, Infinity, null, undefined, or negative values
    if (!time || isNaN(time) || !isFinite(time) || time < 0) {
      return '0:00';
    }

    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const refreshVideoReactionStats = async () => {
    if (!videoInfo?.id) return;
    const statsResp = await fetch(`${API_URL}/livestream/${videoInfo.id}/reaction-stats`);
    if (!statsResp.ok) return;
    const stats = await statsResp.json();
    setVideoLikeCount(stats.likes || 0);
    setVideoDislikeCount(stats.dislikes || 0);
  };

  const handleLike = async () => {
    if (!videoInfo?.id) return;
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }

    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setShowLoginModal(true);
        return;
      }

      const resp = await fetch(`${API_URL}/livestream/${videoInfo.id}/react`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reactionType: 'like' }),
      });

      if (!resp.ok) return;

      const data = await resp.json();
      setVideoReaction(data.reactionType || null);
      await refreshVideoReactionStats();
    } catch (err) {
      console.error('Error updating like reaction:', err);
    }
  };

  const handleDislike = async () => {
    if (!videoInfo?.id) return;
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }

    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setShowLoginModal(true);
        return;
      }

      const resp = await fetch(`${API_URL}/livestream/${videoInfo.id}/react`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reactionType: 'dislike' }),
      });

      if (!resp.ok) return;

      const data = await resp.json();
      setVideoReaction(data.reactionType || null);
      await refreshVideoReactionStats();
    } catch (err) {
      console.error('Error updating dislike reaction:', err);
    }
  };

  const handleShare = async () => {
    const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
    if (!shareUrl) return;

    try {
      if (navigator.share) {
        await navigator.share({
          title: videoInfo?.title || 'StreamLand video',
          text: 'Check out this video on StreamLand',
          url: shareUrl,
        });
        return;
      }

      await navigator.clipboard.writeText(shareUrl);
      alert('Link copied to clipboard!');
    } catch (err) {
      console.error('Share failed:', err);
    }
  };

  const handleSubmitComment = async () => {
    if (!videoInfo?.id) return;
    const content = newComment.trim();
    if (!content) return;
    if (!isAuthenticated) { setShowLoginModal(true); return; }
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${API_URL}/livestream/${videoInfo.id}/comments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ author: currentStudent?.fullName || 'Student', authorAvatar: currentStudent?.avatar, content }),
      });
      if (!res.ok) return;
      const created = await res.json();
      setComments(prev => [created, ...prev]);
      setNewComment('');
    } catch (e) { console.error(e); }
  };

  const handleCommentReaction = async (commentId: string, reaction: 'like'|'dislike') => {
    if (!videoInfo?.id) return;
    if (!isAuthenticated) { setShowLoginModal(true); return; }
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${API_URL}/livestream/comments/${commentId}/react`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ reactionType: reaction }),
      });
      if (!res.ok) return;
      const updated = await res.json();
      setComments(prev => prev.map(c => c.id === commentId ? { ...c, likes: updated.likes || c.likes, dislikes: updated.dislikes || c.dislikes, myReaction: updated.myReaction || null } : c));
    } catch (e) { console.error(e); }
  };

  const handleSubscribe = async () => {
    // Toggle locally; backend integration optional
    setIsSubscribed(prev => !prev);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-gradient-to-r from-[#161853] to-[#292C6D] flex items-center justify-center mx-auto mb-6 shadow-xl">
              <Loader2 className="w-10 h-10 animate-spin text-white" />
            </div>
            <div className="absolute inset-0 w-20 h-20 mx-auto rounded-full bg-gradient-to-r from-[#161853] to-[#292C6D] blur-xl opacity-30 animate-pulse"></div>
          </div>
          <p className="text-lg font-medium text-gray-700">Loading video...</p>
          <p className="text-sm text-gray-500 mt-2">Please wait a moment</p>
        </div>
      </div>
    );
  }

  if (error || !videoInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="bg-white rounded-2xl shadow-2xl p-10 backdrop-blur-lg border border-gray-100">
            <div className="w-20 h-20 bg-gradient-to-br from-red-50 to-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
              <Play className="text-red-600" size={40} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Video Not Available</h2>
            <p className="text-gray-600 mb-8 leading-relaxed">{error || 'This video could not be found or has been removed'}</p>
            <button
              onClick={() => router.back()}
              className="group px-8 py-3.5 bg-gradient-to-r from-[#161853] to-[#292C6D] text-white rounded-xl hover:shadow-xl transition-all duration-300 font-semibold flex items-center gap-2 mx-auto hover:scale-105"
            >
              <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="group flex items-center gap-2 text-gray-600 hover:text-[#161853] mb-6 transition-all duration-300 hover:gap-3 font-medium"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span>Back to Videos</span>
        </button>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Video Player Section */}
          <div className="xl:col-span-2 space-y-6">
            {/* Video Player */}
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
              <div
                ref={playerContainerRef}
                className="relative bg-black group"
                onMouseEnter={() => setShowControls(true)}
                onMouseLeave={() => setShowControls(false)}
              >
                <video
                  ref={videoRef}
                  src={videoInfo.recordingUrl}
                  poster={videoInfo.thumbnailUrl}
                  autoPlay
                  playsInline
                  preload="metadata"
                  className="w-full aspect-video cursor-pointer"
                  onClick={togglePlay}
                />

                {/* Play Overlay */}
                {!isPlaying && (
                  <button
                    type="button"
                    onClick={togglePlay}
                    className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm opacity-100 transition-opacity duration-300"
                    title="Play video"
                  >
                    <div className="w-20 h-20 rounded-full bg-white/90 flex items-center justify-center shadow-2xl hover:scale-110 transition-transform cursor-pointer">
                      <Play size={32} className="text-[#161853] ml-1" fill="currentColor" />
                    </div>
                  </button>
                )}

                {/* Subtitle Overlay (inside video) */}
                {showSubs && activeCueId && (
                  <div className="absolute left-0 right-0 bottom-14 md:bottom-16 flex items-center justify-center px-4">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCueId(activeCueId);
                        setShowTranscriptPanel(true);
                      }}
                      className="bg-black/70 hover:bg-black/80 text-white text-sm px-4 py-2 rounded-md max-w-[90%] text-center transition"
                      title="Open transcript review"
                    >
                      {subtitleCues.find(c => c.id === activeCueId)?.text}
                    </button>
                  </div>
                )}

                {/* Custom Controls */}
                <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 md:p-4 transition-all duration-300 ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
                  {/* Progress Bar */}
                  <div className="mb-2 relative">
                    {/* Progress background */}
                    <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                      {/* Progress fill */}
                      <div 
                        key={currentTime}
                        className="h-full bg-gradient-to-r from-[#EC255A] to-[#ff4d7a] transition-all duration-100"
                        style={{ 
                          width: `${(currentTime / (duration > 0 ? duration : (videoInfo?.duration || 1))) * 100}%` 
                        }}
                      />
                    </div>
                    {/* Slider thumb */}
                    <input
                      type="range"
                      min="0"
                      max={duration > 0 ? duration : (videoInfo?.duration || 100)}
                      value={currentTime}
                      onChange={handleSeek}
                      disabled={!duration && !videoInfo?.duration}
                      className="absolute top-0 left-0 w-full h-1.5 appearance-none cursor-pointer disabled:cursor-not-allowed bg-transparent [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg hover:[&::-webkit-slider-thumb]:scale-110 [&::-webkit-slider-thumb]:transition-transform [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between text-white">
                    <div className="flex items-center gap-2 md:gap-3">
                      <button 
                        onClick={togglePlay} 
                        className="hover:scale-110 transition-transform duration-200 w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-full hover:bg-white/10"
                      >
                        {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                      </button>

                      <div className="flex items-center gap-2 bg-white/10 rounded-full px-3 py-1.5 backdrop-blur-sm">
                        <button 
                          onClick={toggleMute} 
                          className="hover:scale-110 transition-transform duration-200"
                        >
                          {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                        </button>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={volume}
                          onChange={handleVolumeChange}
                          className="w-16 md:w-20 h-1 bg-white/30 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer"
                        />
                      </div>

                      <span className="text-xs md:text-sm font-medium bg-white/10 rounded-full px-3 py-1.5 backdrop-blur-sm">
                        {formatTime(currentTime)} / {formatTime(duration > 0 ? duration : (videoInfo?.duration || 0))}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 md:gap-2">
                      <button onClick={() => setShowSubs(prev => !prev)} className="hover:scale-110 transition-transform duration-200 w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-full hover:bg-white/10">
                        <Captions size={16} />
                      </button>
                      <button className="hover:scale-110 transition-transform duration-200 w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-full hover:bg-white/10">
                        <Settings size={18} />
                      </button>
                      <button 
                        onClick={toggleFullscreen} 
                        className="hover:scale-110 transition-transform duration-200 w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-full hover:bg-white/10"
                      >
                        <Maximize size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Video Info */}
              <div className="p-8">
                <h1 className="text-2xl font-semibold text-gray-900 mb-3 leading-snug">{videoInfo.title}</h1>

                <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-6 border-b border-gray-200">
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl">
                      <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                      <span className="font-semibold text-gray-700">{videoInfo.totalViews.toLocaleString()} views</span>
                    </div>
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-600 font-medium">{new Date(videoInfo.endedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    <span className="px-4 py-2 bg-gradient-to-r from-[#161853] to-[#292C6D] text-white rounded-xl text-xs font-bold shadow-lg">
                      {videoInfo.category}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleLike}
                      className={`group flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all duration-300 font-semibold shadow-md hover:shadow-lg hover:scale-105 ${
                        videoReaction === 'like'
                          ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      <ThumbsUp size={18} className={videoReaction === 'like' ? "fill-current" : ""} />
                      <span className="text-sm">{videoLikeCount}</span>
                    </button>
                    <button
                      onClick={handleDislike}
                      className={`group flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all duration-300 font-semibold shadow-md hover:shadow-lg hover:scale-105 ${
                        videoReaction === 'dislike'
                          ? "bg-gradient-to-r from-red-500 to-red-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      <ThumbsDown size={18} className={videoReaction === 'dislike' ? "fill-current" : ""} />
                      <span className="text-sm">{videoDislikeCount}</span>
                    </button>
                    <button
                      onClick={handleShare}
                      className="group flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#EC255A] to-[#ff4d7a] text-white rounded-xl hover:shadow-lg transition-all duration-300 font-semibold hover:scale-105"
                    >
                      <Share2 size={18} />
                      <span className="text-sm">Share</span>
                    </button>
                  </div>
                </div>

                {/* Teacher Info */}
                <div className="flex items-center justify-between p-6 bg-gradient-to-r from-gray-50 to-blue-50/50 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300">
                  <div className="flex items-center gap-5">
                    <div className="relative group">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#161853] to-[#292C6D] overflow-hidden shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-105">
                        {videoInfo.teacher.avatar ? (
                          <Image
                            src={videoInfo.teacher.avatar}
                            alt={videoInfo.teacher.fullName}
                            width={64}
                            height={64}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white text-xl font-bold">
                            {videoInfo.teacher.fullName.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#161853] to-[#292C6D] blur-lg opacity-0 group-hover:opacity-30 transition-opacity duration-300"></div>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 mb-1">{videoInfo.teacher.fullName}</h3>
                      <p className="text-sm text-gray-500">Instructor</p>
                    </div>
                  </div>
                  <button
                    onClick={() => router.push(`/teacher/public/${videoInfo.teacher.id}`)}
                    className="px-6 py-2.5 bg-gradient-to-r from-[#161853] to-[#292C6D] text-white rounded-xl hover:shadow-lg transition-all duration-300 font-semibold hover:scale-105"
                  >
                    View Profile
                  </button>
                </div>

                {/* Description */}
                {videoInfo.description && (
                  <div className="mt-6 bg-gradient-to-br from-gray-50 to-blue-50/30 rounded-2xl p-6 border border-gray-100">
                    <h4 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wide">Description</h4>
                    <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{videoInfo.description}</p>
                  </div>
                )}

                {/* Subtitles are displayed as an in-video overlay via the captions button in the player controls. */}

                {/* Comments Section */}
                <div className="mt-6 bg-white rounded-2xl p-4 border border-gray-100">
                  <h4 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wide">Comments ({comments.length})</h4>
                  {isAuthenticated ? (
                    <div className="mb-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden bg-gray-200">
                          {currentStudent?.avatar ? (
                            <Image
                              src={currentStudent.avatar}
                              alt={currentStudent.fullName || 'Student'}
                              width={32}
                              height={32}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#161853] to-[#292C6D] text-white text-sm font-bold">
                              {(currentStudent?.fullName || 'S').charAt(0)}
                            </div>
                          )}
                        </div>
                        <textarea value={newComment} onChange={e=>setNewComment(e.target.value)} placeholder="Write your comment..." className="w-full resize-none bg-transparent text-sm text-gray-800 outline-none" rows={3} />
                      </div>
                      <div className="mt-3 flex justify-end">
                        <button onClick={handleSubmitComment} disabled={!newComment.trim()} className="px-4 py-2 bg-[#161853] text-white rounded-lg">Post</button>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-4 p-4 bg-blue-50 rounded-lg text-center">
                      <p className="text-sm text-gray-700 mb-2">You need to be logged in to comment</p>
                      <button onClick={() => setShowLoginModal(true)} className="px-4 py-2 bg-[#161853] text-white rounded-lg">Login to Comment</button>
                    </div>
                  )}

                  <div className="space-y-3">
                    {comments.map(c => (
                      <div key={c.id} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                              {c.authorAvatar ? (
                                <Image
                                  src={c.authorAvatar}
                                  alt={c.author || 'Student'}
                                  width={32}
                                  height={32}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#161853] to-[#292C6D] text-white text-xs font-bold">
                                  {(c.author||'S').charAt(0)}
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-gray-900">{c.author}</div>
                              <div className="text-sm text-gray-700 mt-1">{c.content}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleCommentReaction(c.id, 'like')} className="text-sm px-2 py-1 bg-white rounded">👍 {c.likes}</button>
                            <button onClick={() => handleCommentReaction(c.id, 'dislike')} className="text-sm px-2 py-1 bg-white rounded">👎 {c.dislikes}</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar - Related Videos */}
          <div className="xl:col-span-1">
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-100/50 sticky top-8 overflow-hidden">
              {/* Transcript Panel */}
              <div className="p-4 border-b border-gray-100">
                <h4 className="text-sm font-bold text-gray-900 mb-2">Transcript Preview</h4>
                {showTranscriptPanel && selectedCueId ? (
                  (() => {
                    const cue = subtitleCues.find(c => c.id === selectedCueId);
                    return (
                      <div className="space-y-3">
                        <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-800">{cue?.text}</div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={async () => {
                              setIsSummarizing(true);
                              // simple summary: first 20 words of selected cue + note
                              await new Promise(r => setTimeout(r, 700));
                              setSummary((cue?.text || '').split(' ').slice(0,20).join(' ') + (cue && cue.text.split(' ').length>20 ? '...' : ''));
                              setIsSummarizing(false);
                            }}
                            className="px-3 py-2 bg-indigo-600 text-white rounded-lg flex items-center gap-2 text-sm"
                          >
                            <Sparkles className="w-4 h-4" />
                            {isSummarizing ? 'Summarizing...' : 'Summarize'}
                          </button>
                          <button onClick={() => { setShowTranscriptPanel(false); setSelectedCueId(null); }} className="px-3 py-2 bg-gray-100 rounded-lg text-sm">Close</button>
                        </div>
                        {summary && <div className="mt-3 p-3 bg-white rounded-lg border text-sm text-gray-700">{summary}</div>}
                      </div>
                    );
                  })()
                ) : (
                  <div className="text-sm text-gray-500">Click a subtitle on the left to preview and summarize.</div>
                )}
              </div>
              <div className="bg-gradient-to-r from-[#161853] to-[#292C6D] p-5">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Play className="w-5 h-5" fill="white" />
                  Related Videos
                </h3>
              </div>
              
              {relatedVideos.length === 0 ? (
                <div className="text-center py-12 px-6">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
                    <Play className="text-purple-500" size={28} />
                  </div>
                  <p className="text-sm text-gray-600 font-semibold">No videos yet</p>
                  <p className="text-xs text-gray-400 mt-1">Check back soon!</p>
                </div>
              ) : (
                <div className="p-4">
                  <div className="space-y-3">
                    {relatedVideos.slice(0, displayedVideos).map((video) => (
                      <div key={video.id} onClick={() => router.push(`/student/video/${video.id}`)} className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                        <div className="w-36 h-20 relative flex-shrink-0 rounded-md overflow-hidden bg-gray-200">
                          <Image src={video.thumbnail || '/logo.png'} alt={video.title} fill className="object-cover" />
                          {video.duration > 0 && (
                            <div className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-2 py-0.5 rounded">{formatTime(video.duration)}</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-gray-900 line-clamp-2">{video.title}</h4>
                          <div className="text-xs text-gray-500 mt-1">{video.teacher.fullName} • {video.totalViews.toLocaleString()} views</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* See More Button */}
                  {relatedVideos.length > displayedVideos && (
                    <button
                      onClick={() => setDisplayedVideos(prev => prev + 5)}
                      className="w-full mt-4 py-3 bg-gradient-to-r from-purple-50 to-blue-50 hover:from-purple-100 hover:to-blue-100 text-purple-700 font-bold text-sm rounded-xl transition-all duration-300 border border-purple-200/50 hover:border-purple-300 hover:shadow-md flex items-center justify-center gap-2 group"
                    >
                      <span>See More Videos</span>
                      <svg className="w-4 h-4 transform group-hover:translate-y-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  )}

                  {/* Show Less Button */}
                  {displayedVideos > 5 && displayedVideos >= relatedVideos.length && (
                    <button
                      onClick={() => setDisplayedVideos(5)}
                      className="w-full mt-3 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-600 font-semibold text-sm rounded-xl transition-all duration-300 border border-gray-200 flex items-center justify-center gap-2 group"
                    >
                      <span>Show Less</span>
                      <svg className="w-4 h-4 transform group-hover:-translate-y-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <LoginModal
        isOpen={showLoginModal}
        closeModal={() => setShowLoginModal(false)}
        openRegisterModal={() => {
          setShowLoginModal(false);
          setShowRegisterModal(true);
        }}
        openForgotPasswordModal={() => {}}
        stayOnCurrentPage
      />

      <RegisterModal
        isOpen={showRegisterModal}
        closeModal={() => setShowRegisterModal(false)}
        openLoginModal={() => {
          setShowRegisterModal(false);
          setShowLoginModal(true);
        }}
        openOTPModal={() => {}}
      />
    </div>
  );
}
