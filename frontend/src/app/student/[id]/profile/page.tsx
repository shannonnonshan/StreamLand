'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  UserPlusIcon,
  UserMinusIcon,
  ChatBubbleLeftRightIcon,
  EnvelopeIcon,
  MapPinIcon,
  AcademicCapIcon,
  CalendarIcon,
  ClockIcon,
  SparklesIcon,
  TrophyIcon,
  FireIcon,
  BookOpenIcon,
  VideoCameraIcon,
  DocumentTextIcon,
  CheckBadgeIcon,
  UserGroupIcon,
  ArrowLeftIcon,
  PencilIcon,
  XMarkIcon,
  PlusIcon,
  BuildingOffice2Icon,
} from '@heroicons/react/24/outline';
import Sidebar from '@/component/student/Sidebar';
import Headerbar from '@/component/student/Headerbar';
import { useAuth } from '@/hooks/useAuth';

const PrimaryColor = '161853';
const SecondaryColor = 'EC255A';

// Suggested interests for students
const SUGGESTED_INTERESTS = [
  'English',
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'Literature',
  'History',
  'Geography',
  'Programming',
  'Web Development',
  'Mobile Development',
  'Data Science',
  'AI & Machine Learning',
  'Design',
  'Drawing',
  'Music',
  'IELTS',
  'TOEFL',
  'University Exam Prep',
  'High School Exam Prep',
];

// Mock data
const mockStudent = {
  id: '123',
  name: 'Nguyễn Minh Anh',
  username: '@minhanh.study',
  avatar: '/avatars/student-1.png',
  coverImage: '/images/cover-default.jpg',
  bio: '🎓 Đam mê học tiếng Anh và lập trình | 📚 IELTS 7.5 | 💻 Full-stack Developer',
  location: 'Hồ Chí Minh, Việt Nam',
  joinDate: '2024-03-15',
  verified: true,
  stats: {
    following: 45,
    followers: 128,
    courses: 12,
    documents: 89,
    studyHours: 342,
    streak: 28
  },
  badges: [
    { id: 1, name: 'Early Adopter', icon: '🚀', color: 'blue' },
    { id: 2, name: '100 Hours', icon: '⏰', color: 'purple' },
    { id: 3, name: 'Top Learner', icon: '🏆', color: 'yellow' },
    { id: 4, name: '30 Day Streak', icon: '🔥', color: 'orange' },
  ],
  interests: ['English', 'Programming', 'Mathematics', 'Physics', 'Design'],
  recentActivity: [
    { id: 1, type: 'course', title: 'Completed IELTS Writing Module', time: '2 hours ago' },
    { id: 2, type: 'document', title: 'Added new notes on React Hooks', time: '5 hours ago' },
    { id: 3, type: 'livestream', title: 'Attended Python Advanced Class', time: '1 day ago' },
  ]
};

const mockFollowingChannels = [
  {
    id: '1',
    name: 'Mr. David Nguyen',
    subject: 'English - IELTS',
    avatar: '/avatars/teacher-1.png',
    followers: '12.5k',
    isLive: true,
    verified: true
  },
  {
    id: '2',
    name: 'Ms. Sarah Johnson',
    subject: 'Mathematics',
    avatar: '/avatars/teacher-2.png',
    followers: '8.3k',
    isLive: false,
    verified: true
  },
  {
    id: '3',
    name: 'Mr. Trần Văn An',
    subject: 'Programming',
    avatar: '/avatars/teacher-3.png',
    followers: '15.2k',
    isLive: true,
    verified: true
  },
  {
    id: '4',
    name: 'Dr. Emily Chen',
    subject: 'Physics',
    avatar: '/avatars/teacher-4.png',
    followers: '6.7k',
    isLive: false,
    verified: false
  },
];

