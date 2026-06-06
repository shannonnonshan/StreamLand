import { Injectable, ConflictException, NotFoundException, BadRequestException, UnauthorizedException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLivestreamDto } from './dto/create-livestream.dto';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { Prisma, LiveStreamStatus, ScheduleStatus } from '@prisma/client';
import { R2StorageService } from '../r2-storage/r2-storage.service';
import { RedisService } from '../redis/redis.service';
import { ProcessingService } from '../processing/processing.service';
import { ProcessingStateService } from '../processing/processing-state.service';
import { Readable } from 'stream';
import { createWriteStream, promises as fs } from 'fs';
import { spawn } from 'child_process';
// Try to use ffmpeg-static when available to avoid ENOENT if ffmpeg not installed on system
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffmpegStaticPath: string | null = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('ffmpeg-static');
  } catch (err) {
    return null;
  }
})();
import { pipeline } from 'stream/promises';
import * as os from 'os';
import * as path from 'path';
import logFetch from '../utils/aiFetch';
import { PROCESSING_STAGE_PROGRESS, ProcessingStage } from '../processing/processing.types';
import { NotificationService } from '../notification/notification.service';
import { normalizeVideoCategory } from '../common/constants/video-categories';

export interface AiTranscriptSummaryDocument {
  id?: string;
  type: 'LIVESTREAM' | 'DOCUMENT';
  recordingId?: string;
  documentId?: string;
  transcriptStatus?: 'idle' | 'processing' | 'success' | 'error';
  transcriptError?: string | null;
  transcript?: Prisma.JsonValue;
  summary?: string | null;
  moderationResult?: Prisma.JsonValue;
  moderationCheckedAt?: Date | null;
  transcriptGeneratedAt?: Date | null;
  summaryGeneratedAt?: Date | null;
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
    private processingStateService: ProcessingStateService,
    private notificationService: NotificationService,
  ) {}

  private sleep(ms: number) {
    return new Promise((res) => setTimeout(res, ms));
  }

  private async invalidateTeacherScheduleCaches(teacherId: string) {
    await this.redisService.deleteByPattern(`teacher:${teacherId}:schedules:*`);
  }

  private requireAiServiceUrl(): string {
    if (!this.aiServiceUrl) {
      throw new BadRequestException('AI_SERVICE_URL is not configured');
    }

    return this.aiServiceUrl;
  }

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

  private async normalizeTranscriptContent(transcript: unknown): Promise<string> {
    const text = this.getTranscriptText(transcript as Prisma.JsonValue | null | undefined);
    return text || '';
  }

  private normalizeModerationStatus(status: unknown): string | undefined {
    if (typeof status !== 'string') {
      return undefined;
    }

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

    if (!trimmed) {
      return false;
    }

    if (/\s{2,}/.test(trimmed)) {
      return false;
    }

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
    if (!payload || typeof payload !== 'object') {
      return null;
    }

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

    if (!status && score === undefined && !categories && toxicWord.length === 0) {
      return null;
    }

    return {
      status,
      score,
      categories,
      toxic_word: toxicWord,
    };
  }
  private async callModerationApi(
    transcript: unknown,
  ): Promise<ModerationApiResult | null> {
    const api = `${this.requireAiServiceUrl()}/moderation/text`;

    try {
      // DEBUG RAW INPUT
      this.logger.debug(
        `[Moderation] Raw transcript type=${typeof transcript}`,
      );

      if (typeof transcript === 'string') {
        const rawPreview =
          transcript.length > 300
            ? `${transcript.slice(0, 300)}...`
            : transcript;

        this.logger.debug(
          `[Moderation] Raw transcript preview=${rawPreview}`,
        );
      }

      // NORMALIZE
      const normalizedText = await this.normalizeTranscriptContent(transcript);

      this.logger.log(
        `[Moderation] Normalized text length=${normalizedText.length}`,
      );

      const normalizedPreview =
        normalizedText.length > 500
          ? `${normalizedText.slice(0, 500)}...`
          : normalizedText;

      this.logger.debug(
        `[Moderation] Normalized text preview=${normalizedPreview}`,
      );

      // EMPTY CHECK
      if (!normalizedText.trim()) {
        this.logger.warn(
          '[Moderation] Empty normalized text, skipping moderation',
        );

        return null;
      }

      // PAYLOAD
      const payload = {
        text: normalizedText,
      };

      this.logger.debug(
        `[Moderation] Outgoing payload=${JSON.stringify(payload)}`,
      );

      this.logger.log(
        `[Moderation] POST ${api} | payloadLen=${payload.text.length}`,
      );

      // REQUEST
      const res = await logFetch(api, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        timeoutMs: 10 * 60 * 1000,
      }, this.logger);

      const respText = await res.text();

      this.logger.log(
        `[Moderation] Response status=${res.status}`,
      );

      if (respText) {
        const responsePreview =
          respText.length > 1000
            ? `${respText.slice(0, 1000)}...`
            : respText;

        this.logger.debug(
          `[Moderation] Response body preview=${responsePreview}`,
        );
      }

      if (!res.ok) {
        this.logger.warn(
          `[Moderation] Non-ok response from AI moderation: ${res.status}`,
        );

        return null;
      }

      // PARSE JSON
      let data: any = null;

      try {
        data = respText ? JSON.parse(respText) : null;
      } catch (parseErr) {
        this.logger.error(
          '[Moderation] Failed to parse JSON response',
          parseErr as any,
        );

        return null;
      }

      const moderation = this.sanitizeModerationResult(data);

      this.logger.debug(
        `[Moderation] toxic_word output=${JSON.stringify(moderation?.toxic_word || [])}`,
      );

      this.logger.debug(
        `[Moderation] Parsed moderation=${JSON.stringify(moderation)}`,
      );

      return moderation;
    } catch (err) {
      this.logger.error(
        '[Moderation] call failed',
        err as any,
      );

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
      deletes: [
        {
          q: this.getRecordingAnalysisQuery(recordingId),
          limit: 0,
        },
      ],
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
      // Verify saved recordingUrl matches the R2 upload result
      console.log(`[Service] DB recordingUrl saved: ${updatedLivestream.recordingUrl}`);
      if (String(updatedLivestream.recordingUrl) !== String(videoUrl)) {
        console.warn(`[Service] MISMATCH: saved recordingUrl (${String(updatedLivestream.recordingUrl)}) != uploaded videoUrl (${String(videoUrl)})`);
      }

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
    try {
      const res = await this.prisma.mongo.$runCommandRaw({
        delete: this.aiTranscriptSummaryCollection,
        deletes: [
          {
            q: this.getRecordingAnalysisQuery(recordingId),
            limit: 0,
          },
        ],
      });

      this.logger.debug(`[Mongo] deleteRecordingAiAnalysis result for ${recordingId}: ${JSON.stringify(res)}`);
    } catch (err) {
      this.logger.warn(`[Mongo] deleteRecordingAiAnalysis failed for ${recordingId}: ${String(err)}`);
      // swallow - deletion is best-effort
    }
  }

  async deleteRecording(recordingId: string) {
    const livestream = await this.prisma.postgres.liveStream.findUnique({
      where: { id: recordingId },
      select: {
        id: true,
        recordingUrl: true,
        audioUrl: true,
      },
    });

    if (!livestream) {
      throw new NotFoundException('Livestream not found');
    }

    if (livestream.recordingUrl) {
      try {
        await this.r2StorageService.deleteVideo(recordingId);
      } catch (error) {
        this.logger.warn(`Failed to delete recording file from R2 for livestream ${recordingId}`);
      }
    }

    try {
      await this.r2StorageService.deleteRecordingAudioById(recordingId);
    } catch {
      // ignore missing audio export cleanup
    }

    await this.deleteRecordingAiAnalysis(recordingId).catch(() => undefined);

    await this.prisma.postgres.liveStream.update({
      where: { id: recordingId },
      data: {
        recordingUrl: null,
        isRecorded: false,
        processingStatus: 'PENDING',
      },
    });

    return {
      success: true,
      message: 'Recording deleted',
      livestreamId: recordingId,
    };
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

    await this.invalidateTeacherScheduleCaches(teacherId);

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
    const cacheKey = `teacher:${teacherId}:schedules:${includeCompleted ? '1' : '0'}:${startDate || 'all'}:${endDate || 'all'}`;
    const cachedSchedules = await this.redisService.get<unknown[]>(cacheKey);

    if (cachedSchedules) {
      return cachedSchedules;
    }

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

    await this.redisService.set(cacheKey, schedules, 60);
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

    await this.invalidateTeacherScheduleCaches(schedule.teacherId);

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

    await this.invalidateTeacherScheduleCaches(schedule.teacherId);

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
        isApprove: 'TRUE',
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
        isApprove: 'TRUE',
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
    const normalizedCategory = normalizeVideoCategory(category || '');

    const videos = await this.prisma.postgres.liveStream.findMany({
      where: {
        status: LiveStreamStatus.ENDED,
        isPublic: true,
        isApprove: 'TRUE',
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

  async getAvailableCategories(limit: number = 100) {
    const livestreamCategories = await this.prisma.postgres.liveStream.findMany({
      where: {
        category: { not: null },
      },
      distinct: ['category'],
      select: {
        category: true,
      },
      take: limit,
    });

    const studentProfiles = await this.prisma.postgres.studentProfile.findMany({
      select: {
        interests: true,
      },
    });

    const categories = new Set<string>();

    for (const item of livestreamCategories) {
      if (!item.category) continue;
      const normalized = normalizeVideoCategory(item.category);
      if (normalized) {
        categories.add(normalized);
      }
    }

    for (const profile of studentProfiles) {
      for (const interest of profile.interests || []) {
        const normalized = normalizeVideoCategory(interest);
        if (normalized) {
          categories.add(normalized);
        }
      }
    }

    return Array.from(categories).sort((left, right) => left.localeCompare(right));
  }

  // Get teacher's recorded livestreams (ENDED with recordingUrl)
  async getTeacherRecordedLivestreams(teacherId: string, limit: number = 50) {
    const cacheKey = `teacher:${teacherId}:recordings:${limit}`;
    const cachedRecordings = await this.redisService.get<unknown[]>(cacheKey);

    if (cachedRecordings) {
      return cachedRecordings;
    }

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

    await this.redisService.set(cacheKey, recordings, 60);
    return recordings;
  }

  // Get all ENDED livestreams for a teacher (including those without recordings)
  async getTeacherEndedLivestreams(teacherId: string, limit: number = 50) {
    const cacheKey = `teacher:${teacherId}:ended:${limit}`;
    const cachedLivestreams = await this.redisService.get<unknown[]>(cacheKey);

    if (cachedLivestreams) {
      return cachedLivestreams;
    }

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

    await this.redisService.set(cacheKey, livestreams, 60);
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

      const likes = reactions.filter((reaction: { reactionType?: string }) => reaction.reactionType === 'like').length;
      const dislikes = reactions.filter((reaction: { reactionType?: string }) => reaction.reactionType === 'dislike').length;

      return { likes, dislikes };
    } catch (error) {
      this.logger.error(`Failed to fetch video reaction stats: ${error}`);
      throw new BadRequestException('Failed to fetch video reaction stats');
    }
  }

  private getRecordingAnalysisQuery(recordingId: string) {
    return {
      type: 'LIVESTREAM',
      $or: [
        { recordingId },
        { id: recordingId },
      ],
    };
  }

  private async getRecordingAiAnalysisDocument(recordingId: string): Promise<AiTranscriptSummaryDocument | null> {
    const result = await this.prisma.mongo.$runCommandRaw({
      find: this.aiTranscriptSummaryCollection,
      filter: { type: 'LIVESTREAM', recordingId },
      limit: 1,
    });

    const firstBatch = (result as { cursor?: { firstBatch?: AiTranscriptSummaryDocument[] } }).cursor?.firstBatch || [];
    if (firstBatch[0]) {
      return firstBatch[0];
    }

    const legacyResult = await this.prisma.mongo.$runCommandRaw({
      find: this.aiTranscriptSummaryCollection,
      filter: { type: 'LIVESTREAM', id: recordingId },
      limit: 1,
    });

    const legacyBatch = (legacyResult as { cursor?: { firstBatch?: AiTranscriptSummaryDocument[] } }).cursor?.firstBatch || [];
    return legacyBatch[0] || null;
  }

  // Public helper for debugging: return raw Mongo document (if any)
  async getRecordingAiAnalysisRaw(recordingId: string): Promise<AiTranscriptSummaryDocument | null> {
    return await this.getRecordingAiAnalysisDocument(recordingId);
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

    const maxAttempts = 3;
    let lastErr: any = null;

    this.logger.debug(`[Mongo] upsertRecordingAiAnalysis start ${recordingId} payloadKeys=${Object.keys(mongoPayload).join(',')}`);

    // Try update/upsert with retries
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await this.prisma.mongo.$runCommandRaw({
          update: this.aiTranscriptSummaryCollection,
          updates: [
            {
              q: this.getRecordingAnalysisQuery(recordingId),
              u: {
                $set: {
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

        this.logger.debug(`[Mongo] upsertRecordingAiAnalysis result for ${recordingId} (attempt ${attempt}): ${JSON.stringify(res)}`);
        return;
      } catch (err) {
        lastErr = err;
        this.logger.warn(`[Mongo] upsertRecordingAiAnalysis attempt ${attempt} failed for ${recordingId}: ${String(err)}`);
        if (attempt < maxAttempts) {
          const backoff = 200 * Math.pow(2, attempt - 1);
          await this.sleep(backoff);
          continue;
        }
      }
    }

    // If update/upsert failed after retries, try delete+insert fallback with retries
    this.logger.warn(`[Mongo] upsertRecordingAiAnalysis performing delete+insert fallback for ${recordingId}`);
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.prisma.mongo.$runCommandRaw({
          delete: this.aiTranscriptSummaryCollection,
          deletes: [
            { q: this.getRecordingAnalysisQuery(recordingId), limit: 0 },
          ],
        });

        const doc = {
          id: recordingId,
          type: 'LIVESTREAM',
          recordingId,
          documentId: null,
          ...mongoPayload,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any;

        const insertRes = await this.prisma.mongo.$runCommandRaw({
          insert: this.aiTranscriptSummaryCollection,
          documents: [doc],
        });

        this.logger.debug(`[Mongo] upsertRecordingAiAnalysis fallback insert result for ${recordingId} (attempt ${attempt}): ${JSON.stringify(insertRes)}`);
        return;
      } catch (err2) {
        lastErr = err2;
        this.logger.warn(`[Mongo] upsertRecordingAiAnalysis fallback attempt ${attempt} failed for ${recordingId}: ${String(err2)}`);
        if (attempt < maxAttempts) {
          const backoff = 300 * Math.pow(2, attempt - 1);
          await this.sleep(backoff);
          continue;
        }
      }
    }

    this.logger.error(`[Mongo] upsertRecordingAiAnalysis ultimately failed for ${recordingId}: ${String(lastErr)}`);
    throw lastErr;
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

  async getRecordingAiAnalysis(recordingId: string) {
    const analysis = await this.getRecordingAiAnalysisDocument(recordingId);
    const livestream = await this.prisma.postgres.liveStream.findUnique({ where: { id: recordingId }, select: { audioUrl: true, processingStatus: true } });

    const processingStatus = livestream?.processingStatus ?? null;

    // Derive processing stage from Postgres processingStatus + analysis timestamps
    const processingStage =
      processingStatus === 'FAILED'
        ? 'error'
        : analysis?.moderationCheckedAt
          ? 'done'
          : analysis?.summaryGeneratedAt
            ? 'moderating'
            : analysis?.transcriptGeneratedAt
              ? 'summarizing'
              : analysis?.transcriptStatus === 'processing'
                ? 'transcribing'
                : processingStatus === 'PROCESSING'
                  ? 'preparing'
                  : 'queued';

    return {
      recordingId,
      transcript: analysis?.transcript || null,
      summary: analysis?.summary || undefined,
      audioUrl: livestream?.audioUrl || null,
      moderationResult: analysis?.moderationResult || null,
      ...this.getModerationSnapshot(analysis?.moderationResult),
      transcriptStatus: analysis?.transcriptStatus || 'idle',
      transcriptError: analysis?.transcriptError || null,
      transcriptGeneratedAt: analysis?.transcriptGeneratedAt || null,
      summaryGeneratedAt: analysis?.summaryGeneratedAt || null,
      processingStage: processingStage || null,
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

        await this.updateRecordingProcessingState(recordingId, {
          processingProgress: PROCESSING_STAGE_PROGRESS.done,
          processingError: null,
        });
        await this.updateRecordingProcessingStatus(recordingId, 'DONE').catch(() => undefined);
      }

      return {
        ...analysis,
        moderationResult,
        score: moderationSnapshot.validationRate,
        toxicWords: moderationSnapshot.toxicWords,
        status: moderationStatus,
        label: moderationStatus,
        categories: moderationSnapshot.moderationCategories,
        processingStage: analysis.processingStage || null,
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
      processingStage: analysis.processingStage || null,
      processingProgress: analysis.processingProgress ?? 0,
      processingError: analysis.processingError || null,
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
        audioUrl: true,
        processingStatus: true,
      },
    });

    if (!livestream) {
      throw new NotFoundException('Recording not found');
    }

    if (!livestream.recordingUrl) {
      throw new BadRequestException('Recording URL is missing, cannot transcribe');
    }

    if (force) {
      await this.processingStateService.resetForRetry('LIVESTREAM', recordingId);
      await this.updateRecordingProcessingState(recordingId, {
        transcriptStatus: 'processing',
        transcriptError: null,
        transcript: null,
        summary: null,
        moderationResult: null,
        moderationCheckedAt: null,
        transcriptGeneratedAt: null,
        summaryGeneratedAt: null,
        processingProgress: PROCESSING_STAGE_PROGRESS.preparing,
        processingError: null,
      });
    }

    const existing = await this.getRecordingAiAnalysisDocument(recordingId);
    this.logger.debug(`[Transcribe] existing transcript present=${!!existing?.transcript} status=${existing?.transcriptStatus}`);
    if (!force && existing?.transcript) {
      return await this.getRecordingAiAnalysis(recordingId);
    }

    if (!force && livestream?.processingStatus === 'PROCESSING') {
      return await this.getRecordingAiAnalysis(recordingId);
    }

    if (!force && existing?.transcriptStatus === 'processing') {
      return await this.getRecordingAiAnalysis(recordingId);
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
      let audioUrl = livestream?.audioUrl || (audioExists ? this.r2StorageService.getRecordingAudioUrlById(recordingId) : null);
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
            const ffmpegCmd = ffmpegStaticPath || 'ffmpeg';
            const ffmpeg = spawn(ffmpegCmd, [
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

      if (audioUrl) {
        await this.prisma.postgres.liveStream.update({
          where: { id: recordingId },
          data: { audioUrl },
        }).catch((error) => {
          this.logger.warn(`Failed to persist audioUrl for recording ${recordingId}: ${String(error)}`);
        });
      }

      const presignedAudioUrl = audioUrl
        ? await this.r2StorageService.getRecordingPresignedUrlFromUrl(audioUrl, 3600)
        : null;
      if (!presignedAudioUrl) {
        throw new BadRequestException('Recording audio URL is missing, cannot transcribe');
      }

      // Call transcribe endpoint using the same payload shape as document flow.
      // The AI service expects multipart form-data with file_url.
      const res = await (await import('../utils/aiFetch')).default(
        `${this.requireAiServiceUrl()}/transcribe`,
        {
          method: 'POST',
          body: (() => {
            const formData = new FormData();
            formData.append('file_url', presignedAudioUrl);
            return formData;
          })(),
          timeoutMs: 30 * 60 * 1000,
        },
        this.logger as any,
      );

      if (!res.ok) {
        throw new BadRequestException(`Transcribe service error (${res.status}): ${await res.text()}`);
      }

      const payloadText = await res.text();
      try {
        this.logger.debug(`[Transcribe] AI payload preview for ${recordingId}: ${payloadText.slice(0, 2000)}`);
      } catch (e) {
        this.logger.debug(`[Transcribe] AI payload preview unavailable for ${recordingId}`);
      }
      const transcript = this.extractTranscriptFromNdjson(payloadText);

      try {
        const textPreview = this.getTranscriptText(transcript) || '';
        this.logger.log(`[Transcribe] Extracted transcript length=${textPreview.length} preview=${textPreview.substring(0,200)}`);
      } catch (e) {
        this.logger.warn(`[Transcribe] Failed to preview extracted transcript for ${recordingId}: ${String(e)}`);
      }

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
        transcriptGeneratedAt: new Date(),
        processingProgress: PROCESSING_STAGE_PROGRESS.summarizing,
        processingError: null,
      });

      void this.generateRecordingSummary(recordingId, true).catch((summaryErr) => {
        this.logger.warn('Summary failed for recording', String(summaryErr));
      });

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

      // Notify teacher that transcript is ready (best-effort)
      try {
        const live = await this.prisma.postgres.liveStream.findUnique({ where: { id: recordingId }, select: { teacherId: true } });
        if (live?.teacherId) {
          await this.notificationService.createNotification({
            userId: live.teacherId,
            type: 'COURSE_UPDATE' as any,
            title: 'Transcript Available',
            content: `Transcript and summary are ready for your livestream (${recordingId}).`,
            data: { livestreamId: recordingId, type: 'transcript_ready' },
          }).catch((nErr) => this.logger.warn('[Notification] createNotification failed', String(nErr)));
        }
      } catch (notifyErr) {
        this.logger.warn('[Notification] failed to send transcript-ready notification', String(notifyErr));
      }

      return await this.getRecordingAiAnalysis(recordingId);
    } catch (err: unknown) {
      await this.upsertRecordingAiAnalysis(recordingId, {
        transcriptStatus: 'error',
        transcriptError: err instanceof Error ? err.message : String(err),
        processingProgress: PROCESSING_STAGE_PROGRESS.error,
        processingError: err instanceof Error ? err.message : String(err),
      }).catch(() => undefined);
      await this.updateRecordingProcessingStatus(recordingId, 'FAILED').catch(() => undefined);

      this.logger.error(`[TRANSCRIPT ERROR] RecordingID: ${recordingId}, Error: ${err instanceof Error ? err.message : String(err)}`);
      // Notify teacher about failure (best-effort)
      try {
        const live = await this.prisma.postgres.liveStream.findUnique({ where: { id: recordingId }, select: { teacherId: true } });
        if (live?.teacherId) {
          await this.notificationService.createNotification({
            userId: live.teacherId,
            type: 'COURSE_UPDATE' as any,
            title: 'Transcript Failed',
            content: `Transcript generation failed for your livestream (${recordingId}): ${err instanceof Error ? err.message : String(err)}`,
            data: { livestreamId: recordingId, type: 'transcript_failed' },
          }).catch((nErr) => this.logger.warn('[Notification] createNotification failed', String(nErr)));
        }
      } catch (notifyErr) {
        this.logger.warn('[Notification] failed to send transcript-failed notification', String(notifyErr));
      }
      throw err;
    }
  }

  private extractTranscriptFromNdjson(payloadText: string): Prisma.JsonValue | null {
    const lines = payloadText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line) as Record<string, unknown>;
        if (parsed.status !== 'success') {
          continue;
        }

        // AI response shape: { status, data: { filename, result: { text, segments, language, ... } } }
        // We want to preserve the full result object (with segments/timestamps) not just the text string.
        const dataField = parsed.data as Record<string, unknown> | null | undefined;
        const resultField = dataField?.result ?? parsed.result;

        if (resultField && typeof resultField === 'object' && !Array.isArray(resultField)) {
          return resultField as Prisma.JsonValue;
        }

        // Fallback for other response shapes
        const candidate = parsed.data ?? parsed.result ?? parsed.text ?? parsed.transcript;
        const transcript = this.extractTranscriptValue(candidate);
        if (transcript) {
          return transcript;
        }
      } catch {
        continue;
      }
    }

    return null;
  }

  private extractTranscriptValue(value: unknown, depth = 0): Prisma.JsonValue | null {
    if (depth > 8 || value == null) {
      return null;
    }

    if (typeof value === 'string') {
      return value.trim() || null;
    }

    if (Array.isArray(value)) {
      const items = value
        .map((item) => this.extractTranscriptValue(item, depth + 1))
        .filter((item): item is Prisma.JsonValue => item !== null);

      return items.length > 0 ? (items as Prisma.JsonValue) : null;
    }

    if (typeof value !== 'object') {
      return null;
    }

    const data = value as Record<string, unknown>;

    // If the object has segments or timestamps alongside text, preserve the whole object
    // so callers get timestamps for subtitle rendering. Return plain text only as last resort.
    if (Array.isArray(data.segments) || Array.isArray(data.timestamps)) {
      return data as Prisma.JsonValue;
    }

    // Try nested result/data containers first before falling back to plain text
    for (const key of ['result', 'data', 'payload', 'output']) {
      const nested = data[key];
      if (nested && typeof nested === 'object') {
        const nestedValue = this.extractTranscriptValue(nested, depth + 1);
        if (nestedValue) {
          return nestedValue;
        }
      }
    }

    const directText = data.full_text ?? data.text ?? data.transcript;
    if (typeof directText === 'string') {
      return directText.trim() || null;
    }

    return data as Prisma.JsonValue;
  }

  private getTranscriptText(transcript: Prisma.JsonValue | null | undefined): string | null {
    return this.extractTranscriptTextValue(transcript, 0);
  }

  private extractTranscriptTextValue(value: unknown, depth = 0): string | null {
    if (depth > 8 || value == null) {
      return null;
    }

    if (typeof value === 'string') {
      return value.trim() || null;
    }

    if (Array.isArray(value)) {
      const joined = value
        .map((item) => this.extractTranscriptTextValue(item, depth + 1))
        .filter((item): item is string => Boolean(item))
        .join('\n')
        .trim();

      return joined || null;
    }

    if (typeof value !== 'object') {
      return null;
    }

    const data = value as Record<string, unknown>;
    const directText = data.full_text ?? data.text ?? data.transcript;

    if (typeof directText === 'string') {
      return directText.trim() || null;
    }

    if (directText && typeof directText === 'object') {
      const nestedDirect = this.extractTranscriptTextValue(directText, depth + 1);
      if (nestedDirect) {
        return nestedDirect;
      }
    }

    for (const key of ['result', 'data', 'payload', 'output']) {
      const nestedText = this.extractTranscriptTextValue(data[key], depth + 1);
      if (nestedText) {
        return nestedText;
      }
    }

    if (Array.isArray(data.timestamps)) {
      const timestampJoined = data.timestamps
        .map((segment) => this.extractTranscriptTextValue(segment, depth + 1))
        .filter((item): item is string => Boolean(item))
        .join('\n')
        .trim();

      if (timestampJoined) {
        return timestampJoined;
      }
    }

    if (Array.isArray(data.segments)) {
      const segmentJoined = data.segments
        .map((segment) => this.extractTranscriptTextValue(segment, depth + 1))
        .filter((item): item is string => Boolean(item))
        .join('\n')
        .trim();

      if (segmentJoined) {
        return segmentJoined;
      }
    }

    for (const nestedValue of Object.values(data)) {
      const nestedText = this.extractTranscriptTextValue(nestedValue, depth + 1);
      if (nestedText) {
        return nestedText;
      }
    }

    return null;
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
    const nestedData = data.data && typeof data.data === 'object' ? (data.data as Record<string, unknown>) : null;
    const summaryCandidate = data.summary ?? data.result ?? data.text ?? nestedData?.summary ?? nestedData?.result ?? nestedData?.text;
    if (typeof summaryCandidate === 'string') {
      return summaryCandidate.trim() || null;
    }

    return null;
  }

  async generateRecordingSummary(recordingId: string, force = false) {
    const livestream = await this.prisma.postgres.liveStream.findUnique({
      where: { id: recordingId },
      select: {
        id: true,
        processingStatus: true,
      },
    });
    const existing = await this.getRecordingAiAnalysisDocument(recordingId);

    let transcript = existing?.transcript || null;
    if (!force && existing?.summary) {
      return await this.getRecordingAiAnalysis(recordingId);
    }

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

    await this.updateRecordingProcessingState(recordingId, {
      processingProgress: PROCESSING_STAGE_PROGRESS.summarizing,
      processingError: null,
    });

    const aiResponse = await fetch(`${this.requireAiServiceUrl()}/summarize`, {
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

          await this.updateRecordingProcessingState(recordingId, {
            processingProgress: PROCESSING_STAGE_PROGRESS.done,
            processingError: null,
          });
          await this.updateRecordingProcessingStatus(recordingId, 'DONE').catch(() => undefined);
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

    return await this.getRecordingAiAnalysis(recordingId);
  }
}