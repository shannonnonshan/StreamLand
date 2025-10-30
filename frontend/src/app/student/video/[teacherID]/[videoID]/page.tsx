"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
} from "lucide-react";

interface VideoInfo {
  id: number;
  title: string;
  description: string;
  teacher: string;
  teacherId: number;
  views: number;
  likes: number;
  dislikes: number;
  uploadedAt: string;
  duration: string;
  category: string;
}

export default function VideoPlayerPage() {
  const params = useParams<{ teacherID?: string; videoID?: string }>();
  const router = useRouter();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [isDisliked, setIsDisliked] = useState(false);

  const [videoInfo] = useState<VideoInfo>({
    id: parseInt(params?.videoID ?? "1"),
    title: "Sample Video Title",
    description: "This is a sample video description. Learn important concepts in this tutorial.",
    teacher: "Mr. John Doe",
    teacherId: parseInt(params?.teacherID ?? "1"),
    views: 5200,
    likes: 342,
    dislikes: 12,
    uploadedAt: "2 days ago",
    duration: "45:30",
    category: "Education",
  });

  const [relatedVideos] = useState([
    { id: 1, title: "Related Video 1", thumbnail: "", views: "3.2k", duration: "12:45" },
    { id: 2, title: "Related Video 2", thumbnail: "", views: "1.8k", duration: "18:20" },
    { id: 3, title: "Related Video 3", thumbnail: "", views: "4.5k", duration: "25:15" },
  ]);

  const [comments] = useState([
    { id: 1, user: "Student A", avatar: "", comment: "Great explanation!", time: "2 hours ago", likes: 15 },
    { id: 2, user: "Student B", avatar: "", comment: "Very helpful, thank you!", time: "5 hours ago", likes: 8 },
    { id: 3, user: "Student C", avatar: "", comment: "Can you make more videos like this?", time: "1 day ago", likes: 23 },
  ]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateTime = () => setCurrentTime(video.currentTime);
    const updateDuration = () => setDuration(video.duration);

    video.addEventListener("timeupdate", updateTime);
    video.addEventListener("loadedmetadata", updateDuration);

    return () => {
      video.removeEventListener("timeupdate", updateTime);
      video.removeEventListener("loadedmetadata", updateDuration);
    };
  }, []);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
  };

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        videoRef.current.requestFullscreen();
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const handleLike = () => {
    setIsLiked(!isLiked);
    if (isDisliked) setIsDisliked(false);
  };

  const handleDislike = () => {
    setIsDisliked(!isDisliked);
    if (isLiked) setIsLiked(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Video Section */}
          <div className="lg:col-span-2">
            {/* Video Player */}
            <div
              className="relative w-full bg-black rounded-lg overflow-hidden shadow-lg"
              style={{ aspectRatio: "16/9" }}
              onMouseEnter={() => setShowControls(true)}
              onMouseLeave={() => setShowControls(false)}
            >
              <video
                ref={videoRef}
                className="w-full h-full"
                onClick={togglePlay}
              >
                <source src="/sample-video.mp4" type="video/mp4" />
                Your browser does not support the video tag.
              </video>

              {/* Controls Overlay */}
              {showControls && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                  {/* Progress Bar */}
                  <input
                    type="range"
                    min="0"
                    max={duration || 0}
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full mb-2 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-red-600"
                  />

                  <div className="flex items-center justify-between text-white">
                    <div className="flex items-center gap-3">
                      <button onClick={togglePlay} className="hover:scale-110 transition">
                        {isPlaying ? <Pause size={24} /> : <Play size={24} />}
                      </button>

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
                        className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-white"
                      />

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
            <div className="mt-4 bg-white rounded-lg p-6 shadow">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{videoInfo.title}</h1>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span>{videoInfo.views.toLocaleString()} views</span>
                  <span>•</span>
                  <span>{videoInfo.uploadedAt}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleLike}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full transition ${
                      isLiked ? "bg-blue-100 text-blue-600" : "bg-gray-100 hover:bg-gray-200"
                    }`}
                  >
                    <ThumbsUp size={18} fill={isLiked ? "currentColor" : "none"} />
                    <span>{videoInfo.likes}</span>
                  </button>

                  <button
                    onClick={handleDislike}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full transition ${
                      isDisliked ? "bg-red-100 text-red-600" : "bg-gray-100 hover:bg-gray-200"
                    }`}
                  >
                    <ThumbsDown size={18} fill={isDisliked ? "currentColor" : "none"} />
                  </button>

                  <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-full transition">
                    <Share2 size={18} />
                    <span>Share</span>
                  </button>
                </div>
              </div>

              <hr className="my-4" />

              {/* Teacher Info */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gray-300"></div>
                  <div>
                    <p className="font-semibold text-gray-900">{videoInfo.teacher}</p>
                    <p className="text-sm text-gray-600">12.5k followers</p>
                  </div>
                </div>
                <button className="px-6 py-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition font-semibold">
                  Subscribe
                </button>
              </div>

              {/* Description */}
              <div className="mt-4">
                <p className="text-gray-700 whitespace-pre-line">{videoInfo.description}</p>
              </div>
            </div>

            {/* Comments Section */}
            <div className="mt-6 bg-white rounded-lg p-6 shadow">
              <h3 className="text-lg font-bold mb-4">{comments.length} Comments</h3>

              <div className="mb-6">
                <textarea
                  placeholder="Add a comment..."
                  className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
                <div className="flex justify-end gap-2 mt-2">
                  <button className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition">
                    Cancel
                  </button>
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                    Comment
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-300 flex-shrink-0"></div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm">{comment.user}</span>
                        <span className="text-xs text-gray-500">{comment.time}</span>
                      </div>
                      <p className="text-gray-700 text-sm mb-2">{comment.comment}</p>
                      <div className="flex items-center gap-4 text-xs">
                        <button className="flex items-center gap-1 hover:text-blue-600">
                          <ThumbsUp size={14} />
                          <span>{comment.likes}</span>
                        </button>
                        <button className="hover:text-blue-600">Reply</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar - Related Videos */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg p-4 shadow sticky top-6">
              <h3 className="text-lg font-bold mb-4">Related Videos</h3>
              <div className="space-y-3">
                {relatedVideos.map((video) => (
                  <div
                    key={video.id}
                    className="flex gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition"
                    onClick={() => router.push(`/student/video/teacher-1/video-${video.id}`)}
                  >
                    <div className="w-40 h-24 bg-gray-300 rounded-lg flex-shrink-0 relative">
                      <div className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1 rounded">
                        {video.duration}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm line-clamp-2 mb-1">{video.title}</h4>
                      <p className="text-xs text-gray-600">Teacher Name</p>
                      <p className="text-xs text-gray-500">{video.views} views</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
