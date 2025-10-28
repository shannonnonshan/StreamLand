'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  MagnifyingGlassIcon,
  UserPlusIcon,
  UserMinusIcon,
  ChatBubbleLeftRightIcon,
  CheckBadgeIcon,
  UserGroupIcon,
  UsersIcon,
  ClockIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';
import Sidebar from '@/component/student/Sidebar';
import Headerbar from '@/component/student/Headerbar';

const PrimaryColor = '161853';
const SecondaryColor = 'EC255A';

// Mock data
const mockFriends = [
  {
    id: '1',
    name: 'Nguyễn Minh Anh',
    username: '@minhanh.study',
    avatar: '/avatars/student-1.png',
    bio: '🎓 IELTS 7.5 | Full-stack Developer',
    mutualFriends: 12,
    isOnline: true,
    verified: true,
    studyStreak: 28,
  },
  {
    id: '2',
    name: 'Trần Văn Bình',
    username: '@binhdev',
    avatar: '/avatars/student-2.png',
    bio: '💻 Web Developer | ReactJS Enthusiast',
    mutualFriends: 8,
    isOnline: true,
    verified: false,
    studyStreak: 15,
  },
  {
    id: '3',
    name: 'Lê Thị Cẩm',
    username: '@camle',
    avatar: '/avatars/student-3.png',
    bio: '📚 Math Lover | Competitive Programmer',
    mutualFriends: 5,
    isOnline: false,
    verified: true,
    studyStreak: 42,
  },
  {
    id: '4',
    name: 'Phạm Hoàng Dũng',
    username: '@dungpham',
    avatar: '/avatars/student-4.png',
    bio: '🎨 UI/UX Designer | Creative Mind',
    mutualFriends: 15,
    isOnline: false,
    verified: false,
    studyStreak: 7,
  },
  {
    id: '5',
    name: 'Võ Thị Em',
    username: '@emvo',
    avatar: '/avatars/student-5.png',
    bio: '🌟 Physics Student | Science Enthusiast',
    mutualFriends: 3,
    isOnline: true,
    verified: true,
    studyStreak: 21,
  },
  {
    id: '6',
    name: 'Đặng Văn Phong',
    username: '@phongdang',
    avatar: '/avatars/student-6.png',
    bio: '🚀 AI/ML Researcher | Tech Explorer',
    mutualFriends: 20,
    isOnline: false,
    verified: true,
    studyStreak: 35,
  },
];

const mockSuggestions = [
  {
    id: '7',
    name: 'Hoàng Thị Giang',
    username: '@gianghoang',
    avatar: '/avatars/student-7.png',
    bio: '📖 English Teacher | IELTS Coach',
    mutualFriends: 6,
    verified: false,
  },
  {
    id: '8',
    name: 'Ngô Văn Hùng',
    username: '@hungngo',
    avatar: '/avatars/student-8.png',
    bio: '🎯 Business Student | Entrepreneur',
    mutualFriends: 9,
    verified: true,
  },
  {
    id: '9',
    name: 'Lý Thị Hoa',
    username: '@hoaly',
    avatar: '/avatars/student-9.png',
    bio: '🎵 Music Lover | Piano Player',
    mutualFriends: 4,
    verified: false,
  },
];