export default function StudentProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { id } = params;
  const { user: currentUser } = useAuth();
  
  const [isFriend, setIsFriend] = useState(false);
  const [activeTab, setActiveTab] = useState<'about' | 'channels' | 'activity'>('about');
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [profileData, setProfileData] = useState<{
    id: string;
    fullName: string;
    email: string;
    role: string;
    avatar?: string;
    bio?: string;
    location?: string;
    isVerified: boolean;
    createdAt: string;
    studentProfile?: {
      school?: string;
      grade?: string;
      interests?: string[];
    };
    teacherProfile?: {
      cvUrl?: string;
      subjects?: string[];
      experience?: number;
      education?: string;
    };
  } | null>(null);
  
  // Edit form data
  const [editForm, setEditForm] = useState({
    fullName: '',
    bio: '',
    location: '',
    school: '',
    grade: '',
  });
  
  // Interests management
  const [interests, setInterests] = useState<string[]>([]);
  const [newInterest, setNewInterest] = useState('');
  const [showInterestSuggestions, setShowInterestSuggestions] = useState(false);
  
  const isOwnProfile = currentUser?.id === id;

  const loadProfile = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('accessToken');
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      
      console.log('Loading profile for ID:', id);
      console.log('API URL:', API_URL);
      console.log('Token:', token ? 'Present' : 'Missing');
      
      const response = await fetch(`${API_URL}/auth/${id}/profile`, {
        headers: { 
          Authorization: `Bearer ${token}`,
        },
      });

      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('Error response:', errorData);
        throw new Error(`Failed to load profile: ${response.status} ${errorData}`);
      }

      const data = await response.json();
      console.log('Profile data:', data);
      setProfileData(data);
      
      // Set form data
      setEditForm({
        fullName: data.fullName || '',
        bio: data.bio || '',
        location: data.location || '',
        school: data.studentProfile?.school || '',
        grade: data.studentProfile?.grade || '',
      });
      
      setInterests(data.studentProfile?.interests || []);
    } catch (error) {
      console.error('Error loading profile:', error);
      
      // Fallback to mock data for development
      const mockData = {
        id: id as string,
        fullName: 'Student User',
        email: 'student@example.com',
        role: 'STUDENT',
        isVerified: false,
        createdAt: new Date().toISOString(),
        bio: 'This is a sample bio. Edit your profile to update.',
        location: 'Ho Chi Minh City',
        studentProfile: {
          school: '',
          grade: '',
          interests: [],
        },
      };
      
      setProfileData(mockData);
      setEditForm({
        fullName: mockData.fullName,
        bio: mockData.bio || '',
        location: mockData.location || '',
        school: '',
        grade: '',
      });
      setInterests([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  
  const handleSaveProfile = async () => {
    try {
      setIsSaving(true);
      const token = localStorage.getItem('accessToken');
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      
      // Update user profile
      await fetch(`${API_URL}/auth/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fullName: editForm.fullName,
          bio: editForm.bio,
          location: editForm.location,
        }),
      });

      // Update student profile
      await fetch(`${API_URL}/auth/profile/student`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          school: editForm.school,
          grade: editForm.grade,
          interests: interests,
        }),
      });

      // Reload profile after save
      await loadProfile();
      setIsEditMode(false);
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Failed to save profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    // Reset form to current data
    if (profileData) {
      setEditForm({
        fullName: profileData.fullName || '',
        bio: profileData.bio || '',
        location: profileData.location || '',
        school: profileData.studentProfile?.school || '',
        grade: profileData.studentProfile?.grade || '',
      });
      setInterests(profileData.studentProfile?.interests || []);
    }
  };

  const handleAddInterest = (interest: string) => {
    if (interest && !interests.includes(interest)) {
      setInterests([...interests, interest]);
      setNewInterest('');
      setShowInterestSuggestions(false);
    }
  };

  const handleRemoveInterest = (interest: string) => {
    setInterests(interests.filter(i => i !== interest));
  };

  const filteredSuggestions = SUGGESTED_INTERESTS.filter(
    s => !interests.includes(s) && s.toLowerCase().includes(newInterest.toLowerCase())
  );
  
  const handleAddFriend = () => {
    setIsFriend(!isFriend);
  };
  
  const handleMessage = () => {
    router.push(`/student/message?userId=${id}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <Sidebar />
      <Headerbar />
      
      <div className="ml-20 pt-16">
        <div className="max-w-7xl mx-auto p-6">
          {/* Back Button */}
          <button
            onClick={() => router.back()}
            className="mb-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 text-gray-700 font-medium transition-all shadow-sm hover:shadow-md"
          >
            <ArrowLeftIcon className="h-5 w-5" />
            Back
          </button>

          {/* Loading State */}
          {isLoading ? (
            <div className="flex items-center justify-center h-96">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : !profileData ? (
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <p className="text-gray-600">Profile not found</p>
              </div>
            </div>
          ) : (
            <>
              {/* Profile Header Card */}
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-6 border border-gray-200">
                {/* Profile Info */}
                <div className="px-6 py-6">
                  {/* Avatar & Info Row */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-4">
                      <div className="relative">
                        <div className="h-24 w-24 rounded-2xl bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-3xl font-bold shadow-lg">
                          {profileData.fullName?.charAt(0) || 'U'}
                        </div>
                        {profileData.isVerified && (
                          <div className="absolute -bottom-1 -right-1 bg-blue-500 rounded-full p-1 ring-2 ring-white">
                            <CheckBadgeIcon className="h-4 w-4 text-white" />
                          </div>
                        )}
                      </div>
                  
                  <div className="pt-2">
                    {isEditMode ? (
                      <input
                        type="text"
                        value={editForm.fullName}
                        onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                        className="text-2xl font-bold text-gray-900 border-b-2 border-blue-300 focus:border-blue-500 outline-none mb-1 px-2"
                        placeholder="Full Name"
                      />
                    ) : (
                      <div className="flex items-center gap-2 mb-1">
                        <h1 className="text-2xl font-bold text-gray-900">{profileData.fullName}</h1>
                        {profileData.isVerified && (
                          <CheckBadgeIcon className="h-5 w-5 text-blue-500" />
                        )}
                      </div>
                    )}
                    <p className="text-sm text-gray-500 mb-2">{profileData.email}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-600">
                      <div className="flex items-center gap-1">
                        <MapPinIcon className="h-3.5 w-3.5" />
                        {isEditMode ? (
                          <input
                            type="text"
                            value={editForm.location}
                            onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                            className="border-b border-gray-300 focus:border-blue-500 outline-none px-1 w-40"
                            placeholder="Location"
                          />
                        ) : (
                          <span>{profileData.location || 'Not specified'}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <CalendarIcon className="h-3.5 w-3.5" />
                        <span>Joined {new Date(profileData.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  {isOwnProfile ? (
                    isEditMode ? (
                      <>
                        <button
                          onClick={handleCancelEdit}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-sm transition-all"
                          disabled={isSaving}
                        >
                          <XMarkIcon className="h-4 w-4" />
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveProfile}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg bg-[#${PrimaryColor}] hover:bg-[#1a1d6b] text-white font-semibold text-sm transition-all shadow-md hover:shadow-lg`}
                          disabled={isSaving}
                        >
                          {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setIsEditMode(true)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg bg-[#${PrimaryColor}] hover:bg-[#1a1d6b] text-white font-semibold text-sm transition-all shadow-md hover:shadow-lg`}
                      >
                        <PencilIcon className="h-4 w-4" />
                        Edit Profile
                      </button>
                    )
                  ) : (
                    <>
                      <button
                        onClick={handleAddFriend}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                          isFriend
                            ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                            : `bg-[#${PrimaryColor}] hover:bg-[#1a1d6b] text-white shadow-md hover:shadow-lg`
                        }`}
                      >
                        {isFriend ? (
                          <>
                            <UserMinusIcon className="h-4 w-4" />
                            Unfriend
                          </>
                        ) : (
                          <>
                            <UserPlusIcon className="h-4 w-4" />
                            Add Friend
                          </>
                        )}
                      </button>
                      <button
                        onClick={handleMessage}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg bg-[#${SecondaryColor}] hover:bg-[#d41f4d] text-white font-semibold text-sm transition-all shadow-md hover:shadow-lg`}
                      >
                        <ChatBubbleLeftRightIcon className="h-4 w-4" />
                        Message
                      </button>
                    </>
                  )}
                </div>
              </div>
              
              {/* Bio */}
              {isEditMode ? (
                <textarea
                  value={editForm.bio}
                  onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                  className="w-full text-gray-700 text-sm leading-relaxed mb-4 max-w-3xl border-2 border-gray-300 focus:border-blue-500 rounded-lg p-3 outline-none resize-none"
                  rows={3}
                  placeholder="Tell others about yourself..."
                />
              ) : (
                <p className="text-gray-700 text-sm leading-relaxed mb-4 max-w-3xl">
                  {profileData.bio || 'No bio yet'}
                </p>
              )}
              
              {/* School & Grade (Student specific) */}
              <div className="flex gap-4 mb-4">
                <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-lg border border-blue-200">
                  <BuildingOffice2Icon className="h-5 w-5 text-blue-600" />
                  <div>
                    <div className="text-xs text-gray-600">School</div>
                    {isEditMode ? (
                      <input
                        type="text"
                        value={editForm.school}
                        onChange={(e) => setEditForm({ ...editForm, school: e.target.value })}
                        className="font-medium text-gray-900 bg-transparent border-b border-blue-300 focus:border-blue-500 outline-none"
                        placeholder="Your school"
                      />
                    ) : (
                      <div className="font-medium text-gray-900">
                        {editForm.school || 'Not specified'}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2 px-4 py-2 bg-purple-50 rounded-lg border border-purple-200">
                  <AcademicCapIcon className="h-5 w-5 text-purple-600" />
                  <div>
                    <div className="text-xs text-gray-600">Grade</div>
                    {isEditMode ? (
                      <input
                        type="text"
                        value={editForm.grade}
                        onChange={(e) => setEditForm({ ...editForm, grade: e.target.value })}
                        className="font-medium text-gray-900 bg-transparent border-b border-purple-300 focus:border-purple-500 outline-none w-20"
                        placeholder="12A1"
                      />
                    ) : (
                      <div className="font-medium text-gray-900">
                        {editForm.grade || 'Not specified'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Interests Section */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-700">Interests & Learning Goals</h3>
                  {isEditMode && (
                    <span className="text-xs text-gray-500">Click tags to remove, or add new ones below</span>
                  )}
                </div>
                
                <div className="flex flex-wrap gap-2 mb-3">
                  {interests.length === 0 ? (
                    <p className="text-sm text-gray-500">No interests added yet</p>
                  ) : (
                    interests.map((interest) => (
                      <span
                        key={interest}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                          isEditMode
                            ? 'bg-blue-100 text-blue-700 border-2 border-blue-300 cursor-pointer hover:bg-red-100 hover:text-red-700 hover:border-red-300 transition-all'
                            : 'bg-gradient-to-r from-blue-500 to-purple-500 text-white'
                        }`}
                        onClick={() => isEditMode && handleRemoveInterest(interest)}
                        title={isEditMode ? 'Click to remove' : ''}
                      >
                        {interest}
                        {isEditMode && <XMarkIcon className="h-3 w-3 inline ml-1" />}
                      </span>
                    ))
                  )}
                </div>
                
                {/* Add Interest Input (only in edit mode) */}
                {isEditMode && (
                  <div className="relative">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newInterest}
                        onChange={(e) => {
                          setNewInterest(e.target.value);
                          setShowInterestSuggestions(e.target.value.length > 0);
                        }}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddInterest(newInterest);
                          }
                        }}
                        className="flex-1 px-4 py-2 border-2 border-gray-300 focus:border-blue-500 rounded-lg outline-none text-sm"
                        placeholder="Add an interest (e.g., English, Math, IELTS...)"
                      />
                      <button
                        onClick={() => handleAddInterest(newInterest)}
                        className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium text-sm transition-all flex items-center gap-1"
                      >
                        <PlusIcon className="h-4 w-4" />
                        Add
                      </button>
                    </div>
                    
                    {/* Suggestions Dropdown */}
                    {showInterestSuggestions && filteredSuggestions.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {filteredSuggestions.map((suggestion) => (
                          <button
                            key={suggestion}
                            onClick={() => handleAddInterest(suggestion)}
                            className="w-full text-left px-4 py-2 hover:bg-blue-50 text-sm text-gray-700 border-b border-gray-100 last:border-b-0"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Stats */}
              <div className="grid grid-cols-6 gap-3">
                <div className="text-center p-3 bg-gray-50 rounded-xl border border-gray-200 hover:border-blue-300 transition-colors">
                  <div className="text-2xl font-bold text-blue-600">{mockStudent.stats.following}</div>
                  <div className="text-xs text-gray-600 font-medium mt-0.5">Following</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-xl border border-gray-200 hover:border-purple-300 transition-colors">
                  <div className="text-2xl font-bold text-purple-600">{mockStudent.stats.followers}</div>
                  <div className="text-xs text-gray-600 font-medium mt-0.5">Followers</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-xl border border-gray-200 hover:border-green-300 transition-colors">
                  <div className="text-2xl font-bold text-green-600">{mockStudent.stats.courses}</div>
                  <div className="text-xs text-gray-600 font-medium mt-0.5">Courses</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-xl border border-gray-200 hover:border-yellow-300 transition-colors">
                  <div className="text-2xl font-bold text-yellow-600">{mockStudent.stats.documents}</div>
                  <div className="text-xs text-gray-600 font-medium mt-0.5">Documents</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-xl border border-gray-200 hover:border-indigo-300 transition-colors">
                  <div className="text-2xl font-bold text-indigo-600">{mockStudent.stats.studyHours}</div>
                  <div className="text-xs text-gray-600 font-medium mt-0.5">Study Hours</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-xl border border-gray-200 hover:border-orange-300 transition-colors">
                  <div className="flex items-center justify-center gap-1 text-2xl font-bold text-orange-600">
                    {mockStudent.stats.streak}
                    <FireIcon className="h-5 w-5 text-orange-500" />
                  </div>
                  <div className="text-xs text-gray-600 font-medium mt-0.5">Day Streak</div>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-xl shadow-sm mb-4 border border-gray-200">
            <div className="flex gap-1 p-1">
              <button
                onClick={() => setActiveTab('about')}
                className={`flex-1 py-2 px-4 rounded-lg font-semibold text-sm transition-all ${
                  activeTab === 'about'
                    ? `bg-[#${PrimaryColor}] text-white shadow-sm`
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                About
              </button>
              <button
                onClick={() => setActiveTab('channels')}
                className={`flex-1 py-2 px-4 rounded-lg font-semibold text-sm transition-all ${
                  activeTab === 'channels'
                    ? `bg-[#${PrimaryColor}] text-white shadow-sm`
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                Following Channels
              </button>
              <button
                onClick={() => setActiveTab('activity')}
                className={`flex-1 py-2 px-4 rounded-lg font-semibold text-sm transition-all ${
                  activeTab === 'activity'
                    ? `bg-[#${PrimaryColor}] text-white shadow-sm`
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                Recent Activity
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="col-span-2">
              {/* About Tab */}
              {activeTab === 'about' && (
                <div className="space-y-4">
                  {/* Badges */}
                  <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <TrophyIcon className="h-5 w-5 text-yellow-500" />
                      Achievements & Badges
                    </h3>
                    <div className="grid grid-cols-4 gap-3">
                      {mockStudent.badges.map((badge) => (
                        <div
                          key={badge.id}
                          className="text-center p-4 rounded-xl bg-gray-50 border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer"
                        >
                          <div className="text-3xl mb-1.5">{badge.icon}</div>
                          <div className="text-xs font-semibold text-gray-700">{badge.name}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Interests */}
                  <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <SparklesIcon className="h-5 w-5 text-purple-500" />
                      Interests
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {mockStudent.interests.map((interest, index) => (
                        <span
                          key={index}
                          className="px-4 py-1.5 bg-gray-100 text-gray-700 rounded-lg font-medium text-sm border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-all cursor-pointer"
                        >
                          {interest}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Following Channels Tab */}
              {activeTab === 'channels' && (
                <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <VideoCameraIcon className="h-5 w-5 text-red-500" />
                    Following Channels ({mockFollowingChannels.length})
                  </h3>
                  <div className="space-y-3">
                    {mockFollowingChannels.map((channel) => (
                      <div
                        key={channel.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-lg font-bold">
                              {channel.name.charAt(0)}
                            </div>
                            {channel.isLive && (
                              <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                                LIVE
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h4 className="font-semibold text-sm text-gray-900">{channel.name}</h4>
                              {channel.verified && (
                                <CheckBadgeIcon className="h-4 w-4 text-blue-500" />
                              )}
                            </div>
                            <p className="text-xs text-gray-600">{channel.subject}</p>
                            <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                              <UserGroupIcon className="h-3 w-3" />
                              <span>{channel.followers} followers</span>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => router.push(`/student/teacher/${channel.id}`)}
                          className="px-4 py-1.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-semibold text-xs transition-all shadow-sm hover:shadow-md opacity-0 group-hover:opacity-100"
                        >
                          View
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Activity Tab */}
              {activeTab === 'activity' && (
                <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <ClockIcon className="h-5 w-5 text-blue-500" />
                    Recent Activity
                  </h3>
                  <div className="space-y-3">
                    {mockStudent.recentActivity.map((activity) => (
                      <div
                        key={activity.id}
                        className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all"
                      >
                        <div className={`p-2 rounded-lg ${
                          activity.type === 'course' ? 'bg-green-100' :
                          activity.type === 'document' ? 'bg-blue-100' :
                          'bg-purple-100'
                        }`}>
                          {activity.type === 'course' && <AcademicCapIcon className="h-4 w-4 text-green-600" />}
                          {activity.type === 'document' && <DocumentTextIcon className="h-4 w-4 text-blue-600" />}
                          {activity.type === 'livestream' && <VideoCameraIcon className="h-4 w-4 text-purple-600" />}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-sm text-gray-900 mb-0.5">{activity.title}</h4>
                          <p className="text-xs text-gray-500">{activity.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Quick Actions */}
              {!isOwnProfile && (
                <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
                  <h3 className="text-sm font-bold text-gray-900 mb-3">Quick Actions</h3>
                  <div className="space-y-2">
                    <button
                      onClick={handleMessage}
                      className="w-full flex items-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-semibold text-sm transition-all border border-blue-200"
                    >
                      <EnvelopeIcon className="h-4 w-4" />
                      Send Message
                    </button>
                    <button className="w-full flex items-center gap-2 px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg font-semibold text-sm transition-all border border-purple-200">
                      <BookOpenIcon className="h-4 w-4" />
                      View Documents
                    </button>
                  </div>
                </div>
              )}
              
              {/* Study Stats */}
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl shadow-sm p-4 border border-orange-200">
                <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <FireIcon className="h-4 w-4 text-orange-500" />
                  Study Streak
                </h3>
                <div className="text-center">
                  <div className="text-4xl font-bold text-orange-600 mb-1">{mockStudent.stats.streak}</div>
                  <div className="text-sm text-gray-700 font-medium mb-3">Days in a row! 🔥</div>
                  <div className="p-2 bg-white rounded-lg">
                    <p className="text-xs text-gray-600">Keep it up! You&apos;re on fire! 🚀</p>
                  </div>
                </div>
              </div>
              
              {/* Total Study Time */}
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl shadow-sm p-4 border border-purple-200">
                <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <ClockIcon className="h-4 w-4 text-purple-500" />
                  Total Study Time
                </h3>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600 mb-1">{mockStudent.stats.studyHours}h</div>
                  <div className="text-xs text-gray-600">That&apos;s {Math.round(mockStudent.stats.studyHours / 24)} days of learning!</div>
                </div>
              </div>
            </div>
          </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
