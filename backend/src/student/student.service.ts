import { Injectable, NotFoundException, BadRequestException, ForbiddenException, BadGatewayException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FriendStatus } from '@prisma/client';
import { SendFriendRequestDto, UpdateFriendRequestDto, FollowTeacherDto, UnfollowTeacherDto } from './dto';
import { NotificationService } from '../notification/notification.service';

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

@Injectable()
export class StudentService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {}

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
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lastActivity = student.studentProfile.lastActivityDate;

    let newStreak = student.studentProfile.studyStreak;
    let shouldUpdate = false;

    if (!lastActivity) {
      // First activity ever
      newStreak = 1;
      shouldUpdate = true;
    } else {
      const lastActivityAsDate = new Date(lastActivity);
      const lastActivityDate = new Date(
        lastActivityAsDate.getFullYear(),
        lastActivityAsDate.getMonth(),
        lastActivityAsDate.getDate()
      );
      
      const diffTime = today.getTime() - lastActivityDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        // Same day, no update needed
        shouldUpdate = false;
      } else if (diffDays === 1) {
        // Next day, increment streak
        newStreak = student.studentProfile.studyStreak + 1;
        shouldUpdate = true;
      } else if (diffDays > 1) {
        // Streak broken, reset to 1
        newStreak = 1;
        shouldUpdate = true;
      }
    }

    if (shouldUpdate) {
      await this.prisma.postgres.studentProfile.update({
        where: { id: student.studentProfile.id },
        data: {
          studyStreak: newStreak,
          lastActivityDate: now,
        },
      });
    }

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

    return {
      streak: newStreak,
      updated: shouldUpdate,
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
      items: items.map((item) => ({
        contentId: item.livestreamId,
        watchedAt: item.watchedAt,
        duration: item.duration,
        completed: item.completed,
        progress: item.progress,
        lastPosition: item.lastPosition,
      })),
    };
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

    // Count watch history and documents from MongoDB
    const [watchHistory, documents] = await Promise.all([
      this.prisma.mongo.watchHistory.count({
        where: { userId },
      }),
      this.prisma.mongo.notebook.count({
        where: { userId },
      }),
    ]);

    return {
      following: student.studentProfile.followedTeachers.length,
      friends: friendsCount,
      courses: watchHistory, // Using watch history as course count
      documents: documents,
      studyHours: student.studentProfile.studyHours,
      streak: student.studentProfile.studyStreak,
    };
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

    const interestSet = new Set(interests.map((x) => this.normalizeTopic(x)));
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
      onboardingNeeded: interests.length === 0,
      interests,
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
    return value.trim().toLowerCase();
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

