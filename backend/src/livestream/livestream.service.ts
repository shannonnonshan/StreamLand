import { Injectable, ConflictException, NotFoundException, BadRequestException, UnauthorizedException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLivestreamDto } from './dto/create-livestream.dto';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { Prisma, LiveStreamStatus, ScheduleStatus } from '@prisma/client';
import { R2StorageService } from '../r2-storage/r2-storage.service';
import { RedisService } from '../redis/redis.service';
import { Readable } from 'stream';
import { createWriteStream, promises as fs } from 'fs';
import { spawn } from 'child_process';
import { pipeline } from 'stream/promises';
import * as os from 'os';
import * as path from 'path';

interface AiTranscriptSummaryDocument {
  id?: string;
  type: 'LIVESTREAM' | 'DOCUMENT';
  recordingId?: string;
  documentId?: string;
  transcriptStatus?: 'idle' | 'processing' | 'success' | 'error';
  transcriptError?: string | null;
  transcript?: Prisma.JsonValue;
  summary?: string;
  audioUrl?: string;
  toxicWords?: string[];
  validationRate?: number;
  moderationLabel?: string | null;
  moderationCategories?: string[];
  transcriptGeneratedAt?: Date;
  summaryGeneratedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

@Injectable()
export class LivestreamService {
  private readonly logger = new Logger(LivestreamService.name);
  private readonly aiTranscriptSummaryCollection = 'ai_transcript_summary';
  private readonly localAiBaseUrl = (process.env.LOCAL_AI_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
  
  constructor(
    private prisma: PrismaService,
    private r2StorageService: R2StorageService,
    private redisService: RedisService,
  ) {}

  async createLivestream(createLivestreamDto: CreateLivestreamDto) {
    const { id, teacherId, title, description, isPublic, allowComments } = createLivestreamDto;

    // Optimize: Single query to check teacher and active livestream
    const [existingLivestream, teacher, activeLivestream] = await Promise.all([
      this.prisma.postgres.liveStream.findUnique({
        where: { id },
        select: { id: true }, // Only need ID for existence check
      }),
      this.prisma.postgres.user.findUnique({
        where: { id: teacherId },
        select: { id: true, role: true, avatar: true }, // Include avatar for thumbnail
      }),
      this.prisma.postgres.liveStream.findFirst({
        where: {
          teacherId,
          status: LiveStreamStatus.LIVE,
        },
        select: { id: true }, // Only need ID for existence check
      }),
    ]);

    if (existingLivestream) {
      throw new ConflictException('Livestream ID already exists');
    }

    if (!teacher) {
      throw new NotFoundException('Teacher not found');
    }

    if (teacher.role !== 'TEACHER') {
      throw new BadRequestException('User is not a teacher');
    }

    if (activeLivestream) {
      throw new ConflictException('Teacher already has an active livestream');
    }

    // Use teacher avatar as thumbnail, fallback to logo.png
    const thumbnail = teacher.avatar || '/logo.png';

    // Create the livestream with SCHEDULED status
    const livestream = await this.prisma.postgres.liveStream.create({
      data: {
        id,
        teacherId,
        title,
        description: description || '',
        thumbnail,
        isPublic: isPublic !== undefined ? isPublic : true,
        allowComments: allowComments !== undefined ? allowComments : true,
        status: LiveStreamStatus.SCHEDULED,
        currentViewers: 0,
        totalViews: 0,
        peakViewers: 0,
        duration: 0,
      },
      select: {
        id: true,
        teacherId: true,
        title: true,
        description: true,
        category: true,
        thumbnail: true,
        status: true,
        isPublic: true,
        allowComments: true,
        createdAt: true,
        // Don't return unnecessary fields to reduce response size
      },
    });

    return livestream;
  }

  private async callModerationApi(text: string | null | undefined) {
    const API = `${this.localAiBaseUrl}/moderation/text`;
    try {
      const payload = { text: text || '', rewrite: true };
      this.logger.log(`[Moderation] POST ${API} | payloadLen=${(text || '').length}`);

      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const respText = await res.text();
      this.logger.log(`[Moderation] Response status=${res.status}`);
      if (respText && respText.length > 0) {
        const preview = respText.length > 1000 ? `${respText.substring(0, 1000)}...` : respText;
        this.logger.debug(`[Moderation] Response body preview: ${preview}`);
      }

      if (!res.ok) {
        this.logger.warn(`[Moderation] Non-ok response from AI moderation: ${res.status}`);
        return null;
      }

      let data: any = null;
      try {
        data = respText ? JSON.parse(respText) : null;
      } catch (parseErr) {
        this.logger.warn('[Moderation] Failed to parse JSON response', String(parseErr));
      }

      return data?.moderation || null;
    } catch (err) {
      this.logger.error('[Moderation] call failed', err as any);
      return null;
    }
  }

  async startLivestream(id: string) {
    const livestream = await this.prisma.postgres.liveStream.findUnique({
      where: { id },
    });

    if (!livestream) {
      throw new NotFoundException('Livestream not found');
    }

    if (livestream.status === LiveStreamStatus.LIVE) {
      throw new BadRequestException('Livestream is already live');
    }

    if (livestream.status === LiveStreamStatus.ENDED) {
      throw new BadRequestException('Cannot start an ended livestream');
    }

    // Update status to LIVE and set start time
    const updatedLivestream = await this.prisma.postgres.liveStream.update({
      where: { id },
      data: {
        status: LiveStreamStatus.LIVE,
        startedAt: new Date(),
      },
    });

    return updatedLivestream;
  }

  async createAndStartLivestreamEarly(teacherId: string, title: string, category?: string) {
    // Fetch teacher avatar for thumbnail
    const teacher = await this.prisma.postgres.user.findUnique({
      where: { id: teacherId },
      select: { avatar: true },
    });

    if (!teacher) {
      throw new NotFoundException('Teacher not found');
    }

    // Use teacher avatar as thumbnail, fallback to logo.png
    const thumbnail = teacher.avatar || '/logo.png';

    // Create a new livestream to start immediately
    const newLivestream = await this.prisma.postgres.liveStream.create({
      data: {
        teacherId,
        title,
        description: '',
        category: category || null,
        thumbnail,
        status: LiveStreamStatus.LIVE,
        scheduledAt: new Date(),
        startedAt: new Date(),
        totalViews: 0,
        peakViewers: 0,
        duration: 0,
        currentViewers: 0,
      },
    });

    this.logger.log(`Created and started early livestream ${newLivestream.id} for teacher ${teacherId}`);
    return newLivestream;
  }

  async getLivestreamById(id: string) {
    const livestream = await this.prisma.postgres.liveStream.findUnique({
      where: { id },
      include: {
        teacher: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatar: true,
            bio: true,
            teacherProfile: {
              select: {
                subjects: true,
                experience: true,
                education: true,
                rating: true,
                totalStudents: true,
              },
            },
          },
        },
      },
    });

    if (!livestream) {
      throw new NotFoundException('Livestream not found');
    }

