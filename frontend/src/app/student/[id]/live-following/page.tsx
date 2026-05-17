'use client';

import {
  PlayCircleIcon,
  SignalIcon,
  HeartIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  UserPlusIcon,
  CheckCircleIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useFollow } from '@/hooks/useFollow';
import Image from 'next/image';
import { getStudentRoute } from '@/utils/student';

const PrimaryColor = '161853';
const SecondaryColor = 'EC255A';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface Teacher {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  bio?: string;
  isVerified?: boolean;
  subjects?: string[];
  subscribers?: number;
  totalVideos?: number;
  followedSince: string;
}

interface Livestream {
  id: string;
  title: string;
  teacher: {
    id: string;
    fullName: string;
    avatar?: string;
  };
  viewCount: number;
  thumbnailUrl?: string;
  isLive: boolean;
}

interface Video {
  id: string;
  title: string;
  teacher: {
    id: string;
    fullName: string;
    avatar?: string;
  };
  viewCount: number;
  thumbnailUrl?: string;
  duration?: string;
  uploadedAt: string;
}

interface RecentHistoryVideo extends Video {
  lastPosition: number;
  progress: number;
  watchedAt: string;
}

interface VideoProgressSnapshot {
  videoId: string;
  userId: string;
  currentTime: number;
  duration: number;
  updatedAt: number;
}

interface WatchHistoryItem {
  id: string;
  livestreamId: string;
  title: string;
  thumbnailUrl?: string;
  watchedAt: string;
  duration: number;
  lastPosition: number;
  progress: number;
  teacher: {
    id: string;
    fullName: string;
    avatar?: string;
  };
}

const getProgressStorageKey = (videoId: string, userId: string) =>
  `streamland:video-progress:${userId}:${videoId}`;

const getViewerIdForStorage = () => {
  if (typeof window === 'undefined') return 'anon';

  try {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsed = JSON.parse(storedUser) as { id?: string; userId?: string; email?: string };
      return parsed.id || parsed.userId || parsed.email || 'anon';
    }
  } catch {
    // ignore invalid storage payloads
  }

  return 'anon';
};

