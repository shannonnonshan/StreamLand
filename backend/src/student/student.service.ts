import { Injectable, NotFoundException, BadRequestException, ForbiddenException, BadGatewayException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FriendStatus, Prisma } from '@prisma/client';
import { SendFriendRequestDto, UpdateFriendRequestDto, FollowTeacherDto, UnfollowTeacherDto } from './dto';
import { NotificationService } from '../notification/notification.service';
import { normalizeVideoCategory } from '../common/constants/video-categories';

type RecommendationCandidate = {
  id: string;
  title: string;
  category: string | null;
  thumbnail: string | null;
  duration: number;
  totalViews: number;
  endedAt: Date | null;
  recordingUrl: string | null;
  teacherId: string;
  teacher: {
    id: string;
    fullName: string;
    avatar: string | null;
  };
};

type PartProgressMap = Map<string, number>;

type LearningActivityType = 'VIDEO' | 'QUIZ' | 'EXERCISE';

type RecordLearningActivityInput = {
  activityType?: LearningActivityType;
  videoId?: string;
  watchTimeSeconds?: number;
  completionPercentage?: number;
  completed?: boolean;
  timezone?: string;
};

type JournalVisibility = 'public' | 'followers' | 'private';
type JournalReactionType = 'like' | 'clap' | 'insight';

type JournalReaction = {
  userId: string;
  type: JournalReactionType;
  createdAt: string;
};

type JournalComment = {
  id: string;
  userId: string;
  content: string;
  createdAt: string;
};

type JournalMetadata = {
  content?: string;
  visibility?: JournalVisibility;
  pinned?: boolean;
  reactions?: JournalReaction[];
  comments?: JournalComment[];
};

const MIN_QUALIFIED_WATCH_SECONDS = 5 * 60;
const MIN_QUALIFIED_COMPLETION_PERCENT = 25;
const DEFAULT_DAILY_GOAL_SECONDS = 15 * 60;

