'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MagnifyingGlassIcon,
  UserMinusIcon,
  ChatBubbleLeftRightIcon,
  UserGroupIcon,
  UsersIcon,
  ClockIcon,
  XMarkIcon,
  CheckIcon,
  UserPlusIcon,
} from '@heroicons/react/24/outline';
import { useFriends, useFriendRequests, useSuggestions, useBlockedUsers, useSearchStudents } from '@/hooks/useFriends';

const PrimaryColor = '161853';
const SecondaryColor = 'EC255A';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface Friend {
  id: string;
  fullName: string;
  email: string;
  avatar: string | null;
  bio: string | null;
  friendshipId?: string;
  studentProfile?: {
    id: string;
    school: string | null;
    grade: string | null;
    interests: string[];
  };
}

interface FriendRequest {
  id: string;
  status: string;
  createdAt: string;
  requester?: Friend;
  receiver?: Friend;
}

export default function FriendsPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'suggestions' | 'blocked'>('friends');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Use SWR hooks for data fetching with caching
  const { friends: friendsData, isLoading: friendsLoading, mutate: mutateFriends } = useFriends();
  const { friendRequests: requestsData, isLoading: requestsLoading, mutate: mutateRequests } = useFriendRequests();
  const { suggestions: suggestionsData, isLoading: suggestionsLoading, mutate: mutateSuggestions } = useSuggestions();
  const { blockedUsers: blockedData, isLoading: blockedLoading, mutate: mutateBlocked } = useBlockedUsers();
  const { searchResults, isLoading: searching } = useSearchStudents(searchQuery);

  // Map SWR data to component state format
  const friends: Friend[] = friendsData.map((item: { friend: Friend; friendshipId: string }) => ({
    id: item.friend.id,
    fullName: item.friend.fullName,
    avatar: item.friend.avatar,
    bio: item.friend.bio,
    friendshipId: item.friendshipId,
    studentProfile: item.friend.studentProfile,
  }));

  const friendRequests: FriendRequest[] = requestsData.map((item: { id: string; status: string; createdAt: string; requester?: { user: Friend }; receiver?: { user: Friend } }) => ({
    id: item.id,
    status: item.status,
    createdAt: item.createdAt,
    requester: item.requester?.user ? {
      id: item.requester.user.id,
      fullName: item.requester.user.fullName,
      avatar: item.requester.user.avatar,
      bio: item.requester.user.bio,
      studentProfile: item.requester.user.studentProfile,
    } : undefined,
  }));

  const suggestions = suggestionsData;
  const blockedUsers = blockedData;

  // Determine if any tab is loading
  const loading = friendsLoading || requestsLoading || suggestionsLoading || blockedLoading;

  useEffect(() => {
    if (searchResults.length > 0) {
      setShowSearchDropdown(true);
    } else {
      setShowSearchDropdown(false);
    }
  }, [searchResults]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current && 
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setShowSearchDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredFriends = friends.filter(friend => {
    const matchesSearch = friend.fullName?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const handleUnfriend = async (friendshipId: string) => {
    try {
      const accessToken = localStorage.getItem('accessToken');
      const response = await fetch(`${API_URL}/student/friends/${friendshipId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      if (response.ok) {
        mutateFriends(); // Revalidate friends list
      }
    } catch (error) {
      console.error('Error removing friend:', error);
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      const accessToken = localStorage.getItem('accessToken');
      const response = await fetch(`${API_URL}/student/friends/request/${requestId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'ACCEPTED' }),
      });
      if (response.ok) {
        mutateFriends();
        mutateRequests();
      }
    } catch (error) {
      console.error('Error accepting friend request:', error);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      const accessToken = localStorage.getItem('accessToken');
      const response = await fetch(`${API_URL}/student/friends/request/${requestId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'REJECTED' }),
      });
      if (response.ok) {
        mutateRequests();
      }
    } catch (error) {
      console.error('Error rejecting friend request:', error);
    }
  };

  const handleSendFriendRequest = async (receiverId: string) => {
    try {
      const accessToken = localStorage.getItem('accessToken');
      const response = await fetch(`${API_URL}/student/friends/request`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ receiverId }),
      });
      if (response.ok) {
        mutateSuggestions(); // Revalidate suggestions
      }
    } catch (error) {
      console.error('Error sending friend request:', error);
    }
  };

  const handleBlockUser = async (requestId: string) => {
    try {
      const accessToken = localStorage.getItem('accessToken');
      const response = await fetch(`${API_URL}/student/friends/request/${requestId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'BLOCKED' }),
      });
      if (response.ok) {
        mutateFriends();
        mutateBlocked();
      }
    } catch (error) {
      console.error('Error blocking user:', error);
    }
  };

  const handleUnblockUser = async (friendshipId: string) => {
    try {
      const accessToken = localStorage.getItem('accessToken');
      const response = await fetch(`${API_URL}/student/friends/${friendshipId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      if (response.ok) {
        mutateBlocked();
      }
    } catch (error) {
      console.error('Error unblocking user:', error);
    }
  };

  const handleMessage = (targetUserId: string) => {
    // Get current student ID from URL
    const currentPath = window.location.pathname;
    const match = currentPath.match(/\/student\/([^\/]+)\//);
    const studentId = match ? match[1] : 'guest';
    router.push(`/student/${studentId}/message?userId=${targetUserId}`);
  };

  const handleViewProfile = (userId: string) => {
    router.push(`/student/${userId}/profile`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <UserGroupIcon className="h-8 w-8 text-blue-600" />
            Friends
          </h1>
          <p className="text-gray-600">Connect with your study buddies and classmates</p>
        </div>

        {/* Search Bar with Dropdown */}
        <div ref={searchContainerRef} className="bg-white rounded-xl shadow-sm p-4 mb-6 border border-gray-200 relative">
          <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (e.target.value.trim().length >= 2) {
                    setShowSearchDropdown(true);
                  }
                }}
                onFocus={() => {
                  if (searchQuery.trim().length >= 2 && searchResults.length > 0) {
                    setShowSearchDropdown(true);
                  }
                }}
                placeholder="Search students by name or email..."
                className="flex-1 bg-transparent border-none focus:outline-none text-sm"
              />
              {searchQuery && (
                <button 
                  onClick={() => {
                    setSearchQuery('');
                    setShowSearchDropdown(false);
                  }} 
                  className="p-1 hover:bg-gray-200 rounded-full"
                >
                  <XMarkIcon className="h-4 w-4 text-gray-500" />
                </button>
              )}
              {searching && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              )}
            </div>

            {/* Search Dropdown */}
            <AnimatePresence>
              {showSearchDropdown && searchResults.length > 0 && (
                <motion.div 
                  className="absolute left-0 right-0 top-full mt-2 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-[100]"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="max-h-80 overflow-y-auto">
                    {searchResults.map((student: Friend & { friendshipStatus?: string | null }) => (
                      <div
                        key={student.id}
                        onClick={() => {
                          setShowSearchDropdown(false);
                          setSearchQuery('');
                          router.push(`/student/${student.id}/profile`);
                        }}
                        className="flex items-center gap-4 p-4 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors"
                      >
                        {student.avatar ? (
                          <Image 
                            src={student.avatar} 
                            alt={student.fullName} 
                            width={48}
                            height={48}
                            className="h-12 w-12 rounded-full object-cover shadow-sm" 
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center text-white font-bold shadow-sm">
                            {student.fullName?.charAt(0) || '?'}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-gray-900 truncate">{student.fullName}</h4>
                          <p className="text-sm text-gray-500 truncate">{student.email}</p>
                          {student.studentProfile?.school && (
                            <p className="text-xs text-gray-400 truncate mt-0.5">🏫 {student.studentProfile.school}</p>
                          )}
                        </div>
                        {student.friendshipStatus && (
                          <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                            {student.friendshipStatus === 'PENDING' ? 'Pending' : student.friendshipStatus}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  {searchResults.length > 5 && (
                    <div className="p-2 text-center border-t border-gray-100 bg-gray-50">
                      <p className="text-xs text-gray-500">{searchResults.length} results found</p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
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
                onClick={() => setActiveTab('requests')}
                className={`flex-1 py-2.5 px-4 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'requests'
                    ? `bg-[#${PrimaryColor}] text-white shadow-sm`
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <ClockIcon className="h-5 w-5" />
                Requests ({friendRequests.length})
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
                onClick={() => setActiveTab('blocked')}
                className={`flex-1 py-2.5 px-4 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'blocked'
                    ? `bg-[#${PrimaryColor}] text-white shadow-sm`
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <XMarkIcon className="h-5 w-5" />
                Blocked ({blockedUsers.length})
              </button>
            </div>
          </div>

          {/* Friends Tab */}
          {activeTab === 'friends' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {loading ? (
                <div className="col-span-full text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-500">Loading friends...</p>
                </div>
              ) : filteredFriends.length === 0 ? (
                <div className="col-span-full text-center py-12">
                  <UserGroupIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-600 mb-2">No friends found</h3>
                  <p className="text-gray-500">Try adjusting your search or start adding friends</p>
                </div>
              ) : (
                filteredFriends.map((friend) => (
                  <div
                    key={friend.id}
                    className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-all"
                  >
                    <div className="p-5">
                      <div className="flex items-start gap-3 mb-4">
                        <div
                          onClick={() => handleViewProfile(friend.id)}
                          className="cursor-pointer relative"
                        >
                          {friend.avatar ? (
                            <Image src={friend.avatar} alt={friend.fullName} width={64} height={64} className="h-16 w-16 rounded-xl object-cover shadow-md" />
                            ) : (
                              <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xl font-bold shadow-md">
                              {friend.fullName?.charAt(0) || '?'}
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
                                  {friend.fullName}
                                </h3>
                              </div>
                              <p className="text-xs text-gray-500 mb-1">{friend.email}</p>
                              {friend.bio && (
                                <p className="text-xs text-gray-600 line-clamp-2">{friend.bio}</p>
                              )}
                              {friend.studentProfile?.school && (
                                <p className="text-xs text-gray-500 mt-1">🏫 {friend.studentProfile.school}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Interests */}
                      {friend.studentProfile?.interests && friend.studentProfile.interests.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {friend.studentProfile.interests.slice(0, 3).map((interest, idx) => (
                            <span key={idx} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                              {interest}
                            </span>
                          ))}
                        </div>
                      )}

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
                          onClick={() => handleUnfriend(friend.friendshipId || friend.id)}
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

          {/* Requests Tab */}
          {activeTab === 'requests' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {friendRequests.length === 0 ? (
                <div className="col-span-full bg-white rounded-xl shadow-sm p-8 border border-gray-200 text-center">
                  <ClockIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-600 mb-2">No pending requests</h3>
                  <p className="text-gray-500">You do not have any pending friend requests</p>
                </div>
              ) : (
                friendRequests.map((request) => {
                  const requester = request.requester;
                  if (!requester) return null;
                  
                  return (
                    <div
                      key={request.id}
                      className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-all"
                    >
                      <div className="p-5">
                        <div className="flex items-start gap-3 mb-4">
                          <div className="cursor-pointer">
                            {requester.avatar ? (
                              <Image src={requester.avatar} alt={requester.fullName} width={64} height={64} className="h-16 w-16 rounded-xl object-cover shadow-md" />
                            ) : (
                              <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center text-white text-xl font-bold shadow-md">
                              {requester.fullName?.charAt(0) || '?'}
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1">
                              <h3 className="font-bold text-base text-gray-900 truncate">
                                {requester.fullName}
                              </h3>
                            </div>
                            <p className="text-xs text-gray-500 mb-1">{requester.email}</p>
                            {requester.bio && (
                              <p className="text-xs text-gray-600 line-clamp-2">{requester.bio}</p>
                            )}
                            {requester.studentProfile?.school && (
                              <p className="text-xs text-gray-500 mt-1">🏫 {requester.studentProfile.school}</p>
                            )}
                          </div>
                        </div>

                        {/* Interests */}
                        {requester.studentProfile?.interests && requester.studentProfile.interests.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {requester.studentProfile.interests.slice(0, 3).map((interest, idx) => (
                              <span key={idx} className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">
                                {interest}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAcceptRequest(request.id)}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#${PrimaryColor}] hover:bg-[#1a1d6b] text-white font-semibold text-xs transition-all shadow-sm hover:shadow-md`}
                          >
                            <CheckIcon className="h-4 w-4" />
                            Accept
                          </button>
                          <button
                            onClick={() => handleRejectRequest(request.id)}
                            className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs transition-all flex items-center justify-center"
                          >
                            <XMarkIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleBlockUser(request.id)}
                            className="px-3 py-2 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 font-semibold text-xs transition-all flex items-center justify-center"
                            title="Block user"
                          >
                            Block
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
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
                  <p className="text-gray-500">Check back later for friend suggestions</p>
                </div>
              ) : (
                suggestions.map((student: Friend & { friendshipStatus?: string | null }) => (
                  <div
                    key={student.id}
                    className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-all"
                  >
                    <div className="p-5">
                      <div className="flex items-start gap-3 mb-4">
                        <div className="cursor-pointer">
                          {student.avatar ? (
                            <Image src={student.avatar} alt={student.fullName} width={64} height={64} className="h-16 w-16 rounded-xl object-cover shadow-md" />
                          ) : (
                            <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center text-white text-xl font-bold shadow-md">
                              {student.fullName.charAt(0)}
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            <h3 className="font-bold text-base text-gray-900 truncate">
                              {student.fullName}
                            </h3>
                          </div>
                          <p className="text-xs text-gray-500 mb-1">{student.email}</p>
                          {student.bio && (
                            <p className="text-xs text-gray-600 line-clamp-2">{student.bio}</p>
                          )}
                          {student.studentProfile?.school && (
                            <p className="text-xs text-gray-500 mt-1">🏫 {student.studentProfile.school}</p>
                          )}
                        </div>
                      </div>

                      {/* Interests */}
                      {student.studentProfile?.interests && student.studentProfile.interests.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {student.studentProfile.interests.slice(0, 3).map((interest: string, idx: number) => (
                            <span key={idx} className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">
                              {interest}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2">
                        {!student.friendshipStatus ? (
                          <>
                            <button
                              onClick={() => handleSendFriendRequest(student.id)}
                              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#${PrimaryColor}] hover:bg-[#1a1d6b] text-white font-semibold text-xs transition-all shadow-sm hover:shadow-md`}
                            >
                              <UserPlusIcon className="h-4 w-4" />
                              Add Friend
                            </button>
                            <button
                              onClick={() => handleMessage(student.id)}
                              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#${SecondaryColor}] hover:bg-[#d41f4d] text-white font-semibold text-xs transition-all shadow-sm hover:shadow-md`}
                            >
                              <ChatBubbleLeftRightIcon className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              disabled
                              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gray-200 text-gray-500 font-semibold text-xs cursor-not-allowed"
                            >
                              <ClockIcon className="h-4 w-4" />
                              Request Sent
                            </button>
                            <button
                              onClick={() => handleMessage(student.id)}
                              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#${SecondaryColor}] hover:bg-[#d41f4d] text-white font-semibold text-xs transition-all shadow-sm hover:shadow-md`}
                            >
                              <ChatBubbleLeftRightIcon className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Blocked Tab */}
          {activeTab === 'blocked' && (
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              {blockedUsers.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <XMarkIcon className="h-10 w-10 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-600 mb-2">No blocked users</h3>
                  <p className="text-gray-500">You haven&apos;t blocked anyone yet</p>
                </div>
              ) : (
                blockedUsers.map((user: Friend) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-4 p-4 hover:bg-gray-50 rounded-xl transition-all border-b border-gray-100 last:border-b-0"
                  >
                    <div className="flex-1 flex items-center gap-4">
                      {user.avatar ? (
                        <Image 
                          src={user.avatar} 
                          alt={user.fullName} 
                          width={64}
                          height={64}
                          className="h-16 w-16 rounded-full object-cover shadow-md" 
                        />
                      ) : (
                        <div className="h-16 w-16 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center text-white text-xl font-bold shadow-md">
                          {user.fullName?.charAt(0) || '?'}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{user.fullName}</h3>
                        <p className="text-sm text-gray-500 truncate">{user.email}</p>
                        {user.studentProfile?.school && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate">🏫 {user.studentProfile.school}</p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleUnblockUser(user.friendshipId!)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-semibold text-sm transition-all shadow-md hover:shadow-lg"
                    >
                      <CheckIcon className="h-4 w-4" />
                      Unblock
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
      </div>
    </div>
  );
}
