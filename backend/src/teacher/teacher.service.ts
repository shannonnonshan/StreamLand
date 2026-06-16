import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

type TeacherProfileResponse = {
  id: string;
  email: string;
  fullName: string;
  name: string;
  username: string;
  avatar: string;
  bio: string;
  location: string | null;
  subscribers: number;
  totalVideos: number;
  rating: number;
  createAt: Date;
  twoFactorEnabled: boolean;
  teacherProfile: {
    education: string | null;
    experience: number | null;
    website: string | null;
    linkedin: string | null;
    subjects: string[];
    cvUrl: string | null;
  };
  address: string | null;
  substantiate: string | null;
  yearOfWorking: number | null;
  subjects: string[];
  website: string | null;
  linkedin: string | null;
};

@Injectable()
export class TeacherService {
  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {}

  // Get public content for teacher profile: ENDED livestreams with recording + approved document videos
  async getTeacherPublicContent(teacherId: string, limit: number = 6) {
    const cacheKey = `teacher:${teacherId}:public-content:v2:${limit}`;
    const cached = await this.redisService.get<unknown[]>(cacheKey);
    if (cached) return cached;

    const [livestreams, documents] = await Promise.all([
      this.prisma.postgres.liveStream.findMany({
        where: {
          teacherId,
          isPublic: true,
          status: 'ENDED',
          recordingUrl: { not: null },
          isApprove: 'TRUE',
          processingStatus: 'DONE',
        },
        orderBy: { endedAt: 'desc' },
        take: limit,
        select: {
          id: true,
          title: true,
          thumbnail: true,
          totalViews: true,
          duration: true,
          recordingUrl: true,
          endedAt: true,
        },
      }),
      this.prisma.postgres.document.findMany({
        where: {
          teacherId,
          fileType: 'video',
          isApprove: 'TRUE',
          processingStatus: 'DONE',
        },
        orderBy: { uploadedAt: 'desc' },
        take: limit,
        select: {
          id: true,
          title: true,
          thumbnail: true,
          fileUrl: true,
          uploadedAt: true,
        },
      }),
    ]);

    const result = [
      ...livestreams.map((s) => ({
        id: s.id,
        title: s.title,
        thumbnail: s.thumbnail || null,
        views: s.totalViews || 0,
        duration: this.formatDuration(s.duration),
        date: s.endedAt?.toISOString() || null,
        type: 'livestream' as const,
        videoUrl: s.recordingUrl,
      })),
      ...documents.map((d) => ({
        id: d.id,
        title: d.title,
        thumbnail: d.thumbnail || null,
        date: d.uploadedAt?.toISOString() || null,
        type: 'document' as const,
        videoUrl: d.fileUrl,
      })),
    ]
      .sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime())
      .slice(0, limit);

