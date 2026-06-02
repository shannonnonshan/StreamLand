import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { BanDuration } from '../common/types/ban-duration';
import { calculateBanUntil } from '../common/utils/ban-until';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  private async getProcessingAnalysisState(type: 'LIVESTREAM' | 'DOCUMENT', itemId: string) {
    const result = await this.prisma.mongo.$runCommandRaw({
      find: 'ai_transcript_summary',
      filter: type === 'LIVESTREAM'
        ? { type, recordingId: itemId }
        : { type, documentId: itemId },
      limit: 1,
    });

    const analysis = ((result as { cursor?: { firstBatch?: Record<string, unknown>[] } }).cursor?.firstBatch || [])[0];

    if (!analysis) {
      return {
        processingStage: null,
        processingProgress: 0,
        processingError: null,
      };
    }

    const processingProgress =
      typeof analysis.processingProgress === 'number'
        ? analysis.processingProgress
        : typeof analysis.moderationCheckedAt === 'string' || analysis.moderationCheckedAt instanceof Date
          ? 100
          : typeof analysis.summaryGeneratedAt === 'string' || analysis.summaryGeneratedAt instanceof Date
            ? 85
            : typeof analysis.transcriptGeneratedAt === 'string' || analysis.transcriptGeneratedAt instanceof Date
              ? 60
              : analysis.transcriptStatus === 'processing'
                ? 35
                : analysis.processingStage === 'preparing'
                  ? 10
                  : 0;

    return {
      processingStage: typeof analysis.processingStage === 'string' ? analysis.processingStage : null,
      processingProgress,
      processingError: typeof analysis.processingError === 'string' ? analysis.processingError : null,
    };
  }

  private async markProcessingDoneForLivestream(livestreamId: string): Promise<void> {
    await this.prisma.postgres.liveStream.update({
      where: { id: livestreamId },
      data: {
        isApprove: 'TRUE',
        rejectReason: null,
        processingStatus: 'DONE',
      },
    });
  }

  private async markProcessingDoneForDocument(documentId: string): Promise<void> {
    await this.prisma.postgres.document.update({
      where: { id: documentId },
      data: {
        isApprove: 'TRUE',
        processingStatus: 'DONE',
      },
    });
  }

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
          teacherProfile: {
            include: {
              followers: {
                select: {
                  id: true,
                },
              },
            },
          },
          studentProfile: true,
          _count: {
            select: {
              livestreams: true,
            },
          },
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

  async createReport(reporterId: string, payload: {
    reportedId: string;
    reason: string;
    description?: string;
    category?: string;
    type?: 'USER' | 'LIVESTREAM' | 'COMMENT' | 'MESSAGE' | 'OTHER';
    screenshots?: string[];
    metadata?: Record<string, unknown>;
  }) {
    if (reporterId === payload.reportedId) {
      throw new BadRequestException('You cannot report your own profile');
    }

    const [reporter, reported] = await Promise.all([
      this.prisma.postgres.user.findUnique({
        where: { id: reporterId },
        select: { id: true, role: true, fullName: true, avatar: true },
      }),
      this.prisma.postgres.user.findUnique({
        where: { id: payload.reportedId },
        select: { id: true, role: true, fullName: true, avatar: true },
      }),
    ]);

    if (!reporter) {
      throw new NotFoundException('Reporter not found');
    }

    if (!reported) {
      throw new NotFoundException('Reported user not found');
    }

    const reason = payload.reason.trim();
    if (!reason) {
      throw new BadRequestException('Report reason is required');
    }

    const report = await this.prisma.postgres.report.create({
      data: {
        reporterId,
        reportedId: payload.reportedId,
        type: payload.type || 'USER',
        category: payload.category?.trim() || 'Profile',
        reason,
        description: payload.description?.trim() || null,
        status: 'PENDING',
        screenshots: payload.screenshots || [],
        metadata: payload.metadata ? (payload.metadata as any) : undefined,
      },
    });

    return {
      success: true,
      message: 'Report submitted successfully',
      report: {
        id: report.id,
        reporterId: report.reporterId,
        reporterType: reporter.role === 'TEACHER' ? 'teacher' : 'student',
        reporterName: reporter.fullName,
        reporterAvatar: reporter.avatar || undefined,
        targetId: report.reportedId,
        targetName: reported.fullName,
        targetType: reported.role === 'TEACHER' ? 'teacher' : 'student',
        targetAvatar: reported.avatar || undefined,
        reason: report.reason,
        details: report.description || report.reason,
        evidence: report.screenshots.length > 0 ? report.screenshots : undefined,
        status: 'waiting',
        createdAt: report.createdAt.toISOString(),
      },
    };
  }

  async getReports() {
    const reports = await this.prisma.postgres.report.findMany({
      include: {
        reporter: {
          select: {
            fullName: true,
            role: true,
            avatar: true,
          },
        },
        reported: {
          select: {
            fullName: true,
            role: true,
            avatar: true,
            banUntil: true,
          },
        },
        reviewer: {
          select: {
            fullName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return reports.map((report) => ({
      id: report.id,
      reporterId: report.reporterId,
      reporterName: report.reporter?.fullName ?? 'Unknown user',
      reporterType: report.reporter?.role === 'TEACHER' ? 'teacher' : 'student',
      reporterAvatar: report.reporter?.avatar ?? undefined,
      targetId: report.reportedId,
      targetName: report.reported?.fullName ?? 'Unknown user',
      targetType: report.reported?.role === 'TEACHER' ? 'teacher' : 'student',
      targetAvatar: report.reported?.avatar ?? undefined,
      reason: report.reason,
      details: report.description ?? report.reason,
      evidence: report.screenshots.length > 0 ? report.screenshots : undefined,
      status: report.reported?.banUntil && report.reported.banUntil > new Date()
        ? 'banned'
        : report.status === 'RESOLVED'
          ? 'resolved'
          : report.status === 'DISMISSED'
            ? 'rejected'
            : 'waiting',
      banDuration: undefined,
      bannedUntil: report.reported?.banUntil ? report.reported.banUntil.toISOString() : undefined,
      createdAt: report.createdAt.toISOString(),
      resolvedAt: report.reviewedAt ? report.reviewedAt.toISOString() : undefined,
    }));
  }

  async updateReportStatus(
    reportId: string,
    status: 'RESOLVED' | 'DISMISSED',
    reviewerId: string,
    resolution?: string,
  ) {
    const existing = await this.prisma.postgres.report.findUnique({
      where: { id: reportId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Report not found');
    }

    await this.prisma.postgres.report.update({
      where: { id: reportId },
      data: {
        status,
        resolution: resolution ?? null,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
      },
    });

    return {
      success: true,
      message: 'Report status updated',
      reportId,
      status,
    };
  }

  async banUser(userId: string, duration: BanDuration) {
    const banUntil = calculateBanUntil(duration);

    const user = await this.prisma.postgres.user.findUnique({
      where: { id: userId },
      select: { id: true, fullName: true, email: true, role: true, banUntil: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.banUntil && user.banUntil > new Date()) {
      throw new ConflictException({
        message: 'User is already banned',
        bannedUntil: user.banUntil,
      });
    }

    await this.prisma.postgres.user.update({
      where: { id: userId },
      data: { banUntil },
    });

    return {
      success: true,
      message: 'User banned successfully',
      userId,
      bannedUntil: banUntil,
    };
  }

  // Get all livestreams with pagination
  async getAllLivestreams(status?: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const where: any = {
      recordingUrl: {
        not: null,
      },
    };
    
    if (status) {
      where.status = status.toUpperCase();
    }

    const [livestreams, total] = await Promise.all([
      this.prisma.postgres.liveStream.findMany({
        where,
        select: {
          id: true,
          title: true,
          description: true,
          recordingUrl: true,
          isApprove: true,
          processingStatus: true,
          status: true,
          rejectReason: true,
          createdAt: true,
          teacher: {
            select: {
              fullName: true,
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
      livestreams: await Promise.all(livestreams.map(async ls => ({
        id: ls.id,
        title: ls.title,
        recordingUrl: ls.recordingUrl,
        uploadedBy: ls.teacher?.fullName || 'Unknown',
        uploadedAt: ls.createdAt,
        status: ls.status,
        rejectReason: ls.rejectReason ?? null,
        approvalStatus: ls.isApprove === 'TRUE' ? 'approved' : ls.isApprove === 'REJECTED' ? 'removed' : 'pending',
        processingStatus: ls.processingStatus,
        ...(await this.getProcessingAnalysisState('LIVESTREAM', ls.id)),
      }))),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Approve a livestream recording
  async approveLivestream(livestreamId: string, _moderatorId: string) {
    const livestream = await this.prisma.postgres.liveStream.findUnique({ where: { id: livestreamId } });
    if (!livestream) {
      throw new NotFoundException('Livestream not found');
    }

    await this.markProcessingDoneForLivestream(livestreamId);

    return { success: true, message: 'Livestream approved', livestreamId };
  }

  // Reject a livestream recording
  async rejectLivestream(livestreamId: string, reason?: string, _moderatorId?: string) {
    const livestream = await this.prisma.postgres.liveStream.findUnique({ where: { id: livestreamId } });
    if (!livestream) {
      throw new NotFoundException('Livestream not found');
    }

    await this.prisma.postgres.liveStream.update({
      where: { id: livestreamId },
      data: {
        isApprove: 'REJECTED',
        rejectReason: reason?.trim() || null,
        processingStatus: 'DONE',
      },
    });

    return { success: true, message: 'Livestream rejected', livestreamId, rejectReason: reason?.trim() || null };
  }

  // Get all documents with pagination
  async getAllDocuments(status?: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const where: any = {
      mimeType: {
        startsWith: 'video/',
      },
    };
    
    if (status) {
      const normalizedStatus = status.trim().toLowerCase();
      if (normalizedStatus === 'approved' || normalizedStatus === 'true') {
        where.isApprove = 'TRUE';
      } else if (normalizedStatus === 'rejected' || normalizedStatus === 'removed') {
        where.isApprove = 'REJECTED';
      } else if (normalizedStatus === 'pending' || normalizedStatus === 'false') {
        where.isApprove = 'FALSE';
      }
    }

    const [documents, total] = await Promise.all([
      this.prisma.postgres.document.findMany({
        where,
        select: {
          id: true,
          title: true,
          fileUrl: true,
          uploadedAt: true,
          teacherId: true,
          isApprove: true,
          processingStatus: true,
        },
        orderBy: {
          uploadedAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.postgres.document.count({ where }),
    ]);

    // Get teacher info for each document
    const docsWithTeacher = await Promise.all(
      documents.map(async (doc) => {
        const teacher = await this.prisma.postgres.user.findUnique({
          where: { id: doc.teacherId },
          select: {
            fullName: true,
          },
        });
        return {
          id: doc.id,
          title: doc.title,
          videoUrl: doc.fileUrl,
          uploadedBy: teacher?.fullName || 'Unknown',
          uploadedAt: doc.uploadedAt,
          status: doc.isApprove === 'TRUE' ? 'approved' : doc.isApprove === 'REJECTED' ? 'removed' : 'pending',
          processingStatus: doc.processingStatus,
          ...(await this.getProcessingAnalysisState('DOCUMENT', doc.id)),
        };
      })
    );

    return {
      documents: docsWithTeacher,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Approve a document
  async approveDocument(documentId: string, _moderatorId: string) {
    const doc = await this.prisma.postgres.document.findUnique({ where: { id: documentId } });
    if (!doc) {
      throw new NotFoundException('Document not found');
    }

    await this.markProcessingDoneForDocument(documentId);

    return { success: true, message: 'Document approved', documentId };
  }

  // Reject a document
  async rejectDocument(documentId: string, reason?: string, _moderatorId?: string) {
    const doc = await this.prisma.postgres.document.findUnique({ where: { id: documentId } });
    if (!doc) {
      throw new NotFoundException('Document not found');
    }

    await this.prisma.postgres.document.update({
      where: { id: documentId },
      data: {
        isApprove: 'REJECTED',
        processingStatus: 'DONE',
      },
    });

    return { success: true, message: 'Document rejected', documentId, reason: reason || 'No reason provided' };
  }

  // Create new admin
  async createAdmin(email: string, password: string, fullName: string) {
    const bcrypt = require('bcrypt');
    
    // Check if email already exists
    const existingUser = await this.prisma.postgres.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new Error('Email already in use');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create admin user
    const admin = await this.prisma.postgres.user.create({
      data: {
        email,
        password: hashedPassword,
        fullName,
        role: 'ADMIN',
        isVerified: true, // Auto-verify admin accounts
      },
    });

    // Remove password from response
    const { password: _, ...adminWithoutPassword } = admin;
    return adminWithoutPassword;
  }

  // Delete admin (soft delete by setting role to STUDENT or hard delete)
  async deleteAdmin(adminId: string) {
    const admin = await this.prisma.postgres.user.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    if (admin.role !== 'ADMIN') {
      throw new Error('User is not an admin');
    }

    // Hard delete the admin
    await this.prisma.postgres.user.delete({
      where: { id: adminId },
    });

    return { message: 'Admin deleted successfully' };
  }

  async changePassword(adminId: string, passwords: { currentPassword: string; newPassword: string }) {
    const bcrypt = await import('bcrypt');
    
    const user = await this.prisma.postgres.user.findUnique({
      where: { id: adminId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(passwords.currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(passwords.newPassword, 10);

    await this.prisma.postgres.user.update({
      where: { id: adminId },
      data: { password: hashedNewPassword },
    });

    return { success: true, message: 'Password changed successfully' };
  }
}
