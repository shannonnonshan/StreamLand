import { Injectable, ConflictException, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLivestreamDto } from './dto/create-livestream.dto';
import { LiveStreamStatus } from '@prisma/client';
import { CloudflareService } from '../cloudflare/cloudflare.service';

@Injectable()
export class LivestreamService {
  private readonly logger = new Logger(LivestreamService.name);
  
  constructor(
    private prisma: PrismaService,
    private cloudflareService: CloudflareService,
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

    // If saving recording, prepare for Cloudflare Stream upload
    // The recordingUrl will be updated later after video is uploaded
    if (saveRecording) {
      updateData.recordingUrl = null; // Will be set after upload
    }

    const updatedLivestream = await this.prisma.postgres.liveStream.update({
      where: { id },
      data: updateData,
    });

    this.logger.log(`Livestream ${id} ended successfully. Duration: ${duration}s, Recorded: ${saveRecording}`);
    return updatedLivestream;
  }

  /**
   * Upload recorded video to Cloudflare Stream
   * @param livestreamId - ID of the livestream
   * @param videoBuffer - Video file buffer
   * @param fileName - Name of the video file
   */
  async uploadRecording(
    livestreamId: string,
    videoBuffer: Buffer,
    fileName: string,
  ): Promise<string> {
    const livestream = await this.prisma.postgres.liveStream.findUnique({
      where: { id: livestreamId },
      include: { teacher: true },
    });

    if (!livestream) {
      throw new NotFoundException('Livestream not found');
    }

    try {
      // Upload to Cloudflare Stream
      const video = await this.cloudflareService.uploadVideoFromBuffer(
        videoBuffer,
        {
          name: fileName,
          meta: {
            livestreamId: livestreamId,
            teacherId: livestream.teacherId,
            title: livestream.title,
            uploadedAt: new Date().toISOString(),
          },
          requireSignedURLs: false, // Set to true if you want private videos
          allowedOrigins: ['*'], // Configure based on your needs
        },
      );

      // Update livestream with recording URL
      await this.prisma.postgres.liveStream.update({
        where: { id: livestreamId },
        data: {
          recordingUrl: video.playback.hls,
          cloudflareVideoId: video.uid,
          isRecorded: true,
        },
      });

      this.logger.log(
        `Video uploaded to Cloudflare for livestream ${livestreamId}: ${video.uid}`,
      );

      return video.playback.hls;
    } catch (error) {
      this.logger.error(
        `Failed to upload recording for livestream ${livestreamId}`,
        error,
      );
      throw new BadRequestException('Failed to upload video to Cloudflare');
    }
  }

  /**
   * Get direct upload URL for recording
   * This allows frontend to upload video directly to Cloudflare
   */
  async getDirectUploadUrl(
    livestreamId: string,
  ): Promise<{ uploadURL: string; uid: string }> {
    const livestream = await this.prisma.postgres.liveStream.findUnique({
      where: { id: livestreamId },
    });

    if (!livestream) {
      throw new NotFoundException('Livestream not found');
    }

    try {
      const result = await this.cloudflareService.getDirectUploadUrl(21600); // 6 hours max
      
      // Store the video UID for later reference
      await this.prisma.postgres.liveStream.update({
        where: { id: livestreamId },
        data: {
          cloudflareVideoId: result.uid,
        },
      });

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to get direct upload URL for livestream ${livestreamId}`,
        error,
      );
      throw new BadRequestException('Failed to get upload URL from Cloudflare');
    }
  }

  /**
   * Update recording URL after direct upload completes
   */
  async updateRecordingUrl(livestreamId: string): Promise<void> {
    const livestream = await this.prisma.postgres.liveStream.findUnique({
      where: { id: livestreamId },
    });

    if (!livestream || !livestream.cloudflareVideoId) {
      throw new NotFoundException('Livestream or video ID not found');
    }

    try {
      const video = await this.cloudflareService.getVideo(
        livestream.cloudflareVideoId,
      );

      await this.prisma.postgres.liveStream.update({
        where: { id: livestreamId },
        data: {
          recordingUrl: video.playback.hls,
          isRecorded: true,
        },
      });

      this.logger.log(
        `Recording URL updated for livestream ${livestreamId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to update recording URL for livestream ${livestreamId}`,
        error,
      );
      throw new BadRequestException('Failed to update recording URL');
    }
  }
}
