"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { 
  Calendar, 
  MapPin, 
  Users, 
  Video, 
  Star,
  Bell,
  BellOff,
  Share2,
  Play,
  ArrowLeft,
  Lock
} from "lucide-react";
import { useFollow } from "@/hooks/useFollow";
import { useAuth } from "@/hooks/useAuth";
import toast, { Toaster } from 'react-hot-toast';

// Mock recordings data
import { mockRecordings } from "@/utils/data/teacher/mockRecordings";

export default function PublicTeacherProfilePage() {
  const params = useParams();
  const router = useRouter();
  const teacherId = params?.id as string;
  const { followTeacher, unfollowTeacher, isFollowingTeacher, loading } = useFollow();
  const { isAuthenticated } = useAuth();

  // Mock data - sẽ lấy từ backend
  const [teacher, setTeacher] = useState({
    id: teacherId,
    name: "Dr. John Smith",
    username: "@johnsmith",
    avatar: "/logo.png",
    bio: "Passionate educator with 10+ years of experience in Computer Science. Dedicated to making complex topics easy to understand.",
    subscribers: 1234,
    totalVideos: 56,
    totalViews: 45678,
    rating: 4.8,
    createAt: "2023-01-15",
    address: "Hanoi, Vietnam",
    substantiate: "PhD in Computer Science",
    yearOfWorking: 10,
  });

  const [isSubscribed, setIsSubscribed] = useState(false);
  
  // Get recent videos from recordings
  const recentVideos = mockRecordings
    .filter(r => r.teacherId === teacherId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 6);

  useEffect(() => {
    // Check if user is following this teacher
    const checkFollowStatus = async () => {
      if (isAuthenticated) {
        const result = await isFollowingTeacher(teacherId);
        setIsSubscribed(result.isFollowing);
      }
    };
    
    checkFollowStatus();
  }, [teacherId, isAuthenticated, isFollowingTeacher]);

  const handleSubscribe = async () => {
    if (!isAuthenticated) {
      // Show toast alert for guest users
      toast((t) => (
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="font-semibold text-white">Sign in required</p>
            <p className="text-sm text-blue-100 mt-0.5">Please sign in to follow this teacher</p>
          </div>
          <button
            onClick={() => toast.dismiss(t.id)}
            className="flex-shrink-0 text-white/80 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ), {
        duration: 4000,
        position: 'top-center',
        style: {
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: '#fff',
          padding: '16px 20px',
          borderRadius: '12px',
          boxShadow: '0 10px 40px rgba(102, 126, 234, 0.4)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          minWidth: '320px',
        },
      });
      return;
    }

    try {
      if (!isSubscribed) {
        // Follow teacher
        const result = await followTeacher(teacherId);
        if (result.success) {
          setIsSubscribed(true);
          setTeacher({ ...teacher, subscribers: teacher.subscribers + 1 });
        }
      } else {
        // Unfollow teacher
        const result = await unfollowTeacher(teacherId);
        if (result.success) {
          setIsSubscribed(false);
          setTeacher({ ...teacher, subscribers: teacher.subscribers - 1 });
        }
      }
    } catch (error) {
      // Error toggling follow
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    alert("Profile link copied to clipboard!");
  };

  const handleVideoClick = (videoId: string) => {
    router.push(`/viewer/${teacherId}/${videoId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <Toaster />
      
      {/* Cover Banner */}
      <div className="h-48 bg-gradient-to-r from-[#292C6D] to-[#1f2350]"></div>

      <div className="max-w-6xl mx-auto px-6 -mt-24 pb-12">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-white hover:text-[#FAEDF0] mb-4 transition-colors"
        >
          <ArrowLeft size={20} />
          <span>Back</span>
        </button>
        {/* Profile Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Avatar */}
            <div className="relative">
              <div className="w-32 h-32 rounded-full border-4 border-white shadow-lg overflow-hidden bg-gray-200">
                <Image
                  src={teacher.avatar}
                  alt={teacher.name}
                  width={128}
                  height={128}
                  className="w-full h-full object-cover"
                />
              </div>
              {teacher.rating && (
                <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-yellow-400 text-white px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1">
                  <Star size={14} fill="white" />
                  {teacher.rating}
                </div>
              )}
            </div>

            {/* Profile Info */}
            <div className="flex-1">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">{teacher.name}</h1>
                  <p className="text-gray-600 mb-2">{teacher.username}</p>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Users size={16} className="text-[#292C6D]" />
                      <span className="font-semibold">{teacher.subscribers.toLocaleString()}</span> subscribers
                    </div>
                    <div className="flex items-center gap-1">
                      <Video size={16} className="text-[#292C6D]" />
                      <span className="font-semibold">{teacher.totalVideos}</span> videos
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar size={16} className="text-[#292C6D]" />
                      Joined {new Date(teacher.createAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={handleSubscribe}
                    disabled={loading}
                    className={`flex items-center gap-2 px-6 py-2 rounded-lg transition-colors ${
                      !isAuthenticated
                        ? "bg-gray-400 text-white hover:bg-gray-500"
                        : isSubscribed
                        ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
                        : "bg-[#292C6D] text-white hover:bg-[#1f2350]"
                    } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {!isAuthenticated ? (
                      <>
                        <Lock size={18} />
                        Follow
                      </>
                    ) : isSubscribed ? (
                      <>
                        <BellOff size={18} />
                        Following
                      </>
                    ) : (
                      <>
                        <Bell size={18} />
                        Follow
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleShare}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Share2 size={18} />
                    Share
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Bio */}
          {teacher.bio && (
            <div className="mt-6 pt-6 border-t">
              <h3 className="font-semibold text-gray-900 mb-2">About</h3>
              <p className="text-gray-600 leading-relaxed">{teacher.bio}</p>
            </div>
          )}

          {/* Credentials */}
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            {teacher.substantiate && (
              <div className="flex items-center gap-2 bg-[#FAEDF0] px-4 py-2 rounded-lg">
                <span className="font-semibold text-[#292C6D]">Credentials:</span>
                <span className="text-gray-700">{teacher.substantiate}</span>
              </div>
            )}
            {teacher.yearOfWorking && (
              <div className="flex items-center gap-2 bg-[#FAEDF0] px-4 py-2 rounded-lg">
                <span className="font-semibold text-[#292C6D]">Experience:</span>
                <span className="text-gray-700">{teacher.yearOfWorking} years</span>
              </div>
            )}
            {teacher.address && (
              <div className="flex items-center gap-2 bg-[#FAEDF0] px-4 py-2 rounded-lg">
                <MapPin size={16} className="text-[#292C6D]" />
                <span className="text-gray-700">{teacher.address}</span>
              </div>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="text-blue-600" size={24} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{teacher.subscribers.toLocaleString()}</p>
                <p className="text-sm text-gray-600">Subscribers</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Video className="text-purple-600" size={24} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{teacher.totalVideos}</p>
                <p className="text-sm text-gray-600">Total Videos</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Star className="text-green-600" size={24} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{teacher.rating}</p>
                <p className="text-sm text-gray-600">Average Rating</p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Videos Section */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Recent Videos</h2>
          </div>
          
          {recentVideos.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recentVideos.map((video) => (
                <div
                  key={video.id}
                  onClick={() => handleVideoClick(video.id)}
                  className="group cursor-pointer"
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-gray-200 rounded-lg overflow-hidden mb-3">
                    <Image
                      src={video.thumbnail}
                      alt={video.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                      <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play className="text-[#292C6D] ml-1" size={24} fill="currentColor" />
                      </div>
                    </div>
                    {/* Duration Badge */}
                    <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
                      {video.duration}
                    </div>
                  </div>

                  {/* Video Info */}
                  <div>
                    <h3 className="font-semibold text-gray-900 line-clamp-2 group-hover:text-[#292C6D] transition-colors mb-1">
                      {video.title}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {new Date(video.date).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                      <span>{video.views.toLocaleString()} views</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Video className="mx-auto text-gray-400 mb-3" size={48} />
              <p className="text-gray-600">No videos available yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
