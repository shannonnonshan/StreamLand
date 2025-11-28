import { Injectable, ConflictException, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLivestreamDto } from './dto/create-livestream.dto';
import { LiveStreamStatus } from '@prisma/client';

@Injectable()
export class LivestreamService {
  private readonly logger = new Logger(LivestreamService.name);
  
  constructor(
    private prisma: PrismaService,
  ) {}

  async createLivestream(createLivestreamDto: CreateLivestreamDto) {
    const { id, teacherId, title, description, isPublic, allowComments } = createLivestreamDto;

    // Check if livestream ID already exists
    const existingLivestream = await this.prisma.postgres.liveStream.findUnique({
      where: { id },
    });

    if (existingLivestream) {
      throw new ConflictException('Livestream ID already exists');
    }

    // Check if teacher exists and has TEACHER role
    const teacher = await this.prisma.postgres.user.findUnique({
      where: { id: teacherId },
      include: { teacherProfile: true },
    });

    if (!teacher) {
      throw new NotFoundException('Teacher not found');
    }

    if (teacher.role !== 'TEACHER') {
      throw new BadRequestException('User is not a teacher');
    }

    // Check if teacher already has an active livestream
    const activeLivestream = await this.prisma.postgres.liveStream.findFirst({
      where: {
        teacherId,
        status: LiveStreamStatus.LIVE,
      },
    });

    if (activeLivestream) {
      throw new ConflictException('Teacher already has an active livestream');
    }

    // Create the livestream with SCHEDULED status
    const livestream = await this.prisma.postgres.liveStream.create({
      data: {
        id,
        teacherId,
        title,
        description: description || '',
        isPublic: isPublic !== undefined ? isPublic : true,
        allowComments: allowComments !== undefined ? allowComments : true,
        status: LiveStreamStatus.SCHEDULED,
        currentViewers: 0,
        totalViews: 0,
        peakViewers: 0,
        duration: 0,
      },
    });

    return livestream;
  }

  async getLivestreamById(id: string) {
    const livestream = await this.prisma.postgres.liveStream.findUnique({
      where: { id },
    });

    if (!livestream) {
      throw new NotFoundException('Livestream not found');
    }

    return livestream;
  }

  async updateLivestreamStatus(id: string, status: LiveStreamStatus) {
    const livestream = await this.prisma.postgres.liveStream.findUnique({
      where: { id },
    });

    if (!livestream) {
      throw new NotFoundException('Livestream not found');
    }

    const updateData: any = { status };

    // Set timestamps based on status
    if (status === LiveStreamStatus.LIVE && !livestream.startedAt) {
      updateData.startedAt = new Date();
    } else if (status === LiveStreamStatus.ENDED && !livestream.endedAt) {
      updateData.endedAt = new Date();
      
      // Calculate duration if we have startedAt
      if (livestream.startedAt) {
        const durationMs = new Date().getTime() - livestream.startedAt.getTime();
        updateData.duration = Math.floor(durationMs / 1000); // duration in seconds
      }
    }

    return await this.prisma.postgres.liveStream.update({
      where: { id },
      data: updateData,
    });
  }

