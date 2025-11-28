// components/StudentDashboard.jsx (hoặc đặt trong trang pages/student/dashboard.jsx)
'use client'; // Add client directive for interactivity
import { PlayCircleIcon, SignalIcon, HeartIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { motion } from 'framer-motion'; // Install framer-motion for smooth animations
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

const PrimaryColor = '161853';
const SecondaryColor = 'EC255A';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface LivestreamData {
  id: string;
  title: string;
  teacher: {
    id: string;
    fullName: string;
    avatar?: string;
  };
  viewCount: number;
  currentViewers?: number;
  thumbnailUrl?: string;
  isLive: boolean;
  status: string;
  category?: string;
}

interface VideoData {
  id: string;
  title: string;
  teacher: {
    id: string;
    fullName: string;
    avatar?: string;
  };
  viewCount: number;
  thumbnailUrl?: string;
  duration?: number;
  uploadedAt: string;
}

// --- Sub-Component: Livestream Card ---
function LivestreamCard({ stream, index }: { stream: LivestreamData; index: number }) {
  const [isHovered, setIsHovered] = useState(false);
  const isTopThree = index < 3; // Chỉ hiển thị nhãn Top cho 3 stream đầu tiên
  const router = useRouter();

  const handleClick = () => {
    router.push(`/student/livestream/${stream.id}`);
  };

  return (
    <div 
      className={`relative w-full overflow-hidden rounded-xl bg-white shadow-md hover:shadow-lg transition-all duration-300 ease-in-out transform ${isHovered ? 'scale-[1.02]' : ''} border border-gray-200 cursor-pointer`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
    >
        
        {/* Image/Placeholder */}
        <div className="relative bg-gray-200 overflow-hidden h-48">
            {/* Sử dụng một placeholder nếu không có ảnh, hoặc dùng ảnh thật */}
            {stream.thumbnailUrl ? (
                <div 
                  className={`absolute inset-0 bg-cover bg-center transform transition-transform duration-500 ${isHovered ? 'scale-110' : 'scale-100'}`} 
                  style={{ backgroundImage: `url(${stream.thumbnailUrl})` }}
                >
                </div>
            ) : (
                <div className="flex items-center justify-center h-full text-gray-400 transition-all duration-300">
                    <PlayCircleIcon className={`w-10 h-10 transition-all duration-300 ${isHovered ? `text-[#${stream.isLive ? SecondaryColor : PrimaryColor}] scale-110` : ''}`} />
                </div>
            )}
            
            {/* Top Badge - Chỉ hiển thị cho 3 stream đầu tiên */}
            {isTopThree && (
                <div className={`absolute top-3 right-3 flex items-center justify-center h-8 w-8 rounded-full text-xs font-bold text-white bg-[#${PrimaryColor}] shadow-md`}>
                    Top {index + 1}
                </div>
            )}
            
            {/* LIVE Tag */}
            <div className={`absolute top-3 left-3 flex items-center space-x-1 p-1 rounded-md text-xs font-bold text-white ${stream.isLive ? `bg-[#${SecondaryColor}]` : `bg-[#${PrimaryColor}]`} ${stream.isLive && isHovered ? 'animate-pulse' : ''}`}>
                <SignalIcon className={`h-3 w-3 ${stream.isLive && isHovered ? 'animate-pulse' : ''}`} />
                <span>{stream.isLive ? 'LIVE' : 'VOD'}</span>
            </div>

            {/* Teacher Info */}
            <div className={`absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent text-white`}>
                <p className="font-semibold text-sm truncate">{stream.title}</p>
                <div className="flex items-center text-xs mt-1">
                    {stream.teacher.avatar ? (
                      <img src={stream.teacher.avatar} alt={stream.teacher.fullName} className="h-5 w-5 rounded-full mr-2 border border-white object-cover" />
                    ) : (
                      <div className="h-5 w-5 rounded-full bg-[#161853]/70 mr-2 border border-white flex items-center justify-center">
                        <span className="text-[10px]">{stream.teacher.fullName.charAt(0)}</span>
                      </div>
                    )}
                    <span className="font-medium">{stream.teacher.fullName}</span>
                </div>
            </div>
        </div>
        
        {/* Metrics row */}
        <div className="p-3 flex justify-between items-center">
            <div className="flex items-center space-x-2">
                <span className={`text-xs font-medium text-[#${PrimaryColor}]`}>
                    {stream.viewCount.toLocaleString()} views
                </span>
                {stream.isLive && stream.currentViewers !== undefined && (
                  <span className={`text-xs font-medium text-[#${SecondaryColor}]`}>
                    • {stream.currentViewers} watching
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

// --- Sub-Component: Trending Card ---
function TrendingCard({ item }: { item: VideoData }) {
    const [isHovered, setIsHovered] = useState(false);
    const router = useRouter();

    const handleClick = () => {
        // Navigate to video viewer page (using id as both teacher and livestream)
        router.push(`/student/livestream/${item.id}`);
    };
    
    return (
        <div 
            className={`w-full h-full bg-white rounded-xl overflow-hidden ${isHovered ? 'shadow-md' : 'shadow-sm'} transition-all duration-300 border border-gray-200 ${isHovered ? `border-[#${PrimaryColor}] border-opacity-40` : ''} cursor-pointer`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={handleClick}
        >
            <div className="h-40 bg-gray-200 flex items-center justify-center overflow-hidden">
                {/* Placeholder cho video thumbnail */}
                <HeartIcon className={`h-8 w-8 transition-all duration-300 ${isHovered ? `text-[#${PrimaryColor}] scale-125 transform rotate-12` : 'text-gray-400'}`} />
            </div>
            <div className="p-3">
                <p className={`text-sm font-semibold text-[#${PrimaryColor}] transition-colors duration-300 line-clamp-2`}>{item.title}</p>
                <p className="text-xs text-gray-600 mt-1">
                    <span className={`${isHovered ? 'font-medium' : ''} transition-all duration-300`}>{item.teacher.fullName}</span>
                    <span className="mx-1">•</span>
                    <span className={`text-[#${PrimaryColor}] ${isHovered ? 'font-bold' : 'font-medium'} transition-all duration-300`}>
                      {item.viewCount.toLocaleString()} views
                    </span>
                    <span className="mx-1">•</span>
                    {new Date(item.uploadedAt).toLocaleDateString()}
                </p>
            </div>
        </div>
    );
}


// --- Main Student Dashboard Layout ---
export default function StudentDashboard() {
  // State for controlling animations
  const [isLoaded, setIsLoaded] = useState(false);
  const [topLivestreams, setTopLivestreams] = useState<LivestreamData[]>([]);
  const [topTrending, setTopTrending] = useState<VideoData[]>([]);
  const [isLoadingLivestreams, setIsLoadingLivestreams] = useState(true);
  const [isLoadingVideos, setIsLoadingVideos] = useState(true);
  
  // State để lưu tham chiếu đến container livestream
  const livestreamContainerRef = useRef<HTMLDivElement>(null);

  // Fetch top livestreams
  const fetchTopLivestreams = async () => {
    try {
      const response = await fetch(`${API_URL}/livestream/top/livestreams`);
      if (response.ok) {
        const data = await response.json();
        setTopLivestreams(data);
      }
    } catch (error) {
      console.error('Error fetching top livestreams:', error);
    } finally {
      setIsLoadingLivestreams(false);
    }
  };

  // Fetch trending videos
  const fetchTrendingVideos = async () => {
    try {
      const response = await fetch(`${API_URL}/livestream/trending/videos`);
      if (response.ok) {
        const data = await response.json();
        setTopTrending(data);
      }
    } catch (error) {
      console.error('Error fetching trending videos:', error);
    } finally {
      setIsLoadingVideos(false);
    }
  };

  // Run animation and fetch data after component mounts
  useEffect(() => {
    setIsLoaded(true);
    fetchTopLivestreams();
    fetchTrendingVideos();

    // Auto-refresh every 30 seconds for real-time updates
    const intervalId = setInterval(() => {
      fetchTopLivestreams();
      fetchTrendingVideos();
    }, 30000);

    return () => clearInterval(intervalId);
  }, []);
  
  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  };

  // Hàm xử lý cuộn qua trái
  const scrollLeft = () => {
    if (livestreamContainerRef.current) {
      livestreamContainerRef.current.scrollBy({
        left: -300,
        behavior: 'smooth'
      });
    }
  };

  // Hàm xử lý cuộn qua phải
  const scrollRight = () => {
    if (livestreamContainerRef.current) {
      livestreamContainerRef.current.scrollBy({
        left: 300,
        behavior: 'smooth'
      });
    }
  };
  
  return (
    <motion.div 
      initial="hidden"
      animate={isLoaded ? "visible" : "hidden"}
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
    >
      {/* Main Content Area with better responsiveness */}
      <div className="w-full">
        
        {/* Tiêu đề chính */}
        <motion.h1 
          variants={fadeInUp}
          className={`text-3xl font-extrabold text-[#${PrimaryColor}] mb-8 mt-4`}
        >
            Welcome, Student!
        </motion.h1>

        {/* --- Phần 1: Top Livestream --- */}
        <motion.section 
          variants={fadeInUp}
          className="mb-12"
        >
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center">
              <h2 className={`text-xl font-bold text-[#${PrimaryColor}] mr-3`}>Top Livestream</h2>
              <span className="text-sm text-gray-500">{topLivestreams.length} streams</span>
            </div>
            <div className="flex space-x-3">
              <button 
                onClick={scrollLeft} 
                className="p-2 rounded-full bg-white border border-gray-200 shadow-sm hover:bg-[#161853]/5 hover:border-[#161853]/30 transition-all duration-200"
                aria-label="Scroll left"
              >
                <ChevronLeftIcon className="h-5 w-5 text-[#161853]" />
              </button>
              <button 
                onClick={scrollRight} 
                className="p-2 rounded-full bg-white border border-gray-200 shadow-sm hover:bg-[#161853]/5 hover:border-[#161853]/30 transition-all duration-200"
                aria-label="Scroll right"
              >
                <ChevronRightIcon className="h-5 w-5 text-[#161853]" />
              </button>
            </div>
          </div>
          
          {isLoadingLivestreams ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#161853]"></div>
            </div>
          ) : topLivestreams.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>No livestreams available at the moment</p>
            </div>
          ) : (
          <div 
            ref={livestreamContainerRef} 
            className="flex flex-row space-x-4 overflow-x-auto pb-4 snap-x snap-mandatory scroll-smooth scrollbar-none cursor-grab active:cursor-grabbing"
            onMouseDown={(e) => {
              // Lưu vị trí chuột ban đầu và vị trí cuộn
              if (livestreamContainerRef.current) {
                const startX = e.pageX - livestreamContainerRef.current.offsetLeft;
                const scrollLeft = livestreamContainerRef.current.scrollLeft;
                
                // Xử lý sự kiện mousemove
                const handleMouseMove = (e: MouseEvent) => {
                  if (livestreamContainerRef.current) {
                    // Tính toán khoảng cách di chuyển
                    const x = e.pageX - livestreamContainerRef.current.offsetLeft;
                    const walk = (x - startX) * 1.5; // Hệ số cuộn (tốc độ)
                    livestreamContainerRef.current.scrollLeft = scrollLeft - walk;
                  }
                };
                
                // Xử lý sự kiện mouseup
                const handleMouseUp = () => {
                  document.removeEventListener('mousemove', handleMouseMove);
                  document.removeEventListener('mouseup', handleMouseUp);
                };
                
                // Thêm sự kiện
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
              }
            }}
          >
            {topLivestreams.map((stream, index) => (
              <motion.div 
                key={stream.id} 
                className="flex-shrink-0 w-72 sm:w-72 md:w-72 lg:w-72 snap-center"
                variants={fadeInUp}
                transition={{ delay: 0.1 * (index > 5 ? 5 : index) }}
                whileHover={{ y: -5, transition: { duration: 0.3 } }}
              >
                <LivestreamCard stream={stream} index={index} />
              </motion.div>
            ))}
          </div>
          )}
        </motion.section>

        {/* --- Phần 2: Top Trending --- */}
        <motion.section 
          variants={fadeInUp}
          className="mb-12"
        >
          <h2 className={`text-xl font-bold text-[#${PrimaryColor}] mb-4`}>Top Trending</h2>
          
          {isLoadingVideos ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#161853]"></div>
            </div>
          ) : topTrending.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>No trending videos available</p>
            </div>
          ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 md:gap-6">
            {topTrending.map((item, index) => (
              <motion.div
                key={item.id}
                variants={fadeInUp}
                transition={{ delay: 0.2 * index }}
                whileHover={{ y: -5, transition: { duration: 0.3 } }}
                className="h-full"
              >
                <TrendingCard key={item.id} item={item} />
              </motion.div>
            ))}
          </div>
          )}
        </motion.section>

      </div>
    </motion.div>
  );
}