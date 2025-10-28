"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { 
  Calendar, 
  MapPin, 
  Users, 
  Video, 
  Star,
  Settings,
  Edit3,
  Camera,
  Play,
  ArrowLeft
} from "lucide-react";

// Import mock recordings
import { mockRecordings } from "@/utils/data/teacher/mockRecordings";

export default function TeacherProfilePage() {
  const params = useParams();
  const router = useRouter();
  const teacherId = params?.id as string;

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

  const [isEditingBio, setIsEditingBio] = useState(false);
  const [editedBio, setEditedBio] = useState(teacher.bio);

  // Get recent videos from recordings
  const recentVideos = mockRecordings
    .filter(r => r.teacherId === teacherId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3);

  const handleSaveBio = () => {
    // TODO: Call API to save bio
    setTeacher({ ...teacher, bio: editedBio });
    setIsEditingBio(false);
  };

  const handleChangeAvatar = () => {
    // TODO: Implement avatar upload
    alert("Avatar upload will be implemented");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Cover Banner */}
      <div className="h-48 bg-gradient-to-r from-[#292C6D] to-[#1f2350]"></div>

      <div className="max-w-6xl mx-auto px-6 -mt-24">
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
            <div className="relative group">
              <div className="w-32 h-32 rounded-full border-4 border-white shadow-lg overflow-hidden bg-gray-200">
                <Image
                  src={teacher.avatar}
                  alt={teacher.name}
                  width={128}
                  height={128}
                  className="w-full h-full object-cover"
                />
              </div>
              <button
                onClick={handleChangeAvatar}
                className="absolute inset-0 w-32 h-32 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Camera className="text-white" size={24} />
              </button>
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
                    onClick={() => router.push(`/teacher/${teacherId}/settings`)}
                    className="flex items-center gap-2 px-4 py-2 bg-[#292C6D] text-white rounded-lg hover:bg-[#1f2350] transition-colors"
                  >
                    <Settings size={18} />
                    Edit Settings
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Bio */}
          <div className="mt-6 pt-6 border-t">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900">About</h3>
              {!isEditingBio && (
                <button
                  onClick={() => {
                    setIsEditingBio(true);
                    setEditedBio(teacher.bio);
                  }}
                  className="text-[#292C6D] hover:text-[#1f2350] flex items-center gap-1 text-sm"
                >
                  <Edit3 size={14} />
                  Edit
                </button>
              )}
            </div>
            {isEditingBio ? (
              <div>
                <textarea
                  value={editedBio}
                  onChange={(e) => setEditedBio(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#292C6D] focus:border-transparent text-gray-900"
                  placeholder="Tell people about yourself..."
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={handleSaveBio}
                    className="px-4 py-2 bg-[#292C6D] text-white rounded-lg hover:bg-[#1f2350] transition-colors text-sm"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setIsEditingBio(false)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-gray-600 leading-relaxed">{teacher.bio}</p>
            )}
          </div>

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
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Recent Videos</h2>
            <button
              onClick={() => router.push(`/teacher/${teacherId}/recordings`)}
              className="text-[#292C6D] hover:text-[#1f2350] text-sm font-medium"
            >
              View All
            </button>
          </div>
          
          {recentVideos.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {recentVideos.map((video) => (
                <div
                  key={video.id}
                  onClick={() => router.push(`/teacher/${teacherId}/recordings/detail/${video.id}`)}
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
                    <h3 className="font-semibold text-gray-900 line-clamp-2 group-hover:text-[#292C6D] transition-colors text-sm">
                      {video.title}
                    </h3>
                    <p className="text-xs text-gray-600 mt-1">
                      {new Date(video.date).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </p>
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
