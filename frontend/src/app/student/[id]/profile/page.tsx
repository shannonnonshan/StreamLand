'use client';

import { Fragment, useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
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
  FireIcon,
  BookOpenIcon,
  VideoCameraIcon,
  DocumentTextIcon,
  CheckBadgeIcon,
  ArrowLeftIcon,
  PencilIcon,
  XMarkIcon,
  PlusIcon,
  BuildingOffice2Icon,
} from '@heroicons/react/24/outline';
import Headerbar from '@/component/student/Headerbar';
import { useAuth } from '@/hooks/useAuth';
import ConfirmDialog from '@/component/ConfirmDialog';
import { useConfirm } from '@/hooks/useConfirm';
import toast, { Toaster } from 'react-hot-toast';
import { getUserStats } from '@/lib/userStatsCache';
import { submitProfileReport } from '@/lib/api/report';
import ProfileReportModal from '@/component/(modal)/ProfileReportModal';

const PrimaryColor = '161853';
const SecondaryColor = 'EC255A';
const STREAK_UPDATED_EVENT = 'streamland:streak-updated';

interface FollowedTeacher {
  id: string;
  name: string;
  avatar?: string;
  subjects?: string[];
  isVerified?: boolean;
}

interface LearningStreakResponse {
  userId: string;
  timezone: string;
  currentStreak: number;
  longestStreak: number;
  totalLearningDays: number;
  streakFreezes: number;
  lastLearningDate?: string | null;
  todayQualified: boolean;
}

interface DailyStreakProgressResponse {
  dateKey: string;
  timezone: string;
  activeWatchSeconds: number;
  completionPercentage: number;
  qualified: boolean;
  goalSeconds: number;
  remainingSeconds: number;
}

interface StreakCalendarDay {
  date: string;
  status: 'learned' | 'freeze' | 'missed';
  awarded: boolean;
  freezeConsumed: boolean;
}

interface StreakCalendarResponse {
  timezone: string;
  startDate: string;
  endDate: string;
  days: StreakCalendarDay[];
}

interface StreakLeaderboardEntry {
  rank: number;
  userId: string;
  fullName: string;
  avatar?: string | null;
  currentStreak: number;
  longestStreak: number;
  isCurrentUser: boolean;
}

interface StreakLeaderboardResponse {
  leaderboard: StreakLeaderboardEntry[];
}

interface ProfileActivityNote {
  id: string;
  userId: string;
  content: string;
  createdAt: string;
  visibility: 'public' | 'followers' | 'private';
  pinned: boolean;
  reactions: Array<{
    userId: string;
    type: 'like' | 'clap' | 'insight';
    createdAt: string;
    user?: { id: string; fullName: string; avatar?: string | null } | null;
  }>;
  comments: Array<{
    id: string;
    userId: string;
    content: string;
    createdAt: string;
    user?: { id: string; fullName: string; avatar?: string | null } | null;
  }>;
}

interface ProfileActivityResponse {
  items: ProfileActivityNote[];
}

type JournalFilter = 'all' | 'notes' | 'checkins';

interface ProfileJournalEntry {
  id: string;
  type: 'note' | 'checkin';
  title: string;
  time: string;
  streak?: number;
  visibility: 'public' | 'followers' | 'private';
  pinned: boolean;
  reactions: ProfileActivityNote['reactions'];
  comments: ProfileActivityNote['comments'];
}

interface StudentStatsResponse {
  following?: number;
  friends?: number;
  courses?: number;
  documents?: number;
  studyHours?: number;
  streak?: number;
}

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

