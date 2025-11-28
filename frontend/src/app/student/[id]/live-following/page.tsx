'use client';

import {
  PlayCircleIcon,
  SignalIcon,
  HeartIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  UserPlusIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useFollow } from '@/hooks/useFollow';
import Image from 'next/image';

const PrimaryColor = '161853';
const SecondaryColor = 'EC255A';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface Teacher {
  id: string;
  teacher: {
    id: string;
    fullName: string;
    avatar?: string;
    email: string;
  };
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

function ChannelCard({ channel }: { channel: Teacher }) {
  const [isHovered, setIsHovered] = useState(false);
  const router = useRouter();
  const following = true; // Always true since these are followed teachers

  const handleClick = () => {
    router.push(`/teacher/public/${channel.teacher.id}`);
  };

  return (
    <div
      className={`relative w-full overflow-hidden rounded-xl bg-white shadow-md hover:shadow-lg transition-all duration-300 ease-in-out transform ${isHovered ? 'scale-[1.02]' : ''} border border-gray-200 cursor-pointer`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
    >
      <div className="p-5 flex flex-col items-center">
        <div className="relative mb-4">
          <div className={`h-20 w-20 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden border-4 ${following ? `border-[#${SecondaryColor}]` : 'border-gray-300'} transition-all duration-300`}>
            {channel.teacher.avatar ? (
              <Image
                src={channel.teacher.avatar}
                alt={channel.teacher.fullName}
                width={80}
                height={80}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-2xl text-gray-500">{channel.teacher.fullName.charAt(0)}</span>
            )}
          </div>
          {following && (
            <div className={`absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-[#${SecondaryColor}] flex items-center justify-center border-2 border-white`}>
              <CheckCircleIcon className="h-4 w-4 text-white" />
            </div>
          )}
        </div>

        <h3 className={`text-sm font-semibold text-[#${PrimaryColor}] text-center mb-2 line-clamp-2`}>
          {channel.teacher.fullName}
        </h3>

        <p className="text-xs text-gray-500 mb-3">
          Following since {new Date(channel.followedSince).toLocaleDateString()}
        </p>

        <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${following ? `bg-[#${SecondaryColor}]/10 text-[#${SecondaryColor}]` : `bg-gray-100 text-gray-600`} transition-all duration-300`}>
          {following ? 'Following' : 'Not Following'}
        </div>
      </div>
    </div>
  );
}

function VideoCard({ video }: { video: Livestream | Video }) {
  const [isHovered, setIsHovered] = useState(false);
  const router = useRouter();
  const isLive = 'isLive' in video && video.isLive;

  const handleClick = () => {
    router.push(`/teacher/${video.teacher.id}/profile`);
  };

  const formatViews = (count: number) => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`;
    }
    return count.toString();
  };

  return (
    <div
      className="relative w-full overflow-hidden rounded-xl bg-white shadow-md hover:shadow-lg transition-all duration-300 ease-in-out transform hover:scale-[1.02] cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
    >
      <div className="relative aspect-video bg-gray-200">
        {video.thumbnailUrl ? (
          <Image
            src={video.thumbnailUrl}
            alt={video.title}
            fill
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-400 to-pink-500">
            <PlayCircleIcon className="h-16 w-16 text-white opacity-50" />
          </div>
        )}

        {isLive && (
          <div className="absolute top-2 left-2 flex items-center space-x-1 bg-red-600 text-white px-2 py-1 rounded-md text-xs font-bold">
            <SignalIcon className="h-3 w-3 animate-pulse" />
            <span>LIVE</span>
          </div>
        )}

        {!isLive && 'duration' in video && video.duration && (
          <div className="absolute bottom-2 right-2 bg-black/70 text-white px-2 py-0.5 rounded text-xs">
            {video.duration}
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent text-white">
          <p className="font-semibold text-sm truncate">{video.title}</p>
          <div className="flex items-center text-xs mt-1">
            {video.teacher.avatar ? (
              <Image
                src={video.teacher.avatar}
                alt={video.teacher.fullName}
                width={20}
                height={20}
                className="rounded-full mr-2 border border-white"
              />
            ) : (
              <div className="h-5 w-5 rounded-full bg-[#161853]/70 mr-2 border border-white flex items-center justify-center">
                <span className="text-xs">{video.teacher.fullName.charAt(0)}</span>
              </div>
            )}
            <span className="font-medium">{video.teacher.fullName}</span>
          </div>
        </div>
      </div>

      <div className="p-3 flex justify-between items-center">
        <div className="flex flex-col">
          <span className={`text-xs font-medium text-[#${PrimaryColor}]`}>
            {formatViews(video.viewCount)} views
          </span>
          {!isLive && 'uploadedAt' in video && (
            <span className="text-xs text-gray-500 mt-0.5">
              {new Date(video.uploadedAt).toLocaleDateString()}
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <HeartIcon className={`h-4 w-4 ${isHovered ? `text-[#${SecondaryColor}]` : `text-[#${PrimaryColor}]`} transition-colors duration-300`} />
          <PlayCircleIcon className={`h-4 w-4 ${isHovered ? `text-[#${SecondaryColor}]` : `text-[#${PrimaryColor}]`} transition-colors duration-300`} />
        </div>
      </div>
    </div>
  );
}

export default function LiveFollowingPage() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'live' | 'videos'>('all');
  const [followedChannels, setFollowedChannels] = useState<Teacher[]>([]);
  const [livestreams, setLivestreams] = useState<Livestream[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
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

        // Fetch followed teachers
        const result = await getFollowedTeachers();
        if (result && result.success && result.data) {
          setFollowedChannels(result.data);
        }

        // Fetch livestreams from followed teachers
        const livestreamsRes = await fetch(`${API_URL}/student/followed-livestreams`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (livestreamsRes.ok) {
          const livestreamsData = await livestreamsRes.json();
          setLivestreams(livestreamsData);
        }

        // Fetch videos from followed teachers
        const videosRes = await fetch(`${API_URL}/student/followed-videos`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

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
          </div>
        </motion.div>

        <motion.section variants={fadeInUp} className="mb-12">
          <div className="flex justify-between items-center mb-4">
            <h2 className={`text-xl font-bold text-[#${PrimaryColor}]`}>Following Channels</h2>
            <span className="text-sm text-gray-500">{followedChannels.length} channels</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {followedChannels.map((channel, index) => (
              <motion.div key={channel.id} variants={fadeInUp} transition={{ delay: 0.05 * index }} whileHover={{ y: -5, transition: { duration: 0.3 } }}>
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
                <motion.div key={stream.id} className="flex-shrink-0 w-72 snap-center" variants={fadeInUp} transition={{ delay: 0.1 * index }} whileHover={{ y: -5, transition: { duration: 0.3 } }}>
                  <VideoCard video={stream} />
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
                <motion.div key={video.id} variants={fadeInUp} transition={{ delay: 0.1 * index }} whileHover={{ y: -5, transition: { duration: 0.3 } }}>
                  <VideoCard video={video} />
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
