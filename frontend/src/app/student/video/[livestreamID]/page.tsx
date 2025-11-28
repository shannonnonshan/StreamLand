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
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-[#161853] mx-auto mb-4" />
          <p className="text-gray-600">Loading video...</p>
        </div>
      </div>
    );
  }

  if (error || !videoInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-md mx-4">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Play className="text-red-600" size={32} />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Video Not Available</h2>
            <p className="text-gray-600 mb-6">{error || 'This video could not be found'}</p>
            <button
              onClick={() => router.back()}
              className="px-6 py-3 bg-[#161853] text-white rounded-lg hover:bg-[#292C6D] transition-colors font-medium"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
        >
          <ArrowLeft size={20} />
          <span>Back</span>
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Video Player */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div
                className="relative bg-black"
                onMouseEnter={() => setShowControls(true)}
                onMouseLeave={() => setShowControls(false)}
              >
                <video
                  ref={videoRef}
                  src={videoInfo.recordingUrl}
                  poster={videoInfo.thumbnailUrl}
                  className="w-full aspect-video"
                  onClick={togglePlay}
                />

                {/* Custom Controls */}
                {showControls && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 transition-opacity">
                    {/* Progress Bar */}
                    <input
                      type="range"
                      min="0"
                      max={duration || 0}
                      value={currentTime}
                      onChange={handleSeek}
                      className="w-full mb-2 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                    />

                    <div className="flex items-center justify-between text-white">
                      <div className="flex items-center gap-3">
                        <button onClick={togglePlay} className="hover:scale-110 transition">
                          {isPlaying ? <Pause size={24} /> : <Play size={24} />}
                        </button>

                        <div className="flex items-center gap-2">
                          <button onClick={toggleMute} className="hover:scale-110 transition">
                            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                          </button>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={volume}
                            onChange={handleVolumeChange}
                            className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>

                        <span className="text-sm">
                          {formatTime(currentTime)} / {formatTime(duration)}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <button className="hover:scale-110 transition">
                          <Settings size={20} />
                        </button>
                        <button onClick={toggleFullscreen} className="hover:scale-110 transition">
                          <Maximize size={20} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Video Info */}
              <div className="p-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-3">{videoInfo.title}</h1>

                <div className="flex items-center justify-between mb-4 pb-4 border-b">
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span>{videoInfo.totalViews.toLocaleString()} views</span>
                    <span>•</span>
                    <span>{new Date(videoInfo.endedAt).toLocaleDateString()}</span>
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                      {videoInfo.category}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleLike}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                        isLiked
                          ? "bg-blue-100 text-blue-600"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      <ThumbsUp size={18} />
                      <span className="text-sm font-medium">{videoInfo.likes}</span>
                    </button>
                    <button
                      onClick={handleDislike}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                        isDisliked
                          ? "bg-red-100 text-red-600"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      <ThumbsDown size={18} />
                      <span className="text-sm font-medium">{videoInfo.dislikes}</span>
                    </button>
                    <button
                      onClick={handleShare}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition"
                    >
                      <Share2 size={18} />
                      <span className="text-sm font-medium">Share</span>
                    </button>
                  </div>
                </div>

                {/* Teacher Info */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden">
                    {videoInfo.teacher.avatar ? (
                      <Image
                        src={videoInfo.teacher.avatar}
                        alt={videoInfo.teacher.fullName}
                        width={48}
                        height={48}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-[#161853] text-white font-bold">
                        {videoInfo.teacher.fullName.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{videoInfo.teacher.fullName}</h3>
                    <button
                      onClick={() => router.push(`/teacher/public/${videoInfo.teacher.id}`)}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      View Profile
                    </button>
                  </div>
                </div>

                {/* Description */}
                {videoInfo.description && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-gray-700 whitespace-pre-wrap">{videoInfo.description}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar - Related Videos */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Related Videos</h3>
              <p className="text-sm text-gray-500">No related videos available</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