export default function StudentProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { id } = params;
  const { user: currentUser, getProfile } = useAuth();
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();
  
  const [friendshipStatus, setFriendshipStatus] = useState<'NONE' | 'PENDING' | 'ACCEPTED'>('NONE');
  const [friendshipId, setFriendshipId] = useState<string | null>(null);
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
  
  const [stats, setStats] = useState({
    following: 0,
    friends: 0,
    courses: 0,
    documents: 0,
    studyHours: 0,
    streak: 0,
  });

  const [streakInfo, setStreakInfo] = useState<LearningStreakResponse | null>(null);
  const [dailyStreakProgress, setDailyStreakProgress] = useState<DailyStreakProgressResponse | null>(null);
  const [streakCalendar, setStreakCalendar] = useState<StreakCalendarResponse | null>(null);
  const [streakLeaderboard, setStreakLeaderboard] = useState<StreakLeaderboardEntry[]>([]);
  const [isLoadingStreak, setIsLoadingStreak] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  
  const [followedTeachers, setFollowedTeachers] = useState<FollowedTeacher[]>([]);
  const [recentActivity, setRecentActivity] = useState<ProfileJournalEntry[]>([]);
  const [activityFilter, setActivityFilter] = useState<JournalFilter>('all');
  const [activityVisibility, setActivityVisibility] = useState<'public' | 'followers' | 'private'>('followers');
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [newActivityNote, setNewActivityNote] = useState('');
  const [isPostingActivity, setIsPostingActivity] = useState(false);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [reactionPickerOpen, setReactionPickerOpen] = useState<string | null>(null);
  
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
  
  const profileId = Array.isArray(id) ? id[0] : (id as string);
  const isOwnProfile = !!currentUser?.id && currentUser.id === profileId;

  const formatActivityTime = useCallback((value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Just now';

    return date.toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  const formatTotalStudyTime = useCallback((hoursInt: number, todaysSeconds?: number) => {
    const totalSeconds = Math.max(0, Math.floor((hoursInt || 0) * 60) + Math.floor(todaysSeconds || 0));
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.round((totalSeconds % 3600) / 60);
    if (h <= 0 && m <= 0) return '0h';
    if (m <= 0) return `${h}h`;
    return `${h}h ${m}m`;
  }, []);

  const classifyJournalEntry = useCallback((content: string) => {
    const normalized = content.trim();
    const lineCount = normalized.split(/\r?\n/).filter(Boolean).length;
    const isCheckIn = normalized.length <= 120 && lineCount <= 2;
    return isCheckIn ? 'checkin' : 'note';
  }, []);

  const filteredRecentActivity = recentActivity.filter((entry) => {
    if (activityFilter === 'all') return true;
    if (activityFilter === 'notes') return entry.type === 'note';
    return entry.type === 'checkin';
  });
  const pinnedActivity = filteredRecentActivity.find((e) => e.pinned) || null;
  const visibleActivity = filteredRecentActivity;
  const reactionOptions = [
    { type: 'like' as const, label: 'Like', emoji: '👍' },
    { type: 'clap' as const, label: 'Clap', emoji: '👏' },
    { type: 'insight' as const, label: 'Insight', emoji: '💡' },
  ];

  const loadRecentActivity = useCallback(async () => {
    if (!id) return;

    const token = localStorage.getItem('accessToken');
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

    try {
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(`${API_URL}/student/profile-activity/${profileId}?limit=20`, {
        headers,
      });

      if (!response.ok) {
        setRecentActivity([]);
        return;
      }

      const data = (await response.json()) as ProfileActivityResponse;
      const mapped = await Promise.all((data?.items || []).map(async (item) => {
        const stats = await getUserStats(item.userId);
        const type = classifyJournalEntry(item.content) as ProfileJournalEntry['type'];
        return {
          id: item.id,
          type,
          title: item.content,
          time: formatActivityTime(item.createdAt),
          streak: stats?.streak || 0,
          visibility: item.visibility || 'followers',
          pinned: !!item.pinned,
          reactions: item.reactions || [],
          comments: item.comments || [],
        };
      }));

      setRecentActivity(mapped);
    } catch (error) {
      console.error('Error loading profile activity:', error);
      setRecentActivity([]);
    }
  }, [formatActivityTime, profileId]);

  const handlePostActivity = async () => {
    if (!isOwnProfile) return;

    const content = newActivityNote.trim();
    if (!content) {
      toast.error('Please enter a note.');
      return;
    }

    if (content.length > 280) {
      toast.error('Note must be less than 280 characters');
      return;
    }

    const token = localStorage.getItem('accessToken');
    if (!token) {
      toast.error('Please log in again.');
      return;
    }

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    const loadingToastId = toast.loading('Posting your reflection...');

    try {
      setIsPostingActivity(true);

      // Debug: show which API_URL is being used (helps when NEXT_PUBLIC_API_URL not set)
      // eslint-disable-next-line no-console
      console.debug('Posting profile activity to:', API_URL);

      const response = await fetch(`${API_URL}/student/profile-activity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          content,
          visibility: activityVisibility,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        }),
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Failed to post note');
      }

      // (loadJournalEntry shape)
      const created = (await response.json()) as ProfileActivityNote;

      const type = classifyJournalEntry(created.content) as ProfileJournalEntry['type'];
      const newEntry: ProfileJournalEntry = {
        id: created.id,
        type,
        title: created.content,
        time: formatActivityTime(String(created.createdAt)),
        streak: stats.streak || 0,  
        visibility: created.visibility || activityVisibility,
        pinned: false,
        reactions: [],
        comments: [],
      };
      setRecentActivity((prev) => [newEntry, ...prev]);

      setNewActivityNote('');
      loadRecentActivity().catch(() => {});
      window.dispatchEvent(new CustomEvent(STREAK_UPDATED_EVENT, { detail: { updated: true } }));
      toast.success('Reflection added to your journal.', { id: loadingToastId });
    } catch (error) {
      console.error('Error posting activity note:', error);
      toast.error('Could not post note.', { id: loadingToastId });
    } finally {
      setIsPostingActivity(false);
    }
  };

  const handlePinActivity = async (activityId: string, pinned: boolean) => {
    if (!isOwnProfile) return;

    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

    try {
      setActionLoadingId(activityId);
      const response = await fetch(`${API_URL}/student/profile-activity/${activityId}/pin`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pinned }),
      });

      if (!response.ok) {
        throw new Error('Failed to pin activity');
      }

      await loadRecentActivity();
      toast.success(pinned ? 'Pinned to journal.' : 'Unpinned from journal.');
    } catch (error) {
      console.error('Error pinning activity:', error);
      toast.error('Could not update pin.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleToggleReaction = async (activityId: string, type: 'like' | 'clap' | 'insight') => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

    try {
      setActionLoadingId(activityId);
      const response = await fetch(`${API_URL}/student/profile-activity/${activityId}/reactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type }),
      });

      if (!response.ok) {
        throw new Error('Failed to toggle reaction');
      }

      const updated = (await response.json()) as ProfileActivityNote;
      setRecentActivity((prev) => prev.map((entry) => (
        entry.id === updated.id
          ? {
              ...entry,
              pinned: !!updated.pinned,
              visibility: updated.visibility || entry.visibility,
              reactions: updated.reactions || [],
              comments: updated.comments || [],
            }
          : entry
      )));
    } catch (error) {
      console.error('Error toggling reaction:', error);
      toast.error('Could not update reaction.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleAddComment = async (activityId: string) => {
    const content = (commentDrafts[activityId] || '').trim();
    if (!content) return;

    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

    try {
      setActionLoadingId(activityId);
      const response = await fetch(`${API_URL}/student/profile-activity/${activityId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        throw new Error('Failed to add comment');
      }

      const updated = (await response.json()) as ProfileActivityNote;
      setCommentDrafts((prev) => ({ ...prev, [activityId]: '' }));
      setRecentActivity((prev) => prev.map((entry) => (
        entry.id === updated.id
          ? {
              ...entry,
              pinned: !!updated.pinned,
              visibility: updated.visibility || entry.visibility,
              reactions: updated.reactions || [],
              comments: updated.comments || [],
            }
          : entry
      )));
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Could not add comment.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const normalizeStats = useCallback(
    (
      rawStats: StudentStatsResponse | null | undefined,
      followedTeacherCount?: number,
      savedDocumentCount?: number,
    ) => {
      const safeFollowing = Number(rawStats?.following) || 0;
      const safeFriends = Number(rawStats?.friends) || 0;
      const safeDocuments = Number(rawStats?.documents) || 0;
      const safeStudyHours = Number(rawStats?.studyHours) || 0;
      const safeStreak = Number(rawStats?.streak) || 0;

      const resolvedFollowedCount =
        typeof followedTeacherCount === 'number'
          ? followedTeacherCount
          : safeFollowing;

      const resolvedDocumentCount =
        typeof savedDocumentCount === 'number'
          ? savedDocumentCount
          : safeDocuments;

      return {
        following: resolvedFollowedCount,
        friends: safeFriends,
        courses: resolvedFollowedCount,
        documents: resolvedDocumentCount,
        studyHours: safeStudyHours,
        streak: safeStreak,
      };
    },
    [],
  );

  const checkFriendshipStatus = useCallback(async () => {
    if (isOwnProfile) return;
    
    try {
      const token = localStorage.getItem('accessToken');
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      
      const friendshipResponse = await fetch(`${API_URL}/student/friendship-status/${profileId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (friendshipResponse.ok) {
        const friendshipData = await friendshipResponse.json();
        setFriendshipStatus(friendshipData.status || 'NONE');
        setFriendshipId(friendshipData.friendshipId || null);
      }
    } catch (error) {
      console.error('Error checking friendship status:', error);
    }
  }, [isOwnProfile, profileId]);

  const loadProfile = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('accessToken');
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      
      // Fetch profile, stats, and followed teachers in parallel
      const [profileResponse, statsResponse, followedTeachersResponse, savedDocumentsResponse] = await Promise.all([
        fetch(`${API_URL}/auth/${profileId}/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/student/stats/${profileId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => null),
        isOwnProfile
          ? fetch(`${API_URL}/student/followed-teachers`, {
              headers: { Authorization: `Bearer ${token}` },
            }).catch(() => null)
          : Promise.resolve(null),
        isOwnProfile
          ? fetch(`${API_URL}/student/documents/saved`, {
              headers: { Authorization: `Bearer ${token}` },
            }).catch(() => null)
          : Promise.resolve(null),
      ]);
      
      // Check friendship status
      if (!isOwnProfile) {
        const friendshipResponse = await fetch(`${API_URL}/student/friendship-status/${profileId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (friendshipResponse.ok) {
          const friendshipData = await friendshipResponse.json();
          setFriendshipStatus(friendshipData.status || 'NONE');
          setFriendshipId(friendshipData.friendshipId || null);
        }
      }
      
      if (!profileResponse.ok) {
        const errorData = await profileResponse.text();
        console.error('Error response:', errorData);
        throw new Error(`Failed to load profile: ${profileResponse.status} ${errorData}`);
      }

      const data = await profileResponse.json();
      setProfileData(data);
      
      let followedTeacherCount: number | undefined;
      let savedDocumentCount: number | undefined;

      // Load followed teachers
      if (followedTeachersResponse && followedTeachersResponse.ok) {
        const teachersData = await followedTeachersResponse.json();
        const safeTeachers = Array.isArray(teachersData) ? teachersData : [];
        setFollowedTeachers(safeTeachers);
        followedTeacherCount = safeTeachers.length;
      } else if (isOwnProfile) {
        setFollowedTeachers([]);
      }

      if (savedDocumentsResponse && savedDocumentsResponse.ok) {
        const savedDocumentsData = await savedDocumentsResponse.json();
        if (Array.isArray(savedDocumentsData)) {
          savedDocumentCount = savedDocumentsData.length;
        }
      }

      // Load stats if available
      if (statsResponse && statsResponse.ok) {
        const statsData = (await statsResponse.json()) as StudentStatsResponse;
        setStats(normalizeStats(statsData, followedTeacherCount, savedDocumentCount));
      } else {
        setStats((prev) => normalizeStats(prev, followedTeacherCount, savedDocumentCount));
      }
      
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
        id: profileId,
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

  const loadStreakData = useCallback(async () => {
    const token = localStorage.getItem('accessToken');
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

    if (!token) {
      // No auth token: clear streak UI
      setStreakInfo(null);
      setDailyStreakProgress(null);
      setStreakCalendar(null);
      setStreakLeaderboard([]);
      return;
    }

    setIsLoadingStreak(true);
    try {
      // If viewing someone else's profile, fetch public stats and map minimal streak data
      if (!isOwnProfile) {
        const statsResp = await fetch(`${API_URL}/student/stats/${profileId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (statsResp.ok) {
          const statsData = (await statsResp.json()) as StudentStatsResponse;
          setStats(normalizeStats(statsData));
          setStreakInfo({
            userId: profileId,
            timezone,
            currentStreak: Number(statsData?.streak || 0),
            longestStreak: 0,
            totalLearningDays: 0,
            streakFreezes: 0,
            lastLearningDate: null,
            todayQualified: false,
          });
        } else {
          setStreakInfo(null);
        }

        // No detailed daily/calendar/leaderboard for other users
        setDailyStreakProgress(null);
        setStreakCalendar(null);
        setStreakLeaderboard([]);
        return;
      }

      // Own profile: fetch full streak details
      const [streakResult, dailyResult, calendarResult, leaderboardResult] = await Promise.allSettled([
        fetch(`${API_URL}/student/streak?timezone=${encodeURIComponent(timezone)}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/student/streak/daily-progress?timezone=${encodeURIComponent(timezone)}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/student/streak/calendar?days=30&timezone=${encodeURIComponent(timezone)}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/student/streak/leaderboard?limit=8`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const streakResp = streakResult.status === 'fulfilled' ? streakResult.value : null;
      const dailyResp = dailyResult.status === 'fulfilled' ? dailyResult.value : null;
      const calendarResp = calendarResult.status === 'fulfilled' ? calendarResult.value : null;
      const leaderboardResp = leaderboardResult.status === 'fulfilled' ? leaderboardResult.value : null;

      if (streakResp?.ok) {
        const streak = (await streakResp.json()) as LearningStreakResponse;
        setStreakInfo(streak);
        setStats((prev) => ({ ...prev, streak: streak.currentStreak || prev.streak }));
      } else {
        setStreakInfo((prev) => prev || {
          userId: profileId,
          timezone,
          currentStreak: 0,
          longestStreak: 0,
          totalLearningDays: 0,
          streakFreezes: 0,
          lastLearningDate: null,
          todayQualified: false,
        });
      }

      if (dailyResp?.ok) {
        const daily = (await dailyResp.json()) as DailyStreakProgressResponse;
        setDailyStreakProgress(daily);
      }

      if (calendarResp?.ok) {
        const calendar = (await calendarResp.json()) as StreakCalendarResponse;
        setStreakCalendar(calendar);
      }

      if (leaderboardResp?.ok) {
        const leaderboard = (await leaderboardResp.json()) as StreakLeaderboardResponse;
        setStreakLeaderboard(leaderboard?.leaderboard || []);
      }

      setStreakInfo((prev) => {
        if (prev) return prev;
        const fallbackStreak = Number(stats.streak || 0);
        return {
          userId: profileId,
          timezone,
          currentStreak: fallbackStreak,
          longestStreak: fallbackStreak,
          totalLearningDays: fallbackStreak,
          streakFreezes: 0,
          lastLearningDate: null,
          todayQualified: false,
        };
      });
    } catch (error) {
      console.error('Error loading streak data:', error);
    } finally {
      setIsLoadingStreak(false);
    }
  }, [isOwnProfile]);

  useEffect(() => {
    loadProfile();
    loadStreakData();
    loadRecentActivity();
    
    // Listen for friend request acceptance
    const handleFriendRequestAccepted = () => {
      checkFriendshipStatus();
    };
    
    // Listen for visibility change to refetch when page becomes visible
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkFriendshipStatus();
        loadStreakData();
        loadRecentActivity();
      }
    };

    const handleStreakUpdated = (ev?: any) => {
      const detail = ev?.detail;
      if (detail && detail.optimisticDaily && typeof detail.optimisticDaily.activeWatchSeconds === 'number') {
        const active = Math.max(0, Math.floor(detail.optimisticDaily.activeWatchSeconds));
        setDailyStreakProgress((prev) => ({
          dateKey: prev?.dateKey || new Date().toISOString().slice(0, 10),
          timezone: prev?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
          activeWatchSeconds: active,
          completionPercentage: prev?.completionPercentage || 0,
          qualified: prev?.qualified || false,
          goalSeconds: prev?.goalSeconds || 900,
          remainingSeconds: Math.max(0, (prev?.goalSeconds || 900) - active),
        }));
        // do a background refresh of authoritative data
        void loadStreakData();
        return;
      }

      loadStreakData();
    };
    
    window.addEventListener('friendRequestAccepted', handleFriendRequestAccepted);
    window.addEventListener(STREAK_UPDATED_EVENT, handleStreakUpdated as EventListener);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('friendRequestAccepted', handleFriendRequestAccepted);
      window.removeEventListener(STREAK_UPDATED_EVENT, handleStreakUpdated as EventListener);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (isOwnProfile) {
      loadStreakData();
    }
  }, [isOwnProfile, loadStreakData]);
  
  // Validation functions
  const validateFullName = (name: string): string => {
    if (!name || name.trim().length < 2) {
      return 'Full name must be at least 2 characters';
    }
    if (name.length > 100) {
      return 'Full name must not exceed 100 characters';
    }
    if (!/^[a-zA-Z\s'\-À-ÿ]+$/.test(name)) {
      return 'Full name can only contain letters, spaces, hyphens, and apostrophes';
    }
    return '';
  };

  const validateSchool = (school: string): string => {
    if (school && school.trim().length > 0) {
      if (school.length < 2) {
        return 'School name must be at least 2 characters';
      }
      if (school.length > 200) {
        return 'School name must not exceed 200 characters';
      }
      if (!/^[a-zA-Z0-9\s.'\-À-ÿ]+$/.test(school)) {
        return 'School name can only contain letters, numbers, spaces, periods, hyphens, and apostrophes';
      }
    }
    return '';
  };

  const validateGrade = (grade: string): string => {
    if (grade && grade.trim().length > 0) {
      if (grade.length > 50) {
        return 'Grade must not exceed 50 characters';
      }
      if (!/^[a-zA-Z0-9\s\-]+$/.test(grade)) {
        return 'Grade can only contain letters, numbers, spaces, and hyphens';
      }
    }
    return '';
  };

  const validateLocation = (location: string): string => {
    if (location && location.trim().length > 0) {
      if (location.length > 100) {
        return 'Location must not exceed 100 characters';
      }
      if (!/^[a-zA-Z0-9\s,.'\-À-ÿ]+$/.test(location)) {
        return 'Location contains invalid characters';
      }
    }
    return '';
  };

  const handleSaveProfile = async () => {
    // Validate all fields before saving
    const fullNameError = validateFullName(editForm.fullName);
    const schoolError = validateSchool(editForm.school);
    const gradeError = validateGrade(editForm.grade);
    const locationError = validateLocation(editForm.location);

    if (fullNameError || schoolError || gradeError || locationError) {
      if (fullNameError) toast.error(fullNameError);
      if (schoolError) toast.error(schoolError);
      if (gradeError) toast.error(gradeError);
      if (locationError) toast.error(locationError);
      return;
    }

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
      
      // Refetch user profile to update Headerbar if this is own profile
      if (isOwnProfile) {
        await getProfile();
      }
      
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
  
  const handleAddFriend = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      
      const response = await fetch(`${API_URL}/student/friends/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ receiverId: id }),
      });
      
      if (response.ok) {
        setFriendshipStatus('PENDING');
      }
    } catch (error) {
      console.error('Failed to send friend request:', error);
    }
  };
  
  const handleUnfriend = async () => {
    if (!friendshipId) return;
    
    confirm(
      'Remove Friend',
      'Are you sure you want to remove this friend? This action cannot be undone.',
      async () => {
        try {
          const token = localStorage.getItem('accessToken');
          const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
          
          const response = await fetch(`${API_URL}/student/friends/${friendshipId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
          
          if (response.ok) {
            setFriendshipStatus('NONE');
            setFriendshipId(null);
          }
        } catch (error) {
          console.error('Failed to unfriend:', error);
        }
      },
      { type: 'danger', confirmText: 'Remove', cancelText: 'Cancel' }
    );
  };
  
  const handleMessage = () => {
    // Get current student ID from URL
    const currentPath = window.location.pathname;
    const match = currentPath.match(/\/student\/([^\/]+)\//);
    const studentId = match ? match[1] : 'guest';
    router.push(`/student/${studentId}/message?userId=${id}`);
  };

  const handleOpenReportModal = () => {
    if (isOwnProfile) return;
    setIsReportModalOpen(true);
  };

  const handleSubmitReport = async (formData: {
    category: string;
    reason: string;
    description: string;
    screenshots: string[];
  }) => {
    if (!currentUser) {
      toast.error('Please sign in to report this profile.');
      return;
    }

    try {
      setIsSubmittingReport(true);
      await submitProfileReport({
        reportedId: profileId,
        targetType: 'student',
        category: formData.category.trim(),
        reason: formData.reason.trim(),
        description: formData.description.trim() || undefined,
        screenshots: formData.screenshots,
        metadata: {
          pageUrl: window.location.href,
          reportedRole: 'student',
          reporterName: currentUser.fullName || currentUser.email || 'Unknown user',
        },
      });
      setIsReportModalOpen(false);
      toast.success('Report submitted to admin review.');
    } catch (error) {
      console.error('Error submitting report:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to submit report.');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <Headerbar />
      
      <div className="pt-16 pl-20">
        <div className="max-w-[1400px] mx-auto px-8 py-6">
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
                        {profileData.avatar ? (
                          <Image
                            src={profileData.avatar}
                            alt={profileData.fullName}
                            width={96}
                            height={96}
                            className="h-24 w-24 rounded-2xl object-cover shadow-lg"
                          />
                        ) : (
                          <div className="h-24 w-24 rounded-2xl bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-3xl font-bold shadow-lg">
                            {profileData.fullName?.charAt(0) || 'U'}
                          </div>
                        )}
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
                        <span>
                          Joined {profileData.createdAt && !isNaN(new Date(profileData.createdAt).getTime())
                            ? new Date(profileData.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                            : 'Recently'}
                        </span>
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
                      {friendshipStatus === 'ACCEPTED' ? (
                        <button
                          onClick={handleUnfriend}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-sm transition-all"
                        >
                          <UserMinusIcon className="h-4 w-4" />
                          Unfriend
                        </button>
                      ) : friendshipStatus === 'PENDING' ? (
                        <button
                          disabled
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-100 text-yellow-700 font-semibold text-sm cursor-not-allowed"
                        >
                          <ClockIcon className="h-4 w-4" />
                          Pending
                        </button>
                      ) : (
                        <button
                          onClick={handleAddFriend}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg bg-[#${PrimaryColor}] hover:bg-[#1a1d6b] text-white font-semibold text-sm transition-all shadow-md hover:shadow-lg`}
                        >
                          <UserPlusIcon className="h-4 w-4" />
                          Add Friend
                        </button>
                      )}
                      <button
                        onClick={handleMessage}
                        className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#${SecondaryColor}] hover:bg-[#d41f4d] text-white font-semibold text-xs transition-all shadow-sm hover:shadow-md`}
                      >
                        <ChatBubbleLeftRightIcon className="h-4 w-4" />
                        Message
                      </button>
                      <button
                        onClick={handleOpenReportModal}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-rose-300 bg-white text-rose-600 font-semibold text-xs transition-all hover:bg-rose-50 hover:border-rose-400"
                      >
                        Report
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
                  <ProfileReportModal
                    open={isReportModalOpen}
                    title="Report this student profile"
                    targetLabel={profileData ? `${profileData.fullName} • ${profileData.role}` : 'Student profile'}
                    onClose={() => setIsReportModalOpen(false)}
                    onSubmit={handleSubmitReport}
                    loading={isSubmittingReport}
                  />
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
                  <div className="text-2xl font-bold text-blue-600">{stats.following}</div>
                  <div className="text-xs text-gray-600 font-medium mt-0.5">Following</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-xl border border-gray-200 hover:border-purple-300 transition-colors">
                  <div className="text-2xl font-bold text-purple-600">{stats.friends}</div>
                  <div className="text-xs text-gray-600 font-medium mt-0.5">Friends</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-xl border border-gray-200 hover:border-green-300 transition-colors">
                  <div className="text-2xl font-bold text-green-600">{stats.courses}</div>
                  <div className="text-xs text-gray-600 font-medium mt-0.5">Courses</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-xl border border-gray-200 hover:border-yellow-300 transition-colors">
                  <div className="text-2xl font-bold text-yellow-600">{stats.documents}</div>
                  <div className="text-xs text-gray-600 font-medium mt-0.5">Documents</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-xl border border-gray-200 hover:border-indigo-300 transition-colors">
                  <div className="text-2xl font-bold text-indigo-600">{formatTotalStudyTime(stats.studyHours, isOwnProfile ? dailyStreakProgress?.activeWatchSeconds : 0)}</div>
                  <div className="text-xs text-gray-600 font-medium mt-0.5">Study Hours</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-xl border border-gray-200 hover:border-orange-300 transition-colors">
                  <div className="flex items-center justify-center gap-1 text-2xl font-bold text-orange-600">
                    {stats.streak}
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
                Personal Activity
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="col-span-2">
              {/* About Tab */}
              {activeTab === 'about' && (
                <div className="space-y-4">
                  {isOwnProfile && (
                    <div className="rounded-2xl border border-orange-200 bg-gradient-to-r from-orange-50 via-amber-50 to-yellow-50 p-5 shadow-sm">
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-orange-700">Learning Streak</p>
                          <p className="mt-1 text-2xl font-extrabold text-orange-900">
                            {isLoadingStreak ? '...' : `${(streakInfo?.currentStreak ?? stats.streak ?? 0)} consecutive days`}
                            <span className="ml-2">🔥</span>
                          </p>
                          <p className="mt-1 text-sm text-orange-800">
                            {(streakInfo?.todayQualified || (stats.streak || 0) > 0)
                              ? "You have completed today's streak."
                              : 'Study more today to keep your streak alive.'}
                          </p>
                          <p className="mt-1 text-xs text-orange-700/80">
                            Longest: {streakInfo?.longestStreak ?? 0} days • Total learning days: {streakInfo?.totalLearningDays ?? 0}
                          </p>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="relative h-20 w-20">
                            <svg viewBox="0 0 36 36" className="h-20 w-20 -rotate-90">
                              <path
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none"
                                stroke="#fcd34d"
                                strokeWidth="3"
                                strokeLinecap="round"
                                opacity="0.35"
                              />
                              <path
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none"
                                stroke="#f59e0b"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeDasharray={`${Math.max(0, Math.min(100, (((dailyStreakProgress?.goalSeconds || 1) - (dailyStreakProgress?.remainingSeconds || 0)) / (dailyStreakProgress?.goalSeconds || 1)) * 100)).toFixed(2)}, 100`}
                              />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center text-center">
                              <div>
                                <p className="text-[11px] font-bold text-orange-900">Daily</p>
                                <p className="text-[11px] text-orange-700">
                                  {Math.max(0, Math.floor((dailyStreakProgress?.activeWatchSeconds || 0) / 60))}m
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="text-sm text-orange-800">
                            <p className="font-semibold">Today's Goal</p>
                            <p>
                              {Math.max(0, Math.floor((dailyStreakProgress?.activeWatchSeconds || 0) / 60))}/
                              {Math.max(1, Math.floor((dailyStreakProgress?.goalSeconds || 900) / 60))} minutes
                            </p>
                            <p className="text-xs text-orange-700/80">
                              {Math.max(0, Math.floor((dailyStreakProgress?.remainingSeconds || 0) / 60))} minutes left to complete
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-4 lg:grid-cols-2">
                        <div className="rounded-xl border border-orange-200/70 bg-white/70 p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">30-Day Calendar</p>
                          <div className="mt-2 grid grid-cols-10 gap-1.5">
                            {(streakCalendar?.days || []).slice(-30).map((day) => {
                              const date = new Date(`${day.date}T00:00:00`);
                              const colorClass =
                                day.status === 'learned'
                                  ? 'bg-emerald-500'
                                  : day.status === 'freeze'
                                    ? 'bg-sky-400'
                                    : 'bg-orange-100';

                              return (
                                <div
                                  key={day.date}
                                  className={`h-4 w-4 rounded-sm ${colorClass}`}
                                  title={`${date.toLocaleDateString()} - ${day.status}`}
                                />
                              );
                            })}
                          </div>
                          <div className="mt-2 flex items-center gap-3 text-[11px] text-orange-800">
                            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Learned</span>
                            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-sky-400" /> Freeze</span>
                            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-orange-100 border border-orange-200" /> Missed</span>
                          </div>
                        </div>

                        <div className="rounded-xl border border-orange-200/70 bg-white/70 p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">Leaderboard</p>
                          <div className="mt-2 space-y-1.5">
                            {streakLeaderboard.length === 0 ? (
                              <p className="text-xs text-orange-700/80">No leaderboard data yet.</p>
                            ) : (
                              streakLeaderboard.slice(0, 5).map((entry) => (
                                <div
                                  key={`${entry.userId}-${entry.rank}`}
                                  className={`flex items-center justify-between rounded-md px-2 py-1.5 text-sm ${entry.isCurrentUser ? 'bg-orange-100/80 border border-orange-200' : 'bg-white/70'}`}
                                >
                                  <p className="truncate pr-2 text-orange-900">
                                    <span className="mr-2 font-bold">#{entry.rank}</span>
                                    {entry.fullName}
                                    {entry.isCurrentUser ? ' (You)' : ''}
                                  </p>
                                  <p className="shrink-0 font-semibold text-orange-800">🔥 {entry.currentStreak}</p>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Interests */}
                  <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <SparklesIcon className="h-5 w-5 text-purple-500" />
                      Interests
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {interests && interests.length > 0 ? (
                        interests.map((interest, index) => (
                          <span
                            key={index}
                            className="px-4 py-1.5 bg-gray-100 text-gray-700 rounded-lg font-medium text-sm border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-all cursor-pointer"
                          >
                            {interest}
                          </span>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500">No interests added yet</p>
                      )}
                    </div>
                  </div>
                  
                  {/* School Information */}
                  {(profileData?.studentProfile?.school || profileData?.studentProfile?.grade) && (
                    <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
                      <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <BuildingOffice2Icon className="h-5 w-5 text-blue-500" />
                        Education
                      </h3>
                      <div className="space-y-2">
                        {profileData.studentProfile.school && (
                          <p className="text-sm text-gray-700">
                            <span className="font-semibold">School:</span> {profileData.studentProfile.school}
                          </p>
                        )}
                        {profileData.studentProfile.grade && (
                          <p className="text-sm text-gray-700">
                            <span className="font-semibold">Grade:</span> {profileData.studentProfile.grade}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Following Channels Tab */}
              {activeTab === 'channels' && (
                <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <VideoCameraIcon className="h-5 w-5 text-red-500" />
                    Following Channels ({followedTeachers.length})
                  </h3>
                  <div className="space-y-3">
                    {followedTeachers.length > 0 ? (
                      followedTeachers.map((teacher) => (
                      <div
                        key={teacher.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            {teacher.avatar ? (
                              <Image
                                src={teacher.avatar}
                                alt={teacher.name}
                                width={48}
                                height={48}
                                className="h-12 w-12 rounded-xl object-cover"
                              />
                            ) : (
                              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-lg font-bold">
                                {teacher.name?.charAt(0) || 'T'}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h4 className="font-semibold text-sm text-gray-900">{teacher.name}</h4>
                              {teacher.isVerified && (
                                <CheckBadgeIcon className="h-4 w-4 text-blue-500" />
                              )}
                            </div>
                            <p className="text-xs text-gray-600">{teacher.subjects?.join(', ') || 'Teacher'}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => router.push(`/teacher/public/${teacher.id}`)}
                          className="px-4 py-1.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-semibold text-xs transition-all shadow-sm hover:shadow-md opacity-0 group-hover:opacity-100"
                        >
                          View
                        </button>
                      </div>
                    ))
                    ) : (
                      <p className="text-sm text-gray-500 text-center py-4">Not following any teachers yet</p>
                    )}
                  </div>
                </div>
              )}

              {/* Recent Activity Tab */}
              {activeTab === 'activity' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

                  {/* Header */}
                  <div className="px-5 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold text-gray-900">Learning Journal</h3>
                      <p className="mt-0.5 text-xs text-gray-400">{recentActivity.length} {recentActivity.length === 1 ? 'entry' : 'entries'}</p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 border border-orange-100 px-3 py-1 text-xs font-semibold text-orange-600">
                      <FireIcon className="h-3.5 w-3.5" />
                      {streakInfo?.currentStreak ?? stats.streak ?? 0} day streak
                    </span>
                  </div>

                  {/* Compose — own profile only */}
                  {isOwnProfile && (
                    <div className="px-5 py-4 bg-gray-50/60 border-b border-gray-100">
                      <div className="flex gap-3">
                        {profileData?.avatar ? (
                          <img src={profileData.avatar} alt="" className="h-9 w-9 rounded-full object-cover shrink-0 mt-0.5" />
                        ) : (
                          <div className="h-9 w-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5 text-sm font-bold text-indigo-600">
                            {profileData?.fullName?.charAt(0) || 'U'}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <textarea
                            value={newActivityNote}
                            onChange={(e) => setNewActivityNote(e.target.value)}
                            placeholder="What did you learn today?"
                            maxLength={280}
                            rows={newActivityNote.length > 60 ? 3 : 1}
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 resize-none"
                          />
                          {newActivityNote.length > 0 && (
                            <div className="mt-2 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className={`text-[11px] ${newActivityNote.length > 250 ? 'text-red-500' : 'text-gray-400'}`}>
                                  {280 - newActivityNote.length}
                                </span>
                                <select
                                  value={activityVisibility}
                                  onChange={(e) => setActivityVisibility(e.target.value as 'public' | 'followers' | 'private')}
                                  className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-600 outline-none focus:border-indigo-300"
                                >
                                  <option value="public">🌐 Public</option>
                                  <option value="followers">👥 Followers</option>
                                  <option value="private">🔒 Only me</option>
                                </select>
                              </div>
                              <button
                                onClick={handlePostActivity}
                                disabled={isPostingActivity || !newActivityNote.trim()}
                                className="rounded-full bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                {isPostingActivity ? 'Posting…' : 'Post'}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Pinned banner — only when user actually pinned something */}
                  {pinnedActivity && (
                    <div className="px-5 py-2.5 bg-amber-50 border-b border-amber-100 flex items-center gap-2 text-xs text-amber-700">
                      <span className="text-amber-500">📌</span>
                      <span className="font-medium truncate flex-1">{pinnedActivity.title}</span>
                      {isOwnProfile && (
                        <button
                          onClick={() => handlePinActivity(pinnedActivity.id, false)}
                          className="text-amber-500 hover:text-amber-700 transition shrink-0 underline underline-offset-2"
                        >
                          Unpin
                        </button>
                      )}
                    </div>
                  )}

                  {/* Thread list */}
                  <div className="divide-y divide-gray-100">
                    {recentActivity.length === 0 ? (
                      <div className="py-14 text-center">
                        <DocumentTextIcon className="mx-auto h-9 w-9 text-gray-200 mb-3" />
                        <p className="text-sm text-gray-400">No entries yet.</p>
                        {isOwnProfile && <p className="mt-1 text-xs text-gray-400">Write your first note above.</p>}
                      </div>
                    ) : (
                      recentActivity.map((activity) => {
                        const totalReactions = activity.reactions.length;
                        const myReaction = activity.reactions.find((r) => r.userId === currentUser?.id);
                        const commentsExpanded = expandedComments.has(activity.id);
                        const commentCount = activity.comments.length;
                        const reactionPicker = reactionPickerOpen === activity.id;

                        return (
                          <div key={activity.id} className="px-5 py-4 group">
                            {/* Thread row */}
                            <div className="flex gap-3">
                              {/* Avatar */}
                              {profileData?.avatar ? (
                                <img src={profileData.avatar} alt="" className="h-8 w-8 rounded-full object-cover shrink-0 mt-0.5" />
                              ) : (
                                <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold text-indigo-600">
                                  {profileData?.fullName?.charAt(0) || 'U'}
                                </div>
                              )}

                              {/* Content */}
                              <div className="min-w-0 flex-1">
                                {/* Name + meta */}
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-semibold text-gray-900">{profileData?.fullName || 'Student'}</span>
                                  {activity.pinned && <span className="text-amber-500 text-xs">📌</span>}
                                  <span className="text-xs text-gray-400">{activity.time}</span>
                                  <span className={`text-[11px] ${activity.visibility === 'public' ? 'text-sky-500' : activity.visibility === 'followers' ? 'text-gray-400' : 'text-gray-300'}`}>
                                    {activity.visibility === 'public' ? '· 🌐' : activity.visibility === 'followers' ? '· 👥' : '· 🔒'}
                                  </span>
                                </div>

                                {/* Body */}
                                <p className="mt-1 text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{activity.title}</p>

                                {/* Action bar */}
                                <div className="mt-2.5 flex items-center gap-1 text-gray-400 -ml-1">
                                  {/* Reaction button with hover picker */}
                                  <div className="relative">
                                    <button
                                      onMouseEnter={() => setReactionPickerOpen(activity.id)}
                                      onMouseLeave={() => setReactionPickerOpen(null)}
                                      onClick={() => myReaction
                                        ? handleToggleReaction(activity.id, myReaction.type)
                                        : handleToggleReaction(activity.id, 'like')
                                      }
                                      disabled={actionLoadingId === activity.id}
                                      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs transition hover:bg-gray-100 disabled:opacity-50 ${myReaction ? 'text-indigo-600 font-semibold' : 'text-gray-500'}`}
                                    >
                                      <span className="text-base leading-none">{myReaction ? reactionOptions.find(r => r.type === myReaction.type)?.emoji || '👍' : '👍'}</span>
                                      {totalReactions > 0 && <span>{totalReactions}</span>}
                                    </button>

                                    {/* Hover picker */}
                                    {reactionPicker && (
                                      <div
                                        onMouseEnter={() => setReactionPickerOpen(activity.id)}
                                        onMouseLeave={() => setReactionPickerOpen(null)}
                                        className="absolute bottom-full left-0 mb-1.5 flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-1.5 shadow-lg z-10"
                                      >
                                        {reactionOptions.map((r) => {
                                          const active = myReaction?.type === r.type;
                                          return (
                                            <button
                                              key={r.type}
                                              onClick={(e) => { e.stopPropagation(); handleToggleReaction(activity.id, r.type); setReactionPickerOpen(null); }}
                                              title={r.label}
                                              className={`flex h-8 w-8 items-center justify-center rounded-full text-lg transition hover:scale-125 hover:bg-gray-100 ${active ? 'scale-110 bg-indigo-50' : ''}`}
                                            >
                                              {r.emoji}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>

                                  {/* Comment toggle */}
                                  <button
                                    onClick={() => setExpandedComments((prev) => {
                                      const next = new Set(prev);
                                      next.has(activity.id) ? next.delete(activity.id) : next.add(activity.id);
                                      return next;
                                    })}
                                    className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs text-gray-500 transition hover:bg-gray-100"
                                  >
                                    <ChatBubbleLeftRightIcon className="h-4 w-4" />
                                    {commentCount > 0 && <span>{commentCount}</span>}
                                    <span>{commentsExpanded ? 'Hide' : 'Reply'}</span>
                                  </button>

                                  {/* Pin — own profile */}
                                  {isOwnProfile && (
                                    <button
                                      onClick={() => handlePinActivity(activity.id, !activity.pinned)}
                                      disabled={actionLoadingId === activity.id}
                                      className={`ml-auto rounded-full px-2.5 py-1.5 text-xs transition hover:bg-gray-100 disabled:opacity-50 opacity-0 group-hover:opacity-100 ${activity.pinned ? 'text-amber-500' : 'text-gray-400'}`}
                                    >
                                      {activity.pinned ? 'Unpin' : 'Pin'}
                                    </button>
                                  )}
                                </div>

                                {/* Comment thread — collapsed by default */}
                                {commentsExpanded && (
                                  <div className="mt-3 space-y-2.5 border-l-2 border-gray-100 pl-4">
                                    {activity.comments.map((comment) => (
                                      <div key={comment.id} className="flex gap-2.5">
                                        <div className="h-6 w-6 shrink-0 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500 mt-0.5">
                                          {comment.user?.fullName?.charAt(0) || 'U'}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-baseline gap-2">
                                            <span className="text-xs font-semibold text-gray-800">{comment.user?.fullName || 'Student'}</span>
                                          </div>
                                          <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{comment.content}</p>
                                        </div>
                                      </div>
                                    ))}

                                    {/* Reply input */}
                                    <div className="flex gap-2 pt-1">
                                      <div className="h-6 w-6 shrink-0 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-500 mt-0.5">
                                        {currentUser?.fullName?.charAt(0) || 'U'}
                                      </div>
                                      <div className="flex-1 flex gap-2">
                                        <input
                                          value={commentDrafts[activity.id] || ''}
                                          onChange={(e) => setCommentDrafts((prev) => ({ ...prev, [activity.id]: e.target.value }))}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey && (commentDrafts[activity.id] || '').trim()) {
                                              e.preventDefault();
                                              handleAddComment(activity.id);
                                            }
                                          }}
                                          placeholder="Write a reply…"
                                          className="min-w-0 flex-1 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-800 outline-none transition focus:border-indigo-300 focus:bg-white"
                                        />
                                        <button
                                          onClick={() => handleAddComment(activity.id)}
                                          disabled={actionLoadingId === activity.id || !(commentDrafts[activity.id] || '').trim()}
                                          className="rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                                        >
                                          Send
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
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
              
              {/* Total Study Time */}
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl shadow-sm p-4 border border-purple-200">
                <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <ClockIcon className="h-4 w-4 text-purple-500" />
                  Total Study Time
                </h3>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600 mb-1">{formatTotalStudyTime(stats.studyHours, isOwnProfile ? dailyStreakProgress?.activeWatchSeconds : 0)}</div>
                  <div className="text-xs text-gray-600">{(stats.studyHours || (isOwnProfile && (dailyStreakProgress?.activeWatchSeconds || 0) > 0)) ? `That's ${Math.round((stats.studyHours * 3600 + (isOwnProfile ? (dailyStreakProgress?.activeWatchSeconds || 0) : 0)) / (24 * 3600))} days of learning!` : 'Start learning today!'}</div>
                </div>
              </div>
            </div>
          </div>
            </>
          )}
        </div>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        type={confirmState.type}
        confirmText={confirmState.confirmText}
        cancelText={confirmState.cancelText}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
      
      {/* Toast Notifications */}
      <Toaster />
    </div>
  );
}