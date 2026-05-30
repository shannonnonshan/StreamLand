import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { R2StorageService } from '../r2-storage/r2-storage.service';
import { ProcessingService } from '../processing/processing.service';
import { ProcessingStateService } from '../processing/processing-state.service';
import { RedisService } from '../redis/redis.service';
import { createWriteStream, promises as fs } from 'fs';
import { spawn } from 'child_process';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
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

export interface DocumentAiAnalysisResponse {
  documentId: string;
  transcript: Prisma.JsonValue | null;
  summary: string | null;
  audioUrl: string | null;
  moderationResult: Prisma.JsonValue | null;
  toxicWords: string[];
  validationRate: number;
  moderationLabel: string | null;
  moderationCategories: string[];
  transcriptStatus: 'idle' | 'processing' | 'success' | 'error';
  transcriptError: string | null;
  transcriptGeneratedAt: Date | null;
  summaryGeneratedAt: Date | null;
  processingStage: ProcessingStage | null;
  processingProgress: number;
  processingError: string | null;
  cached?: boolean;
}

type MulterFile = {
  fieldname: string;
  originalname: string;
  encoding?: string;
  mimetype: string;
  size: number;
  buffer?: Buffer;
  destination?: string;
  filename?: string;
  path?: string;
};

@Injectable()
export class DocumentService {
  private readonly aiTranscriptSummaryCollection = 'ai_transcript_summary';
  private readonly logger = new Logger(DocumentService.name);
  private readonly aiServiceUrl = (process.env.AI_SERVICE_URL || '').replace(/\/$/, '');

  constructor(
    private prisma: PrismaService,
    private r2StorageService: R2StorageService,
    private processingService: ProcessingService,
    private processingStateService: ProcessingStateService,
    private redisService: RedisService,
  ) {}

  async saveTranscriptAndMarkCompleted(documentId: string, transcript: Prisma.JsonValue): Promise<void> {
    await this.updateDocumentProcessingState(documentId, {
      transcriptStatus: 'success',
      transcriptError: null,
      transcript,
      transcriptGeneratedAt: new Date(),
      processingProgress: PROCESSING_STAGE_PROGRESS.done,
      processingError: null,
    });

    await this.updateDocumentProcessingStatus(documentId, 'DONE');
  }

  private async invalidateTeacherDocumentCache(teacherId: string) {
    await this.redisService.del(`teacher:${teacherId}:documents:all`);
    await this.redisService.del(`teacher:${teacherId}:documents:image`);
    await this.redisService.del(`teacher:${teacherId}:documents:video`);
    await this.redisService.del(`teacher:${teacherId}:documents:pdf`);
    await this.redisService.del(`teacher:${teacherId}:documents:file`);
  }

  private shouldEnqueueProcessing(filename: string): boolean {
    const extension = path.extname(filename).toLowerCase();

    return [
      '.mp4',
      '.webm',
      '.mov',
      '.mkv',
      '.avi',
      '.m4v',
      '.mp3',
      '.wav',
      '.m4a',
      '.aac',
      '.ogg',
      '.flac',
      '.opus',
    ].includes(extension);
  }

  private requireAiServiceUrl(): string {
    if (!this.aiServiceUrl) {
      throw new BadRequestException('AI_SERVICE_URL is not configured');
    }

    return this.aiServiceUrl;
  }

  async getTeacherDocuments(teacherId: string, fileType?: string) {
    const cacheKey = `teacher:${teacherId}:documents:${fileType || 'all'}`;
    const cachedDocuments = await this.redisService.get<unknown[]>(cacheKey);

    if (cachedDocuments) {
      return cachedDocuments;
    }

    const teacher = await this.prisma.postgres.user.findUnique({
      where: { id: teacherId },
    });

    if (!teacher) {
      throw new NotFoundException('Teacher not found');
    }

    const where: Record<string, unknown> = { teacherId };
    if (fileType) {
      where.fileType = fileType;
    }

    const documents = await this.prisma.postgres.document.findMany({
      where,
      orderBy: { uploadedAt: 'desc' },
    });

    await this.redisService.set(cacheKey, documents, 60);
    return documents;
  }

