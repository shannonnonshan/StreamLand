'use client';

import {
  PlayCircleIcon,
  SignalIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  UserPlusIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useFollow } from '@/hooks/useFollow';
import Image from 'next/image';
import { getStudentRoute } from '@/utils/student';

const PrimaryColor = '161853';
const SecondaryColor = 'EC255A';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// ─── Interfaces ────────────────────────────────────────────────────────────────

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
  teacher: { id: string; fullName: string; avatar?: string };
  viewCount: number;
  thumbnailUrl?: string;
  isLive: boolean;
}

interface Video {
  id: string;
  title: string;
  teacher: { id: string; fullName: string; avatar?: string };
  viewCount: number;
  thumbnailUrl?: string;
  duration?: string;
  uploadedAt: string;
}

// Shape trả về từ GET /student/watch-history
interface WatchHistoryItem {
  id: string;
  title: string;
  thumbnailUrl?: string;
  duration?: number;
  totalViews: number;
  category?: string;
  endedAt?: string;
  teacher: { id: string; fullName: string; avatar?: string };
  watchedAt: string;
  lastPosition: number;
  progress: number;   // 0–100
  completed: boolean;
}

// ─── HistoryCard ────────────────────────────────────────────────────────────────
// Card riêng cho history: hiển thị progress bar + thời gian xem

