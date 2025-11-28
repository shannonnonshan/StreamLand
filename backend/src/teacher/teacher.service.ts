import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { R2StorageService } from '../r2-storage/r2-storage.service';

@Injectable()
export class TeacherService {
  constructor(
    private prisma: PrismaService,
    private r2StorageService: R2StorageService,
  ) {}

  // Get teacher videos/livestreams
  async getTeacherVideos(teacherId: string, limit: number = 20) {
    const livestreams = await this.prisma.postgres.liveStream.findMany({
      where: {
        teacherId,
        isPublic: true,
        OR: [
          { status: 'LIVE' },
          { status: 'SCHEDULED' },
          { 
            status: 'ENDED',
            recordingUrl: { not: null } // Only show ended streams with recordings
          },
        ],
      },
      orderBy: [
        { status: 'asc' }, // LIVE first, then SCHEDULED, then ENDED
        { startedAt: 'desc' },
        { scheduledAt: 'desc' },
        { endedAt: 'desc' },
      ],
      take: limit,
      select: {
        id: true,
        title: true,
        description: true,
        thumbnail: true,
        totalViews: true,
        currentViewers: true,
        duration: true,
        status: true,
        recordingUrl: true,
        startedAt: true,
        scheduledAt: true,
        endedAt: true,
        createdAt: true,
      },
    });

    return livestreams.map(stream => ({
      id: stream.id,
      title: stream.title,
      description: stream.description,
      thumbnail: stream.thumbnail || '/image/default-thumbnail.jpg',
      views: stream.totalViews || 0,
      currentViewers: stream.currentViewers || 0,
      duration: this.formatDuration(stream.duration),
      status: stream.status,
      recordingUrl: stream.recordingUrl,
      startedAt: stream.startedAt,
      scheduledStartTime: stream.scheduledAt,
      date: stream.endedAt || stream.startedAt || stream.scheduledAt || stream.createdAt,
      teacherId,
    }));
  }