  async getTeacherLivestreams(teacherId: string) {
    return await this.prisma.postgres.liveStream.findMany({
      where: { teacherId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getActiveLivestreams() {
    return await this.prisma.postgres.liveStream.findMany({
      where: {
        status: LiveStreamStatus.LIVE,
        isPublic: true,
      },
      orderBy: { currentViewers: 'desc' },
    });
  }

  async endLivestream(id: string, saveRecording: boolean) {
    this.logger.log(`Ending livestream ${id}, saveRecording: ${saveRecording}`);
    
    const livestream = await this.prisma.postgres.liveStream.findUnique({
      where: { id },
    });

    if (!livestream) {
      throw new Error('Livestream not found');
    }

    // Calculate duration
    const startedAt = livestream.startedAt || livestream.createdAt;
    const endedAt = new Date();
    const durationMs = endedAt.getTime() - startedAt.getTime();
    const duration = Math.floor(durationMs / 1000); // duration in seconds

    // Update livestream status
    const updateData: any = {
      status: LiveStreamStatus.ENDED,
      endedAt,
      duration,
      isRecorded: saveRecording,
    };

    // If saving recording, the video chunks are already being uploaded to R2 by stream.gateway
    // The recordingUrl will be set automatically by the gateway's saveVideoToR2 method
    if (saveRecording) {
      // Recording URL will be updated by the WebSocket gateway after processing chunks
      this.logger.log(`Recording will be saved to R2 for livestream ${id}`);
    }

    const updatedLivestream = await this.prisma.postgres.liveStream.update({
      where: { id },
      data: updateData,
    });

    this.logger.log(`Livestream ${id} ended successfully. Duration: ${duration}s, Recorded: ${saveRecording}`);
    return updatedLivestream;
  }

  // Recording is now handled by stream.gateway.ts and R2 storage
  // These methods are deprecated and replaced by R2 upload flow

  // Get top livestreams by view count (for dashboard)
  async getTopLivestreams(limit: number = 10) {
    const livestreams = await this.prisma.postgres.liveStream.findMany({
      where: {
        isPublic: true,
        OR: [
          { status: LiveStreamStatus.LIVE },
          { status: LiveStreamStatus.ENDED },
        ],
      },
      include: {
        users: {
          select: {
            id: true,
            fullName: true,
            avatar: true,
          },
        },
      },
      orderBy: [
        { status: 'asc' }, // LIVE streams first (LIVE comes before ENDED alphabetically)
        { totalViews: 'desc' }, // Then by view count
      ],
      take: limit,
    });

    return livestreams.map((stream) => ({
      id: stream.id,
      title: stream.title,
      description: stream.description,
      teacher: {
        id: stream.users.id,
        fullName: stream.users.fullName,
        avatar: stream.users.avatar,
      },
      viewCount: stream.totalViews,
      currentViewers: stream.currentViewers,
      thumbnailUrl: stream.thumbnail,
      isLive: stream.status === LiveStreamStatus.LIVE,
      status: stream.status,
      category: stream.category,
      startedAt: stream.startedAt,
    }));
  }

  // Get trending videos (recently ended with high views)
  async getTrendingVideos(limit: number = 10) {
    const videos = await this.prisma.postgres.liveStream.findMany({
      where: {
        status: LiveStreamStatus.ENDED,
        isPublic: true,
        recordingUrl: { not: null },
      },
      include: {
        users: {
          select: {
            id: true,
            fullName: true,
            avatar: true,
          },
        },
      },
      orderBy: [
        { endedAt: 'desc' }, // Most recent first
        { totalViews: 'desc' }, // Then by popularity
      ],
      take: limit,
    });

    return videos.map((video) => ({
      id: video.id,
      title: video.title,
      description: video.description,
      teacher: {
        id: video.users.id,
        fullName: video.users.fullName,
        avatar: video.users.avatar,
      },
      viewCount: video.totalViews,
      thumbnailUrl: video.thumbnail,
      duration: video.duration,
      recordingUrl: video.recordingUrl,
      uploadedAt: video.endedAt,
      category: video.category,
    }));
  }

  // Increment view count for a livestream
  async incrementViewCount(id: string) {
    return await this.prisma.postgres.liveStream.update({
      where: { id },
      data: {
        totalViews: { increment: 1 },
      },
    });
  }

  // Update current viewers count
  async updateCurrentViewers(id: string, count: number) {
    const livestream = await this.prisma.postgres.liveStream.update({
      where: { id },
      data: {
        currentViewers: count,
        peakViewers: {
          set: count,
        },
      },
    });

    // Update peak viewers if current is higher
    if (count > livestream.peakViewers) {
      await this.prisma.postgres.liveStream.update({
        where: { id },
        data: { peakViewers: count },
      });
    }

    return livestream;
  }
}
