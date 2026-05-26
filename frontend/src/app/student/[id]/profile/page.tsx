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
  
  const [followedTeachers, setFollowedTeachers] = useState<FollowedTeacher[]>([]);
  const [recentActivity, setRecentActivity] = useState<ProfileJournalEntry[]>([]);
  const [activityFilter, setActivityFilter] = useState<JournalFilter>('all');
  const [activityVisibility, setActivityVisibility] = useState<'public' | 'followers' | 'private'>('followers');
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [newActivityNote, setNewActivityNote] = useState('');
  const [isPostingActivity, setIsPostingActivity] = useState(false);
  
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

  const formatActivityTime = useCallback((value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Vừa xong';

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
  const pinnedActivity = filteredRecentActivity[0] || null;
  const visibleActivity = filteredRecentActivity.slice(1);
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

      const response = await fetch(`${API_URL}/student/profile-activity/${id}?limit=20`, {
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
  }, [formatActivityTime, id]);

  const handlePostActivity = async () => {
    if (!isOwnProfile) return;

    const content = newActivityNote.trim();
    if (!content) {
      toast.error('Please enter a note.');
      return;
    }

    if (content.length > 280) {
      toast.error('Note tối đa 280 ký tự');
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

      // Parse created activity returned by backend (minimal shape)
      const created = (await response.json()) as { id: string; userId: string; content: string; visibility?: 'public' | 'followers' | 'private'; createdAt: string };

      // Optimistically prepend the created entry so the UI updates immediately
      try {
        const stats = await getUserStats(created.userId);
        const type = classifyJournalEntry(created.content) as ProfileJournalEntry['type'];
        const newEntry: ProfileJournalEntry = {
          id: created.id,
          type,
          title: created.content,
          time: formatActivityTime(created.createdAt),
          streak: stats?.streak || 0,
          visibility: created.visibility || 'followers',
          pinned: false,
          reactions: [],
          comments: [],
        };

        setRecentActivity((prev) => [newEntry, ...prev]);
      } catch (e) {
        // ignore optimistic update failure
      }

      // Refresh authoritative data in background and wait to keep UI consistent
      try {
        await loadRecentActivity();
      } catch (e) {
        // ignore - we already showed optimistic entry
      }

      setNewActivityNote('');
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
      
      const friendshipResponse = await fetch(`${API_URL}/student/friendship-status/${id}`, {
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
  }, [isOwnProfile, id]);

  const loadProfile = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('accessToken');
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      
      // Fetch profile, stats, and followed teachers in parallel
      const [profileResponse, statsResponse, followedTeachersResponse, savedDocumentsResponse] = await Promise.all([
        fetch(`${API_URL}/auth/${id}/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/student/stats/${id}`, {
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
        const friendshipResponse = await fetch(`${API_URL}/student/friendship-status/${id}`, {
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
        const statsResp = await fetch(`${API_URL}/student/stats/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (statsResp.ok) {
          const statsData = (await statsResp.json()) as StudentStatsResponse;
          setStats(normalizeStats(statsData));
          setStreakInfo({
            userId: id as string,
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
          userId: id as string,
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

      // Final fallback to whatever stats endpoint already knows, so the panel never stays at zero when the detailed streak call misses.
      setStreakInfo((prev) => {
        const fallbackStreak = Number(stats.streak || 0);
        if (!prev) {
          return {
            userId: id as string,
            timezone,
            currentStreak: fallbackStreak,
            longestStreak: fallbackStreak,
            totalLearningDays: fallbackStreak,
            streakFreezes: 0,
            lastLearningDate: null,
            todayQualified: fallbackStreak > 0,
          };
        }
        return {
          ...prev,
          currentStreak: Math.max(prev.currentStreak || 0, fallbackStreak),
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
                            {isLoadingStreak ? '...' : `${Math.max(streakInfo?.currentStreak || 0, stats.streak || 0)} consecutive days`}
                            <span className="ml-2">🔥</span>
                          </p>
                          <p className="mt-1 text-sm text-orange-800">
                            {(streakInfo?.todayQualified || (stats.streak || 0) > 0)
                              ? "You have completed today's streak."
                              : 'Study more today to keep your streak alive.'}
                          </p>
                          <p className="mt-1 text-xs text-orange-700/80">
                            Longest: {Math.max(streakInfo?.longestStreak || 0, stats.streak || 0)} days • Total learning days: {Math.max(streakInfo?.totalLearningDays || 0, stats.streak || 0)}
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
                              {Math.max(1, Math.floor((dailyStreakProgress?.goalSeconds || 900) / 60))} phút
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
                                    {entry.isCurrentUser ? ' (Bạn)' : ''}
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
                <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <ClockIcon className="h-5 w-5 text-blue-500" />
                        Personal Activity Journal
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">Quick check-ins, study notes, and your latest learning moments.</p>
                    </div>
                    {isOwnProfile && (
                      <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                        Private to your profile
                      </span>
                    )}
                  </div>

                  <div className="mb-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Entries</p>
                      <p className="mt-1 text-2xl font-bold text-gray-900">{recentActivity.length}</p>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Latest update</p>
                      <p className="mt-1 truncate text-sm font-semibold text-gray-900">{recentActivity[0]?.time || 'No activity yet'}</p>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Learning streak</p>
                      <p className="mt-1 text-2xl font-bold text-orange-600">{Math.max(streakInfo?.currentStreak || 0, stats.streak || 0)}</p>
                    </div>
                  </div>

                  <div className="mb-4 flex flex-wrap gap-2">
                    {([
                      { value: 'all', label: 'All' },
                      { value: 'notes', label: 'Notes' },
                      { value: 'checkins', label: 'Check-ins' },
                    ] as const).map((item) => (
                      <button
                        key={item.value}
                        onClick={() => setActivityFilter(item.value)}
                        className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-200 motion-safe:hover:-translate-y-0.5 ${
                          activityFilter === item.value
                            ? 'bg-[#161853] text-white shadow-md shadow-slate-200'
                            : 'border border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:bg-blue-50 hover:shadow-sm'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>

                  {pinnedActivity && (
                    <div className="mb-4 overflow-hidden rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4 shadow-sm transition-transform duration-300 motion-safe:hover:-translate-y-0.5">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-blue-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                            Pinned
                          </span>
                          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Latest reflection</p>
                        </div>
                        <p className="text-xs text-gray-500">{pinnedActivity.time}</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="rounded-xl bg-blue-100 p-2.5">
                          <DocumentTextIcon className="h-5 w-5 text-blue-700" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900">{pinnedActivity.title}</p>
                          <p className="mt-1 text-sm text-gray-600">
                            {activityFilter === 'checkins'
                              ? 'Your most recent check-in is highlighted here.'
                              : 'This entry is pinned to the top of your profile journal.'}
                          </p>
                        </div>
                        {(pinnedActivity.streak || 0) > 0 && (
                          <div className="shrink-0 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700">
                            🔥 {pinnedActivity.streak || 0}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {isOwnProfile && (
                    <div className="mb-4 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4 shadow-sm transition-transform duration-300 motion-safe:hover:-translate-y-0.5">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-blue-900">Journal check-in</p>
                          <p className="text-xs text-blue-700">Capture what you learned today before it slips away.</p>
                        </div>
                        <p className="text-xs font-medium text-gray-500">{newActivityNote.length}/280</p>
                      </div>
                      <textarea
                        value={newActivityNote}
                        onChange={(event) => setNewActivityNote(event.target.value)}
                        placeholder="Write today's note..."
                        maxLength={280}
                        className="w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition duration-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        rows={3}
                      />
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-blue-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all"
                          style={{ width: `${Math.min(100, (newActivityNote.length / 280) * 100)}%` }}
                        />
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-xs text-blue-700/80">
                          <span>Visible on your profile timeline.</span>
                          <select
                            value={activityVisibility}
                            onChange={(event) => setActivityVisibility(event.target.value as 'public' | 'followers' | 'private')}
                            className="rounded-full border border-blue-200 bg-white px-2 py-1 text-[11px] font-semibold text-blue-800 outline-none"
                          >
                            <option value="public">Public</option>
                            <option value="followers">Followers</option>
                            <option value="private">Private</option>
                          </select>
                        </div>
                        <button
                          onClick={handlePostActivity}
                          disabled={isPostingActivity || !newActivityNote.trim()}
                          className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition duration-200 hover:from-blue-700 hover:to-indigo-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isPostingActivity ? 'Posting...' : 'Post note'}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h4 className="text-sm font-semibold text-gray-900">
                      {activityFilter === 'checkins' ? 'Check-in timeline' : activityFilter === 'notes' ? 'Notes timeline' : 'Recent check-ins'}
                    </h4>
                    <p className="text-xs text-gray-500">
                      {filteredRecentActivity.length ? `${filteredRecentActivity.length} entries` : 'Nothing yet'}
                    </p>
                  </div>

                  <div className="space-y-3">
                    {filteredRecentActivity.length > 0 ? (
                      visibleActivity.map((activity, index) => {
                        const isCompact = activityFilter === 'checkins';

                        return (
                          <Fragment key={activity.id}>
                          <div
                            className={`group flex items-start gap-3 rounded-2xl border p-3 transition-all duration-200 motion-safe:hover:-translate-y-0.5 ${index === 0 ? 'border-blue-300 bg-blue-50/70 shadow-sm' : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50 hover:shadow-sm'} ${isCompact ? 'items-center' : ''}`}
                          >
                            <div className={`rounded-xl p-2.5 ${activity.type === 'note' ? 'bg-purple-100' : 'bg-emerald-100'}`}>
                              {activity.type === 'note' && <DocumentTextIcon className="h-4 w-4 text-purple-700" />}
                              {activity.type === 'checkin' && <CalendarIcon className="h-4 w-4 text-emerald-700" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className={`truncate font-semibold text-gray-900 ${isCompact ? 'text-sm' : 'text-sm'}`}>{activity.title}</h4>
                                {index === 0 && (
                                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
                                    Latest
                                  </span>
                                )}
                                {activity.pinned && (
                                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                                    Pinned
                                  </span>
                                )}
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${activity.type === 'note' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                  {activity.type === 'note' ? 'Note' : 'Check-in'}
                                </span>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${activity.visibility === 'public' ? 'bg-sky-100 text-sky-700' : activity.visibility === 'followers' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-700'}`}>
                                  {activity.visibility}
                                </span>
                              </div>
                              {!isCompact && <p className="mt-0.5 text-xs text-gray-500">{activity.time}</p>}
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-2">
                              <div className="flex items-center gap-2">
                                {isOwnProfile && (
                                  <button
                                    onClick={() => handlePinActivity(activity.id, !activity.pinned)}
                                    disabled={actionLoadingId === activity.id}
                                    className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700 transition hover:border-amber-300 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {activity.pinned ? 'Unpin' : 'Pin'}
                                  </button>
                                )}
                                {activity.type === 'note' && (activity.streak || 0) > 0 && (
                                  <div className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700">
                                    🔥 {activity.streak || 0}
                                  </div>
                                )}
                              </div>
                              <p className="text-xs text-gray-500">{activity.time}</p>
                            </div>
                          </div>
                          <div className="mt-3 border-t border-gray-100 pt-3">
                            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                              <span>{activity.reactions.length} reactions</span>
                              <span>•</span>
                              <span>{activity.comments.length} comments</span>
                              <span>•</span>
                              <span>{activity.visibility === 'private' ? 'Private journal note' : activity.visibility === 'followers' ? 'Visible to followers' : 'Public journal note'}</span>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              {reactionOptions.map((reaction) => {
                                const count = activity.reactions.filter((item) => item.type === reaction.type).length;
                                const reacted = activity.reactions.some((item) => item.type === reaction.type && item.userId === currentUser?.id);
                                return (
                                  <button
                                    key={reaction.type}
                                    onClick={() => handleToggleReaction(activity.id, reaction.type)}
                                    disabled={actionLoadingId === activity.id}
                                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${reacted ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:bg-blue-50'} disabled:cursor-not-allowed disabled:opacity-60`}
                                  >
                                    <span>{reaction.emoji}</span>
                                    <span>{reaction.label}</span>
                                    <span className="text-[11px] opacity-75">{count}</span>
                                  </button>
                                );
                              })}
                            </div>

                            <div className="mt-3 space-y-2">
                              {activity.comments.length === 0 && (
                                <p className="rounded-xl border border-dashed border-gray-200 bg-white px-3 py-2 text-xs text-gray-500">
                                  Be the first to leave a note on this entry.
                                </p>
                              )}
                              {activity.comments.slice(-2).map((comment) => (
                                <div key={comment.id} className="flex items-start gap-2 rounded-xl bg-gray-50 px-3 py-2">
                                  <div className="mt-0.5 h-7 w-7 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 text-[10px] font-bold text-white flex items-center justify-center">
                                    {comment.user?.fullName?.charAt(0) || 'U'}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-semibold text-gray-800">{comment.user?.fullName || 'Student'}</p>
                                    <p className="text-sm text-gray-700">{comment.content}</p>
                                  </div>
                                </div>
                              ))}

                              <div className="flex gap-2">
                                <input
                                  value={commentDrafts[activity.id] || ''}
                                  onChange={(event) => setCommentDrafts((prev) => ({ ...prev, [activity.id]: event.target.value }))}
                                  placeholder="Write a comment..."
                                  className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                />
                                <button
                                  onClick={() => handleAddComment(activity.id)}
                                  disabled={actionLoadingId === activity.id || !(commentDrafts[activity.id] || '').trim()}
                                  className="rounded-xl bg-[#161853] px-3 py-2 text-xs font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  Send
                                </button>
                              </div>
                            </div>
                          </div>
                          </Fragment>
                        );
                      })
                    ) : (
                      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 py-6 text-center">
                        <p className="text-sm font-medium text-gray-600">No personal activity yet.</p>
                        <p className="mt-1 text-xs text-gray-500">Your next journal entry will appear here.</p>
                      </div>
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