  // Helper to format duration in seconds to HH:MM:SS or MM:SS
  private formatDuration(seconds: number | null): string {
    if (!seconds) return '0:00';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  // Get dashboard stats for teacher
  async getDashboardStats(teacherId: string) {
    const teacher = await this.prisma.postgres.user.findUnique({
      where: { id: teacherId },
      include: { teacherProfile: { include: { followers: true } } },
    });

    if (!teacher || !teacher.teacherProfile) {
      throw new NotFoundException('Teacher not found');
    }

    // Get livestream stats
    const totalLivestreams = await this.prisma.postgres.liveStream.count({
      where: { teacherId },
    });

    const endedLivestreams = await this.prisma.postgres.liveStream.findMany({
      where: { teacherId, status: 'ENDED' },
      select: { totalViews: true, peakViewers: true, duration: true },
    });

    const totalViews = endedLivestreams.reduce((sum, ls) => sum + (ls.totalViews || 0), 0);
    const totalWatchTime = endedLivestreams.reduce((sum, ls) => sum + (ls.duration || 0), 0);
    const avgViewsPerStream = endedLivestreams.length > 0 ? Math.round(totalViews / endedLivestreams.length) : 0;

    // Get documents count
    const totalDocuments = await this.prisma.postgres.document.count({
      where: { teacherId },
    });

    // Get scheduled livestreams
    const scheduledLivestreams = await this.prisma.postgres.liveStream.count({
      where: { teacherId, status: 'SCHEDULED' },
    });

    // Monthly views trend (last 12 months)
    const monthlyViews = [];
    const monthlySubscribers = [];
    const now = new Date();
    
    for (let i = 11; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      
      const streams = await this.prisma.postgres.liveStream.findMany({
        where: {
          teacherId,
          status: 'ENDED',
          endedAt: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
        select: { totalViews: true },
      });
      
      const monthViews = streams.reduce((sum, s) => sum + (s.totalViews || 0), 0);
      monthlyViews.push(monthViews);
      
      // Subscribers growth (simplified - count followers at each point)
      const subsCount = await this.prisma.postgres.followedTeacher.count({
        where: {
          teacherId,
          createdAt: { lte: monthEnd },
        },
      });
      monthlySubscribers.push(subsCount);
    }

    // Get top 3 livestreams by views
    const topLivestreams = await this.prisma.postgres.liveStream.findMany({
      where: { teacherId, status: 'ENDED' },
      orderBy: { totalViews: 'desc' },
      take: 3,
      select: {
        id: true,
        title: true,
        thumbnail: true,
        totalViews: true,
        peakViewers: true,
        endedAt: true,
      },
    });

    return {
      totalStudents: teacher.teacherProfile.followers.length,
      totalLivestreams,
      totalRecordings: endedLivestreams.length,
      totalViews,
      totalDocuments,
      scheduledLivestreams,
      avgViewsPerStream,
      totalWatchTimeHours: Math.round(totalWatchTime / 3600),
      monthlyViews,
      monthlySubscribers,
      rating: teacher.teacherProfile.rating,
      topLivestreams,
    };
  }

  // Get teacher profile by ID
  async getProfile(teacherId: string) {
    const teacher = await this.prisma.postgres.user.findUnique({
      where: { 
        id: teacherId,
      },
      include: {
        teacherProfile: {
          include: {
            followers: true,
          },
        },
      },
    });

    if (!teacher || !teacher.teacherProfile) {
      throw new NotFoundException('Teacher not found');
    }

    // Count total videos/recordings for this teacher
    // This would require a Recording/Video model - for now using 0
    const totalVideos = 0; // TODO: Implement when Recording model is created

    return {
      id: teacher.id,
      email: teacher.email,
      fullName: teacher.fullName,
      name: teacher.fullName,
      username: teacher.email.split('@')[0],
      avatar: teacher.avatar || '/logo.png',
      bio: teacher.bio || '',
      location: teacher.location || null,
      subscribers: teacher.teacherProfile.followers.length,
      totalVideos,
      rating: teacher.teacherProfile.rating,
      createAt: teacher.createdAt,
      twoFactorEnabled: teacher.twoFactorEnabled,
      teacherProfile: {
        education: teacher.teacherProfile.education || null,
        experience: teacher.teacherProfile.experience || null,
        website: teacher.teacherProfile.website || null,
        linkedin: teacher.teacherProfile.linkedin || null,
        subjects: teacher.teacherProfile.subjects || [],
      },
      // Legacy fields for backward compatibility
      address: teacher.location || null,
      substantiate: teacher.teacherProfile.education || null,
      yearOfWorking: teacher.teacherProfile.experience || null,
      subjects: teacher.teacherProfile.subjects || [],
      website: teacher.teacherProfile.website || null,
      linkedin: teacher.teacherProfile.linkedin || null,
    };
  }

  // Update teacher bio
  async updateBio(teacherId: string, bio: string) {
    const teacher = await this.prisma.postgres.user.findUnique({
      where: { id: teacherId },
      include: { teacherProfile: true },
    });

    if (!teacher || !teacher.teacherProfile) {
      throw new NotFoundException('Teacher not found');
    }

    const updatedTeacher = await this.prisma.postgres.user.update({
      where: { id: teacherId },
      data: { bio },
    });

    return {
      message: 'Bio updated successfully',
      bio: updatedTeacher.bio,
    };
  }

  // Update teacher avatar
  async updateAvatar(teacherId: string, avatarUrl: string) {
    const teacher = await this.prisma.postgres.user.findUnique({
      where: { id: teacherId },
      include: { teacherProfile: true },
    });

    if (!teacher || !teacher.teacherProfile) {
      throw new NotFoundException('Teacher not found');
    }

    const updatedTeacher = await this.prisma.postgres.user.update({
      where: { id: teacherId },
      data: { avatar: avatarUrl },
    });

    return {
      message: 'Avatar updated successfully',
      avatar: updatedTeacher.avatar,
    };
  }

  // Get teacher documents
  async getDocuments(teacherId: string, fileType?: string) {
    const teacher = await this.prisma.postgres.user.findUnique({
      where: { id: teacherId },
    });

    if (!teacher) {
      throw new NotFoundException('Teacher not found');
    }

    const where: any = { teacherId };
    if (fileType) {
      where.fileType = fileType;
    }

    const documents = await this.prisma.postgres.document.findMany({
      where,
      orderBy: { uploadedAt: 'desc' },
    });

    return documents;
  }

  // Upload document to R2
  async uploadDocument(teacherId: string, file: Express.Multer.File) {
    const teacher = await this.prisma.postgres.user.findUnique({
      where: { id: teacherId },
      include: { teacherProfile: true },
    });

    if (!teacher || !teacher.teacherProfile) {
      throw new NotFoundException('Teacher not found');
    }

    // Upload to R2
    const documentUrl = await this.r2StorageService.uploadDocument(
      teacherId,
      file.originalname,
      file.buffer,
      file.mimetype,
    );

    // Determine file type from mime type
    let fileType = 'file';
    if (file.mimetype.startsWith('image/')) {
      fileType = 'image';
    } else if (file.mimetype.startsWith('video/')) {
      fileType = 'video';
    } else if (file.mimetype.includes('pdf')) {
      fileType = 'pdf';
    }

    // Save document to database
    const document = await this.prisma.postgres.document.create({
      data: {
        teacherId,
        title: file.originalname,
        fileUrl: documentUrl,
        fileName: file.originalname,
        fileType,
        fileSize: file.size,
        mimeType: file.mimetype,
      },
    });

    // Return format expected by frontend
    return {
      url: documentUrl,
      filename: file.originalname,
      size: file.size,
      documentId: document.id,
    };
  }

  // Update teacher settings
  async updateSettings(teacherId: string, settings: any) {
    const teacher = await this.prisma.postgres.user.findUnique({
      where: { id: teacherId },
      include: { teacherProfile: true },
    });

    if (!teacher || !teacher.teacherProfile) {
      throw new NotFoundException('Teacher not found');
    }

    // Update user fields
    const updateData: any = {};
    if (settings.email) updateData.email = settings.email;
    if (settings.fullName) updateData.fullName = settings.fullName;
    if (settings.bio) updateData.bio = settings.bio;
    if (settings.location) updateData.location = settings.location;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    if (Object.keys(updateData).length > 0) {
      await this.prisma.postgres.user.update({
        where: { id: teacherId },
        data: updateData,
      });
    }

    // Update teacher profile (use existing fields)
    const profileUpdateData: any = {};
    if (settings.education) profileUpdateData.education = settings.education;
    if (settings.experience !== undefined) profileUpdateData.experience = settings.experience;
    if (settings.website) profileUpdateData.website = settings.website;
    if (settings.linkedin) profileUpdateData.linkedin = settings.linkedin;
    if (settings.subjects) profileUpdateData.subjects = settings.subjects;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    if (Object.keys(profileUpdateData).length > 0) {
      await this.prisma.postgres.teacherProfile.update({
        where: { userId: teacherId },
        data: profileUpdateData,
      });
    }

    return { success: true, message: 'Settings updated successfully' };
  }

  // Change password
  async changePassword(teacherId: string, passwords: { currentPassword: string; newPassword: string }) {
    const bcrypt = await import('bcrypt');
    
    const user = await this.prisma.postgres.user.findUnique({
      where: { id: teacherId },
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
      where: { id: teacherId },
      data: { password: hashedNewPassword },
    });

    return { success: true, message: 'Password changed successfully' };
  }

  // Toggle 2FA
  async toggle2FA(teacherId: string, enabled: boolean) {
    await this.prisma.postgres.user.update({
      where: { id: teacherId },
      data: { twoFactorEnabled: enabled },
    });

    return { success: true, message: `2FA ${enabled ? 'enabled' : 'disabled'} successfully` };
  }
}
