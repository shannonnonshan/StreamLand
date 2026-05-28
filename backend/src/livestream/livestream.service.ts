import { Injectable, ConflictException, NotFoundException, BadRequestException, UnauthorizedException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLivestreamDto } from './dto/create-livestream.dto';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { Prisma, LiveStreamStatus, ScheduleStatus } from '@prisma/client';
import { R2StorageService } from '../r2-storage/r2-storage.service';
import { RedisService } from '../redis/redis.service';
import { ProcessingService } from '../processing/processing.service';
import { Readable } from 'stream';
import { createWriteStream, promises as fs } from 'fs';
import ffmpegPath from 'ffmpeg-static';
import { spawn } from 'child_process';
import { pipeline } from 'stream/promises';
import * as os from 'os';
import * as path from 'path';
import { PROCESSING_STAGE_PROGRESS, ProcessingStage } from '../processing/processing.types';

interface AiTranscriptSummaryDocument {
  id?: string;
  type: 'LIVESTREAM' | 'DOCUMENT';
  recordingId?: string;
  documentId?: string;
  transcriptStatus?: 'idle' | 'processing' | 'success' | 'error';
  transcriptError?: string | null;
  transcript?: Prisma.JsonValue;
  summary?: string;
  audioUrl?: string | null;
  moderationResult?: Prisma.JsonValue;
  moderationCheckedAt?: Date;
  transcriptGeneratedAt?: Date;
  summaryGeneratedAt?: Date;
  processingProgress?: number;
  processingError?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type ModerationApiResult = Prisma.JsonObject & {
  status?: string;
  score?: number;
  categories?: string[];
  toxic_word?: string[];
};

type ModerationSnapshot = {
  toxicWords: string[];
  validationRate: number;
  moderationLabel: string | null;
  moderationCategories: string[];
};

@Injectable()
export class LivestreamService {
  private readonly logger = new Logger(LivestreamService.name);
  private readonly aiTranscriptSummaryCollection = 'ai_transcript_summary';
  private readonly aiServiceUrl = (process.env.AI_SERVICE_URL || '').replace(/\/$/, '');

  constructor(
    private prisma: PrismaService,
    private r2StorageService: R2StorageService,
    private redisService: RedisService,
    private processingService: ProcessingService,
  ) {}

  private requireAiServiceUrl(): string {
    if (!this.aiServiceUrl) {
      throw new BadRequestException('AI_SERVICE_URL is not configured');
    }
    return this.aiServiceUrl;
  }