function HistoryCard({ item, index = 0 }: { item: WatchHistoryItem; index?: number }) {
  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState(false);
  const router = useRouter();
  const progressRatio = Math.min(1, Math.max(0, item.progress / 100));

  const formatDuration = (seconds?: number) => {
    if (!seconds) return null;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const formatWatchedAt = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays === 0) return 'Hôm nay';
    if (diffDays === 1) return 'Hôm qua';
    if (diffDays < 7) return `${diffDays} ngày trước`;
    return d.toLocaleDateString('vi-VN');
  };

  const handleClick = () => {
    // Truyền lastPosition qua query param để video player resume đúng chỗ
    const url = getStudentRoute(`video/${item.id}`);
    router.push(`${url}?t=${Math.floor(item.lastPosition)}`);
  };

  return (
    <div
      className={`w-full h-full bg-white rounded-xl overflow-hidden ${
        isHovered ? 'shadow-md' : 'shadow-sm'
      } transition-all duration-300 border border-gray-200 ${
        isHovered ? `border-[#${PrimaryColor}] border-opacity-40` : ''
      } cursor-pointer`}
      onMouseEnter={() => {
        setIsHovered(true);
        router.prefetch(getStudentRoute(`video/${item.id}`));
      }}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
    >
      {/* Thumbnail */}
      <div className="h-40 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center overflow-hidden relative">
        {item.thumbnailUrl && !imageError ? (
          <Image
            src={item.thumbnailUrl}
            alt={item.title}
            fill
            priority={index < 4}
            loading={index < 4 ? 'eager' : 'lazy'}
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center">
            <PlayCircleIcon
              className={`h-12 w-12 transition-all duration-300 ${
                isHovered ? `text-[#${PrimaryColor}] scale-125 transform rotate-12` : 'text-gray-400'
              }`}
            />
          </div>
        )}

        {/* Duration badge */}
        {item.duration && (
          <div className="absolute bottom-2 right-2 bg-black/70 text-white px-2 py-0.5 rounded text-xs">
            {formatDuration(item.duration)}
          </div>
        )}

        {/* Completed badge */}
        {item.completed && (
          <div className="absolute top-2 left-2 bg-green-600/90 text-white px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1">
            <CheckCircleIcon className="h-3 w-3" />
            Đã xem xong
          </div>
        )}

        {/* Progress bar */}
        {progressRatio > 0 && !item.completed && (
          <div className="absolute left-0 right-0 bottom-0 h-[3px] bg-black/25">
            <div
              className="h-full bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.65)]"
              style={{ width: `${(progressRatio * 100).toFixed(1)}%` }}
            />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-1 min-h-[5rem]">
        <p className={`text-sm font-semibold text-[#${PrimaryColor}] line-clamp-2`}>
          {item.title}
        </p>

        {/* Teacher */}
        <div className="flex items-center text-xs text-gray-600 min-w-0">
          {item.teacher.avatar ? (
            <Image
              src={item.teacher.avatar}
              alt={item.teacher.fullName}
              width={16}
              height={16}
              className="rounded-full mr-1.5 border border-gray-200 object-cover shrink-0"
            />
          ) : (
            <div className="h-4 w-4 rounded-full bg-[#161853]/10 mr-1.5 flex items-center justify-center shrink-0">
              <span className="text-[10px] text-[#161853]">{item.teacher.fullName.charAt(0)}</span>
            </div>
          )}
          <span className="font-medium truncate">{item.teacher.fullName}</span>
        </div>

        {/* Meta row */}
        <div className="flex items-center justify-between text-xs text-gray-500 mt-auto pt-1">
          <span className="flex items-center gap-1">
            <ClockIcon className="h-3 w-3" />
            {formatWatchedAt(item.watchedAt)}
          </span>
          {!item.completed && progressRatio > 0 && (
            <span className={`text-[#${SecondaryColor}] font-medium`}>
              {Math.round(item.progress)}% đã xem
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── VideoCard (giữ nguyên, dùng cho All / Live / Videos tab) ──────────────────

function VideoCard({ video, index = 0 }: { video: Livestream | Video; index?: number }) {
  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState(false);
  const router = useRouter();
  const isLive = 'isLive' in video && video.isLive;

  const handleClick = () => {
    if (isLive) {
      router.push(`/student/livestream/${video.id}`);
    } else {
      router.push(getStudentRoute(`video/${video.id}`));
    }
  };

  const formatViews = (count: number) =>
    count >= 1000 ? `${(count / 1000).toFixed(1)}k` : count.toString();

  return (
    <div
      className={`w-full h-full bg-white rounded-xl overflow-hidden ${
        isHovered ? 'shadow-md' : 'shadow-sm'
      } transition-all duration-300 border border-gray-200 ${
        isHovered ? `border-[#${PrimaryColor}] border-opacity-40` : ''
      } cursor-pointer`}
      onMouseEnter={() => {
        setIsHovered(true);
        if (isLive) router.prefetch(`/student/livestream/${video.id}`);
        else router.prefetch(getStudentRoute(`video/${video.id}`));
      }}
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
            <PlayCircleIcon
              className={`h-12 w-12 transition-all duration-300 ${
                isHovered ? `text-[#${PrimaryColor}] scale-125 transform rotate-12` : 'text-gray-400'
              }`}
            />
            <span className="text-xs text-gray-400 mt-2">No Thumbnail</span>
          </div>
        )}

        {isLive && (
          <div className="absolute top-3 left-3 flex items-center space-x-1 p-1 rounded-md text-xs font-bold text-white bg-[#EC255A]">
            <SignalIcon className="h-3 w-3 animate-pulse" />
            <span>LIVE</span>
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
          <p className={`text-sm font-semibold text-[#${PrimaryColor}] line-clamp-2`}>
            {video.title}
          </p>
          <div className="flex items-center text-xs mt-1 text-gray-600 min-w-0">
            {video.teacher.avatar ? (
              <Image
                src={video.teacher.avatar}
                alt={video.teacher.fullName}
                width={20}
                height={20}
                className="rounded-full mr-2 border border-gray-200 object-cover shrink-0"
              />
            ) : (
              <div className="h-5 w-5 rounded-full bg-[#161853]/10 mr-2 border border-gray-200 flex items-center justify-center shrink-0">
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
              <span className="text-xs text-gray-500">
                • {new Date(video.uploadedAt).toLocaleDateString()}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ChannelCard ────────────────────────────────────────────────────────────────

function ChannelCard({ channel }: { channel: Teacher }) {
  const [isHovered, setIsHovered] = useState(false);
  const router = useRouter();

  return (
    <div
      className={`relative h-full w-full overflow-hidden rounded-xl bg-white shadow-md hover:shadow-lg transition-all duration-300 ease-in-out transform ${
        isHovered ? 'scale-[1.02]' : ''
      } border border-gray-200 cursor-pointer flex flex-col`}
      onMouseEnter={() => {
        setIsHovered(true);
        router.prefetch(`/teacher/public/${channel.id}`);
      }}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => router.push(`/teacher/public/${channel.id}`)}
    >
      <div className="p-6 flex flex-col items-center justify-between flex-1">
        <div className="relative mb-4">
          <div
            className={`h-24 w-24 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden border-4 border-[#${SecondaryColor}] transition-all duration-300`}
          >
            {channel.avatar ? (
              <Image
                src={channel.avatar}
                alt={channel.name || 'Teacher'}
                width={96}
                height={96}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-3xl text-gray-500 font-semibold">
                {(channel.name || 'T').charAt(0)}
              </span>
            )}
          </div>
          <div
            className={`absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-[#${SecondaryColor}] flex items-center justify-center border-2 border-white`}
          >
            <CheckCircleIcon className="h-5 w-5 text-white" />
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center w-full">
          <h3
            className={`text-sm font-semibold text-[#${PrimaryColor}] text-center mb-2 line-clamp-2 min-h-[2.5rem] px-2`}
          >
            {channel.name || 'Unknown Teacher'}
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Following since {new Date(channel.followedSince).toLocaleDateString()}
          </p>
        </div>
        <div className={`px-4 py-2 rounded-full text-xs font-medium bg-[#${SecondaryColor}]/10 text-[#${SecondaryColor}]`}>
          Following
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function LiveFollowingPage() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'live' | 'videos' | 'history'>('all');

  const [followedChannels, setFollowedChannels] = useState<Teacher[]>([]);
  const [livestreams, setLivestreams] = useState<Livestream[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);

  // History state
  const [watchHistory, setWatchHistory] = useState<WatchHistoryItem[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyFetched, setHistoryFetched] = useState(false); // lazy fetch — chỉ gọi khi click tab

  const [loading, setLoading] = useState(true);
  const { getFollowedTeachers } = useFollow();
  const livestreamContainerRef = useRef<HTMLDivElement>(null);

  // ── Fetch followed channels + livestreams + videos (mount) ──────────────────
  useEffect(() => {
    setIsLoaded(true);

    const fetchData = async () => {
      try {
        setLoading(true);
        const accessToken = localStorage.getItem('accessToken');
        if (!accessToken) { setLoading(false); return; }

        const headers = { Authorization: `Bearer ${accessToken}` };

        const [teachersResult, livestreamsRes, videosRes] = await Promise.all([
          getFollowedTeachers(),
          fetch(`${API_URL}/student/followed-livestreams`, { headers }),
          fetch(`${API_URL}/student/followed-videos`, { headers }),
        ]);

        if (teachersResult?.success && teachersResult.data) {
          setFollowedChannels(teachersResult.data);
        }
        if (livestreamsRes.ok) setLivestreams(await livestreamsRes.json());
        if (videosRes.ok) setVideos(await videosRes.json());
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fetch watch history từ API (lazy — chỉ khi tab History được chọn) ──────
  const fetchWatchHistory = useCallback(async () => {
    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) {
      setHistoryError('You need to sign in to view history');
      return;
    }

    try {
      setHistoryLoading(true);
      setHistoryError(null);

      const res = await fetch(`${API_URL}/student/watch-history?limit=24`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json() as { items: WatchHistoryItem[]; total: number };
      setWatchHistory(data.items);
      setHistoryTotal(data.total);
      setHistoryFetched(true);
    } catch (err) {
      console.error('Error fetching watch history:', err);
      setHistoryError('Cannot load watch history. Please try again later.');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  // Trigger fetch khi user chuyển sang tab history lần đầu
  useEffect(() => {
    if (activeTab === 'history' && !historyFetched) {
      fetchWatchHistory();
    }
  }, [activeTab, historyFetched, fetchWatchHistory]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  const scrollLeft = (ref: React.RefObject<HTMLDivElement | null>) =>
    ref.current?.scrollBy({ left: -300, behavior: 'smooth' });

  const scrollRight = (ref: React.RefObject<HTMLDivElement | null>) =>
    ref.current?.scrollBy({ left: 300, behavior: 'smooth' });

  const filteredLivestreams = activeTab === 'all' || activeTab === 'live' ? livestreams : [];
  const filteredVideos     = activeTab === 'all' || activeTab === 'videos' ? videos : [];

  // ── Loading spinner ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#161853]" />
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <motion.div
      initial="hidden"
      animate={isLoaded ? 'visible' : 'hidden'}
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
    >
      <div className="w-full">
        {/* Header */}
        <motion.div variants={fadeInUp} className="mb-8 mt-4">
          <h1 className={`text-3xl font-extrabold text-[#${PrimaryColor}] mb-2`}>
            Following Channels
          </h1>
          <p className="text-gray-600">
            Watch latest content from {followedChannels.length} channels you follow
          </p>
        </motion.div>

        {/* Tabs */}
        <motion.div variants={fadeInUp} className="mb-8">
          <div className="flex space-x-2 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-6 py-3 text-sm font-medium transition-all duration-300 border-b-2 ${
                activeTab === 'all'
                  ? `text-[#${PrimaryColor}] border-[#${PrimaryColor}]`
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              All ({followedChannels.length})
            </button>

            <button
              onClick={() => setActiveTab('live')}
              className={`px-6 py-3 text-sm font-medium transition-all duration-300 border-b-2 ${
                activeTab === 'live'
                  ? `text-[#${SecondaryColor}] border-[#${SecondaryColor}]`
                  : 'text-gray-500 border-transparent hover:text-gray-700'
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
                activeTab === 'videos'
                  ? `text-[#${PrimaryColor}] border-[#${PrimaryColor}]`
                  : 'text-gray-500 border-transparent hover:text-gray-700'
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
                activeTab === 'history'
                  ? `text-[#${SecondaryColor}] border-[#${SecondaryColor}]`
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              <span className="flex items-center gap-2">
                <ClockIcon className="h-4 w-4" />
                History
                {historyFetched && historyTotal > 0 && (
                  <span className="ml-1">({historyTotal})</span>
                )}
              </span>
            </button>
          </div>
        </motion.div>

        {/* Following Channels grid — ẩn khi đang ở tab History */}
        {activeTab !== 'history' && (
          <motion.section variants={fadeInUp} className="mb-12">
            <div className="flex justify-between items-center mb-4">
              <h2 className={`text-xl font-bold text-[#${PrimaryColor}]`}>Following Channels</h2>
              <span className="text-sm text-gray-500">{followedChannels.length} channels</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {followedChannels.map((channel, i) => (
                <motion.div
                  key={channel.id}
                  className="h-full"
                  variants={fadeInUp}
                  transition={{ delay: 0.05 * (i < 8 ? i : 8) }}
                  whileHover={{ y: -5, transition: { duration: 0.3 } }}
                >
                  <ChannelCard channel={channel} />
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}

        {/* LIVESTREAMS */}
        {filteredLivestreams.length > 0 && (
          <motion.section key={`live-${activeTab}`} variants={fadeInUp} className="mb-12">
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
            <div
              ref={livestreamContainerRef}
              className="flex flex-row space-x-4 overflow-x-auto pb-4 snap-x snap-mandatory scroll-smooth scrollbar-none"
            >
              {filteredLivestreams.map((stream, i) => (
                <motion.div
                  key={stream.id}
                  className="shrink-0 w-72 h-full snap-center"
                  variants={fadeInUp}
                  transition={{ delay: 0.05 * (i < 8 ? i : 8) }}
                  whileHover={{ y: -5, transition: { duration: 0.3 } }}
                >
                  <VideoCard video={stream} index={i} />
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}

        {/* VIDEOS */}
        {filteredVideos.length > 0 && (
          <motion.section key={`videos-${activeTab}`} variants={fadeInUp} className="mb-12">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center">
                <h2 className={`text-xl font-bold text-[#${PrimaryColor}] mr-3`}>Recent Videos</h2>
                <span className="text-sm text-gray-500">{filteredVideos.length} videos</span>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 md:gap-6">
              {filteredVideos.map((video, i) => (
                <motion.div
                  key={video.id}
                  className="h-full"
                  variants={fadeInUp}
                  transition={{ delay: 0.05 * (i < 8 ? i : 8) }}
                  whileHover={{ y: -5, transition: { duration: 0.3 } }}
                >
                  <VideoCard video={video} index={i} />
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}

        {/* ── HISTORY TAB ─────────────────────────────────────────────────── */}
        {activeTab === 'history' && (
          <motion.section key="history-section" variants={fadeInUp} className="mb-12">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <h2 className={`text-xl font-bold text-[#${SecondaryColor}] flex items-center gap-2`}>
                  <ClockIcon className="h-5 w-5" />
                  Watch History
                </h2>
                {historyFetched && (
                  <span className="text-sm text-gray-500">{historyTotal} video</span>
                )}
              </div>

              {/* Refresh button */}
              {historyFetched && (
                <button
                  onClick={() => {
                    setHistoryFetched(false);
                    fetchWatchHistory();
                  }}
                  className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors"
                >
                  Refresh
                </button>
              )}
            </div>

            {/* Loading */}
            {historyLoading && (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#161853]" />
              </div>
            )}

            {/* Error */}
            {historyError && !historyLoading && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <ExclamationCircleIcon className="h-10 w-10 text-red-400" />
                <p className="text-gray-500 text-sm">{historyError}</p>
                <button
                  onClick={fetchWatchHistory}
                  className={`px-4 py-2 rounded-lg text-sm font-medium bg-[#${PrimaryColor}] text-white hover:opacity-90 transition-opacity`}
                >
                  Thử lại
                </button>
              </div>
            )}

            {/* Empty */}
            {!historyLoading && !historyError && historyFetched && watchHistory.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 px-4">
                <div className={`h-20 w-20 rounded-full bg-[#${PrimaryColor}]/10 flex items-center justify-center mb-4`}>
                  <ClockIcon className={`h-10 w-10 text-[#${PrimaryColor}]`} />
                </div>
                <h3 className={`text-lg font-semibold text-[#${PrimaryColor}] mb-2`}>
                  Empty
                </h3>
                <p className="text-gray-500 text-center text-sm max-w-sm">
                  Start watching videos and your history will appear here.
                </p>
              </div>
            )}

            {/* Grid */}
            {!historyLoading && !historyError && watchHistory.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 md:gap-6">
                {watchHistory.map((item, i) => (
                  <motion.div
                    key={`history-${item.id}`}
                    className="h-full"
                    variants={fadeInUp}
                    transition={{ delay: 0.04 * (i < 8 ? i : 8) }}
                    whileHover={{ y: -5, transition: { duration: 0.3 } }}
                  >
                    <HistoryCard item={item} index={i} />
                  </motion.div>
                ))}
              </div>
            )}
          </motion.section>
        )}

        {/* EMPTY STATE — chỉ hiện khi không phải tab history */}
        {activeTab !== 'history' &&
          filteredLivestreams.length === 0 &&
          filteredVideos.length === 0 && (
            <motion.div
              variants={fadeInUp}
              className="flex flex-col items-center justify-center py-20 px-4"
            >
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