    // Get followers count separately
    const followersCount = livestream.teacherId
      ? await this.prisma.postgres.followedTeacher.count({
          where: { teacherId: livestream.teacherId },
        })
      : 0;

    return {
      ...livestream,
      teacher: livestream.teacher ? {
        ...livestream.teacher,
        followersCount,
      } : null,
    };
  }

  async getLivestreamDocuments(id: string) {
    // Check if livestream exists
    const livestream = await this.prisma.postgres.liveStream.findUnique({
      where: { id },
      select: { 
        id: true,
        teacherId: true,
      },
    });

    if (!livestream) {
      throw new NotFoundException('Livestream not found');
    }

    // Get livestream documents from MongoDB
    const livestreamDocs = await this.prisma.mongo.liveStreamDocuments.findUnique({
      where: { livestreamId: id },
    });

    // If no documents shared for this livestream, return empty array
    if (!livestreamDocs || !livestreamDocs.documentIds || livestreamDocs.documentIds.length === 0) {
      return [];
    }

    // Get full document details from PostgreSQL
    const documents = await this.prisma.postgres.document.findMany({
      where: { 
        id: { in: livestreamDocs.documentIds },
        teacherId: livestream.teacherId, // Extra safety check
        isApprove: 'TRUE',
      },
      orderBy: { uploadedAt: 'desc' },
    });

    return documents;
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

  async getTeacherLivestreams(teacherId: string, status?: string) {
    const where: any = { teacherId };
    
    if (status && ['SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED'].includes(status)) {
      where.status = status;
    }
    
    return await this.prisma.postgres.liveStream.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        schedule: true,
      },
    });
  }

  async getActiveLivestreams() {
    const livestreams = await this.prisma.postgres.liveStream.findMany({
      where: {
        status: LiveStreamStatus.LIVE,
        isPublic: true,
      },
      include: {
        teacher: {
          select: {
            id: true,
            fullName: true,
            avatar: true,
          },
        },
      },
      orderBy: { currentViewers: 'desc' },
    });

    return livestreams.map((stream) => ({
      id: stream.id,
      title: stream.title,
      description: stream.description,
      teacherId: stream.teacherId,
      teacher: {
        id: stream.teacher.id,
        fullName: stream.teacher.fullName,
        avatar: stream.teacher.avatar,
      },
      totalViews: stream.totalViews,
      currentViewers: stream.currentViewers,
      thumbnailUrl: stream.thumbnail,
      status: stream.status,
      category: stream.category,
      recordingUrl: stream.recordingUrl,
      startedAt: stream.startedAt,
      endedAt: stream.endedAt,
      scheduledStartTime: stream.scheduledAt,
    }));
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

      // --- Update peakViewers and totalViews ---
      // Giả sử bạn đang track current viewers ở server:
      const currentViewers = livestream.currentViewers || 0; // hoặc lấy từ cache/Socket.IO
      const peakViewers = Math.max(livestream.peakViewers || 0, currentViewers);
      const totalViews = (livestream.totalViews || 0) + currentViewers;

      // Update livestream status
      const updateData: any = {
        status: LiveStreamStatus.ENDED,
        endedAt,
        duration,
        isRecorded: saveRecording,
        peakViewers,
        totalViews,
      };

      if (saveRecording) {
        this.logger.log(`Recording will be saved to R2 for livestream ${id}`);
      }

      const updatedLivestream = await this.prisma.postgres.liveStream.update({
        where: { id },
        data: updateData,
      });

      this.logger.log(`Livestream ${id} ended successfully. Duration: ${duration}s, Recorded: ${saveRecording}, PeakViewers: ${peakViewers}, TotalViews: ${totalViews}`);
      return updatedLivestream;
    }

  async updateTotalViewers(id: string, totalViewers: number) {
    try {
      const livestream = await this.prisma.postgres.liveStream.findUnique({
        where: { id },
      });

      if (!livestream) {
        throw new NotFoundException('Livestream not found');
      }

      // Update currentViewers and peakViewers if current is higher
      const peakViewers = Math.max(livestream.peakViewers || 0, totalViewers);
      
      const updatedLivestream = await this.prisma.postgres.liveStream.update({
        where: { id },
        data: {
          currentViewers: totalViewers,
          peakViewers: peakViewers,
        },
      });

      this.logger.log(`Updated livestream ${id} viewers. Current: ${totalViewers}, Peak: ${peakViewers}`);
      return updatedLivestream;
    } catch (error) {
      this.logger.error(`Error updating viewers for livestream ${id}:`, error);
      throw error;
    }
  }

  async saveRecordingChunk(livestreamId: string, chunk: string, chunkIndex: number, totalSize: number) {
    try {
      // For now, just acknowledge - chunks are assembled when recording ends
      // In production, you might want to save these to temporary storage
      return { success: true, chunkIndex, totalSize };
    } catch (error) {
      this.logger.error(`Failed to save recording chunk:`, error);
      throw error;
    }
  }

  async uploadRecordingChunk(livestreamId: string, chunk: string, chunkIndex: number, totalChunks: number, chunkSize: number) {
    try {
      // Decode base64 chunk
      const chunkBuffer = Buffer.from(chunk, 'base64');
      
      // If this is the last chunk, upload to R2
      if (chunkIndex === totalChunks - 1) {
        // For now, acknowledge - full assembly happens in uploadRecording
        return { success: true, chunkIndex, totalChunks, message: 'Chunk received, will be assembled with others' };
      }
      
      return { success: true, chunkIndex, totalChunks };
    } catch (error) {
      this.logger.error(`Failed to upload recording chunk:`, error);
      throw error;
    }
  }

  async uploadRecording(livestreamId: string, videoBase64: string, duration?: number) {
    try {
      console.log(`[Service] uploadRecording START: livestreamId=${livestreamId}`);
      console.log(`[Service] videoBase64 length: ${videoBase64?.length || 0} chars`);
      console.log(`[Service] duration: ${duration}s`);
      
      if (!videoBase64 || videoBase64.length === 0) {
        throw new Error('No video data received - base64 is empty');
      }
      
      console.log(`[Service] Base64 sample: ${videoBase64.substring(0, 50)}...`);
      
      // Decode base64 video
      let videoBuffer: Buffer;
      try {
        videoBuffer = Buffer.from(videoBase64, 'base64');
      } catch (decodeError) {
        console.error(`[Service] Failed to decode base64:`, decodeError);
        const decodeMessage = decodeError instanceof Error ? decodeError.message : String(decodeError);
        throw new Error(`Invalid base64 data: ${decodeMessage}`);
      }
      
      console.log(`[Service] Video buffer decoded: ${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB (${videoBuffer.length} bytes)`);
      
      if (videoBuffer.length === 0) {
        throw new Error('Decoded video buffer is empty');
      }
      
      // Check WebM magic bytes
      const magicBytes = videoBuffer.slice(0, 4).toString('hex');
      console.log(`[Service] File magic bytes: ${magicBytes} (should be 1a45dfa3 for WebM)`);
      
      // Convert buffer to stream for upload
      const videoStream = Readable.from(videoBuffer);
      
      // Upload to R2 with duration metadata
      console.log(`[Service] Uploading to R2...`);
      const videoUrl = await this.r2StorageService.uploadVideo(livestreamId, videoStream, {
        uploadedAt: new Date().toISOString(),
        duration: duration?.toString() || 'unknown',
      });
      console.log(`[Service] R2 upload complete: ${videoUrl}`);
      
      // Update livestream with recording URL and duration
      console.log(`[Service] Updating livestream record with duration=${duration}s...`);
      await this.prisma.postgres.liveStream.update({
        where: { id: livestreamId },
        data: {
          recordingUrl: videoUrl,
          isRecorded: true,
          isApprove: 'FALSE',
          duration: duration || 0,
        },
      });
      console.log(`[Service] Livestream updated successfully`);
      
      this.logger.log(`Recording uploaded: ${videoUrl}`);
      return { success: true, url: videoUrl };
    } catch (error) {
      console.error(`[Service] uploadRecording ERROR:`, error);
      this.logger.error(`Failed to upload recording:`, error);
      throw error;
    }
  }

  async updateRecordingDuration(livestreamId: string, duration: number) {
    try {
      await this.prisma.postgres.liveStream.update({
        where: { id: livestreamId },
        data: {
          duration: duration,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to update recording duration:`, error);
      // Don't throw - duration update is non-critical
    }
  }

  // Schedule Management Methods

  async createSchedule(createScheduleDto: CreateScheduleDto) {
    const { teacherId, title, startTime, endTime, livestreamId, isPublic, category, ...rest } = createScheduleDto;

    // Verify teacher exists and get avatar
    const teacher = await this.prisma.postgres.user.findUnique({
      where: { id: teacherId },
      select: { id: true, role: true, avatar: true },
    });

    if (!teacher || teacher.role !== 'TEACHER') {
      throw new BadRequestException('Invalid teacher ID');
    }

    let finalLivestreamId = livestreamId;

    // If livestreamId provided, verify it exists and belongs to teacher
    if (livestreamId) {
      const livestream = await this.prisma.postgres.liveStream.findUnique({
        where: { id: livestreamId },
      });

      if (!livestream) {
        throw new NotFoundException('Livestream not found');
      }

      if (livestream.teacherId !== teacherId) {
        throw new BadRequestException('Livestream does not belong to this teacher');
      }
    } else {
      // Auto-create livestream if not provided
      // Use teacher avatar as thumbnail, fallback to logo.png
      const thumbnail = teacher.avatar || '/logo.png';

      const newLivestream = await this.prisma.postgres.liveStream.create({
        data: {
          teacherId,
          title,
          description: '',
          category: category || null, // Set category from schedule
          thumbnail,
          status: LiveStreamStatus.SCHEDULED,
          scheduledAt: new Date(startTime),
          totalViews: 0,
          peakViewers: 0,
          duration: 0,
          currentViewers: 0,
        },
      });
      finalLivestreamId = newLivestream.id;
      this.logger.log(`Auto-created livestream ${finalLivestreamId} for schedule`);
    }

    // Create schedule
    const scheduleData: any = {
      teacherId,
      title,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      isPublic: isPublic !== undefined ? isPublic : true,
      notifyBefore: rest.notifyBefore || 15,
      color: rest.color,
      tags: rest.tags || [],
      status: ScheduleStatus.SCHEDULED,
      livestreamId: finalLivestreamId,
    };

    const schedule = await this.prisma.postgres.schedule.create({
      data: scheduleData,
    });

    // Create MongoDB notification tracking
    await this.prisma.mongo.scheduleNotification.create({
      data: {
        scheduleId: schedule.id,
        reminders: [],
        attendees: [],
        viewsCount: 0,
        clicksCount: 0,
        registeredCount: 0,
      },
    });

    this.logger.log(`Schedule created: ${schedule.id} for teacher ${teacherId}`);
    return schedule;
  }

  async getScheduleById(id: string) {
    const schedule = await this.prisma.postgres.schedule.findUnique({
      where: { id },
      include: {
        liveStream: {
          include: {
            teacher: {
              select: {
                id: true,
                fullName: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    // Get notification data from MongoDB
    const notification = await this.prisma.mongo.scheduleNotification.findUnique({
      where: { scheduleId: id },
    });

    return {
      ...schedule,
      analytics: notification || null,
    };
  }

  async getTeacherSchedules(
    teacherId: string, 
    includeCompleted = false,
    startDate?: string,
    endDate?: string
  ) {
    const whereClause: any = { teacherId };

    if (!includeCompleted) {
      whereClause.status = {
        in: [ScheduleStatus.SCHEDULED, ScheduleStatus.IN_PROGRESS],
      };
    }

    // Add date filtering if provided
    if (startDate || endDate) {
      whereClause.startTime = {};
      if (startDate) {
        whereClause.startTime.gte = new Date(startDate);
      }
      if (endDate) {
        whereClause.startTime.lte = new Date(endDate);
      }
    }

    const schedules = await this.prisma.postgres.schedule.findMany({
      where: whereClause,
      include: {
        liveStream: true,
      },
      orderBy: {
        startTime: 'asc',
      },
    });

    return schedules;
  }

  async getUpcomingSchedules(limit = 10, userId?: string) {
    const now = new Date();
    
    // Base query for public schedules
    const whereClause: any = {
      startTime: {
        gte: now,
      },
      status: ScheduleStatus.SCHEDULED,
    };

    // If no user provided, only show public schedules
    if (!userId) {
      whereClause.isPublic = true;
    }

    const schedules = await this.prisma.postgres.schedule.findMany({
      where: whereClause,
      include: {
        liveStream: {
          include: {
            teacher: {
              select: {
                id: true,
                fullName: true,
                avatar: true,
                teacherProfile: {
                  select: {
                    subjects: true,
                    rating: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        startTime: 'asc',
      },
      take: limit,
    });

    // If user is logged in, filter subscriber-only schedules
    if (userId) {
      // Get user's followed teachers
      const student = await this.prisma.postgres.user.findUnique({
        where: { id: userId },
        include: {
          studentProfile: {
            include: {
              followedTeachers: {
                select: {
                  teacherId: true,
                },
              },
            },
          },
        },
      });

      const followedTeacherIds = student?.studentProfile?.followedTeachers.map(f => f.teacherId) || [];

      // Filter schedules: show public OR (subscriber-only AND user follows teacher)
      return schedules.filter(schedule => 
        schedule.isPublic || followedTeacherIds.includes(schedule.teacherId)
      );
    }

    return schedules;
  }

  async updateSchedule(id: string, updateScheduleDto: UpdateScheduleDto) {
    const schedule = await this.prisma.postgres.schedule.findUnique({
      where: { id },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    // If status is being changed to CANCELLED, set cancelledAt
    const updateData: any = { ...updateScheduleDto };
    
    if (updateScheduleDto.status === ScheduleStatus.CANCELLED) {
      updateData.cancelledAt = new Date();
    }

    if (updateScheduleDto.startTime) {
      updateData.startTime = new Date(updateScheduleDto.startTime);
    }

    if (updateScheduleDto.endTime) {
      updateData.endTime = new Date(updateScheduleDto.endTime);
    }

    const updatedSchedule = await this.prisma.postgres.schedule.update({
      where: { id },
      data: updateData,
    });

    this.logger.log(`Schedule ${id} updated`);
    return updatedSchedule;
  }

  async deleteSchedule(id: string) {
    const schedule = await this.prisma.postgres.schedule.findUnique({
      where: { id },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    // Delete MongoDB notification data
    await this.prisma.mongo.scheduleNotification.deleteMany({
      where: { scheduleId: id },
    });

    // Delete schedule
    await this.prisma.postgres.schedule.delete({
      where: { id },
    });

    this.logger.log(`Schedule ${id} deleted`);
    return { success: true };
  }

  async registerAttendee(scheduleId: string, userId: string) {
    const schedule = await this.prisma.postgres.schedule.findUnique({
      where: { id: scheduleId },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    if (schedule.status !== ScheduleStatus.SCHEDULED) {
      throw new BadRequestException('Cannot register for this schedule');
    }

    // Update MongoDB notification
    const notification = await this.prisma.mongo.scheduleNotification.findUnique({
      where: { scheduleId },
    });

    if (notification) {
      // Check if already registered
      const alreadyRegistered = notification.attendees.some(
        (attendee: any) => attendee.userId === userId
      );

      if (alreadyRegistered) {
        throw new BadRequestException('Already registered for this schedule');
      }

      await this.prisma.mongo.scheduleNotification.update({
        where: { scheduleId },
        data: {
          attendees: {
            push: {
              userId,
              registeredAt: new Date(),
              attended: false,
            },
          },
          registeredCount: { increment: 1 },
        },
      });
    }

    this.logger.log(`User ${userId} registered for schedule ${scheduleId}`);
    return { success: true };
  }

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
        teacher: {
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
        id: stream.teacher.id,
        fullName: stream.teacher.fullName,
        avatar: stream.teacher.avatar,
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
        teacher: {
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
        id: video.teacher.id,
        fullName: video.teacher.fullName,
        avatar: video.teacher.avatar,
      },
      viewCount: video.totalViews,
      thumbnailUrl: video.thumbnail,
      duration: video.duration,
      recordingUrl: video.recordingUrl,
      uploadedAt: video.endedAt,
      category: video.category,
    }));
  }

  // Get recorded livestreams (ENDED with recordingUrl) - public
  async getRecordedLivestreams(limit: number = 20, category?: string) {
    const normalizedCategory = category?.trim();

    const videos = await this.prisma.postgres.liveStream.findMany({
      where: {
        status: LiveStreamStatus.ENDED,
        isPublic: true,
        recordingUrl: { not: null },
        ...(normalizedCategory
          ? {
              OR: [
                {
                  category: {
                    equals: normalizedCategory,
                    mode: 'insensitive',
                  },
                },
                {
                  category: {
                    contains: normalizedCategory,
                    mode: 'insensitive',
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        teacher: {
          select: {
            id: true,
            fullName: true,
            avatar: true,
          },
        },
      },
      orderBy: [
        { endedAt: 'desc' },
        { totalViews: 'desc' },
      ],
      take: limit,
    });

    return videos.map((video) => ({
      id: video.id,
      title: video.title,
      description: video.description,
      teacherId: video.teacherId,
      teacher: {
        id: video.teacher.id,
        fullName: video.teacher.fullName,
        avatar: video.teacher.avatar,
      },
      totalViews: video.totalViews,
      thumbnailUrl: video.thumbnail,
      duration: video.duration,
      recordingUrl: video.recordingUrl,
      isApprove: (video as { isApprove?: string }).isApprove ?? 'FALSE',
      endedAt: video.endedAt,
      status: video.status,
      category: video.category,
    }));
  }

  // Get teacher's recorded livestreams (ENDED with recordingUrl)
  async getTeacherRecordedLivestreams(teacherId: string, limit: number = 50) {
    const recordings = await this.prisma.postgres.liveStream.findMany({
      where: {
        teacherId,
        status: LiveStreamStatus.ENDED,
        recordingUrl: { not: null }, // Only include livestreams with saved recordings
      },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        thumbnail: true,
        recordingUrl: true,
        status: true,
        totalViews: true,
        duration: true,
        createdAt: true,
        startedAt: true,
        endedAt: true,
        currentViewers: true,
        peakViewers: true,
        isRecorded: true,
        isApprove: true,
        isPublic: true,
      },
      orderBy: [
        { endedAt: 'desc' },
      ],
      take: limit,
    });

    return recordings;
  }

  // Get all ENDED livestreams for a teacher (including those without recordings)
  async getTeacherEndedLivestreams(teacherId: string, limit: number = 50) {
    const livestreams = await this.prisma.postgres.liveStream.findMany({
      where: {
        teacherId,
        status: LiveStreamStatus.ENDED,
        // No recordingUrl filter - show all ENDED livestreams
      },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        thumbnail: true,
        recordingUrl: true,
        status: true,
        totalViews: true,
        duration: true,
        createdAt: true,
        startedAt: true,
        endedAt: true,
        currentViewers: true,
        peakViewers: true,
        isRecorded: true,
        isApprove: true,
        isPublic: true,
      },
      orderBy: [
        { endedAt: 'desc' },
      ],
      take: limit,
    });

    return livestreams;
  }

  // Get upcoming scheduled livestreams
  async getUpcomingScheduledStreams(limit: number = 20) {
    const now = new Date();
    
    const scheduled = await this.prisma.postgres.liveStream.findMany({
      where: {
        status: LiveStreamStatus.SCHEDULED,
        isPublic: true,
        scheduledAt: {
          gte: now, // Only future streams
        },
      },
      include: {
        teacher: {
          select: {
            id: true,
            fullName: true,
            avatar: true,
          },
        },
      },
      orderBy: {
        scheduledAt: 'asc', // Earliest first
      },
      take: limit,
    });

    return scheduled.map((stream) => ({
      id: stream.id,
      title: stream.title,
      description: stream.description,
      teacherId: stream.teacherId,
      teacher: {
        id: stream.teacher.id,
        fullName: stream.teacher.fullName,
        avatar: stream.teacher.avatar,
      },
      totalViews: stream.totalViews,
      thumbnailUrl: stream.thumbnail,
      status: stream.status,
      category: stream.category,
      scheduledStartTime: stream.scheduledAt,
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

  // Count a recorded-video view only when watched strictly more than 2/3 and dedupe by viewer
  async reportWatch(id: string, viewerId?: string, watchedSeconds?: number, duration?: number) {
    const watched = typeof watchedSeconds === 'number' ? watchedSeconds : 0;
    const total = typeof duration === 'number' ? duration : 0;

    if (total <= 0) {
      return { counted: false, reason: 'invalid_duration' };
    }

    const ratio = watched / total;
    // Business rule: only count when watched strictly greater than 2/3
    if (ratio <= 2 / 3) {
      return { counted: false, reason: 'below_threshold', ratio };
    }

    // If viewer id exists, dedupe in Redis to avoid multiple increments
    if (viewerId) {
      const alreadyCounted = await this.redisService.hasCountedView('video', id, viewerId);
      if (alreadyCounted) {
        return { counted: false, reason: 'already_counted' };
      }
    }

    const updated = await this.prisma.postgres.liveStream.update({
      where: { id },
      data: {
        totalViews: { increment: 1 },
      },
      select: {
        id: true,
        totalViews: true,
      },
    });

    if (viewerId) {
      await this.redisService.markCountedView('video', id, viewerId, 30);
    }

    return { counted: true, totalViews: updated.totalViews, ratio };
  }

  // Update current viewers count
  async updateCurrentViewers(id: string, count: number) {
    const livestream = await this.prisma.postgres.liveStream.findUnique({
      where: { id },
    });

    if (!livestream) {
      throw new NotFoundException('Livestream not found');
    }

    const peakViewers = Math.max(livestream.peakViewers || 0, count);

    return await this.prisma.postgres.liveStream.update({
      where: { id },
      data: {
        currentViewers: count,
        peakViewers: peakViewers,
      },
    });
  }

  // Auto-cancel scheduled livestreams that have passed their scheduled date
  async autoCheckAndCancelExpiredLivestreams(teacherId: string) {
    const now = new Date();

    // Find all scheduled livestreams for this teacher that are past their scheduled date
    const expiredLivestreams = await this.prisma.postgres.liveStream.findMany({
      where: {
        teacherId,
        status: LiveStreamStatus.SCHEDULED,
        scheduledAt: {
          lt: now, // Scheduled date is in the past
        },
      },
    });

    // Update them to CANCELLED status
    for (const livestream of expiredLivestreams) {
      await this.prisma.postgres.liveStream.update({
        where: { id: livestream.id },
        data: {
          status: LiveStreamStatus.CANCELLED,
        },
      });

      // Also update associated schedule status
      const schedule = await this.prisma.postgres.schedule.findUnique({
        where: { livestreamId: livestream.id },
      });

      if (schedule) {
        await this.prisma.postgres.schedule.update({
          where: { id: schedule.id },
          data: {
            status: ScheduleStatus.CANCELLED,
            cancelledAt: now,
            cancelReason: 'Scheduled date has passed without starting',
          },
        });
      }

      this.logger.log(`Auto-cancelled expired livestream ${livestream.id} for teacher ${teacherId}`);
    }

    return expiredLivestreams;
  }

  // Chat service methods
  async saveChatMessage(
    livestreamId: string,
    userId: string,
    username: string,
    userAvatar: string | undefined,
    message: string,
    type: string = 'MESSAGE',
  ) {
    try {
      const chatMessage = await this.prisma.mongo.liveStreamChat.create({
        data: {
          livestreamId,
          userId,
          username,
          userAvatar: userAvatar || null,
          message,
          type: type as any, // ChatType enum value
        },
      });
      
      this.logger.log(`Chat message saved for livestream ${livestreamId}`);
      return chatMessage;
    } catch (error) {
      this.logger.error(`Failed to save chat message: ${error}`);
      throw new BadRequestException('Failed to save chat message');
    }
  }

  async getChatMessages(livestreamId: string, limit: number = 100) {
    try {
      const messages = await this.prisma.mongo.liveStreamChat.findMany({
        where: { livestreamId },
        orderBy: { createdAt: 'asc' },
        take: limit,
      });
      
      return messages;
    } catch (error) {
      this.logger.error(`Failed to fetch chat messages: ${error}`);
      throw new BadRequestException('Failed to fetch chat messages');
    }
  }

  async updateLivestream(id: string, updateData: { description?: string; isPublic?: boolean }) {
    const livestream = await this.prisma.postgres.liveStream.findUnique({
      where: { id },
    });

    if (!livestream) {
      throw new NotFoundException('Livestream not found');
    }

    const updatedLivestream = await this.prisma.postgres.liveStream.update({
      where: { id },
      data: updateData,
    });

    this.logger.log(`Livestream ${id} updated`);
    return updatedLivestream;
  }

  async getRelatedVideos(videoId: string, limit: number = 10) {
    // Get current video details
    const currentVideo = await this.prisma.postgres.liveStream.findUnique({
      where: { id: videoId },
      select: {
        teacherId: true,
        category: true,
        endedAt: true,
      },
    });

    if (!currentVideo || !currentVideo.endedAt) {
      return [];
    }

    // Get all ended livestreams with recording (exclude current video)
    const allVideos = await this.prisma.postgres.liveStream.findMany({
      where: {
        id: { not: videoId },
        status: LiveStreamStatus.ENDED,
        recordingUrl: { not: null },
        isPublic: true,
      },
      select: {
        id: true,
        title: true,
        thumbnail: true,
        category: true,
        teacherId: true,
        totalViews: true,
        duration: true,
        endedAt: true,
        teacher: {
          select: {
            id: true,
            fullName: true,
            avatar: true,
          },
        },
      },
      take: 200, // Get more videos for better filtering
    });

    // Score and sort videos based on relevance (YouTube-like algorithm)
    const scoredVideos = allVideos.map(video => {
      let score = 0;

      // 1. Same teacher (highest priority) - +50 points
      if (video.teacherId === currentVideo.teacherId) {
        score += 50;
      }

      // 2. Same category - +30 points
      if (video.category === currentVideo.category) {
        score += 30;
      }

      // 3. Time proximity for same teacher videos - up to +20 points
      if (video.teacherId === currentVideo.teacherId && video.endedAt && currentVideo.endedAt) {
        const timeDiff = Math.abs(
          new Date(video.endedAt).getTime() - new Date(currentVideo.endedAt).getTime()
        );
        const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
        
        // Closer in time = higher score (max 20 points for videos within same week)
        if (daysDiff <= 7) {
          score += 20 - (daysDiff * 2);
        } else if (daysDiff <= 30) {
          score += 10 - (daysDiff / 3);
        }
      }

      // 4. Popularity bonus (views) - up to +10 points
      const viewsScore = Math.min(10, (video.totalViews || 0) / 1000);
      score += viewsScore;

      return {
        ...video,
        score,
      };
    });

    // Sort by score (descending)
    const sortedVideos = scoredVideos.sort((a, b) => b.score - a.score);

    // Get top related videos
    let relatedVideos = sortedVideos.slice(0, limit);

    // If not enough related videos (score > 0), fill with random videos
    if (relatedVideos.length < limit) {
      const relatedIds = new Set(relatedVideos.map(v => v.id));
      const remainingVideos = sortedVideos
        .filter(v => !relatedIds.has(v.id))
        .sort(() => Math.random() - 0.5) // Random shuffle
        .slice(0, limit - relatedVideos.length);
      
      relatedVideos = [...relatedVideos, ...remainingVideos];
    }

    // Remove score from final result
    return relatedVideos.map(({ score, ...video }) => video);
  }

  // Video Comment service methods
  async saveVideoComment(
    livestreamId: string,
    studentId: string,
    author: string,
    authorAvatar: string | undefined,
    content: string,
  ) {
    try {
      const comment = await this.prisma.mongo.videoComment.create({
        data: {
          livestreamId,
          studentId,
          author,
          authorAvatar: authorAvatar || null,
          content,
          likes: 0,
          dislikes: 0,
          likedBy: [],
          dislikedBy: [],
        },
      });

      this.logger.log(`Comment saved for livestream ${livestreamId} by student ${studentId}`);
      return comment;
    } catch (error) {
      this.logger.error(`Failed to save video comment: ${error}`);
      throw new BadRequestException('Failed to save video comment');
    }
  }

  async getVideoComments(livestreamId: string, limit: number = 50) {
    try {
      const comments = await this.prisma.mongo.videoComment.findMany({
        where: { livestreamId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return comments;
    } catch (error) {
      this.logger.error(`Failed to fetch video comments: ${error}`);
      throw new BadRequestException('Failed to fetch video comments');
    }
  }

  async addCommentReaction(
    commentId: string,
    studentId: string,
    reactionType: 'like' | 'dislike',
  ) {
    try {
      const comment = await this.prisma.mongo.videoComment.findUnique({
        where: { id: commentId },
      });

      if (!comment) {
        throw new NotFoundException('Comment not found');
      }

      let likedBy = [...(comment.likedBy || [])];
      let dislikedBy = [...(comment.dislikedBy || [])];
      let likes = comment.likes;
      let dislikes = comment.dislikes;

      if (reactionType === 'like') {
        // If already liked, remove like
        if (likedBy.includes(studentId)) {
          likedBy = likedBy.filter((id) => id !== studentId);
          likes = Math.max(0, likes - 1);
        } else {
          // Add like and remove dislike if exists
          likedBy.push(studentId);
          likes += 1;

          if (dislikedBy.includes(studentId)) {
            dislikedBy = dislikedBy.filter((id) => id !== studentId);
            dislikes = Math.max(0, dislikes - 1);
          }
        }
      } else if (reactionType === 'dislike') {
        // If already disliked, remove dislike
        if (dislikedBy.includes(studentId)) {
          dislikedBy = dislikedBy.filter((id) => id !== studentId);
          dislikes = Math.max(0, dislikes - 1);
        } else {
          // Add dislike and remove like if exists
          dislikedBy.push(studentId);
          dislikes += 1;

          if (likedBy.includes(studentId)) {
            likedBy = likedBy.filter((id) => id !== studentId);
            likes = Math.max(0, likes - 1);
          }
        }
      }

      const updatedComment = await this.prisma.mongo.videoComment.update({
        where: { id: commentId },
        data: {
          likes,
          dislikes,
          likedBy,
          dislikedBy,
        },
      });

      this.logger.log(`Reaction ${reactionType} added to comment ${commentId} by student ${studentId}`);
      return updatedComment;
    } catch (error) {
      this.logger.error(`Failed to add comment reaction: ${error}`);
      throw new BadRequestException('Failed to add comment reaction');
    }
  }

  async deleteVideoComment(commentId: string, studentId: string) {
    try {
      const comment = await this.prisma.mongo.videoComment.findUnique({
        where: { id: commentId },
      });

      if (!comment) {
        throw new NotFoundException('Comment not found');
      }

      // Only the comment author or admin can delete
      if (comment.studentId !== studentId) {
        throw new UnauthorizedException('You can only delete your own comments');
      }

      await this.prisma.mongo.videoComment.delete({
        where: { id: commentId },
      });

      this.logger.log(`Comment ${commentId} deleted by student ${studentId}`);
      return { message: 'Comment deleted successfully' };
    } catch (error) {
      this.logger.error(`Failed to delete video comment: ${error}`);
      throw new BadRequestException('Failed to delete video comment');
    }
  }

  // Video Reaction (Like/Dislike) service methods
  async saveVideoReaction(
    livestreamId: string,
    studentId: string,
    reactionType: 'like' | 'dislike',
  ) {
    try {
      // Check if reaction already exists
      const existingReaction = await this.prisma.mongo.videoReaction.findUnique({
        where: {
          livestreamId_studentId: {
            livestreamId,
            studentId,
          },
        },
      });

      if (existingReaction) {
        // If same reaction, remove it; if different, update it
        if (existingReaction.reactionType === reactionType) {
          await this.prisma.mongo.videoReaction.delete({
            where: { id: existingReaction.id },
          });
          this.logger.log(`Reaction removed for video ${livestreamId} by student ${studentId}`);
          return { reactionType: null };
        } else {
          // Update to new reaction type
          const updated = await this.prisma.mongo.videoReaction.update({
            where: { id: existingReaction.id },
            data: { reactionType },
          });
          this.logger.log(`Reaction updated for video ${livestreamId} by student ${studentId}`);
          return { reactionType: updated.reactionType };
        }
      }

      // Create new reaction
      const newReaction = await this.prisma.mongo.videoReaction.create({
        data: {
          livestreamId,
          studentId,
          reactionType,
        },
      });

      this.logger.log(`Reaction saved for video ${livestreamId} by student ${studentId}`);
      return { reactionType: newReaction.reactionType };
    } catch (error) {
      this.logger.error(`Failed to save video reaction: ${error}`);
      throw new BadRequestException('Failed to save video reaction');
    }
  }

  async getVideoReaction(livestreamId: string, studentId: string) {
    try {
      const reaction = await this.prisma.mongo.videoReaction.findUnique({
        where: {
          livestreamId_studentId: {
            livestreamId,
            studentId,
          },
        },
      });

      return reaction ? { reactionType: reaction.reactionType } : { reactionType: null };
    } catch (error) {
      this.logger.error(`Failed to fetch video reaction: ${error}`);
      throw new BadRequestException('Failed to fetch video reaction');
    }
  }

  async getVideoReactionStats(livestreamId: string) {
    try {
      const reactions = await this.prisma.mongo.videoReaction.findMany({
        where: { livestreamId },
      });

      const likes = reactions.filter((r) => r.reactionType === 'like').length;
      const dislikes = reactions.filter((r) => r.reactionType === 'dislike').length;

      return { likes, dislikes };
    } catch (error) {
      this.logger.error(`Failed to fetch video reaction stats: ${error}`);
      throw new BadRequestException('Failed to fetch video reaction stats');
    }
  }

  private async getRecordingAiAnalysisDocument(recordingId: string): Promise<AiTranscriptSummaryDocument | null> {
    const result = await this.prisma.mongo.$runCommandRaw({
      find: this.aiTranscriptSummaryCollection,
      filter: { type: 'LIVESTREAM', recordingId },
      limit: 1,
    });

    const firstBatch = (result as { cursor?: { firstBatch?: AiTranscriptSummaryDocument[] } }).cursor?.firstBatch || [];
    return firstBatch[0] || null;
  }

  private async upsertRecordingAiAnalysis(
    recordingId: string,
    payload: Partial<AiTranscriptSummaryDocument>,
  ): Promise<void> {
    await this.prisma.mongo.$runCommandRaw({
      update: this.aiTranscriptSummaryCollection,
      updates: [
        {
          q: { type: 'LIVESTREAM', recordingId },
          u: {
            $set: {
              id: recordingId,
              type: 'LIVESTREAM',
              recordingId,
              documentId: null,
              ...payload,
              updatedAt: new Date(),
            },
            $setOnInsert: {
              id: recordingId,
              type: 'LIVESTREAM',
              recordingId,
              documentId: null,
              toxicWords: [],
              validationRate: 0,
              createdAt: new Date(),
            },
          },
          upsert: true,
        },
      ],
    });
  }

  private extractTranscriptFromPayload(payload: unknown): Prisma.JsonValue | null {
    if (typeof payload === 'string') {
      return payload.trim() || null;
    }

    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const data = payload as Record<string, unknown>;
    const nestedData = data.data && typeof data.data === 'object' ? (data.data as Record<string, unknown>) : null;
    const nestedCandidate = nestedData?.result ?? nestedData?.text ?? nestedData?.transcript;
    const transcriptCandidate = data.text ?? data.transcript ?? data.result ?? nestedCandidate;

    if (typeof transcriptCandidate === 'string') {
      return transcriptCandidate.trim() || null;
    }

    if (transcriptCandidate && typeof transcriptCandidate === 'object') {
      return transcriptCandidate as Prisma.JsonValue;
    }

    return null;
  }

  private getTranscriptText(transcript: Prisma.JsonValue | null | undefined): string | null {
    if (typeof transcript === 'string') {
      return transcript.trim() || null;
    }

    if (!transcript) {
      return null;
    }

    if (typeof transcript === 'object') {
      const data = transcript as Record<string, unknown>;
      const candidate = data.text ?? data.transcript ?? data.result;
      if (typeof candidate === 'string') {
        return candidate.trim() || null;
      }
    }

    try {
      return JSON.stringify(transcript);
    } catch {
      return null;
    }
  }

  private extractAiErrorFromPayload(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const data = payload as Record<string, unknown>;
    if (data.status !== 'error') {
      return null;
    }

    const errorValue = data.error;
    if (typeof errorValue === 'string') {
      return errorValue.trim() || null;
    }

    if (errorValue && typeof errorValue === 'object') {
      const errorData = errorValue as Record<string, unknown>;
      const message = errorData.message ?? errorData.detail ?? errorData.error;
      if (typeof message === 'string') {
        return message.trim() || null;
      }
    }

    return 'Unknown error from transcribe service';
  }

  private extractSummaryFromPayload(payload: unknown): string | null {
    if (typeof payload === 'string') {
      return payload.trim() || null;
    }

    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const data = payload as Record<string, unknown>;
    const summaryCandidate = data.summary || data.result || data.text;
    if (typeof summaryCandidate === 'string') {
      return summaryCandidate.trim() || null;
    }

    return null;
  }

  async getRecordingAiAnalysis(recordingId: string) {
    const analysis = await this.getRecordingAiAnalysisDocument(recordingId);

    return {
      recordingId,
      transcript: analysis?.transcript || null,
      summary: analysis?.summary || undefined,
      audioUrl: analysis?.audioUrl || null,
      toxicWords: analysis?.toxicWords || [],
      validationRate: analysis?.validationRate ?? 0,
      moderationLabel: analysis?.moderationLabel || null,
      moderationCategories: analysis?.moderationCategories || [],
      transcriptStatus: analysis?.transcriptStatus || 'idle',
      transcriptError: analysis?.transcriptError || null,
      transcriptGeneratedAt: analysis?.transcriptGeneratedAt || null,
      summaryGeneratedAt: analysis?.summaryGeneratedAt || null,
    };
  }

  async getRecordingModeration(recordingId: string) {
    const analysis = await this.getRecordingAiAnalysis(recordingId);
    const transcriptText = this.getTranscriptText(analysis.transcript);
    if (transcriptText) {
      this.logger.log(`[Moderation] Recording ${recordingId} - invoking moderation API; textLen=${transcriptText.length}`);
    }
    const moderationResult = transcriptText ? await this.callModerationApi(transcriptText) : null;

    if (moderationResult) {
      const { score, toxic_word, label, categories } = moderationResult as any;

      return {
        ...analysis,
        score: typeof score === 'number' ? score : 0,
        toxicWords: toxic_word || analysis.toxicWords || [],
        label: label || null,
        categories: categories || [],
        text: transcriptText,
      };
    }

    return {
      ...analysis,
      score: analysis.validationRate ?? 0,
      toxicWords: analysis.toxicWords || [],
      label: analysis.moderationLabel || null,
      categories: analysis.moderationCategories || [],
      text: transcriptText,
    };
  }

  private async downloadToBuffer(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new BadRequestException(`Cannot download file: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async generateRecordingTranscript(recordingId: string, force = false) {
    this.logger.log(`[Transcribe] generateRecordingTranscript start recordingId=${recordingId} force=${force}`);
    const livestream = await this.prisma.postgres.liveStream.findUnique({
      where: { id: recordingId },
      select: {
        id: true,
        recordingUrl: true,
      },
    });

    if (!livestream) {
      throw new NotFoundException('Recording not found');
    }

    if (!livestream.recordingUrl) {
      throw new BadRequestException('Recording URL is missing, cannot transcribe');
    }

    const existing = await this.getRecordingAiAnalysisDocument(recordingId);
    this.logger.debug(`[Transcribe] existing transcript present=${!!existing?.transcript} status=${existing?.transcriptStatus}`);
    if (!force && existing?.transcript) {
      try {
        await this.generateRecordingSummary(recordingId, false);
      } catch (summaryErr) {
        this.logger.warn('Summary failed for recording', String(summaryErr));
      }

      try {
        const text = this.getTranscriptText(existing.transcript);
        if (text) {
          this.logger.log(`[Moderation] Recording ${recordingId} (existing) - invoking moderation API; textLen=${text.length}`);
        }
        const moderation = await this.callModerationApi(text || '');
        if (moderation) {
          const { score, toxic_word, label, categories } = moderation as any;

          await this.upsertRecordingAiAnalysis(recordingId, {
            toxicWords: toxic_word || [],
            validationRate: typeof score === 'number' ? score : 0,
            moderationLabel: label || null,
            moderationCategories: categories || [],
          });
        }
      } catch (err) {
        this.logger.warn('Moderation failed for recording', String(err));
      }

      return {
        ...(await this.getRecordingAiAnalysis(recordingId)),
        cached: true,
      };
    }

    if (!force && existing?.transcriptStatus === 'processing') {
      return {
        ...(await this.getRecordingAiAnalysis(recordingId)),
        cached: true,
      };
    }

    try {
      await this.upsertRecordingAiAnalysis(recordingId, {
        transcriptStatus: 'processing',
        transcriptError: null,
      });

      const audioExists = await this.r2StorageService.recordingAudioExistsById(recordingId);
      let audioUrl = existing?.audioUrl || (audioExists ? this.r2StorageService.getRecordingAudioUrlById(recordingId) : null);
      let audioBuffer: Buffer | null = null;

      if (audioUrl) {
        audioBuffer = await this.downloadToBuffer(audioUrl);
      } else {
        const recordingResponse = await fetch(livestream.recordingUrl);
        if (!recordingResponse.ok || !recordingResponse.body) {
          throw new BadRequestException(`Cannot download recording file: ${recordingResponse.status}`);
        }

        const tempBase = `recording-${recordingId}-${Date.now()}`;
        const inputPath = path.join(os.tmpdir(), `${tempBase}.mp4`);
        const outputPath = path.join(os.tmpdir(), `${tempBase}.wav`);

        try {
          await pipeline(Readable.fromWeb(recordingResponse.body as any), createWriteStream(inputPath));

          await new Promise<void>((resolve, reject) => {
            const ffmpeg = spawn('ffmpeg', [
              '-y',
              '-i',
              inputPath,
              '-vn',
              '-ac',
              '1',
              '-ar',
              '16000',
              '-f',
              'wav',
              outputPath,
            ]);

            let stderr = '';
            ffmpeg.stderr.on('data', (chunk) => {
              stderr += chunk.toString();
            });
            ffmpeg.on('error', (err) => reject(err));
            ffmpeg.on('close', (code) => {
              if (code === 0) {
                resolve();
              } else {
                reject(new Error(`ffmpeg failed (${code}): ${stderr}`));
              }
            });
          });

          audioBuffer = await fs.readFile(outputPath);
          audioUrl = await this.r2StorageService.uploadRecordingAudioById(recordingId, audioBuffer);
        } finally {
          await Promise.all([
            fs.unlink(inputPath).catch(() => undefined),
            fs.unlink(outputPath).catch(() => undefined),
          ]);
        }
      }

      if (!audioBuffer) {
        throw new BadRequestException('Audio export failed, cannot transcribe');
      }

      const formData = new FormData();
      const audioBytes = new Uint8Array(audioBuffer);
      // Explicitly set audio/wav type for AI server to correctly process audio
      formData.append('file', new Blob([audioBytes], { type: 'audio/wav' }), `${recordingId}.wav`);

      // Stream transcribe response (handles heartbeats and long processing time)
      const aiResponse = await (await import('../utils/aiFetch')).logStreamingTranscribe(
        `${this.localAiBaseUrl}/transcribe`,
        {
          method: 'POST',
          body: formData,
          timeoutMs: 30 * 60 * 1000, // 30 minutes
        },
        this.logger as any,
      );

      // Extract transcript from the streaming response
      const transcript = this.extractTranscriptFromPayload(aiResponse.data);

      if (!transcript) {
        await this.upsertRecordingAiAnalysis(recordingId, {
          transcriptStatus: 'error',
          transcriptError: 'Transcribe service returned empty transcript',
        });
        throw new BadRequestException('Transcribe service returned empty transcript');
      }

      await this.upsertRecordingAiAnalysis(recordingId, {
        transcriptStatus: 'success',
        transcriptError: null,
        transcript,
        audioUrl: audioUrl || undefined,
        transcriptGeneratedAt: new Date(),
      });

      try {
        await this.generateRecordingSummary(recordingId, false);
      } catch (summaryErr) {
        this.logger.warn('Summary failed for recording', String(summaryErr));
      }

      // Log transcription success with data
      const analysis = await this.getRecordingAiAnalysis(recordingId);
      const transcriptText = this.getTranscriptText(transcript);
      const transcriptLength = transcriptText ? transcriptText.length : 0;
      const transcriptPreview = transcriptText ? transcriptText.substring(0, 200) : '';

      this.logger.log(`[TRANSCRIPT SUCCESS] RecordingID: ${recordingId}, Length: ${transcriptLength} chars, AudioUrl: ${audioUrl ? 'stored' : 'not stored'}`);
      console.log('[Transcript Generation Complete]', {
        recordingId,
        transcriptLength,
        transcriptPreview,
        hasAudioUrl: !!audioUrl,
        generatedAt: new Date().toISOString(),
        status: 'success',
      });

      return {
        ...analysis,
        cached: false,
      };
    } catch (err: unknown) {
      await this.upsertRecordingAiAnalysis(recordingId, {
        transcriptStatus: 'error',
        transcriptError: err instanceof Error ? err.message : String(err),
      }).catch(() => undefined);
      
      this.logger.error(`[TRANSCRIPT ERROR] RecordingID: ${recordingId}, Error: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  }

  async generateRecordingSummary(recordingId: string, force = false) {
    const existing = await this.getRecordingAiAnalysisDocument(recordingId);

    let transcript = existing?.transcript || null;
    if (!transcript) {
      return await this.generateRecordingTranscript(recordingId, false);
    }

    if (!transcript) {
      throw new BadRequestException('Transcript is required before summarizing');
    }

    const transcriptText = this.getTranscriptText(transcript);
    if (!transcriptText) {
      throw new BadRequestException('Transcript is required before summarizing');
    }

    const aiResponse = await fetch(`${this.localAiBaseUrl}/summarize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: transcriptText }),
    });

    if (!aiResponse.ok) {
      const errorBody = await aiResponse.text();
      throw new BadRequestException(`Summarize service error (${aiResponse.status}): ${errorBody}`);
    }

    const aiPayload = await aiResponse.json();
    const summary = this.extractSummaryFromPayload(aiPayload);

    if (!summary) {
      throw new BadRequestException('Summarize service returned empty summary');
    }

    await this.upsertRecordingAiAnalysis(recordingId, {
      summary,
      summaryGeneratedAt: new Date(),
    });

    try {
      const text = this.getTranscriptText(transcript);
      if (text) {
        this.logger.log(`[Moderation] Recording ${recordingId} - invoking moderation API after summarization; textLen=${text.length}`);
      }
      const moderation = await this.callModerationApi(text || '');
      if (moderation) {
        const { score, toxic_word, label, categories } = moderation as any;

        await this.upsertRecordingAiAnalysis(recordingId, {
          toxicWords: toxic_word || [],
          validationRate: typeof score === 'number' ? score : 0,
          moderationLabel: label || null,
          moderationCategories: categories || [],
        });

        if (!text || text.length === 0) {
          await this.prisma.postgres.liveStream.update({
            where: { id: recordingId },
            data: { isApprove: 'TRUE' },
          }).catch(() => undefined);
        } else if (score >= 0.5) {
          await this.prisma.postgres.liveStream.update({
            where: { id: recordingId },
            data: { isApprove: 'REJECTED' },
          }).catch(() => undefined);
        }
      }
    } catch (err) {
      this.logger.warn('Moderation failed for recording', String(err));
    }

    return {
      ...(await this.getRecordingAiAnalysis(recordingId)),
      cached: false,
    };
  }
}