  async createLivestream(createLivestreamDto: CreateLivestreamDto) {
    const { id, teacherId, title, description, isPublic, allowComments } = createLivestreamDto;

    const [existingLivestream, teacher, activeLivestream] = await Promise.all([
      this.prisma.postgres.liveStream.findUnique({
        where: { id },
        select: { id: true },
      }),
      this.prisma.postgres.user.findUnique({
        where: { id: teacherId },
        select: { id: true, role: true, avatar: true },
      }),
      this.prisma.postgres.liveStream.findFirst({
        where: { teacherId, status: LiveStreamStatus.LIVE },
        select: { id: true },
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

    const thumbnail = teacher.avatar || '/logo.png';

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
      },
    });

    return livestream;
  }

  private async normalizeTranscriptContent(transcript: unknown): Promise<string> {
    const text = this.getTranscriptText(transcript as Prisma.JsonValue | null | undefined);
    return text || '';
  }

  private normalizeModerationStatus(status: unknown): string | undefined {
    if (typeof status !== 'string') return undefined;
    const normalized = status.trim().toUpperCase();
    return ['SAFE', 'REVIEW', 'BLOCK'].includes(normalized) ? normalized : undefined;
  }

  private getModerationSnapshot(moderationResult: Prisma.JsonValue | null | undefined): ModerationSnapshot {
    const moderation = this.sanitizeModerationResult(moderationResult) || null;
    return {
      toxicWords: moderation?.toxic_word || [],
      validationRate: typeof moderation?.score === 'number' ? moderation.score : 0,
      moderationLabel: moderation?.status || null,
      moderationCategories: moderation?.categories || [],
    };
  }

  private isWordLevelToxicCandidate(value: string): boolean {
    const trimmed = value.trim();
    if (!trimmed) return false;
    if (/\s{2,}/.test(trimmed)) return false;
    return trimmed.split(/\s+/).filter(Boolean).length <= 2;
  }

  private collectModerationStrings(value: unknown): string[] {
    if (typeof value === 'string') {
      return [value.trim()];
    }

    if (!Array.isArray(value)) {
      return [];
    }

    return value.flatMap((item) => {
      if (typeof item === 'string') {
        return [item.trim()];
      }

      if (!item || typeof item !== 'object') {
        return [];
      }

      const candidate = item as Record<string, unknown>;
      const keys = ['word', 'token', 'term', 'lexeme', 'value', 'label', 'name', 'category'];

      for (const key of keys) {
        const raw = candidate[key];
        if (typeof raw === 'string') {
          return [raw.trim()];
        }
      }

      return [];
    });
  }

  private extractToxicWords(moderation: Record<string, unknown>): string[] {
    const sources = [
      moderation.toxic_word,
      moderation.toxic_words,
      moderation.toxicWords,
      moderation.lexicon_hits,
      moderation.lexiconHits,
    ];

    const candidates = sources.flatMap((source) => this.collectModerationStrings(source));
    const filtered = candidates
      .map((value) => value.trim())
      .filter((value) => this.isWordLevelToxicCandidate(value));

    return Array.from(new Set(filtered));
  }

  private sanitizeModerationResult(payload: unknown): ModerationApiResult | null {
    if (!payload || typeof payload !== 'object') return null;

    const data = payload as Record<string, unknown>;
    const moderation = data.moderation && typeof data.moderation === 'object'
      ? (data.moderation as Record<string, unknown>)
      : data;

    const status = this.normalizeModerationStatus(moderation.status);
    const score = typeof moderation.score === 'number' ? moderation.score : undefined;
    const categories = Array.isArray(moderation.categories)
      ? moderation.categories.filter((value): value is string => typeof value === 'string')
      : undefined;
    const toxicWord = this.extractToxicWords(moderation);

    if (!status && score === undefined && !categories && toxicWord.length === 0) return null;

    return { status, score, categories, toxic_word: toxicWord };
  }

  private async callModerationApi(transcript: unknown): Promise<ModerationApiResult | null> {
    const api = `${this.requireAiServiceUrl()}/moderation/text`;

    try {
      this.logger.debug(`[Moderation] Raw transcript type=${typeof transcript}`);

      if (typeof transcript === 'string') {
        const rawPreview = transcript.length > 300 ? `${transcript.slice(0, 300)}...` : transcript;
        this.logger.debug(`[Moderation] Raw transcript preview=${rawPreview}`);
      }

      const normalizedText = await this.normalizeTranscriptContent(transcript);
      this.logger.log(`[Moderation] Normalized text length=${normalizedText.length}`);

      const normalizedPreview = normalizedText.length > 500 ? `${normalizedText.slice(0, 500)}...` : normalizedText;
      this.logger.debug(`[Moderation] Normalized text preview=${normalizedPreview}`);

      if (!normalizedText.trim()) {
        this.logger.warn('[Moderation] Empty normalized text, skipping moderation');
        return null;
      }

      const payload = { text: normalizedText };
      this.logger.debug(`[Moderation] Outgoing payload=${JSON.stringify(payload)}`);
      this.logger.log(`[Moderation] POST ${api} | payloadLen=${payload.text.length}`);

      const res = await fetch(api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const respText = await res.text();
      this.logger.log(`[Moderation] Response status=${res.status}`);

      if (respText) {
        const responsePreview = respText.length > 1000 ? `${respText.slice(0, 1000)}...` : respText;
        this.logger.debug(`[Moderation] Response body preview=${responsePreview}`);
      }

      if (!res.ok) {
        this.logger.warn(`[Moderation] Non-ok response from AI moderation: ${res.status}`);
        return null;
      }

      let data: any = null;
      try {
        data = respText ? JSON.parse(respText) : null;
      } catch (parseErr) {
        this.logger.error('[Moderation] Failed to parse JSON response', parseErr as any);
        return null;
      }

      const moderation = this.sanitizeModerationResult(data);
      this.logger.debug(`[Moderation] toxic_word output=${JSON.stringify(moderation?.toxic_word || [])}`);
      this.logger.debug(`[Moderation] Parsed moderation=${JSON.stringify(moderation)}`);

      return moderation;
    } catch (err) {
      this.logger.error('[Moderation] call failed', err as any);
      return null;
    }
  }

  private async replaceRecordingAiAnalysisWithModeration(
    recordingId: string,
    moderationResult: ModerationApiResult,
  ): Promise<void> {
    const existing = await this.getRecordingAiAnalysisDocument(recordingId);

    await this.prisma.mongo.$runCommandRaw({
      delete: this.aiTranscriptSummaryCollection,
      deletes: [{ q: { type: 'LIVESTREAM', recordingId }, limit: 0 }],
    });

    await this.prisma.mongo.$runCommandRaw({
      insert: this.aiTranscriptSummaryCollection,
      documents: [
        {
          id: existing?.id || recordingId,
          type: 'LIVESTREAM',
          recordingId,
          documentId: null,
          transcript: existing?.transcript ?? null,
          summary: existing?.summary ?? null,
          audioUrl: existing?.audioUrl ?? null,
          moderationResult: moderationResult as Prisma.JsonValue,
          moderationCheckedAt: new Date(),
          transcriptStatus: existing?.transcriptStatus ?? 'idle',
          transcriptError: existing?.transcriptError ?? null,
          transcriptGeneratedAt: existing?.transcriptGeneratedAt ?? null,
          summaryGeneratedAt: existing?.summaryGeneratedAt ?? null,
          createdAt: existing?.createdAt ?? new Date(),
          updatedAt: new Date(),
        },
      ],
    });
  }

  async startLivestream(id: string) {
    const livestream = await this.prisma.postgres.liveStream.findUnique({ where: { id } });

    if (!livestream) throw new NotFoundException('Livestream not found');
    if (livestream.status === LiveStreamStatus.LIVE) throw new BadRequestException('Livestream is already live');
    if (livestream.status === LiveStreamStatus.ENDED) throw new BadRequestException('Cannot start an ended livestream');

    return await this.prisma.postgres.liveStream.update({
      where: { id },
      data: { status: LiveStreamStatus.LIVE, startedAt: new Date() },
    });
  }

  async createAndStartLivestreamEarly(teacherId: string, title: string, category?: string) {
    const teacher = await this.prisma.postgres.user.findUnique({
      where: { id: teacherId },
      select: { avatar: true },
    });

    if (!teacher) throw new NotFoundException('Teacher not found');

    const thumbnail = teacher.avatar || '/logo.png';

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

    if (!livestream) throw new NotFoundException('Livestream not found');

    const followersCount = livestream.teacherId
      ? await this.prisma.postgres.followedTeacher.count({ where: { teacherId: livestream.teacherId } })
      : 0;

    return {
      ...livestream,
      teacher: livestream.teacher ? { ...livestream.teacher, followersCount } : null,
    };
  }

  async getLivestreamDocuments(id: string) {
    const livestream = await this.prisma.postgres.liveStream.findUnique({
      where: { id },
      select: { id: true, teacherId: true },
    });

    if (!livestream) throw new NotFoundException('Livestream not found');

    const livestreamDocs = await this.prisma.mongo.liveStreamDocuments.findUnique({
      where: { livestreamId: id },
    });

    if (!livestreamDocs || !livestreamDocs.documentIds || livestreamDocs.documentIds.length === 0) {
      return [];
    }

    return await this.prisma.postgres.document.findMany({
      where: {
        id: { in: livestreamDocs.documentIds },
        teacherId: livestream.teacherId,
        isApprove: 'TRUE',
      },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  async updateLivestreamStatus(id: string, status: LiveStreamStatus) {
    const livestream = await this.prisma.postgres.liveStream.findUnique({ where: { id } });

    if (!livestream) throw new NotFoundException('Livestream not found');

    const updateData: any = { status };

    if (status === LiveStreamStatus.LIVE && !livestream.startedAt) {
      updateData.startedAt = new Date();
    } else if (status === LiveStreamStatus.ENDED && !livestream.endedAt) {
      updateData.endedAt = new Date();
      if (livestream.startedAt) {
        const durationMs = new Date().getTime() - livestream.startedAt.getTime();
        updateData.duration = Math.floor(durationMs / 1000);
      }
    }

    return await this.prisma.postgres.liveStream.update({ where: { id }, data: updateData });
  }

  async getTeacherLivestreams(teacherId: string, status?: string) {
    const where: any = { teacherId };

    if (status && ['SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED'].includes(status)) {
      where.status = status;
    }

    return await this.prisma.postgres.liveStream.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { schedule: true },
    });
  }

  async getActiveLivestreams() {
    const livestreams = await this.prisma.postgres.liveStream.findMany({
      where: { status: LiveStreamStatus.LIVE, isPublic: true, isApprove: 'TRUE' },
      include: {
        teacher: { select: { id: true, fullName: true, avatar: true } },
      },
      orderBy: { currentViewers: 'desc' },
    });

    return livestreams.map((stream) => ({
      id: stream.id,
      title: stream.title,
      description: stream.description,
      teacherId: stream.teacherId,
      teacher: { id: stream.teacher.id, fullName: stream.teacher.fullName, avatar: stream.teacher.avatar },
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

    const livestream = await this.prisma.postgres.liveStream.findUnique({ where: { id } });

    if (!livestream) throw new Error('Livestream not found');

    const startedAt = livestream.startedAt || livestream.createdAt;
    const endedAt = new Date();
    const durationMs = endedAt.getTime() - startedAt.getTime();
    const duration = Math.floor(durationMs / 1000);

    const currentViewers = livestream.currentViewers || 0;
    const peakViewers = Math.max(livestream.peakViewers || 0, currentViewers);
    const totalViews = (livestream.totalViews || 0) + currentViewers;

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
      const livestream = await this.prisma.postgres.liveStream.findUnique({ where: { id } });

      if (!livestream) throw new NotFoundException('Livestream not found');

      const peakViewers = Math.max(livestream.peakViewers || 0, totalViewers);

      const updatedLivestream = await this.prisma.postgres.liveStream.update({
        where: { id },
        data: { currentViewers: totalViewers, peakViewers },
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
      return { success: true, chunkIndex, totalSize };
    } catch (error) {
      this.logger.error(`Failed to save recording chunk:`, error);
      throw error;
    }
  }

  async uploadRecordingChunk(livestreamId: string, chunk: string, chunkIndex: number, totalChunks: number, chunkSize: number) {
    try {
      if (chunkIndex === totalChunks - 1) {
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

      const magicBytes = videoBuffer.slice(0, 4).toString('hex');
      console.log(`[Service] File magic bytes: ${magicBytes} (should be 1a45dfa3 for WebM)`);

      const videoStream = Readable.from(videoBuffer);

      console.log(`[Service] Uploading to R2...`);
      const videoUrl = await this.r2StorageService.uploadVideo(livestreamId, videoStream, {
        uploadedAt: new Date().toISOString(),
        duration: duration?.toString() || 'unknown',
      });
      console.log(`[Service] R2 upload complete: ${videoUrl}`);

      console.log(`[Service] Updating livestream record with duration=${duration}s...`);
      const updatedLivestream = await this.prisma.postgres.liveStream.update({
        where: { id: livestreamId },
        data: {
          recordingUrl: videoUrl,
          isRecorded: true,
          isApprove: 'FALSE',
          duration: duration || 0,
          processingStatus: 'PENDING',
        },
      });
      console.log(`[Service] Livestream updated successfully`);

      await this.processingService.enqueue({
        type: 'livestream',
        itemId: livestreamId,
        fileUrl: videoUrl,
        title: updatedLivestream.title,
      });

      this.logger.log(`Recording uploaded: ${videoUrl}`);
      return { success: true, url: videoUrl };
    } catch (error) {
      console.error(`[Service] uploadRecording ERROR:`, error);
      this.logger.error(`Failed to upload recording:`, error);
      throw error;
    }
  }

  private async deleteRecordingAiAnalysis(recordingId: string): Promise<void> {
    await this.prisma.mongo.$runCommandRaw({
      delete: this.aiTranscriptSummaryCollection,
      deletes: [{ q: { type: 'LIVESTREAM', recordingId }, limit: 0 }],
    });
  }

  async deleteRecording(recordingId: string) {
    const livestream = await this.prisma.postgres.liveStream.findUnique({
      where: { id: recordingId },
      select: { id: true, recordingUrl: true },
    });

    if (!livestream) throw new NotFoundException('Livestream not found');

    if (livestream.recordingUrl) {
      try {
        await this.r2StorageService.deleteVideo(recordingId);
      } catch {
        this.logger.warn(`Failed to delete recording file from R2 for livestream ${recordingId}`);
      }
    }

    await this.deleteRecordingAiAnalysis(recordingId).catch(() => undefined);

    await this.prisma.postgres.liveStream.update({
      where: { id: recordingId },
      data: { recordingUrl: null, isRecorded: false, processingStatus: 'PENDING' },
    });

    return { success: true, message: 'Recording deleted', livestreamId: recordingId };
  }

  async updateRecordingDuration(livestreamId: string, duration: number) {
    try {
      await this.prisma.postgres.liveStream.update({
        where: { id: livestreamId },
        data: { duration },
      });
    } catch (error) {
      this.logger.error(`Failed to update recording duration:`, error);
    }
  }

  async createSchedule(createScheduleDto: CreateScheduleDto) {
    const { teacherId, title, startTime, endTime, livestreamId, isPublic, category, ...rest } = createScheduleDto;

    const teacher = await this.prisma.postgres.user.findUnique({
      where: { id: teacherId },
      select: { id: true, role: true, avatar: true },
    });

    if (!teacher || teacher.role !== 'TEACHER') {
      throw new BadRequestException('Invalid teacher ID');
    }

    let finalLivestreamId = livestreamId;

    if (livestreamId) {
      const livestream = await this.prisma.postgres.liveStream.findUnique({ where: { id: livestreamId } });

      if (!livestream) throw new NotFoundException('Livestream not found');
      if (livestream.teacherId !== teacherId) throw new BadRequestException('Livestream does not belong to this teacher');
    } else {
      const thumbnail = teacher.avatar || '/logo.png';

      const newLivestream = await this.prisma.postgres.liveStream.create({
        data: {
          teacherId,
          title,
          description: '',
          category: category || null,
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

    const schedule = await this.prisma.postgres.schedule.create({ data: scheduleData });

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
            teacher: { select: { id: true, fullName: true, avatar: true } },
          },
        },
      },
    });

    if (!schedule) throw new NotFoundException('Schedule not found');

    const notification = await this.prisma.mongo.scheduleNotification.findUnique({
      where: { scheduleId: id },
    });

    return { ...schedule, analytics: notification || null };
  }

  async getTeacherSchedules(teacherId: string, includeCompleted = false, startDate?: string, endDate?: string) {
    const whereClause: any = { teacherId };

    if (!includeCompleted) {
      whereClause.status = { in: [ScheduleStatus.SCHEDULED, ScheduleStatus.IN_PROGRESS] };
    }

    if (startDate || endDate) {
      whereClause.startTime = {};
      if (startDate) whereClause.startTime.gte = new Date(startDate);
      if (endDate) whereClause.startTime.lte = new Date(endDate);
    }

    return await this.prisma.postgres.schedule.findMany({
      where: whereClause,
      include: { liveStream: true },
      orderBy: { startTime: 'asc' },
    });
  }

  async getUpcomingSchedules(limit = 10, userId?: string) {
    const now = new Date();

    const whereClause: any = {
      startTime: { gte: now },
      status: ScheduleStatus.SCHEDULED,
    };

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
                teacherProfile: { select: { subjects: true, rating: true } },
              },
            },
          },
        },
      },
      orderBy: { startTime: 'asc' },
      take: limit,
    });

    if (userId) {
      const student = await this.prisma.postgres.user.findUnique({
        where: { id: userId },
        include: {
          studentProfile: {
            include: { followedTeachers: { select: { teacherId: true } } },
          },
        },
      });

      const followedTeacherIds = student?.studentProfile?.followedTeachers.map((f) => f.teacherId) || [];

      return schedules.filter(
        (schedule) => schedule.isPublic || followedTeacherIds.includes(schedule.teacherId),
      );
    }

    return schedules;
  }

