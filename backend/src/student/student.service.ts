import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FriendStatus } from '@prisma/client';
import { SendFriendRequestDto, UpdateFriendRequestDto, FollowTeacherDto, UnfollowTeacherDto } from './dto';

@Injectable()
export class StudentService {
  constructor(private prisma: PrismaService) {}

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
      include: {
        requester: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
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
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
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
      include: {
        requester: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
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
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
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

    // Extract friend IDs and pending request IDs
    const excludedProfileIds = new Set<string>();
    friendships.forEach(f => {
      if (f.requestId === studentProfileId) {
        excludedProfileIds.add(f.receiverId);
      } else {
        excludedProfileIds.add(f.requestId);
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
      include: {
        studentProfile: true,
      },
      take: 20,
    });

    // Filter out existing friends and add friendship status
    const results = students
      .filter(s => s.studentProfile && !excludedProfileIds.has(s.studentProfile.id))
      .map(s => {
        // Check if there's a pending request
        const pendingRequest = friendships.find(f => 
          (f.requestId === studentProfileId && f.receiverId === s.studentProfile?.id) ||
          (f.receiverId === studentProfileId && f.requestId === s.studentProfile?.id)
        );

        return {
          id: s.id,
          fullName: s.fullName,
          email: s.email,
          avatar: s.avatar,
          bio: s.bio,
          studentProfile: s.studentProfile,
          friendshipStatus: pendingRequest ? pendingRequest.status : null,
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
      include: {
        studentProfile: true,
      },
      take: 50, // Get more to filter from
    });

    // Filter and shuffle
    const filtered = students
      .filter(s => s.studentProfile && !excludedProfileIds.has(s.studentProfile.id))
      .sort(() => Math.random() - 0.5) // Shuffle
      .slice(0, 12); // Take 12 suggestions

    const results = filtered.map(s => ({
      id: s.id,
      fullName: s.fullName,
      email: s.email,
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
      include: {
        requester: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                avatar: true,
                bio: true,
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
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return follows.map(f => ({
      id: f.id,
      teacher: f.teacher.user,
      teacherProfileId: f.teacher.id,
      followedSince: f.createdAt,
    }));
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

    // Get all followed teachers
    const followedTeachers = await this.prisma.postgres.followedTeacher.findMany({
      where: { studentId: user.studentProfile.id },
      select: { teacherId: true },
    });

    // Get teacher IDs
    const teacherIds = followedTeachers.map(ft => ft.teacherId);

    if (teacherIds.length === 0) {
      return [];
    }

    // Get active livestreams from these teachers
    const livestreams = await this.prisma.postgres.liveStream.findMany({
      where: {
        teacherId: { in: teacherIds },
        status: 'LIVE',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Get teacher details
    const teachers = await this.prisma.postgres.teacherProfile.findMany({
      where: { id: { in: teacherIds } },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            avatar: true,
          },
        },
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
          id: teacher?.user.id || '',
          fullName: teacher?.user.fullName || 'Unknown',
          avatar: teacher?.user.avatar || null,
        },
        viewCount: livestream.totalViews,
        thumbnailUrl: livestream.thumbnail || null,
        isLive: true,
      };
    });
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
}
