import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { R2StorageService } from '../r2-storage/r2-storage.service';
import { ProcessingService } from '../processing/processing.service';
import { createWriteStream, promises as fs } from 'fs';
import { spawn } from 'child_process';

import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

import * as os from 'os';
import * as path from 'path';

import {
  PROCESSING_STAGE_PROGRESS,
  ProcessingStage,
} from '../processing/processing.types';

interface AiTranscriptSummaryDocument {
  id?: string;
  type: 'LIVESTREAM' | 'DOCUMENT';

  recordingId?: string | null;
  documentId?: string | null;

  transcriptStatus?: 'idle' | 'processing' | 'success' | 'error';
  transcriptError?: string | null;

  transcript?: Prisma.JsonValue;
  summary?: string;
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
  ) {}

  private shouldEnqueueProcessing(filename: string): boolean {
    const extension = path.extname(filename).toLowerCase();
    return [
      '.mp4', '.webm', '.mov', '.mkv', '.avi', '.m4v',
      '.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac', '.opus',
    ].includes(extension);
  }

  private requireAiServiceUrl(): string {
    if (!this.aiServiceUrl) {
      throw new BadRequestException('AI_SERVICE_URL is not configured');
    }
    return this.aiServiceUrl;
  }

  async getTeacherDocuments(teacherId: string, fileType?: string) {
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

    return this.prisma.postgres.document.findMany({
      where,
      orderBy: { uploadedAt: 'desc' },
    });
  }

  async uploadTeacherDocument(teacherId: string, file: MulterFile, description?: string) {
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
        title: file.originalname,
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
        title: file.originalname,
      });
    }

    return document;
  }

  async updateTeacherDocumentDescription(teacherId: string, documentId: string, description?: string) {
    const existing = await this.prisma.postgres.document.findFirst({
      where: { id: documentId, teacherId },
    });

    if (!existing) {
      throw new NotFoundException('Document not found');
    }

    return this.prisma.postgres.document.update({
      where: { id: documentId },
      data: {
        description: description?.trim() || null,
      },
    });
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
    } catch {
      this.logger.warn(`Failed to delete document from R2 for ${documentId}`);
    }

    try {
      const audioUrl = this.r2StorageService.getDocumentAudioUrlFromUrl(existing.fileUrl);
      if (audioUrl) {
        await this.r2StorageService.deleteDocument(audioUrl).catch(() => undefined);
      }
    } catch {
      // ignore
    }

    await this.prisma.postgres.document.delete({ where: { id: documentId } });

    await this.prisma.mongo.$runCommandRaw({
      delete: this.aiTranscriptSummaryCollection,
      deletes: [{ q: { type: 'DOCUMENT', documentId }, limit: 0 }],
    }).catch(() => undefined);

    return { success: true, message: 'Document deleted' };
  }

  private async getDocumentAiAnalysisDocument(documentId: string): Promise<AiTranscriptSummaryDocument | null> {
    const result = await this.prisma.mongo.$runCommandRaw({
      find: this.aiTranscriptSummaryCollection,
      filter: { type: 'DOCUMENT', documentId },
      limit: 1,
    });

    const firstBatch = (
      result as { cursor?: { firstBatch?: AiTranscriptSummaryDocument[] } }
    ).cursor?.firstBatch || [];

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

  private async updateDocumentProcessingStatus(
    documentId: string,
    status: 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED',
  ): Promise<void> {
    await this.prisma.postgres.document.update({
      where: { id: documentId },
      data: { processingStatus: status },
    });
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
    if (Array.isArray(value)) {
      return value.flatMap((item) => this.collectModerationStrings(item));
    }
    return [];
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
      deletes: [{ q: { type: 'DOCUMENT', documentId }, limit: 0 }],
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
    return Buffer.from(await response.arrayBuffer());
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
    const outputPath = path.join(os.tmpdir(), `${tempBase}.mp3`);

    try {
      await pipeline(Readable.fromWeb(response.body as any), createWriteStream(inputPath));

      await new Promise<void>((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', [
          '-y', '-i', inputPath,
          '-vn', '-ac', '1', '-ar', '16000', '-b:a', '64k', '-f', 'mp3',
          outputPath,
        ]);

        let stderr = '';
        ffmpeg.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
        ffmpeg.on('error', (err) => reject(err));
        ffmpeg.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`ffmpeg failed (${code}): ${stderr}`));
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
    if (processingStatus === 'FAILED') return 'error';
    if (analysis?.moderationCheckedAt) return 'done';
    if (analysis?.summaryGeneratedAt) return 'moderating';
    if (analysis?.transcriptGeneratedAt) return 'summarizing';
    if (analysis?.transcriptStatus === 'processing') return 'transcribing';
    if (processingStatus === 'PROCESSING') return 'preparing';
    return 'queued';
  }

  private isTranscribable(mimeType?: string | null, fileType?: string | null): boolean {
    if (mimeType && (mimeType.startsWith('audio/') || mimeType.startsWith('video/'))) return true;
    if (fileType && (fileType.includes('audio') || fileType.includes('video'))) return true;
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
      where: { studentId: user.sub, documentId },
    });

    if (!saved) {
      throw new ForbiddenException('You do not have access to this document');
    }

    return document;
  }

  async getDocumentAiAnalysis(
    documentId: string,
    user: { sub: string; role?: string },
    autoTranscribe: boolean = true,
  ): Promise<DocumentAiAnalysisResponse> {
    const document = await this.assertDocumentAccess(documentId, user);
    const analysis = await this.getDocumentAiAnalysisDocument(documentId);

    if (autoTranscribe && (!analysis || !analysis.transcript)) {
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
          data: { isApprove: 'TRUE' },
        }).catch(() => undefined);
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
    this.logger.log(`[Transcribe] start documentId=${documentId}`);

    const document = await this.assertDocumentAccess(documentId, user);

    if (!this.isTranscribable(document.mimeType, document.fileType)) {
      throw new BadRequestException('Document type is not supported for transcription');
    }

    const existing = await this.getDocumentAiAnalysisDocument(documentId);
    this.logger.debug(`[Transcribe] existing transcript present=${!!existing?.transcript} status=${existing?.transcriptStatus}`);

    if (!force && existing?.transcript) {
      try {
        await this.generateDocumentSummary(documentId, false, user);
      } catch (summaryErr) {
        this.logger.warn('Summary call failed', String(summaryErr));
      }

      try {
        const transcriptText = this.getTranscriptText(existing.transcript);
        if (transcriptText) {
          this.logger.log(`[Moderation] Document ${documentId} (existing) - invoking moderation API; textLen=${transcriptText.length}`);
        }
        const moderationResult = await this.callModerationApi(transcriptText || '');
        if (moderationResult) {
          await this.replaceDocumentAiAnalysisWithModeration(documentId, moderationResult);
        }
      } catch (modErr) {
        this.logger.warn('Moderation call failed', String(modErr));
      }

      return {
        ...(await this.getDocumentAiAnalysis(documentId, user, false)),
        cached: true,
      };
    }

    await this.updateDocumentProcessingStatus(documentId, 'PROCESSING');
    await this.updateDocumentProcessingState(documentId, {
      transcriptStatus: 'processing',
      transcriptError: null,
      processingProgress: PROCESSING_STAGE_PROGRESS.preparing,
      processingError: null,
    });

    try {
      const audioUrl = document.audioUrl || await this.ensureDocumentAudioUrl(documentId, document.fileUrl, document.mimeType);

      await this.upsertDocumentAiAnalysis(documentId, {
        processingProgress: PROCESSING_STAGE_PROGRESS.transcribing,
        processingError: null,
      });

      const aiResponse = await (await import('../utils/aiFetch')).logStreamingTranscribe(
        `${this.requireAiServiceUrl()}/transcribe`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileUrl: audioUrl }),
          timeoutMs: 30 * 60 * 1000,
        },
        this.logger as any,
      );

      const transcript = this.extractTranscriptFromPayload(aiResponse.data);

      if (!transcript) {
        await this.upsertDocumentAiAnalysis(documentId, {
          transcriptStatus: 'error',
          transcriptError: 'Transcribe service returned empty transcript',
          processingProgress: PROCESSING_STAGE_PROGRESS.transcribing,
          processingError: 'Transcribe service returned empty transcript',
        });
        throw new BadRequestException('Transcribe service returned empty transcript');
      }

      await this.upsertDocumentAiAnalysis(documentId, {
        transcriptStatus: 'success',
        transcriptError: null,
        transcript,
        transcriptGeneratedAt: new Date(),
        processingProgress: PROCESSING_STAGE_PROGRESS.summarizing,
        processingError: null,
      });

      await this.generateDocumentSummary(documentId, false, user);

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
    await this.assertDocumentAccess(documentId, user);

    const existing = await this.getDocumentAiAnalysisDocument(documentId);

    if (!existing?.transcript) {
      return await this.generateDocumentTranscript(documentId, false, user);
    }

    if (!force && existing.summary) {
      return {
        ...(await this.getDocumentAiAnalysis(documentId, user, false)),
        cached: true,
      };
    }

    const transcriptText = this.getTranscriptText(existing.transcript);

    if (!transcriptText) {
      throw new BadRequestException('Transcript text is empty');
    }

    await this.updateDocumentProcessingState(documentId, {
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

    if (!summary) {
      throw new BadRequestException('Summarize service returned empty summary');
    }

    await this.upsertDocumentAiAnalysis(documentId, {
      summary,
      summaryGeneratedAt: new Date(),
      processingProgress: PROCESSING_STAGE_PROGRESS.moderating,
      processingError: null,
    });

    try {
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
            data: { isApprove: 'TRUE' },
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

    return {
      ...(await this.getDocumentAiAnalysis(documentId, user, false)),
      cached: false,
    };
  }

  private extractTranscriptFromPayload(payload: unknown): Prisma.JsonValue | null {
    if (typeof payload === 'string') return payload.trim() || null;

    if (!payload || typeof payload !== 'object') return null;

    const data = payload as Record<string, unknown>;
    const transcriptCandidate = data.text ?? data.transcript ?? data.result ?? data.data;

    if (typeof transcriptCandidate === 'string') return transcriptCandidate.trim() || null;

    if (transcriptCandidate && typeof transcriptCandidate === 'object') {
      return transcriptCandidate as Prisma.JsonValue;
    }

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

  private async normalizeTranscriptContent(transcript: unknown): Promise<string> {
    const text = this.getTranscriptText(transcript as Prisma.JsonValue | null | undefined);
    return text || '';
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

  private extractSummaryFromPayload(payload: unknown): string | null {
    if (typeof payload === 'string') return payload.trim() || null;
    if (!payload || typeof payload !== 'object') return null;

    const data = payload as Record<string, unknown>;
    const nestedData = data.data && typeof data.data === 'object' ? (data.data as Record<string, unknown>) : null;
    const summaryCandidate = data.summary ?? data.result ?? data.text ?? nestedData?.summary ?? nestedData?.result ?? nestedData?.text;

    if (typeof summaryCandidate === 'string') return summaryCandidate.trim() || null;
    return null;
  }
}