  async updateSchedule(id: string, updateScheduleDto: UpdateScheduleDto) {
    const schedule = await this.prisma.postgres.schedule.findUnique({ where: { id } });

    if (!schedule) throw new NotFoundException('Schedule not found');

    const updateData: any = { ...updateScheduleDto };

    if (updateScheduleDto.status === ScheduleStatus.CANCELLED) {
      updateData.cancelledAt = new Date();
    }

    if (updateScheduleDto.startTime) updateData.startTime = new Date(updateScheduleDto.startTime);
    if (updateScheduleDto.endTime) updateData.endTime = new Date(updateScheduleDto.endTime);

    const updatedSchedule = await this.prisma.postgres.schedule.update({ where: { id }, data: updateData });

    this.logger.log(`Schedule ${id} updated`);
    return updatedSchedule;
  }

  async deleteSchedule(id: string) {
    const schedule = await this.prisma.postgres.schedule.findUnique({ where: { id } });

    if (!schedule) throw new NotFoundException('Schedule not found');

    await this.prisma.mongo.scheduleNotification.deleteMany({ where: { scheduleId: id } });
    await this.prisma.postgres.schedule.delete({ where: { id } });

    this.logger.log(`Schedule ${id} deleted`);
    return { success: true };
  }

  async registerAttendee(scheduleId: string, userId: string) {
    const schedule = await this.prisma.postgres.schedule.findUnique({ where: { id: scheduleId } });

    if (!schedule) throw new NotFoundException('Schedule not found');
    if (schedule.status !== ScheduleStatus.SCHEDULED) throw new BadRequestException('Cannot register for this schedule');

    const notification = await this.prisma.mongo.scheduleNotification.findUnique({ where: { scheduleId } });

    if (notification) {
      const alreadyRegistered = notification.attendees.some((attendee: any) => attendee.userId === userId);

      if (alreadyRegistered) throw new BadRequestException('Already registered for this schedule');

      await this.prisma.mongo.scheduleNotification.update({
        where: { scheduleId },
        data: {
          attendees: { push: { userId, registeredAt: new Date(), attended: false } },
          registeredCount: { increment: 1 },
        },
      });
    }

    this.logger.log(`User ${userId} registered for schedule ${scheduleId}`);
    return { success: true };
  }

