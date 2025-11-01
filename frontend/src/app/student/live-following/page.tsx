'use client';

import { PlayCircleIcon, SignalIcon, HeartIcon, ChevronLeftIcon, ChevronRightIcon, UserPlusIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

const PrimaryColor = '161853';
const SecondaryColor = 'EC255A';

const followedChannels = [
  { id: 1, name: 'Mr. David Nguyen', avatar: '/avatars/teacher-1.png', followers: '12.5k', isFollowing: true },
  { id: 2, name: 'Ms. Lan Anh', avatar: '/avatars/teacher-2.png', followers: '8.3k', isFollowing: true },
  { id: 3, name: 'Ms. Thao', avatar: '/avatars/teacher-3.png', followers: '15.2k', isFollowing: true },
  { id: 4, name: 'Mr. Minh Tuan', avatar: '/avatars/teacher-4.png', followers: '9.7k', isFollowing: true },
  { id: 5, name: 'Ms. Phuong Linh', avatar: '/avatars/teacher-5.png', followers: '11.1k', isFollowing: true },
];

const followedLivestreams = [
  { id: 1, title: 'IELTS Speaking Prep', teacher: 'Mr. David Nguyen', teacherId: 1, views: '2.5k', viewCount: 2500, image: '/images/cat.png', isLive: true, duration: null, uploadedAt: null },
  { id: 2, title: 'Calculus I - Chapter 3', teacher: 'Ms. Lan Anh', teacherId: 2, views: '1.2k', viewCount: 1200, image: '', isLive: true, duration: null, uploadedAt: null },
  { id: 3, title: 'Physics for Beginners', teacher: 'Mr. Minh Tuan', teacherId: 4, views: '1.8k', viewCount: 1800, image: '/images/cat.png', isLive: true, duration: null, uploadedAt: null },
  { id: 4, title: 'Advanced Literature', teacher: 'Ms. Phuong Linh', teacherId: 5, views: '950', viewCount: 950, image: '', isLive: true, duration: null, uploadedAt: null },
];

const followedVideos = [
  { id: 5, title: 'Organic Chemistry - Lesson 5', teacher: 'Ms. Thao', teacherId: 3, views: '5.2k', viewCount: 5200, image: '', isLive: false, duration: '45:30', uploadedAt: '2 days ago' },
  { id: 6, title: 'English Grammar Advanced', teacher: 'Mr. David Nguyen', teacherId: 1, views: '3.8k', viewCount: 3800, image: '', isLive: false, duration: '32:15', uploadedAt: '1 week ago' },
  { id: 7, title: 'Calculus Practice Problems', teacher: 'Ms. Lan Anh', teacherId: 2, views: '2.9k', viewCount: 2900, image: '', isLive: false, duration: '28:45', uploadedAt: '3 days ago' },
  { id: 8, title: 'Physics Experiments Lab', teacher: 'Mr. Minh Tuan', teacherId: 4, views: '4.1k', viewCount: 4100, image: '/images/cat.png', isLive: false, duration: '52:20', uploadedAt: '5 days ago' },
  { id: 9, title: 'Literature Analysis Session', teacher: 'Ms. Phuong Linh', teacherId: 5, views: '2.3k', viewCount: 2300, image: '', isLive: false, duration: '38:50', uploadedAt: '1 week ago' },
  { id: 10, title: 'Chemistry Lab Tutorial', teacher: 'Ms. Thao', teacherId: 3, views: '3.5k', viewCount: 3500, image: '', isLive: false, duration: '41:10', uploadedAt: '4 days ago' },
];

function ChannelCard({ channel }: { channel: { id: number; name: string; avatar: string; followers: string; isFollowing: boolean } }) {
  const [isHovered, setIsHovered] = useState(false);
  const following = channel.isFollowing;

  return (
    <div 
      className={`relative w-full overflow-hidden rounded-xl bg-white shadow-md hover:shadow-lg transition-all duration-300 ease-in-out transform ${isHovered ? 'scale-[1.02]' : ''} border border-gray-200`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="p-5 flex flex-col items-center">
        <div className="relative mb-4">
          <div className={`h-20 w-20 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden border-4 ${following ? `border-[#${SecondaryColor}]` : 'border-gray-300'} transition-all duration-300`}>
            {channel.avatar ? (
              <div 
                className="w-full h-full bg-cover bg-center"
                style={{ backgroundImage: `url(${channel.avatar})` }}
              />
            ) : (
              <span className="text-2xl text-gray-500">{channel.name.charAt(0)}</span>
            )}
          </div>
          {following && (
            <div className={`absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-[#${SecondaryColor}] flex items-center justify-center border-2 border-white`}>
              <CheckCircleIcon className="h-4 w-4 text-white" />
            </div>
          )}
        </div>

        <h3 className={`text-sm font-semibold text-[#${PrimaryColor}] text-center mb-2 line-clamp-2`}>
          {channel.name}
        </h3>

        <p className="text-xs text-gray-500 mb-3">
          {channel.followers} followers
        </p>

        <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${following ? `bg-[#${SecondaryColor}]/10 text-[#${SecondaryColor}]` : `bg-gray-100 text-gray-600`} transition-all duration-300`}>
          {following ? 'Following' : 'Not Following'}
        </div>
      </div>
    </div>
  );
}

function VideoCard({ video }: { 
  video: { 
    id: number; 
    title: string; 
    teacher: string; 
    teacherId: number;
    views: string; 
    viewCount: number; 
    image: string; 
    isLive: boolean;
    duration: string | null;
    uploadedAt: string | null;
  }
}) {
  const [isHovered, setIsHovered] = useState(false);
  const router = useRouter();

  const handleClick = () => {
    if (video.isLive) {
      router.push(`/student/livestream/teacher-${video.teacherId}/livestream-${video.id}`);
    } else {
      router.push(`/student/video/teacher-${video.teacherId}/video-${video.id}`);
    }
  };

  return (
    <div 
      className={`relative w-full overflow-hidden rounded-xl bg-white shadow-md hover:shadow-lg transition-all duration-300 ease-in-out transform ${isHovered ? 'scale-[1.02]' : ''} border border-gray-200 cursor-pointer`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
    >
      <div className="relative bg-gray-200 overflow-hidden h-48">
        {video.image ? (
          <div 
            className={`absolute inset-0 bg-cover bg-center transform transition-transform duration-500 ${isHovered ? 'scale-110' : 'scale-100'}`} 
            style={{ backgroundImage: `url(${video.image})` }}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 transition-all duration-300">
            <PlayCircleIcon className={`w-12 h-12 transition-all duration-300 ${isHovered ? `text-[#${video.isLive ? SecondaryColor : PrimaryColor}] scale-110` : ''}`} />
          </div>
        )}
        
        {video.isLive ? (
          <div className={`absolute top-3 left-3 flex items-center space-x-1 px-2 py-1 rounded-md text-xs font-bold text-white bg-[#${SecondaryColor}] ${isHovered ? 'animate-pulse' : ''}`}>
            <SignalIcon className={`h-3 w-3 ${isHovered ? 'animate-pulse' : ''}`} />
            <span>LIVE</span>
          </div>
        ) : (
          <div className="absolute bottom-3 right-3 px-2 py-1 rounded-md text-xs font-semibold text-white bg-black/80">
            {video.duration}
          </div>
        )}

        <div className={`absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent text-white`}>
          <p className="font-semibold text-sm truncate">{video.title}</p>
          <div className="flex items-center text-xs mt-1">
            <div className="h-5 w-5 rounded-full bg-[#161853]/70 mr-2 border border-white"></div>
            <span className="font-medium">{video.teacher}</span>
          </div>
        </div>
      </div>
      
      <div className="p-3 flex justify-between items-center">
        <div className="flex flex-col">
          <span className={`text-xs font-medium text-[#${PrimaryColor}]`}>
            {video.views} views
          </span>
          {!video.isLive && video.uploadedAt && (
            <span className="text-xs text-gray-500 mt-0.5">
              {video.uploadedAt}
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
  
  const livestreamContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsLoaded(true);
  }, []);
  
  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
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

  const filteredLivestreams = activeTab === 'videos' ? [] : followedLivestreams;
  const filteredVideos = activeTab === 'live' ? [] : followedVideos;
  
  return (
    <motion.div 
      initial="hidden"
      animate={isLoaded ? "visible" : "hidden"}
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
    >
      <div className="w-full">
        
        <motion.div variants={fadeInUp} className="mb-8 mt-4">
          <h1 className={`text-3xl font-extrabold text-[#${PrimaryColor}] mb-2`}>
            Following Channels
          </h1>
          <p className="text-gray-600">
            Watch latest content from {followedChannels.length} channels you follow
          </p>
        </motion.div>

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
              All ({followedLivestreams.length + followedVideos.length})
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
                Live Now ({followedLivestreams.length})
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
                Videos ({followedVideos.length})
              </span>
            </button>
          </div>
        </motion.div>

        <motion.section variants={fadeInUp} className="mb-12">
          <div className="flex justify-between items-center mb-4">
            <h2 className={`text-xl font-bold text-[#${PrimaryColor}]`}>
              Following Channels
            </h2>
            <span className="text-sm text-gray-500">{followedChannels.length} channels</span>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {followedChannels.map((channel, index) => (
              <motion.div
                key={channel.id}
                variants={fadeInUp}
                transition={{ delay: 0.05 * index }}
                whileHover={{ y: -5, transition: { duration: 0.3 } }}
              >
                <ChannelCard channel={channel} />
              </motion.div>
            ))}
          </div>
        </motion.section>

        {filteredLivestreams.length > 0 && (
          <motion.section variants={fadeInUp} className="mb-12">
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
              {filteredLivestreams.map((stream, index) => (
                <motion.div 
                  key={stream.id} 
                  className="flex-shrink-0 w-72 snap-center"
                  variants={fadeInUp}
                  transition={{ delay: 0.1 * index }}
                  whileHover={{ y: -5, transition: { duration: 0.3 } }}
                >
                  <VideoCard video={stream} />
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}

        {filteredVideos.length > 0 && (
          <motion.section variants={fadeInUp} className="mb-12">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center">
                <h2 className={`text-xl font-bold text-[#${PrimaryColor}] mr-3`}>
                  Recent Videos
                </h2>
                <span className="text-sm text-gray-500">{filteredVideos.length} videos</span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 md:gap-6">
              {filteredVideos.map((video, index) => (
                <motion.div
                  key={video.id}
                  variants={fadeInUp}
                  transition={{ delay: 0.1 * index }}
                  whileHover={{ y: -5, transition: { duration: 0.3 } }}
                >
                  <VideoCard video={video} />
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}

        {filteredLivestreams.length === 0 && filteredVideos.length === 0 && (
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
