// components/StudentDashboard.jsx
'use client'; // Add client directive for interactivity
import { PlayCircleIcon, SignalIcon, HeartIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { motion } from 'framer-motion'; // Install framer-motion for smooth animations
import { useEffect, useState, useRef } from 'react';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { getStudentRoute } from '@/utils/student';

const PrimaryColor = '161853';
const SecondaryColor = 'EC255A';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface VideoProgressSnapshot {
  videoId: string;
  userId: string;
  currentTime: number;
  duration: number;
  updatedAt: number;
}

const getProgressStorageKey = (videoId: string, userId: string) =>
  `streamland:video-progress:${userId}:${videoId}`;

const getDashboardViewerId = () => {
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

  const viewerId = getDashboardViewerId();
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

interface LivestreamData {
  id: string;
  title: string;
  description?: string;
  teacherId: string;
  teacher: {
    id: string;
    fullName: string;
    avatar?: string;
  };
  totalViews: number;
  currentViewers?: number;
  thumbnailUrl?: string;
  status: 'LIVE' | 'SCHEDULED' | 'ENDED';
  category?: string;
  recordingUrl?: string;
  startedAt?: string;
  endedAt?: string;
  scheduledStartTime?: string;
}

interface VideoData {
  id: string;
  title: string;
  description?: string;
  category?: string;
  teacherId: string;
  teacher: {
    id: string;
    fullName: string;
    avatar?: string;
  };
  totalViews: number;
  // optional: views in the last 7 days (preferred for trending)
  viewsLast7Days?: number;
  thumbnailUrl?: string;
  duration?: number;
  recordingUrl: string;
  endedAt: string;
  status: 'ENDED';
}

interface RecommendationVideo {
  id: string;
  title: string;
  category?: string;
  thumbnailUrl?: string;
  duration?: number;
  totalViews: number;
  endedAt?: string;
  recordingUrl: string;
  teacher: {
    id: string;
    fullName: string;
    avatar?: string;
  };
  reasons: string[];
}

interface RecommendationResponse {
  onboardingNeeded: boolean;
  interests: string[];
  byInterests: RecommendationVideo[];
  continueWatching: RecommendationVideo[];
  recommendations: RecommendationVideo[];
}

// --- Sub-Component: Livestream Card ---
function LivestreamCard({ stream, index }: { stream: LivestreamData; index: number }) {
  const [isHovered, setIsHovered] = useState(false);
  const isTopThree = index < 3;
  const router = useRouter();

  const handleClick = () => {
    // Navigate based on status
    if (stream.status === 'LIVE') {
      // Go to live viewer page
      router.push(`/student/livestream/${stream.id}`);
    } else if (stream.status === 'ENDED' && stream.recordingUrl) {
      // Go to video player page for recorded stream
      router.push(getStudentRoute(`video/${stream.id}`));
    } else if (stream.status === 'SCHEDULED') {
      // Show schedule time for upcoming livestreams
      alert(`This livestream is scheduled for ${new Date(stream.scheduledStartTime!).toLocaleString()}`);
    }
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    // Prefetch the route on hover for instant navigation
    if (stream.status === 'LIVE') {
      router.prefetch(`/student/livestream/${stream.id}`);
    } else if (stream.status === 'ENDED' && stream.recordingUrl) {
      router.prefetch(getStudentRoute(`video/${stream.id}`));
    }
  };

  return (
    <div 
      className={`relative w-full overflow-hidden rounded-xl bg-white shadow-md hover:shadow-lg transition-all duration-300 ease-in-out transform ${isHovered ? 'scale-[1.02]' : ''} border border-gray-200 cursor-pointer`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
    >
        
        {/* Image/Placeholder */}
        <div className="relative bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden h-48">
            {stream.thumbnailUrl ? (
                <Image
                  src={stream.thumbnailUrl}
                  alt={stream.title}
                  fill
                  priority={index < 4}
                  loading={index < 4 ? 'eager' : 'lazy'}
                  className={`object-cover transform transition-transform duration-500 ${isHovered ? 'scale-110' : 'scale-100'}`}
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  onError={(e) => {
                    // Fallback to placeholder if image fails to load
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
            ) : null}
            {!stream.thumbnailUrl && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 transition-all duration-300">
                    <PlayCircleIcon className={`w-16 h-16 mb-2 transition-all duration-300 ${isHovered ? `text-[#${stream.status === 'LIVE' ? SecondaryColor : PrimaryColor}] scale-110` : ''}`} />
                    <span className="text-xs font-medium opacity-60">No Thumbnail</span>
                </div>
            )}
            
            {/* Top Badge - Chỉ hiển thị cho 3 stream đầu tiên */}
            {isTopThree && (
                <div className={`absolute top-3 right-3 flex items-center justify-center h-8 w-8 rounded-full text-xs font-bold text-white bg-[#${PrimaryColor}] shadow-md`}>
                    Top {index + 1}
                </div>
            )}
            
            {/* Status Tag */}
            <div className={`absolute top-3 left-3 flex items-center space-x-1 p-1 rounded-md text-xs font-bold text-white ${
              stream.status === 'LIVE' ? `bg-[#${SecondaryColor}] ${isHovered ? 'animate-pulse' : ''}` : 
              stream.status === 'SCHEDULED' ? 'bg-blue-500' : 
              `bg-[#${PrimaryColor}]`
            }`}>
                <SignalIcon className={`h-3 w-3 ${stream.status === 'LIVE' && isHovered ? 'animate-pulse' : ''}`} />
                <span>
                  {stream.status === 'LIVE' ? 'LIVE' : 
                   stream.status === 'SCHEDULED' ? 'SCHEDULED' : 
                   'RECORDED'}
                </span>
            </div>

            {/* Teacher Info */}
            <div className={`absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent text-white`}>
                <p className="font-semibold text-sm truncate">{stream.title}</p>
                {stream.teacher && (
                  <div className="flex items-center text-xs mt-1">
                      {stream.teacher.avatar ? (
                        <Image 
                          src={stream.teacher.avatar} 
                          alt={stream.teacher.fullName} 
                          width={20} 
                          height={20} 
                          className="h-5 w-5 rounded-full mr-2 border border-white object-cover" 
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="h-5 w-5 rounded-full bg-white/20 mr-2 border border-white flex items-center justify-center">
                          <span className="text-[10px] font-bold">{stream.teacher.fullName.charAt(0).toUpperCase()}</span>
                        </div>
                      )}
                      <span className="font-medium">{stream.teacher.fullName}</span>
                  </div>
                )}
            </div>
        </div>
        
        {/* Metrics row */}
        <div className="p-3 flex justify-between items-center">
            <div className="flex items-center space-x-2">
                <span className={`text-xs font-medium text-[#${PrimaryColor}]`}>
                    {stream.totalViews.toLocaleString()} views
                </span>
                {stream.status === 'LIVE' && stream.currentViewers !== undefined && (
                  <span className={`text-xs font-medium text-[#${SecondaryColor}]`}>
                    • {stream.currentViewers} watching
                  </span>
                )}
                {stream.status === 'SCHEDULED' && stream.scheduledStartTime && (
                  <span className="text-xs font-medium text-blue-600">
                    • {new Date(stream.scheduledStartTime).toLocaleString()}
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

function TrendingCard({ item, index }: { item: VideoData; index: number }) {
    const [isHovered, setIsHovered] = useState(false);
    const [imageError, setImageError] = useState(false);
    const router = useRouter();
  const progressRatio = getProgressRatio(item.id, item.duration);

    const handleClick = () => {
        // Navigate to video player page for recorded stream
      router.push(getStudentRoute(`video/${item.id}`));
    };

    const handleMouseEnter = () => {
        setIsHovered(true);
        // Prefetch the route on hover for instant navigation
      router.prefetch(getStudentRoute(`video/${item.id}`));
    };
    
    return (
        <div 
            className={`w-full h-full bg-white rounded-xl overflow-hidden ${isHovered ? 'shadow-md' : 'shadow-sm'} transition-all duration-300 border border-gray-200 ${isHovered ? `border-[#${PrimaryColor}] border-opacity-40` : ''} cursor-pointer`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={() => setIsHovered(false)}
            onClick={handleClick}
        >
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
                    <PlayCircleIcon className={`h-12 w-12 transition-all duration-300 ${isHovered ? `text-[#${PrimaryColor}] scale-125 transform rotate-12` : 'text-gray-400'}`} />
                    <span className="text-xs text-gray-400 mt-2">No Thumbnail</span>
                  </div>
                )}

                {progressRatio > 0 && (
                  <div className="absolute left-0 right-0 bottom-0 h-[3px] bg-black/25">
                    <div
                      className="h-full bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.65)]"
                      style={{ width: `${(progressRatio * 100).toFixed(2)}%` }}
                    />
                  </div>
                )}
            </div>
            <div className="p-3">
                <p className={`text-sm font-semibold text-[#${PrimaryColor}] transition-colors duration-300 line-clamp-2`}>{item.title}</p>
                <p className="text-xs text-gray-600 mt-1">
                    {item.teacher && (
                      <>
                        <span className={`${isHovered ? 'font-medium' : ''} transition-all duration-300`}>{item.teacher.fullName}</span>
                        <span className="mx-1">•</span>
                      </>
                    )}
                    <span className={`text-[#${PrimaryColor}] ${isHovered ? 'font-bold' : 'font-medium'} transition-all duration-300`}>
                          {(item.viewsLast7Days !== undefined ? item.viewsLast7Days : item.totalViews).toLocaleString()} {item.viewsLast7Days !== undefined ? 'this week' : 'views'}
                    </span>
                    {item.endedAt && (
                      <>
                        <span className="mx-1">•</span>
                        {new Date(item.endedAt).toLocaleDateString()}
                      </>
                    )}
                </p>
            </div>
        </div>
    );
}

function EnglishVideoCard({ item, index }: { item: VideoData; index: number }) {
  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState(false);
  const router = useRouter();
  const progressRatio = getProgressRatio(item.id, item.duration);

  const handleClick = () => {
    router.push(getStudentRoute(`video/${item.id}`));
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
      className={`w-full rounded-2xl border bg-white p-3 md:p-4 cursor-pointer transition-all duration-200 ${
        isHovered
          ? 'border-[#161853]/40 shadow-md -translate-y-[1px]'
          : 'border-gray-200 shadow-sm'
      }`}
    >
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative w-full md:w-56 h-36 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
          {item.thumbnailUrl && !imageError ? (
            <Image
              src={item.thumbnailUrl}
              alt={item.title}
              fill
              priority={index < 3}
              loading={index < 3 ? 'eager' : 'lazy'}
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 224px"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400">
              <PlayCircleIcon className="h-10 w-10" />
            </div>
          )}

          {progressRatio > 0 && (
            <div className="absolute left-0 right-0 bottom-0 h-[3px] bg-black/25">
              <div
                className="h-full bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.65)]"
                style={{ width: `${(progressRatio * 100).toFixed(2)}%` }}
              />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-base md:text-lg font-semibold text-[#161853] line-clamp-2">
              {item.title}
            </h3>
            <span className="px-2 py-1 rounded-full text-[11px] font-semibold bg-[#161853]/10 text-[#161853] border border-[#161853]/20 whitespace-nowrap">
              English
            </span>
          </div>

          <p className="text-sm text-gray-600 mt-2 line-clamp-2">
            {item.description || 'Improve your English skills with practical lessons and clear examples.'}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600">
            <span className="font-medium text-[#161853]">{item.teacher?.fullName || 'Unknown teacher'}</span>
            <span>•</span>
            <span>{item.totalViews.toLocaleString()} views</span>
            {item.endedAt && (
              <>
                <span>•</span>
                <span>{new Date(item.endedAt).toLocaleDateString()}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


// --- Main Student Dashboard Layout ---
export default function StudentDashboard() {
  const params = useParams<{ id: string }>();
  const studentId = params?.id;
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedInterest = searchParams.get('interest')?.trim() || '';
  const router = useRouter();

  // State for controlling animations
  const [isLoaded, setIsLoaded] = useState(false);
  const [topLivestreams, setTopLivestreams] = useState<LivestreamData[]>([]);
  const [topTrending, setTopTrending] = useState<VideoData[]>([]);
  const [recommendedByInterest, setRecommendedByInterest] = useState<VideoData[]>([]);
  const [recommendedNextParts, setRecommendedNextParts] = useState<VideoData[]>([]);
  const [filteredVideosByInterest, setFilteredVideosByInterest] = useState<VideoData[]>([]);
  const [studentInterests, setStudentInterests] = useState<string[]>([]);
  const [hasAuthToken, setHasAuthToken] = useState(false);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(true);
  const [isLoadingLivestreams, setIsLoadingLivestreams] = useState(true);
  const [isLoadingVideos, setIsLoadingVideos] = useState(true);
  const [isLoadingInterestVideos, setIsLoadingInterestVideos] = useState(false);
  
  // Store reference to livestream horizontal scroller
  const livestreamContainerRef = useRef<HTMLDivElement>(null);

  const toVideoData = (item: RecommendationVideo): VideoData => ({
    id: item.id,
    title: item.title,
    teacherId: item.teacher.id,
    teacher: {
      id: item.teacher.id,
      fullName: item.teacher.fullName,
      avatar: item.teacher.avatar,
    },
    totalViews: item.totalViews,
    category: item.category,
    thumbnailUrl: item.thumbnailUrl,
    duration: item.duration,
    recordingUrl: item.recordingUrl,
    endedAt: item.endedAt || new Date().toISOString(),
    status: 'ENDED',
  });

  const resetPersonalizedState = () => {
    setStudentInterests([]);
    setRecommendedByInterest([]);
    setRecommendedNextParts([]);
  };

  const handleInvalidAuth = () => {
    setHasAuthToken(false);
    resetPersonalizedState();
    try {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    } catch {
      // ignore storage errors
    }
  };

  const fetchRecommendations = async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      handleInvalidAuth();
      setIsLoadingRecommendations(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/student/recommendations?limit=24`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          handleInvalidAuth();
        }
        return;
      }

      const data = await response.json() as RecommendationResponse;

      setRecommendedByInterest((data.byInterests || []).map(toVideoData));
      setRecommendedNextParts((data.continueWatching || []).map(toVideoData));

      if ((data.interests || []).length > 0) {
        setStudentInterests(data.interests);
      }
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    } finally {
      setIsLoadingRecommendations(false);
    }
  };

  const fetchStudentProfile = async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      handleInvalidAuth();
      return;
    }

    try {
      const response = await fetch(`${API_URL}/auth/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          handleInvalidAuth();
        }
        return;
      }

      const profile = await response.json();
      const interests = (profile?.studentProfile?.interests || []) as string[];

      if (interests.length > 0) {
        setStudentInterests(interests);
      }
    } catch (error) {
      console.error('Error fetching student profile:', error);
    }
  };

  // Fetch top livestreams (LIVE and SCHEDULED)
  const fetchTopLivestreams = async () => {
    try {
      // Fetch both LIVE and SCHEDULED streams in parallel
      const [liveResponse, scheduledResponse] = await Promise.all([
        fetch(`${API_URL}/livestream/active/all`, {
          next: { revalidate: 30 }, // Cache for 30 seconds
        }), // Get LIVE streams
        fetch(`${API_URL}/livestream/scheduled/upcoming?limit=10`, {
          next: { revalidate: 60 }, // Cache for 60 seconds
        }), // Get SCHEDULED streams
      ]);

      const liveData = liveResponse.ok ? await liveResponse.json() : [];
      const scheduledData = scheduledResponse.ok ? await scheduledResponse.json() : [];
      
      console.log('🔴 Live Data:', liveData);
      console.log('🔴 First live thumbnail:', liveData[0]?.thumbnailUrl);
      console.log('📅 Scheduled Data:', scheduledData);
      
      // Combine and sort with dynamic logic:
      // - LIVE streams first
      // - Between LIVE streams sort by `currentViewers` (fallback to totalViews)
      // - Between SCHEDULED streams sort by soonest `scheduledStartTime`
      // - Fallback to totalViews
      const combined = [...liveData, ...scheduledData];
      combined.sort((a, b) => {
        if (a.status === 'LIVE' && b.status !== 'LIVE') return -1;
        if (a.status !== 'LIVE' && b.status === 'LIVE') return 1;

        // both LIVE -> sort by live viewer count
        if (a.status === 'LIVE' && b.status === 'LIVE') {
          return (b.currentViewers ?? b.totalViews ?? 0) - (a.currentViewers ?? a.totalViews ?? 0);
        }

        // both SCHEDULED -> soonest start first
        if (a.status === 'SCHEDULED' && b.status === 'SCHEDULED') {
          return (new Date(a.scheduledStartTime || 0).getTime() - new Date(b.scheduledStartTime || 0).getTime());
        }

        // fallback by totalViews
        return (b.totalViews ?? 0) - (a.totalViews ?? 0);
      });

      setTopLivestreams(combined);
    } catch (error) {
      console.error('Error fetching top livestreams:', error);
    } finally {
      setIsLoadingLivestreams(false);
    }
  };

  // Fetch trending videos (ENDED with recordingUrl)
  const fetchTrendingVideos = async () => {
    try {
      // Fetch ended livestreams with recordings
      const response = await fetch(`${API_URL}/livestream/recorded/all?limit=12`, {
        next: { revalidate: 60 }, // Cache for 60 seconds instead of no-store
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('🎥 Trending Videos Data:', data);
        console.log('🎥 First video thumbnail:', data[0]?.thumbnailUrl);
        // Filter to only include streams with recordingUrl
        const recordedStreams = (data as VideoData[]).filter((stream) =>
          stream.status === 'ENDED' && stream.recordingUrl
        );
        // Sort by weekly views (preferred) falling back to totalViews
        recordedStreams.sort((a, b) => (b.viewsLast7Days ?? b.totalViews) - (a.viewsLast7Days ?? a.totalViews));
        console.log('🎥 Filtered & Sorted Videos (weekly-first):', recordedStreams);
        setTopTrending(recordedStreams.slice(0, 12));
      }
    } catch (error) {
      console.error('Error fetching trending videos:', error);
    } finally {
      setIsLoadingVideos(false);
    }
  };

  const fetchVideosByInterest = async (interest: string) => {
    if (!interest) {
      setFilteredVideosByInterest([]);
      return;
    }

    setIsLoadingInterestVideos(true);
    try {
      const response = await fetch(
        `${API_URL}/livestream/recorded/all?limit=60&category=${encodeURIComponent(interest)}`,
        {
          next: { revalidate: 60 },
        },
      );

      if (response.ok) {
        const data = await response.json();
        const onlyRecorded = (data as VideoData[]).filter((video) =>
          video.status === 'ENDED' && !!video.recordingUrl,
        );
        setFilteredVideosByInterest(onlyRecorded);
      } else {
        setFilteredVideosByInterest([]);
      }
    } catch (error) {
      console.error('Error fetching videos by interest:', error);
      setFilteredVideosByInterest([]);
    } finally {
      setIsLoadingInterestVideos(false);
    }
  };

  // Run animation and fetch data after component mounts
  useEffect(() => {
    setIsLoaded(true);
    const token = localStorage.getItem('accessToken');
    setHasAuthToken(!!token);
    if (!token) {
      resetPersonalizedState();
    }

    // Fetch data in parallel
    Promise.all([
      fetchTopLivestreams(),
      fetchTrendingVideos(),
      fetchStudentProfile(),
      fetchRecommendations(),
    ]);
  }, []);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== 'accessToken' && event.key !== 'token' && event.key !== 'user') return;
      const token = localStorage.getItem('accessToken');
      if (!token) {
        handleInvalidAuth();
      } else {
        setHasAuthToken(true);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      const token = localStorage.getItem('accessToken');
      if (!token) {
        handleInvalidAuth();
      }
    };

    window.addEventListener('storage', handleStorage);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('storage', handleStorage);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  useEffect(() => {
    fetchVideosByInterest(selectedInterest);
  }, [selectedInterest]);

  // Poll top livestreams periodically so `currentViewers` remains up-to-date
  useEffect(() => {
    const id = setInterval(() => {
      fetchTopLivestreams();
    }, 8000);
    return () => clearInterval(id);
  }, []);

  

  const handleInterestClick = (topic: string) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set('interest', topic);
    router.push(`${pathname}?${nextParams.toString()}`);
  };

  const clearInterestFilter = () => {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('interest');
    const query = nextParams.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };
  
  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  };

  // Scroll livestream list to the left
  const scrollLeft = () => {
    if (livestreamContainerRef.current) {
      livestreamContainerRef.current.scrollBy({
        left: -300,
        behavior: 'smooth'
      });
    }
  };

  // Scroll livestream list to the right
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
        
        {/* Main heading */}
        <motion.h1 
          variants={fadeInUp}
          className={`text-3xl font-extrabold text-[#${PrimaryColor}] mb-8 mt-4`}
        >
            Welcome, Student!
        </motion.h1>

        {hasAuthToken && studentInterests.length > 0 && (
          <motion.div variants={fadeInUp} className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Topics you are interested in</p>
              <button
                type="button"
                onClick={() => {
                  if (studentId) {
                    router.push(`/student/${studentId}/profile`);
                  }
                }}
                className="text-xs font-semibold text-[#161853] hover:underline"
              >
                Edit in Profile
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {studentInterests.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => handleInterestClick(topic)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                    selectedInterest.toLowerCase() === topic.toLowerCase()
                      ? 'bg-[#161853] text-white border-[#161853]'
                      : 'bg-[#161853]/10 text-[#161853] border-[#161853]/20 hover:bg-[#161853]/20'
                  }`}
                >
                  {topic}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {selectedInterest && (
          <motion.section variants={fadeInUp} className="mb-12">
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-xl font-bold text-[#${PrimaryColor}]`}>
                {`Videos in "${selectedInterest}"`}
              </h2>
              <button
                type="button"
                onClick={clearInterestFilter}
                className="text-sm font-semibold text-[#161853] hover:underline"
              >
                Clear filter
              </button>
            </div>

            {isLoadingInterestVideos ? (
              <div className="flex justify-center items-center h-40">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#161853]"></div>
              </div>
            ) : filteredVideosByInterest.length === 0 ? (
              <div className="text-center py-10 text-gray-500 border border-dashed border-gray-300 rounded-xl">
                <p>No videos found for this interest yet.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3 md:gap-4">
                {filteredVideosByInterest.map((item, index) => (
                  <motion.div
                    key={item.id}
                    variants={fadeInUp}
                    transition={{ delay: 0.03 * (index < 10 ? index : 10) }}
                    whileHover={{ y: -1, transition: { duration: 0.2 } }}
                    className="w-full"
                  >
                    <EnglishVideoCard item={item} index={index} />
                  </motion.div>
                ))}
              </div>
            )}
          </motion.section>
        )}

        {!selectedInterest && (
          <motion.section
            variants={fadeInUp}
            className="mb-12"
          >
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center">
                <h2 className={`text-xl font-bold text-[#${PrimaryColor}] mr-3`}>Top Livestreams</h2>
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
                  if (livestreamContainerRef.current) {
                    const startX = e.pageX - livestreamContainerRef.current.offsetLeft;
                    const initialScrollLeft = livestreamContainerRef.current.scrollLeft;

                    const handleMouseMove = (event: MouseEvent) => {
                      if (livestreamContainerRef.current) {
                        const x = event.pageX - livestreamContainerRef.current.offsetLeft;
                        const walk = (x - startX) * 1.5;
                        livestreamContainerRef.current.scrollLeft = initialScrollLeft - walk;
                      }
                    };

                    const handleMouseUp = () => {
                      document.removeEventListener('mousemove', handleMouseMove);
                      document.removeEventListener('mouseup', handleMouseUp);
                    };

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
        )}

        {!selectedInterest && (
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
                  transition={{ delay: 0.05 * (index < 8 ? index : 8) }}
                  whileHover={{ y: -5, transition: { duration: 0.3 } }}
                  className="h-full"
                >
                  <TrendingCard item={item} index={index} />
                </motion.div>
              ))}
            </div>
            )}
          </motion.section>
        )}

        {!selectedInterest && hasAuthToken && (
          <>
            {!isLoadingRecommendations && recommendedByInterest.length > 0 && (
              <motion.section variants={fadeInUp} className="mb-12">
                <div className="flex items-center justify-between mb-4">
                  <h2 className={`text-xl font-bold text-[#${PrimaryColor}]`}>
                    Recommended for Your Interests
                  </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 md:gap-6">
                  {recommendedByInterest.slice(0, 8).map((item, index) => (
                    <motion.div
                      key={item.id}
                      variants={fadeInUp}
                      transition={{ delay: 0.05 * (index < 8 ? index : 8) }}
                      whileHover={{ y: -5, transition: { duration: 0.3 } }}
                      className="h-full"
                    >
                      <TrendingCard item={item} index={index} />
                    </motion.div>
                  ))}
                </div>
              </motion.section>
            )}

            {!isLoadingRecommendations && recommendedNextParts.length > 0 && (
              <motion.section variants={fadeInUp} className="mb-12">
                <h2 className={`text-xl font-bold text-[#${PrimaryColor}] mb-4`}>
                  Continue Watching
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 md:gap-6">
                  {recommendedNextParts.slice(0, 8).map((item, index) => (
                    <motion.div
                      key={item.id}
                      variants={fadeInUp}
                      transition={{ delay: 0.05 * (index < 8 ? index : 8) }}
                      whileHover={{ y: -5, transition: { duration: 0.3 } }}
                      className="h-full"
                    >
                      <TrendingCard item={item} index={index} />
                    </motion.div>
                  ))}
                </div>
              </motion.section>
            )}
          </>
        )}

      </div>
    </motion.div>
  );
}