  async getTopLivestreams(limit: number = 10) {
    const livestreams = await this.prisma.postgres.liveStream.findMany({
      where: {
        isPublic: true,
        isApprove: 'TRUE',
        OR: [{ status: LiveStreamStatus.LIVE }, { status: LiveStreamStatus.ENDED }],
      },
      include: { teacher: { select: { id: true, fullName: true, avatar: true } } },
      orderBy: [{ status: 'asc' }, { totalViews: 'desc' }],
      take: limit,
    });

    return livestreams.map((stream) => ({
      id: stream.id,
      title: stream.title,
      description: stream.description,
      teacher: { id: stream.teacher.id, fullName: stream.teacher.fullName, avatar: stream.teacher.avatar },
      viewCount: stream.totalViews,
      currentViewers: stream.currentViewers,
      thumbnailUrl: stream.thumbnail,
      isLive: stream.status === LiveStreamStatus.LIVE,
      status: stream.status,
      category: stream.category,
      startedAt: stream.startedAt,
    }));
  }

  async getTrendingVideos(limit: number = 10) {
    const videos = await this.prisma.postgres.liveStream.findMany({
      where: { status: LiveStreamStatus.ENDED, isPublic: true, isApprove: 'TRUE', recordingUrl: { not: null } },
      include: { teacher: { select: { id: true, fullName: true, avatar: true } } },
      orderBy: [{ endedAt: 'desc' }, { totalViews: 'desc' }],
      take: limit,
    });

    return videos.map((video) => ({
      id: video.id,
      title: video.title,
      description: video.description,
      teacher: { id: video.teacher.id, fullName: video.teacher.fullName, avatar: video.teacher.avatar },
      viewCount: video.totalViews,
      thumbnailUrl: video.thumbnail,
      duration: video.duration,
      recordingUrl: video.recordingUrl,
      uploadedAt: video.endedAt,
      category: video.category,
    }));
  }