@Injectable()
export class StudentService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {}

  private normalizeJournalMetadata(metadata: Prisma.JsonValue | null | undefined): JournalMetadata {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return {};
    }

    return metadata as JournalMetadata;
  }

  private async canViewProfileJournal(viewerId: string | null | undefined, ownerId: string) {
    if (!viewerId) return false;
    if (viewerId === ownerId) {
      return true;
    }

    const friendship = await this.prisma.postgres.friendList.findFirst({
      where: {
        OR: [
          { requestId: viewerId, receiverId: ownerId },
          { requestId: ownerId, receiverId: viewerId },
        ],
        status: FriendStatus.ACCEPTED,
      },
      select: { id: true },
    });

    return !!friendship;
  }

  private async getJournalUserMap(userIds: string[]) {
    const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
    if (!uniqueIds.length) {
      return new Map<string, { id: string; fullName: string; avatar: string | null }>();
    }

    const users = await this.prisma.postgres.user.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, fullName: true, avatar: true },
    });

    return new Map(users.map((user) => [user.id, user]));
  }

  private async loadJournalEntry(row: {
    id: string;
    userId: string;
    createdAt: Date;
    metadata: Prisma.JsonValue | null;
  }) {
    const metadata = this.normalizeJournalMetadata(row.metadata);
    const reactions = Array.isArray(metadata.reactions) ? metadata.reactions : [];
    const comments = Array.isArray(metadata.comments) ? metadata.comments : [];

    const users = await this.getJournalUserMap([
      ...reactions.map((reaction) => reaction.userId),
      ...comments.map((comment) => comment.userId),
    ]);

    return {
      id: row.id,
      userId: row.userId,
      content: typeof metadata.content === 'string' ? metadata.content : '',
      visibility: metadata.visibility || 'followers',
      pinned: !!metadata.pinned,
      reactions: reactions.map((reaction) => ({
        ...reaction,
        user: users.get(reaction.userId) || null,
      })),
      comments: comments
        .map((comment) => ({
          ...comment,
          user: users.get(comment.userId) || null,
        }))
        .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()),
      createdAt: row.createdAt,
    };
  }

  // Send friend request
  async sendFriendRequest(requesterId: string, dto: SendFriendRequestDto) {
    const { receiverId } = dto;

    // Check if trying to add self
    if (requesterId === receiverId) {
      throw new BadRequestException('Cannot send friend request to yourself');
    }

    // Check if receiver exists and is a student
    const receiver = await this.prisma.postgres.user.findUnique({
      where: { id: receiverId },
      include: { studentProfile: true },
    });

    if (!receiver || !receiver.studentProfile) {
      throw new NotFoundException('Student not found');
    }

    // Check if requester has student profile
    const requester = await this.prisma.postgres.user.findUnique({
      where: { id: requesterId },
      include: { studentProfile: true },
    });

    if (!requester || !requester.studentProfile) {
      throw new ForbiddenException('Only students can send friend requests');
    }

    // Check if friend request already exists (either direction)
    const existingRequest = await this.prisma.postgres.friendList.findFirst({
      where: {
        OR: [
          { requestId: requester.studentProfile.id, receiverId: receiver.studentProfile.id },
          { requestId: receiver.studentProfile.id, receiverId: requester.studentProfile.id },
        ],
      },
    });

    if (existingRequest) {
      if (existingRequest.status === FriendStatus.PENDING) {
        throw new BadRequestException('Friend request already sent');
      }
      if (existingRequest.status === FriendStatus.ACCEPTED) {
        throw new BadRequestException('Already friends');
      }
      if (existingRequest.status === FriendStatus.BLOCKED) {
        throw new BadRequestException('Cannot send friend request');
      }
      // If REJECTED, allow sending again
      await this.prisma.postgres.friendList.update({
        where: { id: existingRequest.id },
        data: { status: FriendStatus.PENDING },
      });
      return { message: 'Friend request sent again', friendRequest: existingRequest };
    }

    // Create new friend request
    const friendRequest = await this.prisma.postgres.friendList.create({
      data: {
        requestId: requester.studentProfile.id,
        receiverId: receiver.studentProfile.id,
        status: FriendStatus.PENDING,
      },
      include: {
        requester: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                avatar: true,
              },
            },
          },
        },
        receiver: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    // Send notification to receiver
    await this.notificationService.createFriendRequestNotification(
      receiver.id,
      requester.id,
      requester.fullName,
      requester.avatar || '',
      friendRequest.id,
    );

    return { message: 'Friend request sent successfully', friendRequest };
  }

  // Update friend request status (accept/reject/block)
  async updateFriendRequest(userId: string, requestId: string, dto: UpdateFriendRequestDto) {
    const status: FriendStatus = dto.status;

    // Get user's student profile
    const user = await this.prisma.postgres.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true },
    });

    if (!user || !user.studentProfile) {
      throw new ForbiddenException('Only students can update friend requests');
    }

    // Find the friend request
    const friendRequest = await this.prisma.postgres.friendList.findUnique({
      where: { id: requestId },
    });

    if (!friendRequest) {
      throw new NotFoundException('Friend request not found');
    }

    // Only receiver can accept/reject, both can block
    if (friendRequest.receiverId !== user.studentProfile.id && status !== FriendStatus.BLOCKED) {
      throw new ForbiddenException('Only the receiver can accept or reject friend requests');
    }

    // Cannot change from ACCEPTED to PENDING
    if (friendRequest.status === FriendStatus.ACCEPTED && status === FriendStatus.PENDING) {
      throw new BadRequestException('Cannot change accepted friend request back to pending');
    }

    // Update status
    const updatedRequest = await this.prisma.postgres.friendList.update({
      where: { id: requestId },
      data: { status },
      include: {
        requester: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                avatar: true,
              },
            },
          },
        },
        receiver: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    // Send notification to requester when request is accepted
    if (status === FriendStatus.ACCEPTED) {
      await this.notificationService.createFriendRequestAcceptedNotification(
        updatedRequest.requester.user.id,
        updatedRequest.receiver.user.id,
        updatedRequest.receiver.user.fullName,
        updatedRequest.receiver.user.avatar || ''
      );
    }

    return { message: 'Friend request updated successfully', friendRequest: updatedRequest };
  }

  // Get all friend requests (sent or received)
  async getFriendRequests(userId: string, type: 'sent' | 'received' | 'all' = 'all', status?: FriendStatus) {
    // Get user's student profile
    const user = await this.prisma.postgres.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true },
    });

    if (!user || !user.studentProfile) {
      throw new ForbiddenException('Only students can view friend requests');
    }

    interface WhereClause {
      requestId?: string;
      receiverId?: string;
      OR?: Array<{ requestId?: string; receiverId?: string }>;
      status?: FriendStatus;
    }

    const whereClause: WhereClause = {};

    if (type === 'sent') {
      whereClause.requestId = user.studentProfile.id;
    } else if (type === 'received') {
      whereClause.receiverId = user.studentProfile.id;
    } else {
      whereClause.OR = [
        { requestId: user.studentProfile.id },
        { receiverId: user.studentProfile.id },
      ];
    }

    if (status) {
      whereClause.status = status;
    }

    const friendRequests = await this.prisma.postgres.friendList.findMany({
      where: whereClause,
      select: {
        id: true,
        status: true,
        createdAt: true,
        requester: {
          select: {
            id: true,
            user: {
              select: {
                id: true,
                fullName: true,
                avatar: true,
                bio: true,
                studentProfile: {
                  select: {
                    id: true,
                    school: true,
                    grade: true,
                    interests: true,
                  },
                },
              },
            },
          },
        },
        receiver: {
          select: {
            id: true,
            user: {
              select: {
                id: true,
                fullName: true,
                avatar: true,
                bio: true,
                studentProfile: {
                  select: {
                    id: true,
                    school: true,
                    grade: true,
                    interests: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return friendRequests;
  }

  // Get friends list (only ACCEPTED)
  async getFriends(userId: string) {
    // Get user's student profile
    const user = await this.prisma.postgres.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true },
    });

    if (!user || !user.studentProfile) {
      throw new ForbiddenException('Only students can view friends');
    }

    const friends = await this.prisma.postgres.friendList.findMany({
      where: {
        OR: [
          { requestId: user.studentProfile.id, status: FriendStatus.ACCEPTED },
          { receiverId: user.studentProfile.id, status: FriendStatus.ACCEPTED },
        ],
      },
      select: {
        id: true,
        createdAt: true,
        requester: {
          select: {
            id: true,
            user: {
              select: {
                id: true,
                fullName: true,
                avatar: true,
                bio: true,
                studentProfile: {
                  select: {
                    id: true,
                    school: true,
                    grade: true,
                    interests: true,
                  },
                },
              },
            },
          },
        },
        receiver: {
          select: {
            id: true,
            user: {
              select: {
                id: true,
                fullName: true,
                avatar: true,
                bio: true,
                studentProfile: {
                  select: {
                    id: true,
                    school: true,
                    grade: true,
                    interests: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Map to return only the friend (not self)
    const friendsList = friends.map(f => {
      const isSelf = f.requester.id === user.studentProfile!.id;
      return {
        friendshipId: f.id,
        friend: isSelf ? f.receiver.user : f.requester.user,
        since: f.createdAt,
      };
    });

    return friendsList;
  }

  // Remove friend (delete friendship)
  async removeFriend(userId: string, friendshipId: string) {
    // Get user's student profile
    const user = await this.prisma.postgres.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true },
    });

    if (!user || !user.studentProfile) {
      throw new ForbiddenException('Only students can remove friends');
    }

    const friendship = await this.prisma.postgres.friendList.findUnique({
      where: { id: friendshipId },
    });

    if (!friendship) {
      throw new NotFoundException('Friendship not found');
    }

    // Check if user is part of this friendship
    if (friendship.requestId !== user.studentProfile.id && friendship.receiverId !== user.studentProfile.id) {
      throw new ForbiddenException('You are not part of this friendship');
    }

    await this.prisma.postgres.friendList.delete({
      where: { id: friendshipId },
    });

    return { message: 'Friend removed successfully' };
  }

  // Block a friend (update existing friendship to BLOCKED)
  async blockFriend(userId: string, friendshipId: string) {
    // Get user's student profile
    const user = await this.prisma.postgres.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true },
    });

    if (!user || !user.studentProfile) {
      throw new ForbiddenException('Only students can block users');
    }

    const friendship = await this.prisma.postgres.friendList.findUnique({
      where: { id: friendshipId },
    });

    if (!friendship) {
      throw new NotFoundException('Friendship not found');
    }

    // Check if user is part of this friendship
    if (friendship.requestId !== user.studentProfile.id && friendship.receiverId !== user.studentProfile.id) {
      throw new ForbiddenException('You are not part of this friendship');
    }

    // Update status to BLOCKED
    await this.prisma.postgres.friendList.update({
      where: { id: friendshipId },
      data: { status: FriendStatus.BLOCKED },
    });

    return { message: 'User blocked successfully' };
  }

  // Unblock a user (delete the blocked friendship record)
  async unblockUser(userId: string, friendshipId: string) {
    // Get user's student profile
    const user = await this.prisma.postgres.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true },
    });

    if (!user || !user.studentProfile) {
      throw new ForbiddenException('Only students can unblock users');
    }

    const friendship = await this.prisma.postgres.friendList.findUnique({
      where: { id: friendshipId },
    });

    if (!friendship) {
      throw new NotFoundException('Blocked friendship not found');
    }

    // Check if user is part of this friendship
    if (friendship.requestId !== user.studentProfile.id && friendship.receiverId !== user.studentProfile.id) {
      throw new ForbiddenException('You are not part of this friendship');
    }

    // Check if it's actually blocked
    if (friendship.status !== FriendStatus.BLOCKED) {
      throw new BadRequestException('This friendship is not blocked');
    }

    // Delete the blocked friendship record
    await this.prisma.postgres.friendList.delete({
      where: { id: friendshipId },
    });

    return { message: 'User unblocked successfully' };
  }

  // Search for students (exclude self and existing friends)
  async searchStudents(userId: string, query: string) {
    // Get user's student profile
    const user = await this.prisma.postgres.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true },
    });

    if (!user || !user.studentProfile) {
      throw new ForbiddenException('Only students can search for friends');
    }

    if (!query || query.trim().length < 2) {
      return [];
    }

    const studentProfileId = user.studentProfile.id;

    // Get list of ALL friendships (to show status)
    const friendships = await this.prisma.postgres.friendList.findMany({
      where: {
        OR: [
          { requestId: studentProfileId },
          { receiverId: studentProfileId },
        ],
      },
      select: {
        requestId: true,
        receiverId: true,
        status: true,
      },
    });

    // Only exclude BLOCKED users
    const blockedProfileIds = new Set<string>();
    friendships.forEach(f => {
      if (f.status === FriendStatus.BLOCKED) {
        if (f.requestId === studentProfileId) {
          blockedProfileIds.add(f.receiverId);
        } else {
          blockedProfileIds.add(f.requestId);
        }
      }
    });

    // Search for students
    const students = await this.prisma.postgres.user.findMany({
      where: {
        AND: [
          { role: 'STUDENT' },
          { id: { not: userId } }, // Exclude self
          {
            OR: [
              { fullName: { contains: query, mode: 'insensitive' } },
              { email: { contains: query, mode: 'insensitive' } },
            ],
          },
        ],
      },
      select: {
        id: true,
        fullName: true,
        avatar: true,
        bio: true,
        studentProfile: {
          select: {
            id: true,
            school: true,
            grade: true,
            interests: true,
          },
        },
      },
      take: 20,
    });

    // Filter out blocked users and add friendship status
    const results = students
      .filter(s => s.studentProfile && !blockedProfileIds.has(s.studentProfile.id))
      .map(s => {
        // Check friendship status
        const friendship = friendships.find(f => 
          (f.requestId === studentProfileId && f.receiverId === s.studentProfile?.id) ||
          (f.receiverId === studentProfileId && f.requestId === s.studentProfile?.id)
        );

        return {
          id: s.id,
          fullName: s.fullName,
          avatar: s.avatar,
          bio: s.bio,
          studentProfile: s.studentProfile,
          friendshipStatus: friendship ? friendship.status : null,
        };
      });

    return results;
  }

  // Get friend suggestions (random students, excluding self and existing friends)
  async getSuggestions(userId: string) {
    // Get user's student profile
    const user = await this.prisma.postgres.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true },
    });

    if (!user || !user.studentProfile) {
      throw new ForbiddenException('Only students can get suggestions');
    }

    const studentProfileId = user.studentProfile.id;

    // Get list of current friends and pending requests
    const friendships = await this.prisma.postgres.friendList.findMany({
      where: {
        OR: [
          { requestId: studentProfileId },
          { receiverId: studentProfileId },
        ],
      },
      select: {
        requestId: true,
        receiverId: true,
        status: true,
      },
    });

    // Extract friend IDs (both ACCEPTED and PENDING should be excluded)
    const excludedProfileIds = new Set<string>();
    friendships.forEach(f => {
      if (f.requestId === studentProfileId) {
        excludedProfileIds.add(f.receiverId);
      } else {
        excludedProfileIds.add(f.requestId);
      }
    });

    // Get random students (excluding self and friends)
    const students = await this.prisma.postgres.user.findMany({
      where: {
        AND: [
          { role: 'STUDENT' },
          { id: { not: userId } },
        ],
      },
      select: {
        id: true,
        fullName: true,
        avatar: true,
        bio: true,
        studentProfile: {
          select: {
            id: true,
            school: true,
            grade: true,
            interests: true,
          },
        },
      },
      take: 50,
    });

    // Filter and shuffle
    const filtered = students
      .filter(s => s.studentProfile && !excludedProfileIds.has(s.studentProfile.id))
      .sort(() => Math.random() - 0.5) // Shuffle
      .slice(0, 12); // Take 12 suggestions

    const results = filtered.map(s => ({
      id: s.id,
      fullName: s.fullName,
      avatar: s.avatar,
      bio: s.bio,
      studentProfile: s.studentProfile,
      friendshipStatus: null,
    }));

    return results;
  }

  // Get blocked users
  async getBlockedUsers(userId: string) {
    // Get user's student profile
    const user = await this.prisma.postgres.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true },
    });

    if (!user || !user.studentProfile) {
      throw new ForbiddenException('Only students can get blocked users');
    }

    const studentProfileId = user.studentProfile.id;

    // Get blocked friendships
    const blockedFriendships = await this.prisma.postgres.friendList.findMany({
      where: {
        OR: [
          { requestId: studentProfileId, status: FriendStatus.BLOCKED },
          { receiverId: studentProfileId, status: FriendStatus.BLOCKED },
        ],
      },
      select: {
        id: true,
        requestId: true,
        requester: {
          select: {
            id: true,
            user: {
              select: {
                id: true,
                fullName: true,
                avatar: true,
                bio: true,
              },
            },
          },
        },
        receiver: {
          select: {
            id: true,
            user: {
              select: {
                id: true,
                fullName: true,
                avatar: true,
                bio: true,
              },
            },
          },
        },
      },
    });

    // Map to friend objects
    const blockedUsers = blockedFriendships.map(friendship => {
      const blockedUser = friendship.requestId === studentProfileId
        ? friendship.receiver.user
        : friendship.requester.user;

      return {
        ...blockedUser,
        friendshipId: friendship.id,
        studentProfile: friendship.requestId === studentProfileId
          ? friendship.receiver
          : friendship.requester,
      };
    });

    return blockedUsers;
  }

  // Check friendship status with another user
  async getFriendshipStatus(userId: string, targetUserId: string) {
    // Get both users' student profiles
    const [user, targetUser] = await Promise.all([
      this.prisma.postgres.user.findUnique({
        where: { id: userId },
        include: { studentProfile: true },
      }),
      this.prisma.postgres.user.findUnique({
        where: { id: targetUserId },
        include: { studentProfile: true },
      }),
    ]);

    if (!user || !user.studentProfile || !targetUser || !targetUser.studentProfile) {
      return { status: 'NONE', friendshipId: null };
    }

    // Check if friendship exists
    const friendship = await this.prisma.postgres.friendList.findFirst({
      where: {
        OR: [
          {
            requestId: user.studentProfile.id,
            receiverId: targetUser.studentProfile.id,
          },
          {
            requestId: targetUser.studentProfile.id,
            receiverId: user.studentProfile.id,
          },
        ],
      },
    });

    if (!friendship) {
      return { status: 'NONE', friendshipId: null };
    }

    return {
      status: friendship.status,
      friendshipId: friendship.id,
    };
  }

  // Follow a teacher
  async followTeacher(userId: string, dto: FollowTeacherDto) {
    const { teacherId } = dto;

    // Get user's student profile
    const user = await this.prisma.postgres.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true },
    });

    if (!user || !user.studentProfile) {
      throw new ForbiddenException('Only students can follow teachers');
    }

    // Check if teacher exists
    const teacher = await this.prisma.postgres.user.findUnique({
      where: { id: teacherId },
      include: { teacherProfile: true },
    });

    if (!teacher || !teacher.teacherProfile) {
      throw new NotFoundException('Teacher not found');
    }

    // Check if already following
    const existingFollow = await this.prisma.postgres.followedTeacher.findUnique({
      where: {
        studentId_teacherId: {
          studentId: user.studentProfile.id,
          teacherId: teacher.teacherProfile.id,
        },
      },
    });

    if (existingFollow) {
      throw new BadRequestException('Already following this teacher');
    }

    // Create follow relationship
    await this.prisma.postgres.followedTeacher.create({
      data: {
        studentId: user.studentProfile.id,
        teacherId: teacher.teacherProfile.id,
      },
    });

    // Send notification to teacher
    await this.notificationService.createFollowNotification(
      teacher.id,
      user.id,
      user.fullName,
      user.avatar || '',
    );

    return { message: 'Successfully followed teacher' };
  }

  // Unfollow a teacher
  async unfollowTeacher(userId: string, dto: UnfollowTeacherDto) {
    const { teacherId } = dto;

    // Get user's student profile
    const user = await this.prisma.postgres.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true },
    });

    if (!user || !user.studentProfile) {
      throw new ForbiddenException('Only students can unfollow teachers');
    }

    // Check if teacher exists
    const teacher = await this.prisma.postgres.user.findUnique({
      where: { id: teacherId },
      include: { teacherProfile: true },
    });

    if (!teacher || !teacher.teacherProfile) {
      throw new NotFoundException('Teacher not found');
    }

    // Check if currently following
    const existingFollow = await this.prisma.postgres.followedTeacher.findUnique({
      where: {
        studentId_teacherId: {
          studentId: user.studentProfile.id,
          teacherId: teacher.teacherProfile.id,
        },
      },
    });

    if (!existingFollow) {
      throw new BadRequestException('Not following this teacher');
    }

    // Delete follow relationship
    await this.prisma.postgres.followedTeacher.delete({
      where: {
        studentId_teacherId: {
          studentId: user.studentProfile.id,
          teacherId: teacher.teacherProfile.id,
        },
      },
    });

    return { message: 'Successfully unfollowed teacher' };
  }

  // Get list of followed teachers
  async getFollowedTeachers(userId: string) {
    // Get user's student profile
    const user = await this.prisma.postgres.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true },
    });

    if (!user || !user.studentProfile) {
      throw new ForbiddenException('Only students can view followed teachers');
    }

    const follows = await this.prisma.postgres.followedTeacher.findMany({
      where: {
        studentId: user.studentProfile.id,
      },
      include: {
        teacher: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                avatar: true,
                bio: true,
                isVerified: true,
              },
            },
            followers: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Get additional info for each teacher
    const teachersWithStats = await Promise.all(
      follows.map(async (f) => {
        const teacherId = f.teacher.userId;
        
        // Count total livestreams
        const totalLivestreams = await this.prisma.postgres.liveStream.count({
          where: {
            teacherId,
            isPublic: true,
          },
        });

        return {
          id: f.teacher.user.id,
          name: f.teacher.user.fullName,
          email: f.teacher.user.email,
          avatar: f.teacher.user.avatar,
          bio: f.teacher.user.bio,
          isVerified: f.teacher.user.isVerified,
          subjects: f.teacher.subjects || [],
          subscribers: f.teacher.followers.length,
          totalVideos: totalLivestreams,
          followedSince: f.createdAt,
        };
      })
    );

    return teachersWithStats;
  }

  // Get livestreams from followed teachers
  async getFollowedLivestreams(userId: string) {
    // Get user's student profile
    const user = await this.prisma.postgres.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true },
    });

    if (!user || !user.studentProfile) {
      throw new NotFoundException('Student profile not found');
    }

    // Get all followed teachers with their User IDs
    const followedTeachers = await this.prisma.postgres.followedTeacher.findMany({
      where: { studentId: user.studentProfile.id },
      include: {
        teacher: {
          select: {
            userId: true,
            id: true,
          },
        },
      },
    });

    // Get User IDs (not TeacherProfile IDs!)
    const teacherUserIds = followedTeachers.map(ft => ft.teacher.userId);

    if (teacherUserIds.length === 0) {
      console.log('⚠️ No followed teachers found');
      return [];
    }

    // Get active livestreams from these teachers
    const livestreams = await this.prisma.postgres.liveStream.findMany({
      where: {
        teacherId: { in: teacherUserIds },
        status: 'LIVE',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Get teacher details by User IDs
    const teachers = await this.prisma.postgres.user.findMany({
      where: { id: { in: teacherUserIds } },
      select: {
        id: true,
        fullName: true,
        avatar: true,
      },
    });

    const teacherMap = new Map(teachers.map(t => [t.id, t]));

    // Format response
    return livestreams.map(livestream => {
      const teacher = teacherMap.get(livestream.teacherId);
      return {
        id: livestream.id,
        title: livestream.title,
        teacher: {
          id: teacher?.id || '',
          fullName: teacher?.fullName || 'Unknown',
          avatar: teacher?.avatar || null,
        },
        viewCount: livestream.totalViews,
        thumbnailUrl: livestream.thumbnail || null,
        isLive: true,
      };
    });
  }

  // Get videos (ended livestreams with recordings) from followed teachers
  async getFollowedVideos(userId: string) {
    // Get user's student profile
    const user = await this.prisma.postgres.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true },
    });

    if (!user || !user.studentProfile) {
      throw new NotFoundException('Student profile not found');
    }

    // Get all followed teachers with their User IDs
    const followedTeachers = await this.prisma.postgres.followedTeacher.findMany({
      where: { studentId: user.studentProfile.id },
      include: {
        teacher: {
          select: {
            userId: true,
            id: true,
          },
        },
      },
    });

    // Get User IDs (not TeacherProfile IDs!)
    const teacherUserIds = followedTeachers.map(ft => ft.teacher.userId);

    if (teacherUserIds.length === 0) {
      console.log('⚠️ No followed teachers found for videos');
      return [];
    }

    // Get ended livestreams with recordings from these teachers
    const videos = await this.prisma.postgres.liveStream.findMany({
      where: {
        teacherId: { in: teacherUserIds },
        status: 'ENDED',
        recordingUrl: { not: null },
      },
      orderBy: [
        { endedAt: 'desc' },
        { totalViews: 'desc' },
      ],
      take: 50, // Limit to 50 recent videos
    });

    // Get teacher details by User IDs
    const teachers = await this.prisma.postgres.user.findMany({
      where: { id: { in: teacherUserIds } },
      select: {
        id: true,
        fullName: true,
        avatar: true,
      },
    });

    const teacherMap = new Map(teachers.map(t => [t.id, t]));

    // Format response
    return videos.map(video => {
      const teacher = teacherMap.get(video.teacherId);
      return {
        id: video.id,
        title: video.title,
        teacher: {
          id: teacher?.id || '',
          fullName: teacher?.fullName || 'Unknown',
          avatar: teacher?.avatar || null,
        },
        viewCount: video.totalViews,
        thumbnailUrl: video.thumbnail || null,
        duration: this.calculateDuration(video.startedAt, video.endedAt),
        uploadedAt: video.endedAt,
      };
    });
  }

  // Helper method to calculate video duration
  private calculateDuration(startedAt: Date | null, endedAt: Date | null): string {
    if (!startedAt || !endedAt) return '0:00';

    const durationMs = endedAt.getTime() - startedAt.getTime();
    const hours = Math.floor(durationMs / 3600000);
    const minutes = Math.floor((durationMs % 3600000) / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  // Check if student is following a teacher
  async isFollowingTeacher(userId: string, teacherId: string) {
    // Get user's student profile
    const user = await this.prisma.postgres.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true },
    });

    if (!user || !user.studentProfile) {
      return { isFollowing: false };
    }

    // Check if teacher exists
    const teacher = await this.prisma.postgres.user.findUnique({
      where: { id: teacherId },
      include: { teacherProfile: true },
    });

    if (!teacher || !teacher.teacherProfile) {
      return { isFollowing: false };
    }

    const existingFollow = await this.prisma.postgres.followedTeacher.findUnique({
      where: {
        studentId_teacherId: {
          studentId: user.studentProfile.id,
          teacherId: teacher.teacherProfile.id,
        },
      },
    });

    return { isFollowing: !!existingFollow };
  }

  // Get all teachers for search functionality
  async getAllTeachers() {
    const teachers = await this.prisma.postgres.user.findMany({
      where: {
        teacherProfile: {
          isNot: null,
        },
      },
      include: {
        teacherProfile: true,
      },
      orderBy: {
        fullName: 'asc',
      },
    });

    return teachers.map((teacher) => ({
      id: teacher.id,
      name: teacher.fullName,
      bio: teacher.bio || null,
      profilePicture: teacher.avatar || null,
      subjects: teacher.teacherProfile?.subjects || [],
      experience: teacher.teacherProfile?.experience || null,
    }));
  }

  // Track watch activity, update streak, and persist watch progress
  async trackWatchActivity(
    userId: string,
    contentType: 'livestream' | 'video',
    contentId: string,
    progressData?: {
      lastPosition?: number;
      duration?: number;
      progress?: number;
      completed?: boolean;
      timezone?: string;
      activityType?: LearningActivityType;
      activeWatchSeconds?: number;
    },
  ) {
    // Get student profile
    const student = await this.prisma.postgres.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true },
    });

    if (!student || !student.studentProfile) {
      throw new ForbiddenException('Only students can track watch activity');
    }

    const now = new Date();

    const incomingLastPosition = Math.max(0, Math.floor(progressData?.lastPosition || 0));
    const incomingDuration = Math.max(0, Math.floor(progressData?.duration || 0));
    const incomingProgress = typeof progressData?.progress === 'number'
      ? Math.max(0, Math.min(100, progressData.progress))
      : incomingDuration > 0
        ? Math.max(0, Math.min(100, (incomingLastPosition / incomingDuration) * 100))
        : 0;

    const existingProgress = await this.prisma.mongo.watchHistory.findUnique({
      where: {
        userId_livestreamId: {
          userId,
          livestreamId: contentId,
        },
      },
    });

    const lastPosition = Math.max(existingProgress?.lastPosition || 0, incomingLastPosition);
    const duration = Math.max(existingProgress?.duration || 0, incomingDuration);
    const computedProgress = duration > 0
      ? Math.max(0, Math.min(100, (lastPosition / duration) * 100))
      : 0;
    const progress = Math.max(existingProgress?.progress || 0, incomingProgress, computedProgress);
    const completed =
      !!existingProgress?.completed ||
      !!progressData?.completed ||
      progress >= 90;

    // Record watch history in MongoDB using a stable per-user/per-video record
    await this.prisma.mongo.watchHistory.upsert({
      where: {
        userId_livestreamId: {
          userId,
          livestreamId: contentId,
        },
      },
      create: {
        userId,
        livestreamId: contentId,
        watchedAt: now,
        duration,
        completed,
        progress,
        lastPosition,
      },
      update: {
        watchedAt: now,
        duration,
        completed,
        progress,
        lastPosition,
      },
    });

    const streakResult = await this.recordLearningActivity(userId, {
      activityType: progressData?.activityType || (contentType === 'video' ? 'VIDEO' : 'EXERCISE'),
      videoId: contentId,
      watchTimeSeconds: Math.max(0, progressData?.activeWatchSeconds || incomingLastPosition),
      completionPercentage: progress,
      completed,
      timezone: progressData?.timezone,
    });

    if (streakResult.streakUpdated || streakResult.todayQualified) {
      await this.prisma.postgres.studentProfile.update({
        where: { id: student.studentProfile.id },
        data: {
          studyStreak: streakResult.currentStreak,
          lastActivityDate: now,
        },
      });
    }

    return {
      streak: streakResult.currentStreak,
      updated: streakResult.streakUpdated,
      longestStreak: streakResult.longestStreak,
      todayQualified: streakResult.todayQualified,
    };
  }

  async getWatchProgress(userId: string, contentId: string) {
    const progress = await this.prisma.mongo.watchHistory.findUnique({
      where: {
        userId_livestreamId: {
          userId,
          livestreamId: contentId,
        },
      },
    });

    return progress || null;
  }

  async getWatchProgressBatch(userId: string, contentIds: string[]) {
    const uniqueContentIds = Array.from(
      new Set((contentIds || []).map((id) => (id || '').trim()).filter(Boolean)),
    ).slice(0, 500);

    if (uniqueContentIds.length === 0) {
      return { items: [] };
    }

    const items = await this.prisma.mongo.watchHistory.findMany({
      where: {
        userId,
        livestreamId: {
          in: uniqueContentIds,
        },
      },
      select: {
        livestreamId: true,
        watchedAt: true,
        duration: true,
        completed: true,
        progress: true,
        lastPosition: true,
      },
      orderBy: {
        watchedAt: 'desc',
      },
    });

    return {
      items: items.map((item: (typeof items)[number]) => ({
        contentId: item.livestreamId,
        watchedAt: item.watchedAt,
        duration: item.duration,
        completed: item.completed,
        progress: item.progress,
        lastPosition: item.lastPosition,
      })),
    };
  }

  async getLearningStreak(userId: string, timezone?: string) {
    const tz = this.normalizeTimezone(timezone);
    const streak = await this.ensureLearningStreak(userId, tz);
    const dateKey = this.getDateKeyInTimezone(new Date(), streak.timezone);

    const hasAwardedToday = await this.prisma.mongo.learningStreakDay.findUnique({
      where: {
        userId_dateKey: {
          userId,
          dateKey,
        },
      },
    });

    return {
      userId,
      timezone: streak.timezone,
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      totalLearningDays: streak.totalLearningDays,
      streakFreezes: streak.streakFreezes,
      lastLearningDate: streak.lastLearningDate,
      todayQualified: !!hasAwardedToday,
    };
  }

  async recordLearningActivity(userId: string, input: RecordLearningActivityInput) {
    const activityType: LearningActivityType = input.activityType || 'VIDEO';
    const timezone = this.normalizeTimezone(input.timezone);
    const now = new Date();

    const streak = await this.ensureLearningStreak(userId, timezone);
    const sessionDateKey = this.getDateKeyInTimezone(now, streak.timezone);

    const watchTimeSeconds = Math.max(0, Math.floor(input.watchTimeSeconds || 0));
    const completionPercentage = Math.max(0, Math.min(100, Number(input.completionPercentage || 0)));
    const completed = !!input.completed;

    const qualifies =
      activityType !== 'VIDEO'
        ? completed || watchTimeSeconds >= 60
        : completed ||
          watchTimeSeconds >= MIN_QUALIFIED_WATCH_SECONDS ||
          completionPercentage >= MIN_QUALIFIED_COMPLETION_PERCENT;

    const sessionVideoId = (input.videoId || '').trim() || '__no_video__';
    const existingSession = await this.prisma.mongo.learningSession.findUnique({
      where: {
        userId_sessionDateKey_videoId: {
          userId,
          sessionDateKey,
          videoId: sessionVideoId,
        },
      },
    });

    const activeWatchSeconds = this.computeSafeWatchTimeIncrement(
      existingSession?.activeWatchSeconds || 0,
      watchTimeSeconds,
    );
    const nextCompletion = Math.max(existingSession?.completionPercentage || 0, completionPercentage);
    const nextQualified = !!existingSession?.qualifiedForStreak || qualifies;

    const session = await this.prisma.mongo.learningSession.upsert({
      where: {
        userId_sessionDateKey_videoId: {
          userId,
          sessionDateKey,
          videoId: sessionVideoId,
        },
      },
      create: {
        userId,
        videoId: sessionVideoId,
        activityType: activityType as any,
        activeWatchSeconds,
        completionPercentage: nextCompletion,
        qualifiedForStreak: nextQualified,
        sessionDateKey,
        createdAt: now,
      },
      update: {
        activeWatchSeconds,
        completionPercentage: nextCompletion,
        qualifiedForStreak: nextQualified,
      },
    });

    const daySessions = await this.prisma.mongo.learningSession.findMany({
      where: {
        userId,
        sessionDateKey,
      },
      select: {
        activeWatchSeconds: true,
        completionPercentage: true,
        qualifiedForStreak: true,
      },
    });

    const dayWatchSeconds = daySessions.reduce(
      (sum: number, item: (typeof daySessions)[number]) => sum + (item.activeWatchSeconds || 0),
      0,
    );
    const dayHasQualifiedSession = daySessions.some((item: (typeof daySessions)[number]) => item.qualifiedForStreak);
    const dayCompletionMax = daySessions.reduce(
      (max: number, item: (typeof daySessions)[number]) => Math.max(max, item.completionPercentage || 0),
      0,
    );

    const dayQualified =
      dayHasQualifiedSession ||
      dayWatchSeconds >= MIN_QUALIFIED_WATCH_SECONDS ||
      dayCompletionMax >= MIN_QUALIFIED_COMPLETION_PERCENT;

    let streakUpdated = false;
    let currentStreak = streak.currentStreak;
    let longestStreak = streak.longestStreak;

    if (dayQualified) {
      const existingAward = await this.prisma.mongo.learningStreakDay.findUnique({
        where: {
          userId_dateKey: {
            userId,
            dateKey: sessionDateKey,
          },
        },
      });

      if (!existingAward) {
        let createdAward = false;
        try {
          await this.prisma.mongo.learningStreakDay.create({
            data: {
              userId,
              dateKey: sessionDateKey,
              sourceSessionId: session.id,
              awarded: true,
              freezeConsumed: false,
              createdAt: now,
            },
          });
          createdAward = true;
        } catch (error) {
          const isDuplicateAward =
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002';
          if (!isDuplicateAward) {
            throw error;
          }
        }

        if (createdAward) {
          const prevDate = streak.lastLearningDate;
          if (!prevDate) {
            currentStreak = 1;
          } else {
            const gapDays = this.diffDateKeys(prevDate, sessionDateKey, streak.timezone);
            if (gapDays <= 0) {
              currentStreak = Math.max(1, streak.currentStreak);
            } else if (gapDays === 1) {
              currentStreak = streak.currentStreak + 1;
            } else {
              currentStreak = 1;
            }
          }

          longestStreak = Math.max(streak.longestStreak, currentStreak);
          streakUpdated = true;

          await this.prisma.mongo.learningStreak.update({
            where: { id: streak.id },
            data: {
              currentStreak,
              longestStreak,
              lastLearningDate: sessionDateKey,
              totalLearningDays: streak.totalLearningDays + 1,
              timezone: streak.timezone,
              updatedAt: now,
            },
          });

          // Increment student's aggregate study time in minutes in Postgres (best-effort).
          try {
            const minutesToAdd = Math.floor(dayWatchSeconds / 60);
            if (minutesToAdd > 0) {
              await this.prisma.postgres.studentProfile.update({
                where: { userId },
                data: { studyHours: { increment: minutesToAdd } as any },
              });
            }
          } catch (err) {
            // Do not fail streak awarding if updating studyHours fails
            console.error('Failed to increment studyHours for user', userId, err);
          }
        }
      }
    }

    const latestStreak = await this.prisma.mongo.learningStreak.findUnique({
      where: { id: streak.id },
      select: {
        currentStreak: true,
        longestStreak: true,
      },
    });

    currentStreak = latestStreak?.currentStreak ?? currentStreak;
    longestStreak = latestStreak?.longestStreak ?? longestStreak;

    return {
      sessionDateKey,
      timezone: streak.timezone,
      currentStreak,
      longestStreak,
      streakUpdated,
      todayQualified: dayQualified,
      dailyProgress: {
        activeWatchSeconds: dayWatchSeconds,
        completionPercentage: dayCompletionMax,
        goalSeconds: DEFAULT_DAILY_GOAL_SECONDS,
        remainingSeconds: Math.max(0, DEFAULT_DAILY_GOAL_SECONDS - dayWatchSeconds),
      },
    };
  }

  async getDailyStreakProgress(userId: string, timezone?: string) {
    const streak = await this.ensureLearningStreak(userId, this.normalizeTimezone(timezone));
    const dateKey = this.getDateKeyInTimezone(new Date(), streak.timezone);

    const daySessions = await this.prisma.mongo.learningSession.findMany({
      where: {
        userId,
        sessionDateKey: dateKey,
      },
      select: {
        activeWatchSeconds: true,
        completionPercentage: true,
        qualifiedForStreak: true,
      },
    });

    const activeWatchSeconds = daySessions.reduce(
      (sum: number, item: (typeof daySessions)[number]) => sum + (item.activeWatchSeconds || 0),
      0,
    );
    const completionPercentage = daySessions.reduce(
      (max: number, item: (typeof daySessions)[number]) => Math.max(max, item.completionPercentage || 0),
      0,
    );
    const qualified =
      daySessions.some((item: (typeof daySessions)[number]) => item.qualifiedForStreak) ||
      activeWatchSeconds >= MIN_QUALIFIED_WATCH_SECONDS ||
      completionPercentage >= MIN_QUALIFIED_COMPLETION_PERCENT;

    return {
      dateKey,
      timezone: streak.timezone,
      activeWatchSeconds,
      completionPercentage,
      qualified,
      goalSeconds: DEFAULT_DAILY_GOAL_SECONDS,
      remainingSeconds: Math.max(0, DEFAULT_DAILY_GOAL_SECONDS - activeWatchSeconds),
    };
  }

  async getStreakCalendar(userId: string, days = 90, timezone?: string) {
    const streak = await this.ensureLearningStreak(userId, this.normalizeTimezone(timezone));
    const safeDays = Math.min(Math.max(days || 90, 7), 365);
    const endDateKey = this.getDateKeyInTimezone(new Date(), streak.timezone);
    const startDate = this.addDaysToDateKey(endDateKey, -(safeDays - 1), streak.timezone);

    const dayEntries = await this.prisma.mongo.learningStreakDay.findMany({
      where: {
        userId,
        dateKey: {
          gte: startDate,
          lte: endDateKey,
        },
      },
      select: {
        dateKey: true,
        awarded: true,
        freezeConsumed: true,
      },
      orderBy: {
        dateKey: 'asc',
      },
    });

    return {
      timezone: streak.timezone,
      startDate,
      endDate: endDateKey,
      days: dayEntries.map((item: (typeof dayEntries)[number]) => ({
        date: item.dateKey,
        status: item.freezeConsumed ? 'freeze' : item.awarded ? 'learned' : 'missed',
        awarded: item.awarded,
        freezeConsumed: item.freezeConsumed,
      })),
    };
  }

  async getStreakLeaderboard(currentUserId: string, limit = 20) {
    const safeLimit = Math.min(Math.max(limit || 20, 5), 100);
    const rows = await this.prisma.mongo.learningStreak.findMany({
      orderBy: [{ currentStreak: 'desc' }, { longestStreak: 'desc' }, { updatedAt: 'asc' }],
      take: safeLimit,
      select: {
        userId: true,
        currentStreak: true,
        longestStreak: true,
        updatedAt: true,
      },
    });

    const userIds = rows.map((item: (typeof rows)[number]) => item.userId);
    const users = userIds.length
      ? await this.prisma.postgres.user.findMany({
          where: { id: { in: userIds } },
          select: {
            id: true,
            fullName: true,
            avatar: true,
          },
        })
      : [];
    const userMap = new Map(users.map((item) => [item.id, item]));

    return {
      leaderboard: rows.map((item: (typeof rows)[number], index: number) => ({
        rank: index + 1,
        userId: item.userId,
        fullName: userMap.get(item.userId)?.fullName || 'Unknown user',
        avatar: userMap.get(item.userId)?.avatar || null,
        currentStreak: item.currentStreak,
        longestStreak: item.longestStreak,
        isCurrentUser: item.userId === currentUserId,
      })),
    };
  }

  private async ensureLearningStreak(userId: string, timezone: string) {
    const now = new Date();
    const existing = await this.prisma.mongo.learningStreak.findUnique({ where: { userId } });
    if (existing) {
      if (!existing.timezone || existing.timezone !== timezone) {
        return this.prisma.mongo.learningStreak.update({
          where: { id: existing.id },
          data: {
            timezone,
            updatedAt: now,
          },
        });
      }
      return existing;
    }

    try {
      return await this.prisma.mongo.learningStreak.create({
        data: {
          userId,
          timezone,
          currentStreak: 0,
          longestStreak: 0,
          totalLearningDays: 0,
          streakFreezes: 0,
          createdAt: now,
        },
      });
    } catch (error) {
      const isDuplicateCreate =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002';

      if (!isDuplicateCreate) {
        throw error;
      }

      // Another concurrent request already created this streak row.
      const concurrent = await this.prisma.mongo.learningStreak.findUnique({ where: { userId } });
      if (!concurrent) {
        throw error;
      }

      if (!concurrent.timezone || concurrent.timezone !== timezone) {
        return this.prisma.mongo.learningStreak.update({
          where: { id: concurrent.id },
          data: {
            timezone,
            updatedAt: now,
          },
        });
      }

      return concurrent;
    }
  }

  private normalizeTimezone(value?: string) {
    const fallback = 'UTC';
    if (!value || typeof value !== 'string') return fallback;
    const normalized = value.trim();
    if (!normalized) return fallback;
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: normalized }).format(new Date());
      return normalized;
    } catch {
      return fallback;
    }
  }

  private getDateKeyInTimezone(date: Date, timezone: string) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);

    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;

    return `${year}-${month}-${day}`;
  }

  private dateKeyToUtcDate(dateKey: string) {
    const [year, month, day] = dateKey.split('-').map((part) => Number(part));
    return new Date(Date.UTC(year, month - 1, day));
  }

  private diffDateKeys(startDateKey: string, endDateKey: string, _timezone: string) {
    const start = this.dateKeyToUtcDate(startDateKey);
    const end = this.dateKeyToUtcDate(endDateKey);
    return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  }

  private addDaysToDateKey(dateKey: string, days: number, _timezone: string) {
    const date = this.dateKeyToUtcDate(dateKey);
    date.setUTCDate(date.getUTCDate() + days);
    const year = date.getUTCFullYear();
    const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
    const day = `${date.getUTCDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private computeSafeWatchTimeIncrement(existingWatchSeconds: number, incomingWatchSeconds: number) {
    const safeIncoming = Math.max(0, Math.floor(incomingWatchSeconds || 0));
    const safeExisting = Math.max(0, Math.floor(existingWatchSeconds || 0));
    const delta = Math.max(0, safeIncoming - safeExisting);
    const cappedDelta = Math.min(delta, 120);
    return safeExisting + cappedDelta;
  }

  // Get student stats
  async getStudentStats(userId: string) {
    const student = await this.prisma.postgres.user.findUnique({
      where: { id: userId },
      include: { 
        studentProfile: {
          include: {
            followedTeachers: true,
            sentFriendRequests: {
              where: { status: FriendStatus.ACCEPTED },
            },
            receivedFriendRequests: {
              where: { status: FriendStatus.ACCEPTED },
            },
          },
        },
      },
    });

    if (!student || !student.studentProfile) {
      throw new NotFoundException('Student not found');
    }

    // Count friends (both directions)
    const friendsCount = 
      student.studentProfile.sentFriendRequests.length +
      student.studentProfile.receivedFriendRequests.length;

    // Count documents and learning streak from MongoDB
    const [documents, learningStreak] = await Promise.all([
      this.prisma.mongo.notebook.count({
        where: { userId },
      }),
      this.prisma.mongo.learningStreak.findUnique({
        where: { userId },
        select: { currentStreak: true },
      }),
    ]);

    return {
      following: student.studentProfile.followedTeachers.length,
      friends: friendsCount,
      courses: student.studentProfile.followedTeachers.length,
      documents: documents,
      studyHours: student.studentProfile.studyHours,
      streak: learningStreak?.currentStreak ?? student.studentProfile.studyStreak,
    };
  }

  async createProfileActivity(userId: string, content: string, visibility: JournalVisibility = 'followers') {
    const trimmedContent = (content || '').trim();
    if (!trimmedContent) {
      throw new BadRequestException('Activity content cannot be empty');
    }

    if (trimmedContent.length > 280) {
      throw new BadRequestException('Activity content must be 280 characters or fewer');
    }

    const created = await this.prisma.mongo.activityLog.create({
      data: {
        userId,
        action: 'PROFILE_NOTE_POSTED',
        resource: 'profile-note',
        metadata: {
          content: trimmedContent,
          visibility,
          pinned: false,
          reactions: [],
          comments: [],
        },
      },
    });

    // Also record as a lightweight learning activity so it can qualify for streaks
    try {
      // Best-effort: award the day with minimal watch seconds (e.g., 60s)
      await this.recordLearningActivity(userId, {
        activityType: 'EXERCISE',
        watchTimeSeconds: 60,
        completionPercentage: 100,
        completed: true,
        timezone: undefined,
      });
    } catch (err) {
      // Do not block note creation if streak recording fails
      console.error('Failed to record learning activity for profile note:', err);
    }

    // Return a full journal entry object for frontend compatibility
    return await this.loadJournalEntry(created);
  }

  async getProfileActivities(viewerId: string | null | undefined, userId: string, limit = 20) {
    const safeLimit = Math.min(Math.max(limit || 20, 1), 50);
    const rows = await this.prisma.mongo.activityLog.findMany({
      where: {
        userId,
        action: 'PROFILE_NOTE_POSTED',
        resource: 'profile-note',
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: safeLimit,
    });

    const canViewFollowers = await this.canViewProfileJournal(viewerId, userId);

    const items = await Promise.all(rows
      .map(async (row: (typeof rows)[number]) => {
        const entry = await this.loadJournalEntry(row);

        const canViewEntry =
          entry.visibility === 'public' ||
          entry.userId === viewerId ||
          (entry.visibility === 'followers' && canViewFollowers);

        if (!canViewEntry) {
          return null;
        }

        return entry;
      }));

    const orderedItems = items
      .filter((item: (typeof items)[number]): item is NonNullable<(typeof items)[number]> => !!item)
      .sort((left: NonNullable<(typeof items)[number]>, right: NonNullable<(typeof items)[number]>) => {
        if (left.pinned !== right.pinned) {
          return left.pinned ? -1 : 1;
        }
        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      });

    return { items: orderedItems };
  }

  async pinProfileActivity(userId: string, activityId: string, pinned = true) {
    const activity = await this.prisma.mongo.activityLog.findFirst({
      where: {
        id: activityId,
        userId,
        action: 'PROFILE_NOTE_POSTED',
        resource: 'profile-note',
      },
    });

    if (!activity) {
      throw new NotFoundException('Activity not found');
    }

    const existing = this.normalizeJournalMetadata(activity.metadata);

    if (pinned) {
      const others = await this.prisma.mongo.activityLog.findMany({
        where: {
          userId,
          action: 'PROFILE_NOTE_POSTED',
          resource: 'profile-note',
          id: { not: activityId },
        },
      });

      await Promise.all(others.map((row: (typeof others)[number]) => {
        const metadata = this.normalizeJournalMetadata(row.metadata);
        return this.prisma.mongo.activityLog.update({
          where: { id: row.id },
          data: {
            metadata: {
              ...metadata,
              pinned: false,
            },
          },
        });
      }));
    }

    const updated = await this.prisma.mongo.activityLog.update({
      where: { id: activityId },
      data: {
        metadata: {
          ...existing,
          pinned,
        },
      },
    });

    return this.loadJournalEntry(updated);
  }

  async toggleProfileReaction(userId: string, activityId: string, type: JournalReactionType) {
    const activity = await this.prisma.mongo.activityLog.findFirst({
      where: {
        id: activityId,
        action: 'PROFILE_NOTE_POSTED',
        resource: 'profile-note',
      },
    });

    if (!activity) {
      throw new NotFoundException('Activity not found');
    }

    const metadata = this.normalizeJournalMetadata(activity.metadata);
    const reactions = Array.isArray(metadata.reactions) ? metadata.reactions : [];

    const existingIndex = reactions.findIndex((reaction) => reaction.userId === userId && reaction.type === type);
    const nextReactions = existingIndex >= 0
      ? reactions.filter((_, index) => index !== existingIndex)
      : [
          ...reactions.filter((reaction) => reaction.userId !== userId),
          { userId, type, createdAt: new Date().toISOString() },
        ];

    const updated = await this.prisma.mongo.activityLog.update({
      where: { id: activityId },
      data: {
        metadata: {
          ...metadata,
          reactions: nextReactions,
        },
      },
    });

    return this.loadJournalEntry(updated);
  }

  async addProfileComment(userId: string, activityId: string, content: string) {
    const trimmedContent = (content || '').trim();
    if (!trimmedContent) {
      throw new BadRequestException('Comment cannot be empty');
    }

    const activity = await this.prisma.mongo.activityLog.findFirst({
      where: {
        id: activityId,
        action: 'PROFILE_NOTE_POSTED',
        resource: 'profile-note',
      },
    });

    if (!activity) {
      throw new NotFoundException('Activity not found');
    }

    const metadata = this.normalizeJournalMetadata(activity.metadata);
    const comments = Array.isArray(metadata.comments) ? metadata.comments : [];
    const nextComment: JournalComment = {
      id: `comment_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      userId,
      content: trimmedContent,
      createdAt: new Date().toISOString(),
    };

    const updated = await this.prisma.mongo.activityLog.update({
      where: { id: activityId },
      data: {
        metadata: {
          ...metadata,
          comments: [...comments, nextComment],
        },
      },
    });

    return this.loadJournalEntry(updated);
  }

  // Send student help/chat message to ai-service
  async chatWithAi(userId: string, message: string) {
    if (!message || message.trim().length === 0) {
      throw new BadRequestException('Message cannot be empty');
    }

    const user = await this.prisma.postgres.user.findUnique({
      where: { id: userId },
      include: {
        studentProfile: true,
      },
    });

    if (!user || !user.studentProfile) {
      throw new ForbiddenException('Only students can use the help chatbot');
    }

    const directEndpoint = process.env.AI_SERVICE_URL;
    const hfEndpoint = process.env.HUGGINGFACE_ENDPOINT_URL;
    const hfModelId = process.env.HUGGINGFACE_MODEL_ID;
    const requestMode = (process.env.AI_REQUEST_MODE || 'hf').toLowerCase();

    let targetUrl = directEndpoint;
    if (!targetUrl) {
      if (hfEndpoint) {
        targetUrl = hfEndpoint;
      } else if (hfModelId) {
        targetUrl = `https://router.huggingface.co/hf-inference/models/${hfModelId}`;
      }
    }

    if (!targetUrl) {
      throw new BadGatewayException('AI endpoint is not configured');
    }

    const normalizedTarget = targetUrl.replace(/\/$/, '');
    const aiServiceUrl =
      requestMode === 'custom'
        ? normalizedTarget.replace(/\/chat$/, '') + '/chat'
        : normalizedTarget;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    let response: Response;
    try {
      const payload =
        requestMode === 'custom'
          ? { message: message.trim() }
          : {
              inputs: message.trim(),
              parameters: {
                max_new_tokens: 256,
                temperature: 0.7,
                return_full_text: false,
              },
              options: {
                wait_for_model: true,
              },
            };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (process.env.HUGGINGFACE_API_TOKEN) {
        headers.Authorization = `Bearer ${process.env.HUGGINGFACE_API_TOKEN}`;
      }

      response = await fetch(aiServiceUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error);
      throw new BadGatewayException(`AI service request failed: ${messageText}`);
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new BadGatewayException(
        `AI service error: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const body = await response.json();

    const normalized =
      body?.answer ||
      body?.response ||
      body?.generated_text ||
      body?.[0]?.generated_text ||
      body?.[0]?.summary_text ||
      null;

    if (!normalized) {
      if (body?.error) {
        throw new BadGatewayException(body.error);
      }
      throw new BadGatewayException('AI service returned no response');
    }

    return {
      success: true,
      response: normalized,
    };
  }

  // Save document from livestream to student's notebook
  async saveDocument(userId: string, data: {
    livestreamId: string;
    documentId: string;
    title: string;
    filename: string;
    fileType: string;
    fileUrl: string;
    fileSize: number;
    folder?: string;
    tags?: string[];
  }) {
    const student = await this.prisma.postgres.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true },
    });

    if (!student || !student.studentProfile) {
      throw new NotFoundException('Student not found');
    }

    // Check if already saved
    const existing = await this.prisma.mongo.studentNotebook.findFirst({
      where: {
        studentId: userId,
        documentId: data.documentId,
        livestreamId: data.livestreamId,
      },
    });

    if (existing) {
      throw new BadRequestException('Document already saved');
    }

    // Create saved document
    const savedDoc = await this.prisma.mongo.studentNotebook.create({
      data: {
        studentId: userId,
        livestreamId: data.livestreamId,
        documentId: data.documentId,
        title: data.title,
        filename: data.filename,
        fileType: data.fileType,
        fileUrl: data.fileUrl,
        fileSize: data.fileSize,
        folder: data.folder || 'Livestream Materials',
        tags: data.tags || [],
        notes: '',
        isPinned: false,
        savedAt: new Date(),
        lastAccessedAt: new Date(),
      },
    });

    return savedDoc;
  }

  // Get all saved documents for student
  async getSavedDocuments(userId: string, filters?: {
    folder?: string;
    isPinned?: boolean;
    tags?: string[];
  }) {
    const student = await this.prisma.postgres.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true },
    });

    if (!student || !student.studentProfile) {
      throw new NotFoundException('Student not found');
    }

    const where: any = { studentId: userId };

    if (filters?.folder) {
      where.folder = filters.folder;
    }

    if (filters?.isPinned !== undefined) {
      where.isPinned = filters.isPinned;
    }

    if (filters?.tags && filters.tags.length > 0) {
      where.tags = { hasEvery: filters.tags };
    }

    const documents = await this.prisma.mongo.studentNotebook.findMany({
      where,
      orderBy: [
        { isPinned: 'desc' },
        { savedAt: 'desc' },
      ],
    });

    return documents;
  }

  // Update saved document (notes, tags, pin status)
  async updateSavedDocument(userId: string, documentMongoId: string, data: {
    notes?: string;
    tags?: string[];
    isPinned?: boolean;
    folder?: string;
  }) {
    const existing = await this.prisma.mongo.studentNotebook.findUnique({
      where: { id: documentMongoId },
    });

    if (!existing) {
      throw new NotFoundException('Saved document not found');
    }

    if (existing.studentId !== userId) {
      throw new ForbiddenException('Cannot update another student\'s document');
    }

    const updated = await this.prisma.mongo.studentNotebook.update({
      where: { id: documentMongoId },
      data: {
        ...data,
        lastAccessedAt: new Date(),
      },
    });

    return updated;
  }

  // Remove saved document
  async removeSavedDocument(userId: string, documentMongoId: string) {
    const existing = await this.prisma.mongo.studentNotebook.findUnique({
      where: { id: documentMongoId },
    });

    if (!existing) {
      throw new NotFoundException('Saved document not found');
    }

    if (existing.studentId !== userId) {
      throw new ForbiddenException('Cannot delete another student\'s document');
    }

    await this.prisma.mongo.studentNotebook.delete({
      where: { id: documentMongoId },
    });

    return { message: 'Document removed successfully' };
  }

  // Check if document is saved
  async isDocumentSaved(userId: string, livestreamId: string, documentId: string) {
    const saved = await this.prisma.mongo.studentNotebook.findFirst({
      where: {
        studentId: userId,
        livestreamId,
        documentId,
      },
    });

    return { isSaved: !!saved, document: saved };
  }

  // Personalized recommendations for student home
  async getPersonalizedRecommendations(userId: string, limit: number = 24) {
    const safeLimit = Math.min(Math.max(limit || 24, 6), 48);

    const student = await this.prisma.postgres.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true },
    });

    if (!student || !student.studentProfile) {
      throw new NotFoundException('Student profile not found');
    }

    const interests = (student.studentProfile.interests || [])
      .map((x) => x.trim())
      .filter((x) => x.length > 0)
      .slice(0, 5);
    const normalizedInterests = interests
      .map((interest) => this.normalizeTopic(interest))
      .filter((interest) => interest.length > 0);

    const watchHistory = await this.prisma.mongo.watchHistory.findMany({
      where: { userId },
      orderBy: { watchedAt: 'desc' },
      take: 200,
      select: {
        livestreamId: true,
      },
    });

    const watchedIds: string[] = [];
    const watchedSet = new Set<string>();
    for (const item of watchHistory) {
      if (!watchedSet.has(item.livestreamId)) {
        watchedSet.add(item.livestreamId);
        watchedIds.push(item.livestreamId);
      }
    }

    const watchedVideos = watchedIds.length
      ? await this.prisma.postgres.liveStream.findMany({
          where: {
            id: { in: watchedIds },
            status: 'ENDED',
            recordingUrl: { not: null },
          },
          select: {
            id: true,
            title: true,
            category: true,
            teacherId: true,
          },
        })
      : [];

    const interestSet = new Set(normalizedInterests);
    const categorySignal = new Map<string, number>();
    const teacherSignal = new Map<string, number>();

    for (const interest of interestSet) {
      categorySignal.set(interest, (categorySignal.get(interest) || 0) + 4);
    }

    watchedVideos.forEach((video, index) => {
      const recencyWeight = Math.max(1, 5 - Math.floor(index / 5));
      const normalizedCategory = this.normalizeTopic(video.category || '');

      if (normalizedCategory) {
        categorySignal.set(
          normalizedCategory,
          (categorySignal.get(normalizedCategory) || 0) + recencyWeight,
        );
      }

      teacherSignal.set(
        video.teacherId,
        (teacherSignal.get(video.teacherId) || 0) + recencyWeight,
      );
    });

    const nextPartMap = this.buildNextPartMap(watchedVideos);

    const candidates = await this.prisma.postgres.liveStream.findMany({
      where: {
        status: 'ENDED',
        recordingUrl: { not: null },
        id: {
          notIn: watchedIds,
        },
      },
      select: {
        id: true,
        title: true,
        category: true,
        thumbnail: true,
        duration: true,
        totalViews: true,
        endedAt: true,
        recordingUrl: true,
        teacherId: true,
        teacher: {
          select: {
            id: true,
            fullName: true,
            avatar: true,
          },
        },
      },
      orderBy: [{ endedAt: 'desc' }, { totalViews: 'desc' }],
      take: 300,
    });

    const scored = candidates
      .map((video) => this.scoreCandidate(video, categorySignal, teacherSignal, interestSet, nextPartMap))
      .sort((a, b) => b.score - a.score);

    const byInterests = scored
      .filter((item) => item.reasons.includes('interest'))
      .slice(0, Math.min(8, safeLimit));

    const continueWatching = scored
      .filter((item) => item.reasons.includes('next_part'))
      .slice(0, Math.min(8, safeLimit));

    const merged = this.uniqueById([
      ...continueWatching,
      ...byInterests,
      ...scored,
    ]).slice(0, safeLimit);

    return {
      onboardingNeeded: normalizedInterests.length === 0,
      interests: normalizedInterests,
      byInterests,
      continueWatching,
      recommendations: merged,
    };
  }

  private scoreCandidate(
    candidate: RecommendationCandidate,
    categorySignal: Map<string, number>,
    teacherSignal: Map<string, number>,
    interestSet: Set<string>,
    nextPartMap: PartProgressMap,
  ) {
    let score = 0;
    const reasons: string[] = [];

    const normalizedCategory = this.normalizeTopic(candidate.category || '');
    if (normalizedCategory) {
      if (interestSet.has(normalizedCategory)) {
        score += 40;
        reasons.push('interest');
      }

      const categoryWeight = categorySignal.get(normalizedCategory) || 0;
      if (categoryWeight > 0) {
        score += Math.min(30, categoryWeight * 5);
        reasons.push('watch_history_category');
      }
    }

    const teacherWeight = teacherSignal.get(candidate.teacherId) || 0;
    if (teacherWeight > 0) {
      score += Math.min(18, teacherWeight * 3);
      reasons.push('watch_history_teacher');
    }

    if (this.isNextPart(candidate, nextPartMap)) {
      score += 65;
      reasons.push('next_part');
    }

    score += Math.min(10, (candidate.totalViews || 0) / 1000);

    if (candidate.endedAt) {
      const daysOld =
        (Date.now() - new Date(candidate.endedAt).getTime()) /
        (1000 * 60 * 60 * 24);
      score += Math.max(0, 8 - daysOld / 15);
    }

    return {
      id: candidate.id,
      title: candidate.title,
      category: candidate.category,
      thumbnailUrl: candidate.thumbnail,
      duration: candidate.duration,
      totalViews: candidate.totalViews,
      endedAt: candidate.endedAt,
      recordingUrl: candidate.recordingUrl,
      teacher: candidate.teacher,
      score: Number(score.toFixed(2)),
      reasons: Array.from(new Set(reasons)),
    };
  }

  private buildNextPartMap(
    watchedVideos: Array<{ teacherId: string; title: string }>,
  ): PartProgressMap {
    const map: PartProgressMap = new Map();

    for (const item of watchedVideos) {
      const parsed = this.parsePart(item.title);
      if (!parsed) continue;

      const key = `${item.teacherId}:${parsed.base}`;
      const nextPart = parsed.part + 1;
      const currentMax = map.get(key) || 0;
      if (nextPart > currentMax) {
        map.set(key, nextPart);
      }
    }

    return map;
  }

  private isNextPart(candidate: RecommendationCandidate, nextPartMap: PartProgressMap): boolean {
    const parsed = this.parsePart(candidate.title);
    if (!parsed) return false;

    const key = `${candidate.teacherId}:${parsed.base}`;
    const expectedPart = nextPartMap.get(key);

    return !!expectedPart && parsed.part === expectedPart;
  }

  private parsePart(title: string): { base: string; part: number } | null {
    const cleanTitle = title.trim().toLowerCase();
    const match = cleanTitle.match(/^(.*?)(?:\s*[-:|]?\s*)(?:part|episode|ep|phan|bai)\s*(\d+)\b/i);

    if (!match) {
      return null;
    }

    const base = (match[1] || '')
      .replace(/[^a-z0-9\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const part = Number(match[2]);
    if (!base || Number.isNaN(part)) {
      return null;
    }

    return { base, part };
  }

  private normalizeTopic(value: string): string {
    return normalizeVideoCategory(value).trim().toLowerCase();
  }

  private uniqueById<T extends { id: string }>(items: T[]): T[] {
    const seen = new Set<string>();
    const result: T[] = [];

    for (const item of items) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        result.push(item);
      }
    }

    return result;
  }
}