  async uploadTeacherDocument(teacherId: string, file: MulterFile, description?: string, title?: string) {
    const teacher = await this.prisma.postgres.user.findUnique({
      where: { id: teacherId },
      include: { teacherProfile: true },
    });

    if (!teacher || !teacher.teacherProfile) {
      throw new NotFoundException('Teacher not found');
    }

    const documentUrl = await this.r2StorageService.uploadDocument(
      teacherId,
      file.originalname,
      file.buffer!,
      file.mimetype,
    );

    let fileType = 'file';
    if (file.mimetype.startsWith('image/')) {
      fileType = 'image';
    } else if (file.mimetype.startsWith('video/')) {
      fileType = 'video';
    } else if (file.mimetype.includes('pdf')) {
      fileType = 'pdf';
    }

    const document = await this.prisma.postgres.document.create({
      data: {
        teacherId,
        title: title?.trim() || file.originalname,
        description: description?.trim() || null,
        fileUrl: documentUrl,
        fileName: file.originalname,
        fileType,
        fileSize: file.size,
        mimeType: file.mimetype,
        processingStatus: 'PENDING',
      },
    });

    if (this.shouldEnqueueProcessing(file.originalname)) {
      await this.processingService.enqueue({
        type: 'document',
        itemId: document.id,
        fileUrl: documentUrl,
        title: title?.trim() || file.originalname,
      });
    }

    await this.invalidateTeacherDocumentCache(teacherId);

    return document;
  }

  async updateTeacherDocumentDescription(teacherId: string, documentId: string, description?: string) {
    const existing = await this.prisma.postgres.document.findFirst({
      where: {
        id: documentId,
        teacherId,
      },
    });

    if (!existing) {
      throw new NotFoundException('Document not found');
    }

    const updatedDocument = await this.prisma.postgres.document.update({
      where: { id: documentId },
      data: {
        description: description?.trim() || null,
      },
    });

    await this.invalidateTeacherDocumentCache(teacherId);

    return updatedDocument;
  }

  async updateTeacherDocument(teacherId: string, documentId: string, title?: string, description?: string) {
    const existing = await this.prisma.postgres.document.findFirst({
      where: {
        id: documentId,
        teacherId,
      },
    });

    if (!existing) {
      throw new NotFoundException('Document not found');
    }

    const updatedDocument = await this.prisma.postgres.document.update({
      where: { id: documentId },
      data: {
        title: typeof title === 'string' && title.trim().length > 0 ? title.trim() : existing.title,
        description: typeof description === 'string' ? (description.trim() || null) : existing.description,
      },
    });

    await this.invalidateTeacherDocumentCache(teacherId);

    return updatedDocument;
  }

  async deleteTeacherDocument(teacherId: string, documentId: string) {
    const existing = await this.prisma.postgres.document.findFirst({
      where: { id: documentId, teacherId },
    });

    if (!existing) {
      throw new NotFoundException('Document not found');
    }

    try {
      if (existing.fileUrl) {
        await this.r2StorageService.deleteDocument(existing.fileUrl);
      }
    } catch (err) {
      this.logger.warn(`Failed to delete document from R2 for ${documentId}`);
    }

    try {
      await this.r2StorageService.deleteDocumentAudioById(documentId);
    } catch {
      // ignore missing audio export cleanup
    }

    await this.prisma.postgres.document.delete({ where: { id: documentId } });

    await this.prisma.mongo.$runCommandRaw({
      delete: this.aiTranscriptSummaryCollection,
      deletes: [
        {
          q: {
            type: 'DOCUMENT',
            documentId,
          },
          limit: 0,
        },
      ],
    }).catch(() => undefined);

    await this.invalidateTeacherDocumentCache(teacherId);

    return { success: true, message: 'Document deleted' };
  }

  private async getDocumentAiAnalysisDocument(documentId: string): Promise<AiTranscriptSummaryDocument | null> {
    const result = await this.prisma.mongo.$runCommandRaw({
      find: this.aiTranscriptSummaryCollection,
      filter: { type: 'DOCUMENT', documentId },
      limit: 1,
    });

    const firstBatch = (result as { cursor?: { firstBatch?: AiTranscriptSummaryDocument[] } }).cursor?.firstBatch || [];
    return firstBatch[0] || null;
  }