  async getRecordedLivestreams(limit: number = 20, category?: string) {
    const normalizedCategory = category?.trim();

    const videos = await this.prisma.postgres.liveStream.findMany({
      where: {
        status: LiveStreamStatus.ENDED,
        isPublic: true,
        isApprove: 'TRUE',
        recordingUrl: { not: null },
        ...(normalizedCategory
          ? {
              OR: [
                { category: { equals: normalizedCategory, mode: 'insensitive' } },
                { category: { contains: normalizedCategory, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: { teacher: { select: { id: true, fullName: true, avatar: true } } },
      orderBy: [{ endedAt: 'desc' }, { totalViews: 'desc' }],
      take: limit,
    });

    return videos.map((video) => ({
      id: video.id,
      title: video.title,
      description: video.description,
      teacherId: video.teacherId,
      teacher: { id: video.teacher.id, fullName: video.teacher.fullName, avatar: video.teacher.avatar },
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

  async getTeacherRecordedLivestreams(teacherId: string, limit: number = 50) {
    return await this.prisma.postgres.liveStream.findMany({
      where: { teacherId, status: LiveStreamStatus.ENDED, recordingUrl: { not: null } },
      select: {
        id: true, title: true, description: true, category: true, thumbnail: true,
        recordingUrl: true, status: true, totalViews: true, duration: true,
        createdAt: true, startedAt: true, endedAt: true, currentViewers: true,
        peakViewers: true, isRecorded: true, isApprove: true, isPublic: true,
      },
      orderBy: [{ endedAt: 'desc' }],
      take: limit,
    });
  }

  async getTeacherEndedLivestreams(teacherId: string, limit: number = 50) {
    return await this.prisma.postgres.liveStream.findMany({
      where: { teacherId, status: LiveStreamStatus.ENDED },
      select: {
        id: true, title: true, description: true, category: true, thumbnail: true,
        recordingUrl: true, status: true, totalViews: true, duration: true,
        createdAt: true, startedAt: true, endedAt: true, currentViewers: true,
        peakViewers: true, isRecorded: true, isApprove: true, isPublic: true,
      },
      orderBy: [{ endedAt: 'desc' }],
      take: limit,
    });
  }

  async getUpcomingScheduledStreams(limit: number = 20) {
    const now = new Date();

    const scheduled = await this.prisma.postgres.liveStream.findMany({
      where: { status: LiveStreamStatus.SCHEDULED, isPublic: true, scheduledAt: { gte: now } },
      include: { teacher: { select: { id: true, fullName: true, avatar: true } } },
      orderBy: { scheduledAt: 'asc' },
      take: limit,
    });

    return scheduled.map((stream) => ({
      id: stream.id,
      title: stream.title,
      description: stream.description,
      teacherId: stream.teacherId,
      teacher: { id: stream.teacher.id, fullName: stream.teacher.fullName, avatar: stream.teacher.avatar },
      totalViews: stream.totalViews,
      thumbnailUrl: stream.thumbnail,
      status: stream.status,
      category: stream.category,
      scheduledStartTime: stream.scheduledAt,
    }));
  }

  async incrementViewCount(id: string) {
    return await this.prisma.postgres.liveStream.update({
      where: { id },
      data: { totalViews: { increment: 1 } },
    });
  }

  async reportWatch(id: string, viewerId?: string, watchedSeconds?: number, duration?: number) {
    const watched = typeof watchedSeconds === 'number' ? watchedSeconds : 0;
    const total = typeof duration === 'number' ? duration : 0;

    if (total <= 0) return { counted: false, reason: 'invalid_duration' };

    const ratio = watched / total;
    if (ratio <= 2 / 3) return { counted: false, reason: 'below_threshold', ratio };

    if (viewerId) {
      const alreadyCounted = await this.redisService.hasCountedView('video', id, viewerId);
      if (alreadyCounted) return { counted: false, reason: 'already_counted' };
    }

    const updated = await this.prisma.postgres.liveStream.update({
      where: { id },
      data: { totalViews: { increment: 1 } },
      select: { id: true, totalViews: true },
    });

    if (viewerId) {
      await this.redisService.markCountedView('video', id, viewerId, 30);
    }

    return { counted: true, totalViews: updated.totalViews, ratio };
  }

  async updateCurrentViewers(id: string, count: number) {
    const livestream = await this.prisma.postgres.liveStream.findUnique({ where: { id } });

    if (!livestream) throw new NotFoundException('Livestream not found');

    const peakViewers = Math.max(livestream.peakViewers || 0, count);

    return await this.prisma.postgres.liveStream.update({
      where: { id },
      data: { currentViewers: count, peakViewers },
    });
  }

  async autoCheckAndCancelExpiredLivestreams(teacherId: string) {
    const now = new Date();

    const expiredLivestreams = await this.prisma.postgres.liveStream.findMany({
      where: { teacherId, status: LiveStreamStatus.SCHEDULED, scheduledAt: { lt: now } },
    });

    for (const livestream of expiredLivestreams) {
      await this.prisma.postgres.liveStream.update({
        where: { id: livestream.id },
        data: { status: LiveStreamStatus.CANCELLED },
      });

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
        data: { livestreamId, userId, username, userAvatar: userAvatar || null, message, type: type as any },
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
      return await this.prisma.mongo.liveStreamChat.findMany({
        where: { livestreamId },
        orderBy: { createdAt: 'asc' },
        take: limit,
      });
    } catch (error) {
      this.logger.error(`Failed to fetch chat messages: ${error}`);
      throw new BadRequestException('Failed to fetch chat messages');
    }
  }

  async updateLivestream(id: string, updateData: { description?: string; isPublic?: boolean }) {
    const livestream = await this.prisma.postgres.liveStream.findUnique({ where: { id } });

    if (!livestream) throw new NotFoundException('Livestream not found');

    const updatedLivestream = await this.prisma.postgres.liveStream.update({ where: { id }, data: updateData });

    this.logger.log(`Livestream ${id} updated`);
    return updatedLivestream;
  }

  async getRelatedVideos(videoId: string, limit: number = 10) {
    const currentVideo = await this.prisma.postgres.liveStream.findUnique({
      where: { id: videoId },
      select: { teacherId: true, category: true, endedAt: true },
    });

    if (!currentVideo || !currentVideo.endedAt) return [];

    const allVideos = await this.prisma.postgres.liveStream.findMany({
      where: { id: { not: videoId }, status: LiveStreamStatus.ENDED, recordingUrl: { not: null }, isPublic: true },
      select: {
        id: true, title: true, thumbnail: true, category: true, teacherId: true,
        totalViews: true, duration: true, endedAt: true,
        teacher: { select: { id: true, fullName: true, avatar: true } },
      },
      take: 200,
    });

    const scoredVideos = allVideos.map((video) => {
      let score = 0;

      if (video.teacherId === currentVideo.teacherId) score += 50;
      if (video.category === currentVideo.category) score += 30;

      if (video.teacherId === currentVideo.teacherId && video.endedAt && currentVideo.endedAt) {
        const timeDiff = Math.abs(new Date(video.endedAt).getTime() - new Date(currentVideo.endedAt).getTime());
        const daysDiff = timeDiff / (1000 * 60 * 60 * 24);

        if (daysDiff <= 7) score += 20 - daysDiff * 2;
        else if (daysDiff <= 30) score += 10 - daysDiff / 3;
      }

      score += Math.min(10, (video.totalViews || 0) / 1000);

      return { ...video, score };
    });

    const sortedVideos = scoredVideos.sort((a, b) => b.score - a.score);
    let relatedVideos = sortedVideos.slice(0, limit);

    if (relatedVideos.length < limit) {
      const relatedIds = new Set(relatedVideos.map((v) => v.id));
      const remainingVideos = sortedVideos
        .filter((v) => !relatedIds.has(v.id))
        .sort(() => Math.random() - 0.5)
        .slice(0, limit - relatedVideos.length);
      relatedVideos = [...relatedVideos, ...remainingVideos];
    }

    return relatedVideos.map(({ score, ...video }) => video);
  }

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
          livestreamId, studentId, author,
          authorAvatar: authorAvatar || null,
          content, likes: 0, dislikes: 0, likedBy: [], dislikedBy: [],
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
      return await this.prisma.mongo.videoComment.findMany({
        where: { livestreamId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
    } catch (error) {
      this.logger.error(`Failed to fetch video comments: ${error}`);
      throw new BadRequestException('Failed to fetch video comments');
    }
  }

  async addCommentReaction(commentId: string, studentId: string, reactionType: 'like' | 'dislike') {
    try {
      const comment = await this.prisma.mongo.videoComment.findUnique({ where: { id: commentId } });

      if (!comment) throw new NotFoundException('Comment not found');

      let likedBy = [...(comment.likedBy || [])];
      let dislikedBy = [...(comment.dislikedBy || [])];
      let likes = comment.likes;
      let dislikes = comment.dislikes;

      if (reactionType === 'like') {
        if (likedBy.includes(studentId)) {
          likedBy = likedBy.filter((id) => id !== studentId);
          likes = Math.max(0, likes - 1);
        } else {
          likedBy.push(studentId);
          likes += 1;
          if (dislikedBy.includes(studentId)) {
            dislikedBy = dislikedBy.filter((id) => id !== studentId);
            dislikes = Math.max(0, dislikes - 1);
          }
        }
      } else if (reactionType === 'dislike') {
        if (dislikedBy.includes(studentId)) {
          dislikedBy = dislikedBy.filter((id) => id !== studentId);
          dislikes = Math.max(0, dislikes - 1);
        } else {
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
        data: { likes, dislikes, likedBy, dislikedBy },
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
      const comment = await this.prisma.mongo.videoComment.findUnique({ where: { id: commentId } });

      if (!comment) throw new NotFoundException('Comment not found');
      if (comment.studentId !== studentId) throw new UnauthorizedException('You can only delete your own comments');

      await this.prisma.mongo.videoComment.delete({ where: { id: commentId } });

      this.logger.log(`Comment ${commentId} deleted by student ${studentId}`);
      return { message: 'Comment deleted successfully' };
    } catch (error) {
      this.logger.error(`Failed to delete video comment: ${error}`);
      throw new BadRequestException('Failed to delete video comment');
    }
  }

  async saveVideoReaction(livestreamId: string, studentId: string, reactionType: 'like' | 'dislike') {
    try {
      const existingReaction = await this.prisma.mongo.videoReaction.findUnique({
        where: { livestreamId_studentId: { livestreamId, studentId } },
      });

      if (existingReaction) {
        if (existingReaction.reactionType === reactionType) {
          await this.prisma.mongo.videoReaction.delete({ where: { id: existingReaction.id } });
          this.logger.log(`Reaction removed for video ${livestreamId} by student ${studentId}`);
          return { reactionType: null };
        } else {
          const updated = await this.prisma.mongo.videoReaction.update({
            where: { id: existingReaction.id },
            data: { reactionType },
          });
          this.logger.log(`Reaction updated for video ${livestreamId} by student ${studentId}`);
          return { reactionType: updated.reactionType };
        }
      }

      const newReaction = await this.prisma.mongo.videoReaction.create({
        data: { livestreamId, studentId, reactionType },
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
        where: { livestreamId_studentId: { livestreamId, studentId } },
      });
      return reaction ? { reactionType: reaction.reactionType } : { reactionType: null };
    } catch (error) {
      this.logger.error(`Failed to fetch video reaction: ${error}`);
      throw new BadRequestException('Failed to fetch video reaction');
    }
  }

  async getVideoReactionStats(livestreamId: string) {
    try {
      const reactions = await this.prisma.mongo.videoReaction.findMany({ where: { livestreamId } });
      const likes = reactions.filter((r: { reactionType?: string }) => r.reactionType === 'like').length;
      const dislikes = reactions.filter((r: { reactionType?: string }) => r.reactionType === 'dislike').length;
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
    const {
      transcriptStatus: _transcriptStatus,
      transcriptError: _transcriptError,
      processingProgress: _processingProgress,
      processingError: _processingError,
      ...mongoPayload
    } = payload;

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
              ...mongoPayload,
              updatedAt: new Date(),
            },
            $setOnInsert: {
              id: recordingId,
              type: 'LIVESTREAM',
              recordingId,
              documentId: null,
              createdAt: new Date(),
            },
          },
          upsert: true,
        },
      ],
    });
  }

  private async updateRecordingProcessingState(
    recordingId: string,
    payload: Partial<AiTranscriptSummaryDocument>,
  ): Promise<void> {
    await this.upsertRecordingAiAnalysis(recordingId, payload);
  }

  private async updateRecordingProcessingStatus(recordingId: string, status: 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED'): Promise<void> {
    await this.prisma.postgres.liveStream.update({
      where: { id: recordingId },
      data: { processingStatus: status },
    });
  }

  private extractTranscriptFromPayload(payload: unknown): Prisma.JsonValue | null {
    if (typeof payload === 'string') return payload.trim() || null;
    if (!payload || typeof payload !== 'object') return null;

    const data = payload as Record<string, unknown>;
    const nestedData = data.data && typeof data.data === 'object' ? (data.data as Record<string, unknown>) : null;
    const nestedCandidate = nestedData?.result ?? nestedData?.text ?? nestedData?.transcript;
    const transcriptCandidate = data.text ?? data.transcript ?? data.result ?? nestedCandidate;

    if (typeof transcriptCandidate === 'string') return transcriptCandidate.trim() || null;
    if (transcriptCandidate && typeof transcriptCandidate === 'object') return transcriptCandidate as Prisma.JsonValue;

    return null;
  }

  private getTranscriptText(transcript: Prisma.JsonValue | null | undefined): string | null {
    if (typeof transcript === 'string') return transcript.trim() || null;
    if (!transcript) return null;

    if (typeof transcript === 'object') {
      const data = transcript as Record<string, unknown>;
      const directTextCandidate = data.full_text ?? data.text;
      if (typeof directTextCandidate === 'string') return directTextCandidate.trim() || null;

      const resultCandidate = data.result;
      if (resultCandidate && typeof resultCandidate === 'object') {
        const resultData = resultCandidate as Record<string, unknown>;
        const resultText = resultData.full_text ?? resultData.text;
        if (typeof resultText === 'string') return resultText.trim() || null;
      }

      if (Array.isArray(data.timestamps)) {
        const joined = data.timestamps
          .map((segment) => {
            if (!segment || typeof segment !== 'object') return '';
            const s = segment as Record<string, unknown>;
            return typeof s.text === 'string' ? s.text.trim() : '';
          })
          .filter(Boolean)
          .join('\n')
          .trim();
        if (joined) return joined;
      }

      if (Array.isArray(data.segments)) {
        const joined = data.segments
          .map((segment) => {
            if (!segment || typeof segment !== 'object') return '';
            const s = segment as Record<string, unknown>;
            return typeof s.text === 'string' ? s.text.trim() : '';
          })
          .filter(Boolean)
          .join('\n')
          .trim();
        if (joined) return joined;
      }
    }

    return null;
  }

  private extractAiErrorFromPayload(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') return null;

    const data = payload as Record<string, unknown>;
    if (data.status !== 'error') return null;

    const errorValue = data.error;
    if (typeof errorValue === 'string') return errorValue.trim() || null;

    if (errorValue && typeof errorValue === 'object') {
      const errorData = errorValue as Record<string, unknown>;
      const message = errorData.message ?? errorData.detail ?? errorData.error;
      if (typeof message === 'string') return message.trim() || null;
    }

    return 'Unknown error from transcribe service';
  }

  private extractSummaryFromPayload(payload: unknown): string | null {
    if (typeof payload === 'string') return payload.trim() || null;
    if (!payload || typeof payload !== 'object') return null;

    const data = payload as Record<string, unknown>;
    const summaryCandidate = data.summary || data.result || data.text;
    if (typeof summaryCandidate === 'string') return summaryCandidate.trim() || null;

    return null;
  }

  async getRecordingAiAnalysis(recordingId: string) {
    const analysis = await this.getRecordingAiAnalysisDocument(recordingId);

    return {
      recordingId,
      transcript: analysis?.transcript || null,
      summary: analysis?.summary || undefined,
      audioUrl: analysis?.audioUrl || null,
      moderationResult: analysis?.moderationResult || null,
      ...this.getModerationSnapshot(analysis?.moderationResult),
      transcriptStatus: analysis?.transcriptStatus || 'idle',
      transcriptError: analysis?.transcriptError || null,
      transcriptGeneratedAt: analysis?.transcriptGeneratedAt || null,
      summaryGeneratedAt: analysis?.summaryGeneratedAt || null,
      processingProgress: analysis?.processingProgress ?? 0,
      processingError: analysis?.processingError || null,
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
      await this.replaceRecordingAiAnalysisWithModeration(recordingId, moderationResult);
      const moderationSnapshot = this.getModerationSnapshot(moderationResult as Prisma.JsonValue);
      const moderationStatus = moderationSnapshot.moderationLabel;

      if (moderationStatus === 'SAFE') {
        await this.prisma.postgres.liveStream.update({
          where: { id: recordingId },
          data: { isApprove: 'TRUE' },
        }).catch(() => undefined);
      }

      return {
        ...analysis,
        moderationResult,
        score: moderationSnapshot.validationRate,
        toxicWords: moderationSnapshot.toxicWords,
        status: moderationStatus,
        label: moderationStatus,
        categories: moderationSnapshot.moderationCategories,
        processingProgress: analysis.processingProgress ?? 0,
        processingError: analysis.processingError || null,
      };
    }

    const moderationSnapshot = this.getModerationSnapshot(analysis.moderationResult);

    return {
      ...analysis,
      score: moderationSnapshot.validationRate,
      toxicWords: moderationSnapshot.toxicWords,
      status: moderationSnapshot.moderationLabel,
      label: moderationSnapshot.moderationLabel,
      categories: moderationSnapshot.moderationCategories,
      moderationResult: null,
      processingProgress: analysis.processingProgress ?? 0,
      processingError: analysis.processingError || null,
    };
  }

  private async downloadToBuffer(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) throw new BadRequestException(`Cannot download file: ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }

  async generateRecordingTranscript(recordingId: string, force = false) {
    this.logger.log(`[Transcribe] generateRecordingTranscript start recordingId=${recordingId} force=${force}`);

    const livestream = await this.prisma.postgres.liveStream.findUnique({
      where: { id: recordingId },
      select: { id: true, recordingUrl: true },
    });

    if (!livestream) throw new NotFoundException('Recording not found');
    if (!livestream.recordingUrl) throw new BadRequestException('Recording URL is missing, cannot transcribe');

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
          await this.replaceRecordingAiAnalysisWithModeration(recordingId, moderation);
        }
      } catch (err) {
        this.logger.warn('Moderation failed for recording', String(err));
      }

      return { ...(await this.getRecordingAiAnalysis(recordingId)), cached: true };
    }

    if (!force && existing?.transcriptStatus === 'processing') {
      return { ...(await this.getRecordingAiAnalysis(recordingId)), cached: true };
    }

    try {
      await this.updateRecordingProcessingStatus(recordingId, 'PROCESSING');
      await this.upsertRecordingAiAnalysis(recordingId, {
        transcriptStatus: 'processing',
        transcriptError: null,
        processingProgress: PROCESSING_STAGE_PROGRESS.preparing,
        processingError: null,
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
            if (!ffmpegPath) {
              reject(new Error('FFmpeg binary not found'));
              return;
            }

            this.logger.log(`Using FFmpeg binary: ${ffmpegPath}`);

            const ffmpeg = spawn(ffmpegPath as string, [
              '-y', '-i', inputPath, '-vn', '-ac', '1', '-ar', '16000', '-f', 'wav', outputPath,
            ]);

            let stderr = '';
            ffmpeg.stderr.on('data', (chunk) => {
              const message = chunk.toString();
              stderr += message;
              this.logger.debug(`[FFmpeg] ${message}`);
            });
            ffmpeg.on('error', (err) => { this.logger.error('FFmpeg spawn error', err); reject(err); });
            ffmpeg.on('close', (code) => {
              this.logger.log(`FFmpeg exited with code ${code}`);
              if (code === 0) resolve();
              else reject(new Error(`FFmpeg failed (${code}): ${stderr}`));
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

      if (!audioBuffer) throw new BadRequestException('Audio export failed, cannot transcribe');

      const formData = new FormData();
      const audioBytes = new Uint8Array(audioBuffer);
      formData.append('file', new Blob([audioBytes], { type: 'audio/wav' }), `${recordingId}.wav`);

      const aiResponse = await (await import('../utils/aiFetch')).logStreamingTranscribe(
        `${this.requireAiServiceUrl()}/transcribe`,
        {
          method: 'POST',
          body: formData,
          timeoutMs: 30 * 60 * 1000,
        },
        this.logger as any,
      );

      const transcript = this.extractTranscriptFromPayload(aiResponse.data);

      if (!transcript) {
        await this.upsertRecordingAiAnalysis(recordingId, {
          transcriptStatus: 'error',
          transcriptError: 'Transcribe service returned empty transcript',
          processingProgress: PROCESSING_STAGE_PROGRESS.transcribing,
          processingError: 'Transcribe service returned empty transcript',
        });
        throw new BadRequestException('Transcribe service returned empty transcript');
      }

      await this.upsertRecordingAiAnalysis(recordingId, {
        transcriptStatus: 'success',
        transcriptError: null,
        transcript,
        audioUrl: audioUrl || undefined,
        transcriptGeneratedAt: new Date(),
        processingProgress: PROCESSING_STAGE_PROGRESS.summarizing,
        processingError: null,
      });

      try {
        await this.generateRecordingSummary(recordingId, false);
      } catch (summaryErr) {
        this.logger.warn('Summary failed for recording', String(summaryErr));
      }

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

      return { ...analysis, cached: false };
    } catch (err: unknown) {
      await this.upsertRecordingAiAnalysis(recordingId, {
        transcriptStatus: 'error',
        transcriptError: err instanceof Error ? err.message : String(err),
        processingProgress: PROCESSING_STAGE_PROGRESS.error,
        processingError: err instanceof Error ? err.message : String(err),
      }).catch(() => undefined);
      await this.updateRecordingProcessingStatus(recordingId, 'FAILED').catch(() => undefined);

      this.logger.error(`[TRANSCRIPT ERROR] RecordingID: ${recordingId}, Error: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  }

  async generateRecordingSummary(recordingId: string, force = false) {
    const existing = await this.getRecordingAiAnalysisDocument(recordingId);

    const transcript = existing?.transcript || null;
    if (!transcript) {
      return await this.generateRecordingTranscript(recordingId, false);
    }

    const transcriptText = this.getTranscriptText(transcript);
    if (!transcriptText) {
      throw new BadRequestException('Transcript is required before summarizing');
    }

    await this.updateRecordingProcessingState(recordingId, {
      processingProgress: PROCESSING_STAGE_PROGRESS.summarizing,
      processingError: null,
    });

    const aiResponse = await fetch(`${this.requireAiServiceUrl()}/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: transcriptText }),
    });

    if (!aiResponse.ok) {
      const errorBody = await aiResponse.text();
      throw new BadRequestException(`Summarize service error (${aiResponse.status}): ${errorBody}`);
    }

    const aiPayload = await aiResponse.json();
    const summary = this.extractSummaryFromPayload(aiPayload);

    if (!summary) throw new BadRequestException('Summarize service returned empty summary');

    await this.upsertRecordingAiAnalysis(recordingId, {
      summary,
      summaryGeneratedAt: new Date(),
      processingProgress: PROCESSING_STAGE_PROGRESS.moderating,
      processingError: null,
    });

    try {
      const text = this.getTranscriptText(transcript);
      if (text) {
        this.logger.log(`[Moderation] Recording ${recordingId} - invoking moderation API after summarization; textLen=${text.length}`);
      }
      const moderation = await this.callModerationApi(text || '');

      if (moderation) {
        await this.replaceRecordingAiAnalysisWithModeration(recordingId, moderation);

        const moderationStatus = typeof moderation.status === 'string' ? moderation.status : null;

        if (moderationStatus === 'SAFE') {
          await this.prisma.postgres.liveStream.update({
            where: { id: recordingId },
            data: { isApprove: 'TRUE' },
          }).catch(() => undefined);
        }

        await this.updateRecordingProcessingState(recordingId, {
          processingProgress: PROCESSING_STAGE_PROGRESS.done,
          processingError: null,
        });
        await this.updateRecordingProcessingStatus(recordingId, 'DONE').catch(() => undefined);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn('Moderation failed for recording', message);
      await this.updateRecordingProcessingState(recordingId, {
        processingProgress: PROCESSING_STAGE_PROGRESS.moderating,
        processingError: message,
      }).catch(() => undefined);
      await this.updateRecordingProcessingStatus(recordingId, 'FAILED').catch(() => undefined);
    }

    return { ...(await this.getRecordingAiAnalysis(recordingId)), cached: false };
  }
}