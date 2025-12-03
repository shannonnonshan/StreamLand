"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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

export default function VideoPlayerPage() {
  const params = useParams<{ livestreamID?: string }>();
  const router = useRouter();
  const livestreamID = params?.livestreamID;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [isDisliked, setIsDisliked] = useState(false);

  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      } catch (err) {
        console.error('Error fetching video:', err);
        setError(err instanceof Error ? err.message : 'Failed to load video');
      } finally {
        setLoading(false);
      }
    };

    fetchVideoData();
  }, [livestreamID]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateTime = () => setCurrentTime(video.currentTime);
    const updateDuration = () => setDuration(video.duration);
    const handleEnded = () => setIsPlaying(false);

    video.addEventListener("timeupdate", updateTime);
    video.addEventListener("loadedmetadata", updateDuration);
    video.addEventListener("ended", handleEnded);

    return () => {
      video.removeEventListener("timeupdate", updateTime);
      video.removeEventListener("loadedmetadata", updateDuration);
      video.removeEventListener("ended", handleEnded);
    };
  }, [videoInfo]);

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
    video.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const toggleFullscreen = () => {
    const video = videoRef.current;
    if (!video) return;

    if (!document.fullscreenElement) {
      video.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const formatTime = (time: number) => {
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const handleLike = () => {
    setIsLiked(!isLiked);
    if (isDisliked) setIsDisliked(false);
  };

  const handleDislike = () => {
    setIsDisliked(!isDisliked);
    if (isLiked) setIsLiked(false);
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    alert("Link copied to clipboard!");
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
                className="relative bg-black group"
                onMouseEnter={() => setShowControls(true)}
                onMouseLeave={() => setShowControls(false)}
              >
                <video
                  ref={videoRef}
                  src={videoInfo.recordingUrl}
                  poster={videoInfo.thumbnailUrl}
                  className="w-full aspect-video cursor-pointer"
                  onClick={togglePlay}
                />

                {/* Play Overlay */}
                {!isPlaying && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="w-20 h-20 rounded-full bg-white/90 flex items-center justify-center shadow-2xl hover:scale-110 transition-transform cursor-pointer">
                      <Play size={32} className="text-[#161853] ml-1" fill="currentColor" />
                    </div>
                  </div>
                )}

                {/* Custom Controls */}
                <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-6 transition-all duration-300 ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
                  {/* Progress Bar */}
                  <div className="mb-4">
                    <input
                      type="range"
                      min="0"
                      max={duration || 0}
                      value={currentTime}
                      onChange={handleSeek}
                      className="w-full h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg hover:[&::-webkit-slider-thumb]:scale-110 [&::-webkit-slider-thumb]:transition-transform"
                      style={{
                        background: `linear-gradient(to right, #EC255A ${(currentTime / duration) * 100}%, rgba(255,255,255,0.2) ${(currentTime / duration) * 100}%)`
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-white">
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={togglePlay} 
                        className="hover:scale-110 transition-transform duration-200 w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10"
                      >
                        {isPlaying ? <Pause size={24} /> : <Play size={24} />}
                      </button>

                      <div className="flex items-center gap-3 bg-white/10 rounded-full px-4 py-2 backdrop-blur-sm">
                        <button 
                          onClick={toggleMute} 
                          className="hover:scale-110 transition-transform duration-200"
                        >
                          {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                        </button>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={volume}
                          onChange={handleVolumeChange}
                          className="w-24 h-1 bg-white/30 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer"
                        />
                      </div>

                      <span className="text-sm font-medium bg-white/10 rounded-full px-4 py-2 backdrop-blur-sm">
                        {formatTime(currentTime)} / {formatTime(duration)}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <button className="hover:scale-110 transition-transform duration-200 w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10">
                        <Settings size={20} />
                      </button>
                      <button 
                        onClick={toggleFullscreen} 
                        className="hover:scale-110 transition-transform duration-200 w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10"
                      >
                        <Maximize size={20} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Video Info */}
              <div className="p-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-4 leading-tight">{videoInfo.title}</h1>

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
                        isLiked
                          ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      <ThumbsUp size={18} className={isLiked ? "fill-current" : ""} />
                      <span className="text-sm">{videoInfo.likes}</span>
                    </button>
                    <button
                      onClick={handleDislike}
                      className={`group flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all duration-300 font-semibold shadow-md hover:shadow-lg hover:scale-105 ${
                        isDisliked
                          ? "bg-gradient-to-r from-red-500 to-red-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      <ThumbsDown size={18} className={isDisliked ? "fill-current" : ""} />
                      <span className="text-sm">{videoInfo.dislikes}</span>
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
              </div>
            </div>
          </div>

          {/* Sidebar - Related Videos */}
          <div className="xl:col-span-1">
            <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100 sticky top-8">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <div className="w-1 h-6 bg-gradient-to-b from-[#161853] to-[#292C6D] rounded-full"></div>
                Related Videos
              </h3>
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Play className="text-gray-400" size={28} />
                </div>
                <p className="text-sm text-gray-500 font-medium">No related videos available</p>
                <p className="text-xs text-gray-400 mt-2">Check back later for more content</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