  private async upsertDocumentAiAnalysis(
    documentId: string,
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
          q: { type: 'DOCUMENT', documentId },
          u: {
            $set: {
              id: documentId,
              type: 'DOCUMENT',
              documentId,
              recordingId: null,
              ...mongoPayload,
              updatedAt: new Date(),
            },
            $setOnInsert: {
              id: documentId,
              type: 'DOCUMENT',
              documentId,
              recordingId: null,
              createdAt: new Date(),
            },
          },
          upsert: true,
        },
      ],
    });
  }

  private async updateDocumentProcessingState(
    documentId: string,
    payload: Partial<AiTranscriptSummaryDocument>,
  ): Promise<void> {
    await this.upsertDocumentAiAnalysis(documentId, payload);
  }

  private async updateDocumentProcessingStatus(documentId: string, status: 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED'): Promise<void> {
    await this.prisma.postgres.document.update({
      where: { id: documentId },
      data: { processingStatus: status },
    });
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

  private async replaceDocumentAiAnalysisWithModeration(
    documentId: string,
    moderationResult: ModerationApiResult,
  ): Promise<void> {
    const existing = await this.getDocumentAiAnalysisDocument(documentId);

    await this.prisma.mongo.$runCommandRaw({
      delete: this.aiTranscriptSummaryCollection,
      deletes: [
        {
          q: { type: 'DOCUMENT', documentId },
          limit: 0,
        },
      ],
    });

    await this.prisma.mongo.$runCommandRaw({
      insert: this.aiTranscriptSummaryCollection,
      documents: [
        {
          id: existing?.id || documentId,
          type: 'DOCUMENT',
          recordingId: null,
          documentId,
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

  private async downloadToBuffer(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new BadRequestException(`Cannot download file: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  private async ensureDocumentAudioUrl(
    documentId: string,
    fileUrl: string,
    mimeType: string,
  ): Promise<string> {
    const response = await fetch(fileUrl);
    if (!response.ok || !response.body) {
      throw new BadRequestException(`Cannot download document file: ${response.status}`);
    }

    const tempBase = `document-${documentId}-${Date.now()}`;
    const inputPath = path.join(os.tmpdir(), `${tempBase}.${this.getInputExtension(mimeType)}`);
    const outputPath = path.join(os.tmpdir(), `${tempBase}.wav`);

    try {
      await pipeline(Readable.fromWeb(response.body as any), createWriteStream(inputPath));

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
          '-c:a',
          'pcm_s16le',
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

      const audioBuffer = await fs.readFile(outputPath);
      const audioUrl = await this.r2StorageService.uploadDocumentAudioById(documentId, audioBuffer);

      await this.prisma.postgres.document.update({
        where: { id: documentId },
        data: { audioUrl },
      });

      return audioUrl;
    } finally {
      await Promise.all([
        fs.unlink(inputPath).catch(() => undefined),
        fs.unlink(outputPath).catch(() => undefined),
      ]);
    }
  }

  private deriveProcessingStage(
    processingStatus: string,
    analysis: AiTranscriptSummaryDocument | null,
  ): ProcessingStage {
    if (processingStatus === 'FAILED') {
      return 'error';
    }

    if (analysis?.moderationCheckedAt) {
      return 'done';
    }

    if (analysis?.summaryGeneratedAt) {
      return 'moderating';
    }

    if (analysis?.transcriptGeneratedAt) {
      return 'summarizing';
    }

    if (analysis?.transcriptStatus === 'processing') {
      return 'transcribing';
    }

    if (processingStatus === 'PROCESSING') {
      return 'preparing';
    }

    return 'queued';
  }

  private isTranscribable(mimeType?: string | null, fileType?: string | null): boolean {
    if (mimeType && (mimeType.startsWith('audio/') || mimeType.startsWith('video/'))) {
      return true;
    }

    if (fileType && (fileType.includes('audio') || fileType.includes('video'))) {
      return true;
    }

    return false;
  }

  private getInputExtension(mimeType?: string | null): string {
    if (!mimeType) return 'bin';
    if (mimeType.includes('audio/mpeg')) return 'mp3';
    if (mimeType.includes('audio/wav')) return 'wav';
    if (mimeType.includes('video/webm')) return 'webm';
    if (mimeType.includes('video/mp4')) return 'mp4';
    if (mimeType.includes('video/quicktime')) return 'mov';
    return 'bin';
  }

  private async assertDocumentAccess(documentId: string, user: { sub: string; role?: string }) {
    const document = await this.prisma.postgres.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    if (user.role === 'TEACHER') {
      if (document.teacherId !== user.sub) {
        throw new ForbiddenException('You can only access your own documents');
      }
      return document;
    }

    if (user.role === 'ADMIN') {
      return document;
    }

    const isApproved = document.isApprove === 'TRUE';

    if (!isApproved) {
      throw new ForbiddenException('You can only access approved documents');
    }

    const saved = await this.prisma.mongo.studentNotebook.findFirst({
      where: {
        studentId: user.sub,
        documentId,
      },
    });

    if (!saved) {
      throw new ForbiddenException('You do not have access to this document');
    }

    return document;
  }

  async getDocumentAiAnalysis(
    documentId: string,
    user: { sub: string; role?: string },
    autoTranscribe: boolean = false,
  ): Promise<DocumentAiAnalysisResponse> {
    const document = await this.assertDocumentAccess(documentId, user);
    const analysis = await this.getDocumentAiAnalysisDocument(documentId);
  
    const processorIsHandling = (
      document.processingStatus === 'PENDING' ||
      document.processingStatus === 'PROCESSING' ||
      document.processingStatus === 'DONE' ||
      document.processingStatus === 'FAILED'
    );
  
    if (autoTranscribe && !analysis?.transcript && !processorIsHandling) {
      return await this.generateDocumentTranscript(documentId, false, user);
    }
  
    return {
      documentId,
      transcript: analysis?.transcript || null,
      summary: analysis?.summary || null,
      audioUrl: document.audioUrl || null,
      moderationResult: analysis?.moderationResult || null,
      ...this.getModerationSnapshot(analysis?.moderationResult),
      transcriptStatus: analysis?.transcriptStatus || 'idle',
      transcriptError: analysis?.transcriptError || null,
      transcriptGeneratedAt: analysis?.transcriptGeneratedAt || null,
      summaryGeneratedAt: analysis?.summaryGeneratedAt || null,
      processingStage: this.deriveProcessingStage(document.processingStatus, analysis),
      processingProgress: analysis?.processingProgress ?? 0,
      processingError: analysis?.processingError || null,
    };
  }

  async getDocumentModeration(documentId: string, user: { sub: string; role?: string }) {
    const document = await this.assertDocumentAccess(documentId, user);
    const analysis = await this.getDocumentAiAnalysis(documentId, user, false);
    const transcriptText = this.getTranscriptText(analysis.transcript);

    if (transcriptText) {
      this.logger.log(`[Moderation] Document ${documentId} - invoking moderation API; textLen=${transcriptText.length}`);
    }

    const moderationResult = transcriptText ? await this.callModerationApi(transcriptText) : null;

    if (moderationResult) {
      await this.replaceDocumentAiAnalysisWithModeration(documentId, moderationResult);
      const moderationSnapshot = this.getModerationSnapshot(moderationResult as Prisma.JsonValue);

      if (moderationResult.status === 'SAFE') {
        await this.prisma.postgres.document.update({
          where: { id: documentId },
          data: {
            isApprove: 'TRUE',
          },
        }).catch(() => undefined);

        await this.updateDocumentProcessingState(documentId, {
          processingProgress: PROCESSING_STAGE_PROGRESS.done,
          processingError: null,
        });
        await this.updateDocumentProcessingStatus(documentId, 'DONE').catch(() => undefined);
      }

      return {
        ...analysis,
        moderationResult,
        score: moderationSnapshot.validationRate,
        toxicWords: moderationSnapshot.toxicWords,
        status: moderationSnapshot.moderationLabel,
        label: moderationSnapshot.moderationLabel,
        categories: moderationSnapshot.moderationCategories,
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
      processingStage: this.deriveProcessingStage(document.processingStatus, null),
      processingProgress: analysis.processingProgress ?? 0,
      processingError: analysis.processingError || null,
    };
  }

  async generateDocumentTranscript(
    documentId: string,
    force: boolean,
    user: { sub: string; role?: string },
  ): Promise<DocumentAiAnalysisResponse> {
    this.logger.log(`[Transcribe] generateDocumentTranscript start documentId=${documentId} force=${force}`);
    const document = await this.assertDocumentAccess(documentId, user);

    if (!this.isTranscribable(document.mimeType, document.fileType)) {
      throw new BadRequestException('Document type is not supported for transcription');
    }

    if (force) {
      await this.processingStateService.resetForRetry('DOCUMENT', documentId);
      await this.updateDocumentProcessingState(documentId, {
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

    const existing = await this.getDocumentAiAnalysisDocument(documentId);
    this.logger.debug(`[Transcribe] existing transcript present=${!!existing?.transcript} status=${existing?.transcriptStatus}`);
    if (!force && existing?.transcript) {
      return {
        ...(await this.getDocumentAiAnalysis(documentId, user, false)),
        cached: true,
      };
    }

    if (!force && document.processingStatus === 'PROCESSING') {
      return {
        ...(await this.getDocumentAiAnalysis(documentId, user, false)),
        cached: true,
      };
    }

    if (!force && existing?.transcriptStatus === 'success' && existing?.transcript) {
      return {
        ...(await this.getDocumentAiAnalysis(documentId, user, false)),
        cached: true,
      };
    }

    if (!force && existing?.transcriptStatus === 'processing') {
      return {
        ...(await this.getDocumentAiAnalysis(documentId, user, false)),
        cached: true,
      };
    }

    try {
      await this.updateDocumentProcessingStatus(documentId, 'PROCESSING');
      await this.upsertDocumentAiAnalysis(documentId, {
        transcriptStatus: 'processing',
        transcriptError: null,
        processingProgress: PROCESSING_STAGE_PROGRESS.preparing,
        processingError: null,
      });

      const audioUrl = document.audioUrl || await this.ensureDocumentAudioUrl(documentId, document.fileUrl, document.mimeType);
      const presignedAudioUrl = await this.r2StorageService.getDocumentPresignedUrlFromUrl(audioUrl, 3600);

      await this.upsertDocumentAiAnalysis(documentId, {
        processingProgress: PROCESSING_STAGE_PROGRESS.transcribing,
        processingError: null,
      });

      const formData = new FormData();
      formData.append('file_url', presignedAudioUrl);

      const res = await (await import('../utils/aiFetch')).default(
        `${this.requireAiServiceUrl()}/transcribe`,
        {
          method: 'POST',
          body: formData,
          timeoutMs: 30 * 60 * 1000,
        },
        this.logger as any,
      );

      if (!res.ok) {
        throw new BadRequestException(`Transcribe service error (${res.status}): ${await res.text()}`);
      }

      const payloadText = await res.text();
      const transcript = this.extractTranscriptFromNdjson(payloadText);

      if (!transcript) {
        await this.upsertDocumentAiAnalysis(documentId, {
          transcriptStatus: 'error',
          transcriptError: 'Transcribe service returned empty transcript',
          processingProgress: PROCESSING_STAGE_PROGRESS.transcribing,
          processingError: 'Transcribe service returned empty transcript',
        });
        throw new BadRequestException('Transcribe service returned empty transcript');
      }

      await this.saveTranscriptAndMarkCompleted(documentId, transcript);

      try {
        await this.generateDocumentSummary(documentId, true, user);
      } catch (summaryErr) {
        this.logger.warn('Summary failed for document', String(summaryErr));
      }

      return {
        ...(await this.getDocumentAiAnalysis(documentId, user, false)),
        cached: false,
      };
    } catch (err: unknown) {
      await this.upsertDocumentAiAnalysis(documentId, {
        transcriptStatus: 'error',
        transcriptError: err instanceof Error ? err.message : String(err),
        processingProgress: PROCESSING_STAGE_PROGRESS.error,
        processingError: err instanceof Error ? err.message : String(err),
      }).catch(() => undefined);
      await this.updateDocumentProcessingStatus(documentId, 'FAILED').catch(() => undefined);
      throw err;
    }
  }

  async generateDocumentSummary(
    documentId: string,
    force: boolean,
    user: { sub: string; role?: string },
  ): Promise<DocumentAiAnalysisResponse> {
    const document = await this.assertDocumentAccess(documentId, user);

    if (!this.isTranscribable(document.mimeType, document.fileType)) {
      throw new BadRequestException('Document type is not supported for summarization');
    }

    const existing = await this.getDocumentAiAnalysisDocument(documentId);
    const shouldModerate = true;

    let transcript = existing?.transcript || null;
    if (!force && existing?.summary) {
      return {
        ...(await this.getDocumentAiAnalysis(documentId, user, false)),
        cached: true,
      };
    }

    if (!force && document.processingStatus === 'PROCESSING') {
      return {
        ...(await this.getDocumentAiAnalysis(documentId, user, false)),
        cached: true,
      };
    }

    if (!transcript) {
      return await this.generateDocumentTranscript(documentId, false, user);
    }

    const transcriptText = this.getTranscriptText(transcript);
    if (!transcriptText) {
      throw new BadRequestException('Transcript is required before summarizing');
    }

    await this.updateDocumentProcessingState(documentId, {
      processingProgress: PROCESSING_STAGE_PROGRESS.summarizing,
      processingError: null,
    });

    if (transcriptText) {
      this.logger.log(`[Moderation] Document ${documentId} - invoking moderation API during summarization (will call after summarize); textLen=${transcriptText.length}`);
    }

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

    await this.upsertDocumentAiAnalysis(documentId, {
      summary,
      summaryGeneratedAt: new Date(),
      processingProgress: PROCESSING_STAGE_PROGRESS.moderating,
      processingError: null,
    });

    if (shouldModerate) {
      try {
        const transcriptText = this.getTranscriptText(transcript);
        if (transcriptText) {
          this.logger.log(`[Moderation] Document ${documentId} - invoking moderation API after summarization; textLen=${transcriptText.length}`);
        }
        const moderationResult = await this.callModerationApi(transcriptText);

        if (moderationResult) {
          await this.replaceDocumentAiAnalysisWithModeration(documentId, moderationResult as ModerationApiResult);

          const moderationStatus = typeof moderationResult.status === 'string' ? moderationResult.status : null;

          if (moderationStatus === 'SAFE') {
            await this.prisma.postgres.document.update({
              where: { id: documentId },
              data: {
                isApprove: 'TRUE',
              },
            }).catch(() => undefined);
          }

          await this.updateDocumentProcessingState(documentId, {
            processingProgress: PROCESSING_STAGE_PROGRESS.done,
            processingError: null,
          });
          await this.updateDocumentProcessingStatus(documentId, 'DONE').catch(() => undefined);
        }
      } catch (modErr) {
        const message = modErr instanceof Error ? modErr.message : String(modErr);
        this.logger.warn('Moderation call failed', message);
        await this.updateDocumentProcessingState(documentId, {
          processingProgress: PROCESSING_STAGE_PROGRESS.moderating,
          processingError: message,
        }).catch(() => undefined);
        await this.updateDocumentProcessingStatus(documentId, 'FAILED').catch(() => undefined);
      }
    }

    return {
      ...(await this.getDocumentAiAnalysis(documentId, user, false)),
      cached: false,
    };
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

  private getTranscriptText(transcript: Prisma.JsonValue | null | undefined): string | null {
    return this.extractTranscriptTextValue(transcript, 0);
  }

  private extractTranscriptValue(value: unknown, depth = 0): Prisma.JsonValue | null {
    if (depth > 8 || value == null) {
      return null;
    }

    if (typeof value === 'string') {
      return value.trim() || null;
    }

    if (Array.isArray(value)) {
      const normalizedArray = value
        .map((item) => this.extractTranscriptValue(item, depth + 1))
        .filter((item): item is Prisma.JsonValue => item !== null);

      return normalizedArray.length > 0 ? normalizedArray as Prisma.JsonValue : null;
    }

    if (typeof value === 'object') {
      const data = value as Record<string, unknown>;
      const directText = data.full_text ?? data.text ?? data.transcript;
      if (typeof directText === 'string') {
        return directText.trim() || null;
      }

      if (directText && typeof directText === 'object') {
        const nestedDirect = this.extractTranscriptValue(directText, depth + 1);
        if (nestedDirect) {
          return nestedDirect;
        }
      }

      for (const key of ['result', 'data', 'payload', 'output']) {
        const nestedValue = this.extractTranscriptValue(data[key], depth + 1);
        if (nestedValue) {
          return nestedValue;
        }
      }

      if (Array.isArray(data.timestamps) || Array.isArray(data.segments)) {
        return data as Prisma.JsonValue;
      }

      return data as Prisma.JsonValue;
    }

    return null;
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

    if (typeof value === 'object') {
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
    }

    return null;
  }
  private async normalizeTranscriptContent(transcript: unknown): Promise<string> {
    const text = this.getTranscriptText(transcript as Prisma.JsonValue | null | undefined);
    return text || '';
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
      const res = await fetch(api, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

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
}
