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

import { createWriteStream, promises as fs } from 'fs';
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';

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

  audioUrl?: string;

  moderationResult?: Prisma.JsonValue;
  moderationCheckedAt?: Date;

  toxicWords?: string[];
  validationRate?: number;
  moderationLabel?: string | null;
  moderationCategories?: string[];

  transcriptGeneratedAt?: Date;
  summaryGeneratedAt?: Date;

  processingStage?: ProcessingStage;
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

@Injectable()
export class DocumentService {
  private readonly aiTranscriptSummaryCollection =
    'ai_transcript_summary';

  private readonly logger = new Logger(DocumentService.name);

  private readonly localAiBaseUrl = (
    process.env.AI_SERVICE_URL || 'http://localhost:8080'
  ).replace(/\/$/, '');

  constructor(
    private prisma: PrismaService,
    private r2StorageService: R2StorageService,
  ) {}

  private async getDocumentAiAnalysisDocument(
    documentId: string,
  ): Promise<AiTranscriptSummaryDocument | null> {
    const result = await this.prisma.mongo.$runCommandRaw({
      find: this.aiTranscriptSummaryCollection,
      filter: {
        type: 'DOCUMENT',
        documentId,
      },
      limit: 1,
    });

    const firstBatch =
      (
        result as {
          cursor?: {
            firstBatch?: AiTranscriptSummaryDocument[];
          };
        }
      ).cursor?.firstBatch || [];

    return firstBatch[0] || null;
  }
  async getDocumentModeration(
    documentId: string,
    user: { sub: string; role?: string },
  ) {
    const analysis = await this.getDocumentAiAnalysis(
      documentId,
      user,
      false,
    );

    const transcriptText = this.getTranscriptText(
      analysis.transcript,
    );

    if (!transcriptText) {
      return {
        ...analysis,
        moderationResult: null,
        score: 0,
        toxicWords: [],
        status: null,
        label: null,
        categories: [],
      };
    }

    const response = await fetch(
      `${this.localAiBaseUrl}/moderation/text`,
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
        },

        body: JSON.stringify({
          text: transcriptText,
        }),
      },
    );

    const rawText = await response.text();

    if (!response.ok) {
      throw new BadRequestException(
        `Moderation service error (${response.status}): ${rawText}`,
      );
    }

    let payload: any = {};

    try {
      payload = rawText ? JSON.parse(rawText) : {};
    } catch {
      throw new BadRequestException(
        `Invalid moderation JSON response: ${rawText}`,
      );
    }

    const moderation = {
      status:
        typeof payload.status === 'string'
          ? payload.status
          : null,

      score:
        typeof payload.score === 'number'
          ? payload.score
          : 0,

      categories: Array.isArray(payload.categories)
        ? payload.categories
        : [],

      toxic_word: Array.isArray(payload.toxic_word)
        ? payload.toxic_word
        : [],
    };

    await this.updateDocumentProcessingState(
      documentId,
      {
        moderationResult:
          moderation as Prisma.JsonValue,

        moderationCheckedAt: new Date(),

        toxicWords: moderation.toxic_word,

        validationRate: moderation.score,

        moderationLabel: moderation.status,

        moderationCategories:
          moderation.categories,
      },
    );

    return {
      ...analysis,

      moderationResult:
        moderation as Prisma.JsonValue,

      score: moderation.score,

      toxicWords: moderation.toxic_word,

      status: moderation.status,

      label: moderation.status,

      categories: moderation.categories,
    };
  }


  private async upsertDocumentAiAnalysis(
    documentId: string,
    payload: Partial<AiTranscriptSummaryDocument>,
  ): Promise<void> {
    await this.prisma.mongo.$runCommandRaw({
      update: this.aiTranscriptSummaryCollection,
      updates: [
        {
          q: {
            type: 'DOCUMENT',
            documentId,
          },

          u: {
            $set: {
              id: documentId,
              type: 'DOCUMENT',
              documentId,
              recordingId: null,

              ...payload,

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
      data: {
        processingStatus: status,
      },
    });
  }


  private async assertDocumentAccess(
    documentId: string,
    user: { sub: string; role?: string },
  ) {
    const document = await this.prisma.postgres.document.findUnique({
      where: {
        id: documentId,
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    if (user.role === 'ADMIN') {
      return document;
    }

    if (user.role === 'TEACHER') {
      if (document.teacherId !== user.sub) {
        throw new ForbiddenException(
          'You can only access your own documents',
        );
      }

      return document;
    }

    const isApproved = document.isApprove === 'TRUE';

    if (!isApproved) {
      throw new ForbiddenException(
        'You can only access approved documents',
      );
    }

    const saved = await this.prisma.mongo.studentNotebook.findFirst({
      where: {
        studentId: user.sub,
        documentId,
      },
    });

    if (!saved) {
      throw new ForbiddenException(
        'You do not have access to this document',
      );
    }

    return document;
  }

  private isTranscribable(
    mimeType?: string | null,
    fileType?: string | null,
  ): boolean {
    if (
      mimeType &&
      (
        mimeType.startsWith('audio/') ||
        mimeType.startsWith('video/')
      )
    ) {
      return true;
    }

    if (
      fileType &&
      (
        fileType.includes('audio') ||
        fileType.includes('video')
      )
    ) {
      return true;
    }

    return false;
  }

  private getInputExtension(
    mimeType?: string | null,
  ): string {
    if (!mimeType) return 'bin';

    if (mimeType.includes('audio/mpeg')) return 'mp3';
    if (mimeType.includes('audio/wav')) return 'wav';
    if (mimeType.includes('video/mp4')) return 'mp4';
    if (mimeType.includes('video/webm')) return 'webm';
    if (mimeType.includes('video/quicktime')) return 'mov';

    return 'bin';
  }

  private async downloadToBuffer(
    url: string,
  ): Promise<Buffer> {
    const response = await fetch(url);

    if (!response.ok) {
      throw new BadRequestException(
        `Cannot download file (${response.status})`,
      );
    }

    const arrayBuffer = await response.arrayBuffer();

    return Buffer.from(arrayBuffer);
  }

  async getDocumentAiAnalysis(
    documentId: string,
    user: { sub: string; role?: string },
    autoTranscribe: boolean = true,
  ): Promise<DocumentAiAnalysisResponse> {
    await this.assertDocumentAccess(documentId, user);

    const analysis =
      await this.getDocumentAiAnalysisDocument(documentId);

    if (
      autoTranscribe &&
      (!analysis || !analysis.transcript)
    ) {
      return await this.generateDocumentTranscript(
        documentId,
        false,
        user,
      );
    }

    return {
      documentId,

      transcript: analysis?.transcript || null,
      summary: analysis?.summary || null,
      audioUrl: analysis?.audioUrl || null,

      moderationResult:
        analysis?.moderationResult || null,

      toxicWords: analysis?.toxicWords || [],
      validationRate: analysis?.validationRate ?? 0,
      moderationLabel:
        analysis?.moderationLabel || null,
      moderationCategories:
        analysis?.moderationCategories || [],

      transcriptStatus:
        analysis?.transcriptStatus || 'idle',

      transcriptError:
        analysis?.transcriptError || null,

      transcriptGeneratedAt:
        analysis?.transcriptGeneratedAt || null,

      summaryGeneratedAt:
        analysis?.summaryGeneratedAt || null,

      processingStage:
        analysis?.processingStage || null,

      processingProgress:
        analysis?.processingProgress ?? 0,

      processingError:
        analysis?.processingError || null,
    };
  }

  async generateDocumentTranscript(
    documentId: string,
    force: boolean,
    user: { sub: string; role?: string },
  ): Promise<DocumentAiAnalysisResponse> {
    this.logger.log(
      `[Transcribe] start documentId=${documentId}`,
    );

    const document =
      await this.assertDocumentAccess(documentId, user);

    if (
      !this.isTranscribable(
        document.mimeType,
        document.fileType,
      )
    ) {
      throw new BadRequestException(
        'Document type is not supported for transcription',
      );
    }

    const existing =
      await this.getDocumentAiAnalysisDocument(
        documentId,
      );

    if (!force && existing?.transcript) {
      return {
        ...(await this.getDocumentAiAnalysis(
          documentId,
          user,
          false,
        )),
        cached: true,
      };
    }

    await this.updateDocumentProcessingStatus(
      documentId,
      'PROCESSING',
    );

    await this.updateDocumentProcessingState(
      documentId,
      {
        transcriptStatus: 'processing',
        transcriptError: null,

        processingStage: 'preparing',
        processingProgress:
          PROCESSING_STAGE_PROGRESS.preparing,

        processingError: null,
      },
    );

    try {
      let audioBuffer: Buffer | null = null;
      let audioUrl: string | null = null;

      const response = await fetch(document.fileUrl);

      if (!response.ok || !response.body) {
        throw new BadRequestException(
          `Cannot download document (${response.status})`,
        );
      }

      const tempBase = `document-${documentId}-${Date.now()}`;

      const inputPath = path.join(
        os.tmpdir(),
        `${tempBase}.${this.getInputExtension(
          document.mimeType,
        )}`,
      );

      const outputPath = path.join(
        os.tmpdir(),
        `${tempBase}.wav`,
      );

      try {
        await pipeline(
          Readable.fromWeb(response.body as any),
          createWriteStream(inputPath),
        );

        await new Promise<void>((resolve, reject) => {
          if (!ffmpegPath) {
            reject(
              new Error(
                'FFmpeg binary not found. Install ffmpeg-static',
              ),
            );

            return;
          }

          this.logger.log(
            `Using FFmpeg binary: ${ffmpegPath}`,
          );

          const ffmpeg = spawn(ffmpegPath as string, [
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
            const msg = chunk.toString();

            stderr += msg;

            this.logger.debug(`[FFmpeg] ${msg}`);
          });

          ffmpeg.on('error', (err) => {
            this.logger.error(
              'FFmpeg spawn error',
              err,
            );

            reject(err);
          });

          ffmpeg.on('close', (code) => {
            if (code === 0) {
              resolve();
              return;
            }

            reject(
              new Error(
                `FFmpeg failed (${code}): ${stderr}`,
              ),
            );
          });
        });

        audioBuffer = await fs.readFile(outputPath);

        audioUrl =
          await this.r2StorageService.uploadDocumentAudioById(
            documentId,
            audioBuffer,
          );
      } finally {
        await Promise.all([
          fs.unlink(inputPath).catch(() => undefined),
          fs.unlink(outputPath).catch(() => undefined),
        ]);
      }

      if (!audioBuffer) {
        throw new BadRequestException(
          'Audio export failed',
        );
      }

      const formData = new FormData();

      formData.append(
        'file',
        new Blob([new Uint8Array(audioBuffer)], {
          type: 'audio/wav',
        }),
        `${documentId}.wav`,
      );

      const aiResponse = await fetch(
        `${this.localAiBaseUrl}/transcribe`,
        {
          method: 'POST',
          body: formData,
        },
      );

      const rawText = await aiResponse.text();

      this.logger.debug(
        `[AI RAW RESPONSE] ${rawText}`,
      );

      if (!aiResponse.ok) {
        throw new BadRequestException(
          `Transcribe service error (${aiResponse.status}): ${rawText}`,
        );
      }

      let payload: any;

      try {
        payload = rawText ? JSON.parse(rawText) : {};
      } catch {
        throw new BadRequestException(
          `Invalid JSON from transcribe service: ${rawText}`,
        );
      }

      const transcript =
        this.extractTranscriptFromPayload(payload);

      if (!transcript) {
        throw new BadRequestException(
          'Transcribe service returned empty transcript',
        );
      }

      await this.updateDocumentProcessingState(
        documentId,
        {
          transcriptStatus: 'success',
          transcriptError: null,

          transcript,

          audioUrl,

          transcriptGeneratedAt: new Date(),

          processingStage: 'summarizing',
          processingProgress:
            PROCESSING_STAGE_PROGRESS.summarizing,

          processingError: null,
        },
      );

      await this.generateDocumentSummary(
        documentId,
        false,
        user,
      );

      return {
        ...(await this.getDocumentAiAnalysis(
          documentId,
          user,
          false,
        )),
        cached: false,
      };
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : String(err);

      await this.updateDocumentProcessingState(
        documentId,
        {
          transcriptStatus: 'error',
          transcriptError: message,

          processingStage: 'error',
          processingProgress:
            PROCESSING_STAGE_PROGRESS.error,

          processingError: message,
        },
      );

      await this.updateDocumentProcessingStatus(
        documentId,
        'FAILED',
      );

      throw err;
    }
  }

  async generateDocumentSummary(
    documentId: string,
    force: boolean,
    user: { sub: string; role?: string },
  ): Promise<DocumentAiAnalysisResponse> {
    await this.assertDocumentAccess(documentId, user);

    const existing =
      await this.getDocumentAiAnalysisDocument(
        documentId,
      );

    if (!existing?.transcript) {
      return await this.generateDocumentTranscript(
        documentId,
        false,
        user,
      );
    }

    if (!force && existing.summary) {
      return {
        ...(await this.getDocumentAiAnalysis(
          documentId,
          user,
          false,
        )),
        cached: true,
      };
    }

    const transcriptText =
      this.getTranscriptText(existing.transcript);

    if (!transcriptText) {
      throw new BadRequestException(
        'Transcript text is empty',
      );
    }

    await this.updateDocumentProcessingState(
      documentId,
      {
        processingStage: 'summarizing',
        processingProgress:
          PROCESSING_STAGE_PROGRESS.summarizing,
      },
    );

    const response = await fetch(
      `${this.localAiBaseUrl}/summarize`,
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
        },

        body: JSON.stringify({
          text: transcriptText,
        }),
      },
    );

    const rawText = await response.text();

    if (!response.ok) {
      throw new BadRequestException(
        `Summarize service error (${response.status}): ${rawText}`,
      );
    }

    let payload: any = {};

    try {
      payload = rawText ? JSON.parse(rawText) : {};
    } catch {
      throw new BadRequestException(
        `Invalid summarize response JSON: ${rawText}`,
      );
    }

    const summary =
      this.extractSummaryFromPayload(payload);

    if (!summary) {
      throw new BadRequestException(
        'Summary is empty',
      );
    }

    await this.updateDocumentProcessingState(
      documentId,
      {
        summary,

        summaryGeneratedAt: new Date(),

        processingStage: 'done',
        processingProgress:
          PROCESSING_STAGE_PROGRESS.done,

        processingError: null,
      },
    );

    await this.updateDocumentProcessingStatus(
      documentId,
      'DONE',
    );

    return {
      ...(await this.getDocumentAiAnalysis(
        documentId,
        user,
        false,
      )),
      cached: false,
    };
  }

  private extractTranscriptFromPayload(
    payload: unknown,
  ): Prisma.JsonValue | null {
    if (typeof payload === 'string') {
      return payload.trim() || null;
    }

    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const data = payload as Record<string, unknown>;

    const transcriptCandidate =
      data.text ??
      data.transcript ??
      data.result ??
      data.data;

    if (typeof transcriptCandidate === 'string') {
      return transcriptCandidate.trim() || null;
    }

    if (
      transcriptCandidate &&
      typeof transcriptCandidate === 'object'
    ) {
      return transcriptCandidate as Prisma.JsonValue;
    }

    return null;
  }

  private getTranscriptText(
    transcript: Prisma.JsonValue | null | undefined,
  ): string | null {
    if (typeof transcript === 'string') {
      return transcript.trim() || null;
    }

    if (!transcript) {
      return null;
    }

    if (typeof transcript === 'object') {
      const data = transcript as Record<
        string,
        unknown
      >;

      if (typeof data.full_text === 'string') {
        return data.full_text.trim() || null;
      }

      if (typeof data.text === 'string') {
        return data.text.trim() || null;
      }
    }

    return null;
  }

  private extractSummaryFromPayload(
    payload: unknown,
  ): string | null {
    if (typeof payload === 'string') {
      return payload.trim() || null;
    }

    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const data = payload as Record<string, unknown>;

    const summaryCandidate =
      data.summary ??
      data.result ??
      data.text;

    if (typeof summaryCandidate === 'string') {
      return summaryCandidate.trim() || null;
    }

    return null;
  }
}
