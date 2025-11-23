'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
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
import Sidebar from '@/component/student/Sidebar';
import Headerbar from '@/component/student/Headerbar';

const PrimaryColor = '161853';
const SecondaryColor = 'EC255A';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Friend {
  id: string;
  fullName: string;
  email: string;
  avatar: string | null;
  bio: string | null;
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

interface SearchResult extends Friend {
  friendshipStatus: string | null;
}

export default function FriendsPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'suggestions' | 'search'>('friends');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }

    setSearching(true);
    try {
      const accessToken = localStorage.getItem('accessToken');
      const response = await fetch(`${API_URL}/student/search?q=${encodeURIComponent(searchQuery)}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data);
        setShowSearchDropdown(data.length > 0);
      }
    } catch (error) {
      console.error('Error searching students:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleSearchResultClick = (studentId: string) => {
    setShowSearchDropdown(false);
    setSearchQuery('');
    router.push(`/student/profile/${studentId}`);
  };

  useEffect(() => {
    fetchFriends();
    fetchFriendRequests();
    fetchSuggestions();
  }, []);

  useEffect(() => {
    const delaySearch = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        handleSearch();
      } else {
        setSearchResults([]);
        setShowSearchDropdown(false);
      }
    }, 500);

    return () => clearTimeout(delaySearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const fetchFriends = async () => {
    try {
      const accessToken = localStorage.getItem('accessToken');
      const response = await fetch(`${API_URL}/student/friends`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setFriends(data);
      }
    } catch (error) {
      console.error('Error fetching friends:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFriendRequests = async () => {
    try {
      const accessToken = localStorage.getItem('accessToken');
      const response = await fetch(`${API_URL}/student/friends/requests?type=received&status=PENDING`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setFriendRequests(data);
      }
    } catch (error) {
      console.error('Error fetching friend requests:', error);
    }
  };

  const fetchSuggestions = async () => {
    try {
      const accessToken = localStorage.getItem('accessToken');
      const response = await fetch(`${API_URL}/student/suggestions`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data);
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    }
  };

  const filteredFriends = friends.filter(friend => {
    const matchesSearch = friend.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         friend.email.toLowerCase().includes(searchQuery.toLowerCase());
    
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
        fetchFriends();
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
        fetchFriends();
        fetchFriendRequests();
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
        fetchFriendRequests();
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
        // Update search results and suggestions to show pending status
        setSearchResults(prev => prev.map(user => 
          user.id === receiverId ? { ...user, friendshipStatus: 'PENDING' } : user
        ));
        setSuggestions(prev => prev.map(user => 
          user.id === receiverId ? { ...user, friendshipStatus: 'PENDING' } : user
        ));
      }
    } catch (error) {
      console.error('Error sending friend request:', error);
    }
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

          {/* Search Bar */}
          <div className="bg-white rounded-xl shadow-sm p-4 mb-6 border border-gray-200">
            <div className="flex items-center gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search students by name or email (min 2 characters)..."
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {searching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  </div>
                )}
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
              {searchResults.length > 0 && (
                <button
                  onClick={() => setActiveTab('search')}
                  className={`flex-1 py-2.5 px-4 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                    activeTab === 'search'
                      ? `bg-[#${PrimaryColor}] text-white shadow-sm`
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <MagnifyingGlassIcon className="h-5 w-5" />
                  Search Results ({searchResults.length})
                </button>
              )}
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
                              {friend.fullName.charAt(0)}
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
                                {requester.fullName.charAt(0)}
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
                            className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-red-50 text-gray-700 hover:text-red-600 font-semibold text-xs transition-all flex items-center justify-center"
                          >
                            <XMarkIcon className="h-4 w-4" />
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
                suggestions.map((student) => (
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
                          {student.studentProfile.interests.slice(0, 3).map((interest, idx) => (
                            <span key={idx} className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">
                              {interest}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2">
                        {!student.friendshipStatus ? (
                          <button
                            onClick={() => handleSendFriendRequest(student.studentProfile!.id)}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#${PrimaryColor}] hover:bg-[#1a1d6b] text-white font-semibold text-xs transition-all shadow-sm hover:shadow-md`}
                          >
                            <UserPlusIcon className="h-4 w-4" />
                            Add Friend
                          </button>
                        ) : (
                          <button
                            disabled
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gray-200 text-gray-500 font-semibold text-xs cursor-not-allowed"
                          >
                            <ClockIcon className="h-4 w-4" />
                            Request Sent
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