export default function FriendsPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'friends' | 'suggestions' | 'requests'>('friends');
  const [filter, setFilter] = useState<'all' | 'online' | 'verified'>('all');
  const [friends, setFriends] = useState(mockFriends);
  const [suggestions, setSuggestions] = useState(mockSuggestions);

  const filteredFriends = friends.filter(friend => {
    const matchesSearch = friend.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         friend.username.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = 
      filter === 'all' ||
      (filter === 'online' && friend.isOnline) ||
      (filter === 'verified' && friend.verified);
    
    return matchesSearch && matchesFilter;
  });

  const handleUnfriend = (friendId: string) => {
    setFriends(friends.filter(f => f.id !== friendId));
  };

  const handleAddFriend = (userId: string) => {
    setSuggestions(suggestions.filter(s => s.id !== userId));
    // TODO: API call to add friend
  };

  const handleMessage = (userId: string) => {
    router.push(`/student/message?userId=${userId}`);
  };

  const handleViewProfile = (userId: string) => {
    router.push(`/student/${userId}/profile`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <Sidebar />
      <Headerbar />
      
      <div className="ml-20 pt-16">
        <div className="max-w-7xl mx-auto p-6">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
              <UserGroupIcon className="h-8 w-8 text-blue-600" />
              Friends
            </h1>
            <p className="text-gray-600">Connect with your study buddies and classmates</p>
          </div>

          {/* Search & Filter Bar */}
          <div className="bg-white rounded-xl shadow-sm p-4 mb-6 border border-gray-200">
            <div className="flex items-center gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search friends by name or username..."
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Filter Dropdown */}
              <div className="relative">
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as 'all' | 'online' | 'verified')}
                  className="appearance-none pl-10 pr-8 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white cursor-pointer"
                >
                  <option value="all">All Friends</option>
                  <option value="online">Online Only</option>
                  <option value="verified">Verified Only</option>
                </select>
                <FunnelIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-xl shadow-sm mb-6 border border-gray-200">
            <div className="flex gap-1 p-1">
              <button
                onClick={() => setActiveTab('friends')}
                className={`flex-1 py-2.5 px-4 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'friends'
                    ? `bg-[#${PrimaryColor}] text-white shadow-sm`
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <UsersIcon className="h-5 w-5" />
                My Friends ({friends.length})
              </button>
              <button
                onClick={() => setActiveTab('suggestions')}
                className={`flex-1 py-2.5 px-4 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'suggestions'
                    ? `bg-[#${PrimaryColor}] text-white shadow-sm`
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <UserPlusIcon className="h-5 w-5" />
                Suggestions ({suggestions.length})
              </button>
              <button
                onClick={() => setActiveTab('requests')}
                className={`flex-1 py-2.5 px-4 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'requests'
                    ? `bg-[#${PrimaryColor}] text-white shadow-sm`
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <ClockIcon className="h-5 w-5" />
                Requests (3)
              </button>
            </div>
          </div>

          {/* Friends Tab */}
          {activeTab === 'friends' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredFriends.length === 0 ? (
                <div className="col-span-full text-center py-12">
                  <UserGroupIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-600 mb-2">No friends found</h3>
                  <p className="text-gray-500">Try adjusting your search or filters</p>
                </div>
              ) : (
                filteredFriends.map((friend) => (
                  <div
                    key={friend.id}
                    className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-all"
                  >
                    {/* Avatar & Info */}
                    <div className="p-5">
                      <div className="flex items-start gap-3 mb-4">
                        <div
                          onClick={() => handleViewProfile(friend.id)}
                          className="cursor-pointer relative"
                        >
                          <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xl font-bold shadow-md">
                            {friend.name.charAt(0)}
                          </div>
                          {friend.isOnline && (
                            <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-green-500 rounded-full border-2 border-white">
                              <div className="h-full w-full bg-green-400 rounded-full animate-ping opacity-75" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div
                              onClick={() => handleViewProfile(friend.id)}
                              className="cursor-pointer flex-1 min-w-0"
                            >
                              <div className="flex items-center gap-1.5 mb-1">
                                <h3 className="font-bold text-base text-gray-900 hover:text-blue-600 transition-colors truncate">
                                  {friend.name}
                                </h3>
                                {friend.verified && (
                                  <CheckBadgeIcon className="h-4 w-4 text-blue-500 flex-shrink-0" />
                                )}
                              </div>
                              <p className="text-xs text-gray-500 mb-1">{friend.username}</p>
                              <p className="text-xs text-gray-600 line-clamp-2">{friend.bio}</p>
                            </div>
                            {friend.isOnline && (
                              <span className="flex-shrink-0 text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                                Online
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-4 mb-3 text-xs text-gray-600 px-1">
                        <div className="flex items-center gap-1">
                          <UserGroupIcon className="h-3.5 w-3.5" />
                          <span>{friend.mutualFriends} mutual</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-orange-500">🔥</span>
                          <span>{friend.studyStreak} days</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleMessage(friend.id)}
                          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#${SecondaryColor}] hover:bg-[#d41f4d] text-white font-semibold text-xs transition-all shadow-sm hover:shadow-md`}
                        >
                          <ChatBubbleLeftRightIcon className="h-4 w-4" />
                          Message
                        </button>
                        <button
                          onClick={() => handleUnfriend(friend.id)}
                          className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-red-50 text-gray-700 hover:text-red-600 font-semibold text-xs transition-all"
                        >
                          <UserMinusIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Suggestions Tab */}
          {activeTab === 'suggestions' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {suggestions.length === 0 ? (
                <div className="col-span-full text-center py-12">
                  <UserPlusIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-600 mb-2">No suggestions available</h3>
                  <p className="text-gray-500">Check back later for new friend suggestions</p>
                </div>
              ) : (
                suggestions.map((user) => (
                  <div
                    key={user.id}
                    className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-all"
                  >
                    {/* Avatar & Info */}
                    <div className="p-5">
                      <div className="flex items-start gap-3 mb-4">
                        <div
                          onClick={() => handleViewProfile(user.id)}
                          className="cursor-pointer"
                        >
                          <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center text-white text-xl font-bold shadow-md">
                            {user.name.charAt(0)}
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div
                            onClick={() => handleViewProfile(user.id)}
                            className="cursor-pointer"
                          >
                            <div className="flex items-center gap-1.5 mb-1">
                              <h3 className="font-bold text-base text-gray-900 hover:text-blue-600 transition-colors truncate">
                                {user.name}
                              </h3>
                              {user.verified && (
                                <CheckBadgeIcon className="h-4 w-4 text-blue-500 flex-shrink-0" />
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mb-1">{user.username}</p>
                            <p className="text-xs text-gray-600 line-clamp-2">{user.bio}</p>
                          </div>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-1 mb-3 text-xs text-gray-600 px-1">
                        <UserGroupIcon className="h-3.5 w-3.5" />
                        <span>{user.mutualFriends} mutual friends</span>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAddFriend(user.id)}
                          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#${PrimaryColor}] hover:bg-[#1a1d6b] text-white font-semibold text-xs transition-all shadow-sm hover:shadow-md`}
                        >
                          <UserPlusIcon className="h-4 w-4" />
                          Add Friend
                        </button>
                        <button
                          onClick={() => handleViewProfile(user.id)}
                          className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs transition-all"
                        >
                          View
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Requests Tab */}
          {activeTab === 'requests' && (
            <div className="bg-white rounded-xl shadow-sm p-8 border border-gray-200 text-center">
              <ClockIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">Friend Requests</h3>
              <p className="text-gray-500">You have 3 pending friend requests</p>
              <p className="text-sm text-gray-400 mt-2">This feature is coming soon...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