const readVideoProgress = (videoId: string): VideoProgressSnapshot | null => {
  if (typeof window === 'undefined') return null;

  const viewerId = getViewerIdForStorage();
  const key = getProgressStorageKey(videoId, viewerId);

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as VideoProgressSnapshot;
    if (!parsed || typeof parsed.currentTime !== 'number' || typeof parsed.duration !== 'number') {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};

const getProgressRatio = (videoId: string, duration?: number) => {
  const snapshot = readVideoProgress(videoId);
  if (!snapshot) return 0;

  const effectiveDuration = snapshot.duration || duration || 0;
  if (!effectiveDuration || effectiveDuration <= 0) return 0;

  return Math.max(0, Math.min(1, snapshot.currentTime / effectiveDuration));
};

function ChannelCard({ channel }: { channel: Teacher }) {
  const [isHovered, setIsHovered] = useState(false);
  const router = useRouter();
  const following = true; // Always true since these are followed teachers

  const handleClick = () => {
    router.push(`/teacher/public/${channel.id}`);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    // Prefetch the route on hover for instant navigation
    router.prefetch(`/teacher/public/${channel.id}`);
  };

  return (
    <div
      className={`relative h-full w-full overflow-hidden rounded-xl bg-white shadow-md hover:shadow-lg transition-all duration-300 ease-in-out transform ${isHovered ? 'scale-[1.02]' : ''} border border-gray-200 cursor-pointer flex flex-col`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
    >
      <div className="p-6 flex flex-col items-center justify-between flex-1">
        <div className="relative mb-4">
          <div className={`h-24 w-24 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden border-4 ${following ? `border-[#${SecondaryColor}]` : 'border-gray-300'} transition-all duration-300`}>
            {channel.avatar ? (
              <Image
                src={channel.avatar}
                alt={channel.name || 'Teacher'}
                width={96}
                height={96}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-3xl text-gray-500 font-semibold">{(channel.name || 'T').charAt(0)}</span>
            )}
          </div>
          {following && (
            <div className={`absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-[#${SecondaryColor}] flex items-center justify-center border-2 border-white`}>
              <CheckCircleIcon className="h-5 w-5 text-white" />
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col items-center justify-center w-full">
          <h3 className={`text-sm font-semibold text-[#${PrimaryColor}] text-center mb-2 line-clamp-2 min-h-[2.5rem] px-2`}>
            {channel.name || 'Unknown Teacher'}
          </h3>

          <p className="text-xs text-gray-500 mb-3">
            Following since {new Date(channel.followedSince).toLocaleDateString()}
          </p>
        </div>

        <div className={`px-4 py-2 rounded-full text-xs font-medium ${following ? `bg-[#${SecondaryColor}]/10 text-[#${SecondaryColor}]` : `bg-gray-100 text-gray-600`} transition-all duration-300`}>
          {following ? 'Following' : 'Not Following'}
        </div>
      </div>
    </div>
  );
}

function VideoCard({ video, index = 0 }: { video: Livestream | Video; index?: number }) {
  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState(false);
  const router = useRouter();
  const isLive = 'isLive' in video && video.isLive;
  const progressRatio = !isLive ? getProgressRatio(video.id) : 0;

  const handleClick = () => {
    if (isLive) {
      router.push(`/student/livestream/${video.id}`);
    } else {
      router.push(getStudentRoute(`video/${video.id}`));
    }
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    // Prefetch the route on hover for instant navigation
    if (isLive) {
      router.prefetch(`/student/livestream/${video.id}`);
    } else {
      router.prefetch(getStudentRoute(`video/${video.id}`));
    }
  };

  const formatViews = (count: number) => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`;
    }
    return count.toString();
  };

  return (
    <div
      className={`w-full h-full bg-white rounded-xl overflow-hidden ${isHovered ? 'shadow-md' : 'shadow-sm'} transition-all duration-300 border border-gray-200 ${isHovered ? `border-[#${PrimaryColor}] border-opacity-40` : ''} cursor-pointer`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
    >
      <div className="h-40 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center overflow-hidden relative">
        {video.thumbnailUrl && !imageError ? (
          <Image
            src={video.thumbnailUrl}
            alt={video.title}
            fill
            priority={index < 4}
            loading={index < 4 ? 'eager' : 'lazy'}
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center">
            <PlayCircleIcon className={`h-12 w-12 transition-all duration-300 ${isHovered ? `text-[#${PrimaryColor}] scale-125 transform rotate-12` : 'text-gray-400'}`} />
            <span className="text-xs text-gray-400 mt-2">No Thumbnail</span>
          </div>
        )}

        {isLive && (
          <div className="absolute top-3 left-3 flex items-center space-x-1 p-1 rounded-md text-xs font-bold text-white bg-[#EC255A]">
            <SignalIcon className="h-3 w-3 animate-pulse" />
            <span>LIVE</span>
          </div>
        )}

        {!isLive && progressRatio > 0 && (
          <div className="absolute left-0 right-0 bottom-0 h-[3px] bg-black/25">
            <div
              className="h-full bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.65)]"
              style={{ width: `${(progressRatio * 100).toFixed(2)}%` }}
            />
          </div>
        )}

        {!isLive && 'duration' in video && video.duration && (
          <div className="absolute bottom-2 right-2 bg-black/70 text-white px-2 py-0.5 rounded text-xs">
            {video.duration}
          </div>
        )}
      </div>

      <div className="p-3 flex justify-between items-center min-h-[4rem]">
        <div className="flex flex-col flex-1 min-w-0">
          <p className={`text-sm font-semibold text-[#${PrimaryColor}] transition-colors duration-300 line-clamp-2`}>
            {video.title}
          </p>
          <div className="flex items-center text-xs mt-1 text-gray-600 min-w-0">
            {video.teacher.avatar ? (
              <Image
                src={video.teacher.avatar}
                alt={video.teacher.fullName}
                width={20}
                height={20}
                className="rounded-full mr-2 border border-gray-200 object-cover flex-shrink-0"
              />
            ) : (
              <div className="h-5 w-5 rounded-full bg-[#161853]/10 mr-2 border border-gray-200 flex items-center justify-center flex-shrink-0">
                <span className="text-xs text-[#161853]">{video.teacher.fullName.charAt(0)}</span>
              </div>
            )}
            <span className="font-medium truncate">{video.teacher.fullName}</span>
          </div>
          <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mt-1">
            <span className={`text-xs font-medium text-[#${PrimaryColor}]`}>
              {formatViews(video.viewCount)} views
            </span>
            {isLive ? (
              <span className="text-xs text-gray-500">• live now</span>
            ) : 'uploadedAt' in video ? (
              <span className="text-xs text-gray-500">• {new Date(video.uploadedAt).toLocaleDateString()}</span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LiveFollowingPage() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'live' | 'videos' | 'history'>('all');
  const [followedChannels, setFollowedChannels] = useState<Teacher[]>([]);
  const [livestreams, setLivestreams] = useState<Livestream[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [recentHistory, setRecentHistory] = useState<RecentHistoryVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const { getFollowedTeachers } = useFollow();

  const livestreamContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsLoaded(true);

    const fetchData = async () => {
      try {
        setLoading(true);
        const accessToken = localStorage.getItem('accessToken');

        if (!accessToken) {
          setLoading(false);
          return;
        }

        const headers = {
          Authorization: `Bearer ${accessToken}`,
        };

        // Fetch all data in parallel for faster loading
        const [teachersResult, livestreamsRes, videosRes] = await Promise.all([
          getFollowedTeachers(),
          fetch(`${API_URL}/student/followed-livestreams`, { headers }),
          fetch(`${API_URL}/student/followed-videos`, { headers }),
        ]);

        // Process results
        if (teachersResult && teachersResult.success && teachersResult.data) {
          setFollowedChannels(teachersResult.data);
        }

        if (livestreamsRes.ok) {
          const livestreamsData = await livestreamsRes.json();
          setLivestreams(livestreamsData);
        }

        if (videosRes.ok) {
          const videosData = await videosRes.json();
          setVideos(videosData);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // We intentionally run this effect once on mount to fetch initial data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const loadHistory = () => {
      const viewerId = getViewerIdForStorage();
      const keys = Object.keys(localStorage).filter((key) => key.startsWith(`streamland:video-progress:${viewerId}:`));

      const snapshots = keys
        .map((key) => {
          try {
            const raw = localStorage.getItem(key);
            if (!raw) return null;
            const parsed = JSON.parse(raw) as VideoProgressSnapshot;
            if (!parsed || typeof parsed.videoId !== 'string' || typeof parsed.currentTime !== 'number') return null;
            return parsed;
          } catch {
            return null;
          }
        })
        .filter((item): item is VideoProgressSnapshot => !!item)
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

      const historyItems: RecentHistoryVideo[] = snapshots
        .map((snapshot) => {
          const matchedVideo = videos.find((video) => video.id === snapshot.videoId);
          if (!matchedVideo) return null;

          return {
            ...matchedVideo,
            lastPosition: snapshot.currentTime,
            progress: snapshot.duration > 0 ? Math.min(100, (snapshot.currentTime / snapshot.duration) * 100) : 0,
            watchedAt: new Date(snapshot.updatedAt).toISOString(),
          };
        })
        .filter((item): item is RecentHistoryVideo => !!item)
        .slice(0, 12);

      setRecentHistory(historyItems);
    };

    loadHistory();
    window.addEventListener('storage', loadHistory);
    return () => window.removeEventListener('storage', loadHistory);
  }, [videos]);

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  const scrollLeft = (ref: React.RefObject<HTMLDivElement | null>) => {
    if (ref.current) {
      ref.current.scrollBy({ left: -300, behavior: 'smooth' });
    }
  };

  const scrollRight = (ref: React.RefObject<HTMLDivElement | null>) => {
    if (ref.current) {
      ref.current.scrollBy({ left: 300, behavior: 'smooth' });
    }
  };

  // FIXED: explicit checks so 'all' shows both lists
  const filteredLivestreams = activeTab === 'all' || activeTab === 'live' ? livestreams : [];
  const filteredVideos = activeTab === 'all' || activeTab === 'videos' ? videos : [];
  const filteredHistory = activeTab === 'history' ? recentHistory : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#161853]"></div>
      </div>
    );
  }

  return (
    <motion.div initial="hidden" animate={isLoaded ? 'visible' : 'hidden'} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="w-full">
        <motion.div variants={fadeInUp} className="mb-8 mt-4">
          <h1 className={`text-3xl font-extrabold text-[#${PrimaryColor}] mb-2`}>Following Channels</h1>
          <p className="text-gray-600">Watch latest content from {followedChannels.length} channels you follow</p>
        </motion.div>

        <motion.div variants={fadeInUp} className="mb-8">
          <div className="flex space-x-2 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-6 py-3 text-sm font-medium transition-all duration-300 border-b-2 ${
                activeTab === 'all' ? `text-[#${PrimaryColor}] border-[#${PrimaryColor}]` : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              All ({followedChannels.length})
            </button>
            <button
              onClick={() => setActiveTab('live')}
              className={`px-6 py-3 text-sm font-medium transition-all duration-300 border-b-2 ${
                activeTab === 'live' ? `text-[#${SecondaryColor}] border-[#${SecondaryColor}]` : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              <span className="flex items-center gap-2">
                <SignalIcon className="h-4 w-4" />
                Live Now ({livestreams.length})
              </span>
            </button>
            <button
              onClick={() => setActiveTab('videos')}
              className={`px-6 py-3 text-sm font-medium transition-all duration-300 border-b-2 ${
                activeTab === 'videos' ? `text-[#${PrimaryColor}] border-[#${PrimaryColor}]` : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              <span className="flex items-center gap-2">
                <PlayCircleIcon className="h-4 w-4" />
                Videos ({videos.length})
              </span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-6 py-3 text-sm font-medium transition-all duration-300 border-b-2 ${
                activeTab === 'history' ? `text-[#${SecondaryColor}] border-[#${SecondaryColor}]` : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              <span className="flex items-center gap-2">
                <ClockIcon className="h-4 w-4" />
                History ({recentHistory.length})
              </span>
            </button>
          </div>
        </motion.div>

        <motion.section variants={fadeInUp} className="mb-12">
          <div className="flex justify-between items-center mb-4">
            <h2 className={`text-xl font-bold text-[#${PrimaryColor}]`}>Following Channels</h2>
            <span className="text-sm text-gray-500">{followedChannels.length} channels</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {followedChannels.map((channel, index) => (
              <motion.div 
                key={channel.id} 
                className="h-full"
                variants={fadeInUp} 
                transition={{ delay: 0.05 * (index < 8 ? index : 8) }} 
                whileHover={{ y: -5, transition: { duration: 0.3 } }}
              >
                <ChannelCard channel={channel} />
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* LIVESTREAMS */}
        {filteredLivestreams.length > 0 && (
          // Add key so section remounts if activeTab changes (safeguard if child components cache)
          <motion.section key={`live-section-${activeTab}`} variants={fadeInUp} className="mb-12">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center">
                <h2 className={`text-xl font-bold text-[#${SecondaryColor}] mr-3 flex items-center gap-2`}>
                  <SignalIcon className="h-6 w-6" />
                  Live Now
                </h2>
                <span className="text-sm text-gray-500">{filteredLivestreams.length} livestreams</span>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => scrollLeft(livestreamContainerRef)}
                  className="p-2 rounded-full bg-white border border-gray-200 shadow-sm hover:bg-[#161853]/5 hover:border-[#161853]/30 transition-all duration-200"
                  aria-label="Scroll left"
                >
                  <ChevronLeftIcon className="h-5 w-5 text-[#161853]" />
                </button>
                <button
                  onClick={() => scrollRight(livestreamContainerRef)}
                  className="p-2 rounded-full bg-white border border-gray-200 shadow-sm hover:bg-[#161853]/5 hover:border-[#161853]/30 transition-all duration-200"
                  aria-label="Scroll right"
                >
                  <ChevronRightIcon className="h-5 w-5 text-[#161853]" />
                </button>
              </div>
            </div>

            <div ref={livestreamContainerRef} className="flex flex-row space-x-4 overflow-x-auto pb-4 snap-x snap-mandatory scroll-smooth scrollbar-none">
              {filteredLivestreams.map((stream, index) => (
                <motion.div 
                  key={stream.id} 
                  className="flex-shrink-0 w-72 h-full snap-center" 
                  variants={fadeInUp} 
                  transition={{ delay: 0.05 * (index < 8 ? index : 8) }} 
                  whileHover={{ y: -5, transition: { duration: 0.3 } }}
                >
                  <VideoCard video={stream} index={index} />
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}

        {/* VIDEOS */}
        {filteredVideos.length > 0 && (
          <motion.section key={`videos-section-${activeTab}`} variants={fadeInUp} className="mb-12">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center">
                <h2 className={`text-xl font-bold text-[#${PrimaryColor}] mr-3`}>Recent Videos</h2>
                <span className="text-sm text-gray-500">{filteredVideos.length} videos</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 md:gap-6">
              {filteredVideos.map((video, index) => (
                <motion.div 
                  key={video.id} 
                  className="h-full"
                  variants={fadeInUp} 
                  transition={{ delay: 0.05 * (index < 8 ? index : 8) }} 
                  whileHover={{ y: -5, transition: { duration: 0.3 } }}
                >
                  <VideoCard video={video} index={index} />
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}

        {/* HISTORY */}
        {filteredHistory.length > 0 && (
          <motion.section key={`history-section-${activeTab}`} variants={fadeInUp} className="mb-12">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center">
                <h2 className={`text-xl font-bold text-[#${SecondaryColor}] mr-3 flex items-center gap-2`}>
                  <ClockIcon className="h-5 w-5" />
                  Recently Watched
                </h2>
                <span className="text-sm text-gray-500">{filteredHistory.length} videos</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 md:gap-6">
              {filteredHistory.map((video, index) => (
                <motion.div
                  key={`history-${video.id}`}
                  className="h-full"
                  variants={fadeInUp}
                  transition={{ delay: 0.05 * (index < 8 ? index : 8) }}
                  whileHover={{ y: -5, transition: { duration: 0.3 } }}
                >
                  <VideoCard video={video} index={index} />
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}

        {/* EMPTY STATE */}
        {filteredLivestreams.length === 0 && filteredVideos.length === 0 && (
          <motion.div variants={fadeInUp} className="flex flex-col items-center justify-center py-20 px-4">
            <div className={`h-24 w-24 rounded-full bg-[#${PrimaryColor}]/10 flex items-center justify-center mb-6`}>
              <UserPlusIcon className={`h-12 w-12 text-[#${PrimaryColor}]`} />
            </div>
            <h3 className={`text-xl font-semibold text-[#${PrimaryColor}] mb-2`}>
              {activeTab === 'live' ? 'No livestreams available' : 'No videos available'}
            </h3>
            <p className="text-gray-500 text-center max-w-md">
              {activeTab === 'live'
                ? 'Channels you follow are not live at the moment. Check back later!'
                : 'Channels you follow have not posted new videos. Explore more channels!'}
            </p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