    await this.redisService.set(cacheKey, result, 120);
    return result;
  }

  // Get a single approved document video by ID (public)
  async getPublicDocumentById(documentId: string) {
    const document = await this.prisma.postgres.document.findUnique({
      where: { id: documentId },
      include: {
        teacher: {
          select: { id: true, fullName: true, avatar: true },
        },
      },
    });

    if (!document || document.isApprove !== 'TRUE' || document.processingStatus !== 'DONE') {
      return null;
    }

    return {
      id: document.id,
      title: document.title,
      description: document.description,
      fileUrl: document.fileUrl,
      thumbnail: document.thumbnail,
      fileType: document.fileType,
      fileSize: document.fileSize,
      uploadedAt: document.uploadedAt,
      updatedAt: document.updatedAt,
      teacher: document.teacher,
      teacherId: document.teacherId,
    };
  }

  // Get public livestream recordings for teacher profile
  async getTeacherLivestreamVideos(teacherId: string, limit: number = 6) {
    const cacheKey = `teacher:${teacherId}:livestream-videos:v2:${limit}`;
    const cached = await this.redisService.get<unknown[]>(cacheKey);
    if (cached) return cached;

    const livestreams = await this.prisma.postgres.liveStream.findMany({
      where: {
        teacherId,
        isPublic: true,
        status: 'ENDED',
        recordingUrl: { not: null },
        isApprove: 'TRUE',
        processingStatus: 'DONE',
      },
      orderBy: { endedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        title: true,
        thumbnail: true,
        totalViews: true,
        duration: true,
        recordingUrl: true,
        endedAt: true,
      },
    });

    const result = livestreams.map((s) => ({
      id: s.id,
      title: s.title,
      thumbnail: s.thumbnail || null,
      views: s.totalViews || 0,
      duration: this.formatDuration(s.duration),
      date: s.endedAt?.toISOString() || null,
      type: 'livestream' as const,
      videoUrl: s.recordingUrl,
    }));

    await this.redisService.set(cacheKey, result, 120);
    return result;
  }

  // Get approved document videos for teacher profile
  async getTeacherDocumentVideos(teacherId: string, limit: number = 6) {
    const cacheKey = `teacher:${teacherId}:document-videos:v2:${limit}`;
    const cached = await this.redisService.get<unknown[]>(cacheKey);
    if (cached) return cached;

    const documents = await this.prisma.postgres.document.findMany({
      where: {
        teacherId,
        fileType: 'video',
        isApprove: 'TRUE',
        processingStatus: 'DONE',
      },
      orderBy: { uploadedAt: 'desc' },
      take: limit,
      include: {
        teacher: {
          select: {
            id: true,
            fullName: true,
            avatar: true,
          },
        },
      },
    });

    const result = documents.map((d) => ({
      id: d.id,
      title: d.title,
      description: d.description,
      thumbnail: d.thumbnail || null,
      date: d.uploadedAt?.toISOString() || null,
      type: 'document' as const,
      videoUrl: d.fileUrl,
      fileSize: d.fileSize,
      fileName: d.fileName,
      teacher: d.teacher,
    }));

    await this.redisService.set(cacheKey, result, 120);
    return result;
  }

  // Get teacher videos/livestreams
  async getTeacherVideos(teacherId: string, page: number = 1, limit: number = 20) {
    const cacheKey = `teacher:${teacherId}:videos:${page}:${limit}`;
    const cachedVideos = await this.redisService.get<unknown[]>(cacheKey);

    if (cachedVideos) {
      return cachedVideos;
    }

    const skip = (page - 1) * limit;
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
      skip,
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

    const result = livestreams.map(stream => ({
      id: stream.id,
      title: stream.title,
      description: stream.description,
      thumbnail: stream.thumbnail || null,
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

    await this.redisService.set(cacheKey, result, 120);
    return result;
  }

  // Helper to format duration in seconds to HH:MM:SS or MM:SS
  private formatDuration(seconds: number | null): string {
    // Handle null, undefined, 0, or NaN
    if (!seconds || isNaN(seconds) || seconds < 0) return '0:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  // Get dashboard stats for teacher
  async getDashboardStats(teacherId: string, filter?: string) {
    const cacheKey = `teacher:${teacherId}:dashboard:${filter || 'default'}`;
    const cachedStats = await this.redisService.get<Record<string, unknown>>(cacheKey);

    if (cachedStats) {
      return cachedStats;
    }

    // Run all database queries in parallel (Promise.all) instead of sequentially
    const [teacher, totalLivestreams, endedLivestreams, totalDocuments, scheduledLivestreams, allEndedStreams, topLivestreams] = await Promise.all([
      // Query 1: Get teacher with profile
      this.prisma.postgres.user.findUnique({
        where: { id: teacherId },
        select: {
          id: true,
          teacherProfile: {
            select: {
              rating: true,
              _count: {
                select: {
                  followers: true,
                },
              },
            },
          },
        },
      }),
      
      // Query 2: Count total livestreams
      this.prisma.postgres.liveStream.count({
        where: { teacherId },
      }),
      
      // Query 3: Get ended livestreams for stats
      this.prisma.postgres.liveStream.findMany({
        where: { teacherId, status: 'ENDED' },
        select: { totalViews: true, peakViewers: true, duration: true },
      }),
      
      // Query 4: Count documents
      this.prisma.postgres.document.count({
        where: { teacherId },
      }),
      
      // Query 5: Count scheduled livestreams
      this.prisma.postgres.liveStream.count({
        where: { teacherId, status: 'SCHEDULED' },
      }),
      
      // Query 6: Get all ended streams for monthly data
      this.prisma.postgres.liveStream.findMany({
        where: {
          teacherId,
          status: 'ENDED',
        },
        select: { totalViews: true, endedAt: true },
        orderBy: { endedAt: 'desc' },
        take: 100, // Limit to last 100 ended streams
      }),
      
      // Query 7: Get top 3 livestreams
      this.prisma.postgres.liveStream.findMany({
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
      }),
    ]);

    if (!teacher || !teacher.teacherProfile) {
      throw new NotFoundException('Teacher not found');
    }

    // Calculate stats from already-fetched data
    const totalViews = endedLivestreams.reduce((sum, ls) => sum + (ls.totalViews || 0), 0);
    const totalWatchTime = endedLivestreams.reduce((sum, ls) => sum + (ls.duration || 0), 0);
    const avgViewsPerStream = endedLivestreams.length > 0 ? Math.round(totalViews / endedLivestreams.length) : 0;

    // Calculate monthly views (last 12 months)
    const monthlyViews: number[] = [];
    const monthlySubscribers: number[] = [];
    const now = new Date();
    const last12Months = 12;
    
    const monthRanges = Array.from({ length: last12Months }, (_, i) => {
      const start = new Date(now.getFullYear(), now.getMonth() - (last12Months - 1 - i), 1);
      const end = new Date(now.getFullYear(), now.getMonth() - (last12Months - 2 - i) + 1, 0);
      return { start, end };
    });
    
    // Calculate monthly views from already-fetched data
    monthRanges.forEach(({ start, end }) => {
      const monthViews = allEndedStreams
        .filter(s => s.endedAt && s.endedAt >= start && s.endedAt <= end)
        .reduce((sum, s) => sum + (s.totalViews || 0), 0);
      monthlyViews.push(monthViews);
    });
    
    // Use followers count as subscriber growth (simpler approach)
    const totalFollowers = teacher.teacherProfile._count.followers;
    monthRanges.forEach(() => {
      // For now, just spread the total followers evenly
      monthlySubscribers.push(Math.round(totalFollowers / last12Months));
    });

    // Calculate daily data if filter is provided
    let dailyViews: number[] = [];
    let dailySubscribers: number[] = [];
    
    if (filter) {
      const days = filter === 'last 7 day' ? 7 : filter === 'last 30 day' ? 30 : filter === 'last 90 day' ? 90 : 0;
      
      if (days > 0) {
        const dayRanges = Array.from({ length: days }, (_, i) => {
          const start = new Date(now);
          start.setDate(start.getDate() - (days - 1 - i));
          start.setHours(0, 0, 0, 0);
          const end = new Date(start);
          end.setHours(23, 59, 59, 999);
          return { start, end };
        });
        
        // Calculate daily views
        dayRanges.forEach(({ start, end }) => {
          const dayViews = allEndedStreams
            .filter(s => s.endedAt && s.endedAt >= start && s.endedAt <= end)
            .reduce((sum, s) => sum + (s.totalViews || 0), 0);
          dailyViews.push(dayViews);
        });
        
        // Calculate daily subscribers (spread evenly for now)
        dayRanges.forEach(() => {
          dailySubscribers.push(Math.round(totalFollowers / days));
        });
      }
    }

    const stats = {
      totalStudents: totalFollowers,
      totalLivestreams,
      totalRecordings: endedLivestreams.length,
      totalViews,
      totalDocuments,
      scheduledLivestreams,
      avgViewsPerStream,
      totalWatchTimeHours: Math.round(totalWatchTime / 3600),
      monthlyViews,
      monthlySubscribers,
      dailyViews: dailyViews.length > 0 ? dailyViews : undefined,
      dailySubscribers: dailySubscribers.length > 0 ? dailySubscribers : undefined,
      rating: teacher.teacherProfile.rating,
      topLivestreams,
    };

    await this.redisService.set(cacheKey, stats, 120);
    return stats;
  }

  // Get teacher profile by ID
  async getProfile(teacherId: string): Promise<TeacherProfileResponse> {
    const cacheKey = `teacher:${teacherId}:profile`;
    const cachedProfile = await this.redisService.get<TeacherProfileResponse>(cacheKey);

    if (cachedProfile) {
      return cachedProfile;
    }

    const [teacher, totalVideos] = await Promise.all([
      this.prisma.postgres.user.findUnique({
        where: {
          id: teacherId,
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          avatar: true,
          bio: true,
          location: true,
          createdAt: true,
          twoFactorEnabled: true,
          teacherProfile: {
            select: {
              education: true,
              experience: true,
              website: true,
              linkedin: true,
              subjects: true,
              cvUrl: true,
              rating: true,
              _count: {
                select: {
                  followers: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.postgres.liveStream.count({
        where: {
          teacherId,
          isPublic: true,
          OR: [
            { status: 'LIVE' },
            { status: 'SCHEDULED' },
            {
              status: 'ENDED',
              recordingUrl: { not: null }, // Only count ended streams with recordings
            },
          ],
        },
      }),
    ]);

    if (!teacher || !teacher.teacherProfile) {
      throw new NotFoundException('Teacher not found');
    }

    const profile: TeacherProfileResponse = {
      id: teacher.id,
      email: teacher.email,
      fullName: teacher.fullName,
      name: teacher.fullName,
      username: teacher.email.split('@')[0],
      avatar: teacher.avatar || '/logo.png',
      bio: teacher.bio || '',
      location: teacher.location || null,
      subscribers: teacher.teacherProfile._count.followers,
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
        cvUrl: teacher.teacherProfile.cvUrl || null,
      },
      // Legacy fields for backward compatibility
      address: teacher.location || null,
      substantiate: teacher.teacherProfile.education || null,
      yearOfWorking: teacher.teacherProfile.experience || null,
      subjects: teacher.teacherProfile.subjects || [],
      website: teacher.teacherProfile.website || null,
      linkedin: teacher.teacherProfile.linkedin || null,
    };

    await this.redisService.set(cacheKey, profile, 180);
    return profile;
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

    await this.redisService.del(`teacher:${teacherId}:profile`);

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