import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  // Get all conversations with admin
  async getAdminConversations() {
    const messages = await this.prisma.mongo.chatMessage.findMany({
      where: {
        OR: [
          { senderId: 'ADMIN' },
          { receiverId: 'ADMIN' },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group by user and get latest message for each
    const conversationsMap = new Map();
    
    for (const msg of messages) {
      const otherUserId = msg.senderId === 'ADMIN' ? msg.receiverId : msg.senderId;
      
      if (!conversationsMap.has(otherUserId)) {
        conversationsMap.set(otherUserId, {
          userId: otherUserId,
          lastMessage: msg.content,
          lastMessageAt: msg.createdAt,
          unread: msg.receiverId === 'ADMIN' && !msg.readAt,
        });
      }
    }

    // Get user details for each conversation
    const conversations = [];
    for (const [userId, convData] of conversationsMap) {
      const user = await this.prisma.postgres.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          fullName: true,
          email: true,
          avatar: true,
          role: true,
        },
      });

      if (user) {
        conversations.push({
          ...convData,
          user,
        });
      }
    }

    return conversations;
  }

  // Get pending teachers waiting for approval
  async getPendingTeachers() {
    const teachers = await this.prisma.postgres.user.findMany({
      where: {
        role: 'TEACHER',
        teacherProfile: {
          isApproved: false,
          rejectedAt: null,
        },
      },
      include: {
        teacherProfile: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return teachers.map(teacher => ({
      id: teacher.id,
      fullName: teacher.fullName,
      email: teacher.email,
      avatar: teacher.avatar,
      bio: teacher.bio,
      location: teacher.location,
      education: teacher.teacherProfile?.education,
      experience: teacher.teacherProfile?.experience,
      subjects: teacher.teacherProfile?.subjects,
      cvUrl: teacher.teacherProfile?.cvUrl,
      website: teacher.teacherProfile?.website,
      linkedin: teacher.teacherProfile?.linkedin,
      createdAt: teacher.createdAt,
    }));
  }

  // Get all teachers with optional status filter
  async getAllTeachers(status?: string) {
    const where: any = { role: 'TEACHER' };
    
    if (status === 'approved') {
      where.teacherProfile = { isApproved: true };
    } else if (status === 'pending') {
      where.teacherProfile = { isApproved: false, rejectedAt: null };
    } else if (status === 'rejected') {
      where.teacherProfile = { rejectedAt: { not: null } };
    }

    const teachers = await this.prisma.postgres.user.findMany({
      where,
      include: {
        teacherProfile: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return teachers;
  }

  // Approve teacher
  async approveTeacher(teacherId: string) {
    const teacher = await this.prisma.postgres.user.findUnique({
      where: { id: teacherId },
      include: { teacherProfile: true },
    });

    if (!teacher || !teacher.teacherProfile) {
      throw new NotFoundException('Teacher not found');
    }

    await this.prisma.postgres.teacherProfile.update({
      where: { userId: teacherId },
      data: {
        isApproved: true,
        approvedAt: new Date(),
        rejectedAt: null,
        rejectionReason: null,
      },
    });

    // TODO: Send approval email notification

    return {
      success: true,
      message: 'Teacher approved successfully',
      teacherId,
    };
  }

  // Reject teacher
  async rejectTeacher(teacherId: string, reason?: string) {
    const teacher = await this.prisma.postgres.user.findUnique({
      where: { id: teacherId },
      include: { teacherProfile: true },
    });

    if (!teacher || !teacher.teacherProfile) {
      throw new NotFoundException('Teacher not found');
    }

    await this.prisma.postgres.teacherProfile.update({
      where: { userId: teacherId },
      data: {
        isApproved: false,
        rejectedAt: new Date(),
        rejectionReason: reason || 'No reason provided',
        approvedAt: null,
      },
    });

    // TODO: Send rejection email notification

    return {
      success: true,
      message: 'Teacher rejected',
      teacherId,
      reason,
    };
  }

  // Get admin dashboard stats
  async getDashboardStats() {
    const [
      totalUsers,
      totalTeachers,
      totalStudents,
      pendingTeachers,
      approvedTeachers,
      rejectedTeachers,
      totalLivestreams,
      activeLivestreams,
      totalViews,
    ] = await Promise.all([
      this.prisma.postgres.user.count(),
      this.prisma.postgres.user.count({ where: { role: 'TEACHER' } }),
      this.prisma.postgres.user.count({ where: { role: 'STUDENT' } }),
      this.prisma.postgres.teacherProfile.count({ 
        where: { isApproved: false, rejectedAt: null } 
      }),
      this.prisma.postgres.teacherProfile.count({ where: { isApproved: true } }),
      this.prisma.postgres.teacherProfile.count({ 
        where: { rejectedAt: { not: null } } 
      }),
      this.prisma.postgres.liveStream.count(),
      this.prisma.postgres.liveStream.count({ where: { status: 'LIVE' } }),
      this.prisma.postgres.liveStream.aggregate({
        _sum: { totalViews: true },
      }),
    ]);

    // Get monthly user registrations (last 12 months)
    const monthlyRegistrations = [];
    const now = new Date();
    
    for (let i = 11; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      
      const count = await this.prisma.postgres.user.count({
        where: {
          createdAt: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
      });
      
      monthlyRegistrations.push(count);
    }

    return {
      totalUsers,
      totalTeachers,
      totalStudents,
      pendingTeachers,
      approvedTeachers,
      rejectedTeachers,
      totalLivestreams,
      activeLivestreams,
      totalViews: totalViews._sum.totalViews || 0,
      monthlyRegistrations,
    };
  }

  // Get all users with pagination
  async getAllUsers(role?: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const where: any = {};
    
    if (role) {
      where.role = role.toUpperCase();
    }

    const [users, total] = await Promise.all([
      this.prisma.postgres.user.findMany({
        where,
        include: {
          teacherProfile: true,
          studentProfile: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.postgres.user.count({ where }),
    ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Get all livestreams with pagination
  async getAllLivestreams(status?: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const where: any = {};
    
    if (status) {
      where.status = status.toUpperCase();
    }

    const [livestreams, total] = await Promise.all([
      this.prisma.postgres.liveStream.findMany({
        where,
        include: {
          teacher: {
            select: {
              id: true,
              fullName: true,
              email: true,
              avatar: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.postgres.liveStream.count({ where }),
    ]);

    return {
      livestreams,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
