import { Injectable, ConflictException, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLivestreamDto } from './dto/create-livestream.dto';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { LiveStreamStatus, ScheduleStatus } from '@prisma/client';
import { R2StorageService } from '../r2-storage/r2-storage.service';
import { Readable } from 'stream';

@Injectable()
export class LivestreamService {
  private readonly logger = new Logger(LivestreamService.name);
  
  constructor(
    private prisma: PrismaService,
    private r2StorageService: R2StorageService,
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
        select: { id: true, role: true }, // Don't need full teacherProfile
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

    // Create the livestream with SCHEDULED status
    const livestream = await this.prisma.postgres.liveStream.create({
      data: {
        id,
        teacherId,
        title,
        description: description || '',
        thumbnail: 'https://images.unsplash.com/photo-1588072432836-e10032774350?w=800&h=450&fit=crop', // Default thumbnail
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
      select: { id: true },
    });

    if (!livestream) {
      throw new NotFoundException('Livestream not found');
    }

    // TODO: Implement document storage and retrieval
    // For now, return empty array as documents are not yet implemented in database
    this.logger.warn(`Documents requested for livestream ${id} but document feature is not yet implemented`);
    return [];
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


  async uploadRecording(livestreamId: string, videoBase64: string) {
    this.logger.log(`Uploading recording for livestream ${livestreamId}`);
    
    try {
      // Decode base64 video
      const videoBuffer = Buffer.from(videoBase64, 'base64');
      this.logger.log(`Video size: ${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB`);
      
      // Convert buffer to stream for upload
      const videoStream = Readable.from(videoBuffer);
      
      // Upload to R2
      const videoUrl = await this.r2StorageService.uploadVideo(livestreamId, videoStream, {
        uploadedAt: new Date().toISOString(),
      });
      
      // Update livestream with recording URL
      await this.prisma.postgres.liveStream.update({
        where: { id: livestreamId },
        data: {
          recordingUrl: videoUrl,
          isRecorded: true,
        },
      });
      
      this.logger.log(`Recording uploaded successfully: ${videoUrl}`);
      return { success: true, url: videoUrl };
    } catch (error) {
      this.logger.error(`Failed to upload recording:`, error);
      throw error;
    }
  }

  // Schedule Management Methods

  async createSchedule(createScheduleDto: CreateScheduleDto) {
    const { teacherId, title, startTime, endTime, livestreamId, isPublic, ...rest } = createScheduleDto;

    // Verify teacher exists
    const teacher = await this.prisma.postgres.user.findUnique({
      where: { id: teacherId },
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
      const newLivestream = await this.prisma.postgres.liveStream.create({
        data: {
          teacherId,
          title,
          description: '',
          thumbnail: 'https://images.unsplash.com/photo-1588072432836-e10032774350?w=800&h=450&fit=crop', // Default thumbnail
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

  async getTeacherSchedules(teacherId: string, includeCompleted = false) {
    const whereClause: any = { teacherId };

    if (!includeCompleted) {
      whereClause.status = {
        in: [ScheduleStatus.SCHEDULED, ScheduleStatus.IN_PROGRESS],
      };
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

  // Get recorded livestreams (ENDED with recordingUrl)
  async getRecordedLivestreams(limit: number = 20) {
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
      endedAt: video.endedAt,
      status: video.status,
      category: video.category,
    }));
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
}
