
import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';

import { Process, Processor } from '@nestjs/bull';
import { Prisma } from '@prisma/client';
import { Job } from 'bull';

import {
  createWriteStream,
  promises as fs,
} from 'fs';

import { spawn } from 'child_process';

const ffmpegPath = require('ffmpeg-static');

import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

import * as os from 'os';
import * as path from 'path';

import { PrismaService } from '../prisma/prisma.service';

import { R2StorageService } from '../r2-storage/r2-storage.service';

import {
  PROCESSING_JOB_NAME,
  PROCESSING_QUEUE_NAME,
  PROCESSING_STAGE_PROGRESS,
  ProcessingJobPayload,
  ProcessingJobStatus,
  ProcessingStage,
} from './processing.types';

interface TranscribeResponse {
  text: string;
  language: string;
  timestamps: Prisma.JsonValue[];
}

interface SummariseResponse {
  summary: string;
}

interface ModerateResponse {
  status: string;
  score: number;
  categories: string[];
  toxic_word: string[];
}

interface ProcessingAnalysisDocument {
  id?: string;

  type: 'LIVESTREAM' | 'DOCUMENT';

  recordingId?: string | null;

  documentId?: string | null;

  transcriptStatus?:
    | 'idle'
    | 'processing'
    | 'success'
    | 'error';

  transcriptError?: string | null;

  transcript?: Prisma.JsonValue;

  summary?: string;

  audioUrl?: string;

  moderationResult?: Prisma.JsonValue;

  moderationCheckedAt?: Date;
  transcriptGeneratedAt?: Date;

  summaryGeneratedAt?: Date;

  processingStage?: ProcessingStage;

  processingProgress?: number;

  processingError?: string | null;

  createdAt?: Date;

  updatedAt?: Date;
}

@Processor(PROCESSING_QUEUE_NAME)
@Injectable()
export class ProcessingProcessor {
  private readonly logger = new Logger(
    ProcessingProcessor.name,
  );

  private readonly aiServiceUrl = (
    process.env.AI_SERVICE_URL || ''
  ).replace(/\/$/, '');

  constructor(
    private readonly prisma: PrismaService,

    private readonly r2StorageService: R2StorageService,
  ) {}

  @Process(PROCESSING_JOB_NAME)
  async handle(
    job: Job<ProcessingJobPayload>,
  ): Promise<void> {
    const payload = job.data;

    const tempDir = await fs.mkdtemp(
      path.join(
        os.tmpdir(),
        'streamland-processing-',
      ),
    );

    let latestProgress =
      PROCESSING_STAGE_PROGRESS.preparing;

    let transcriptCompleted = false;

    const startedAt = Date.now();

    try {
      this.logger.log(
        `Processing started for ${payload.type}:${payload.itemId} (${payload.title})`,
      );

      await this.updateProcessingStatus(
        payload,
        'PROCESSING',
      );

      await this.updateProcessingAnalysis(payload, {
        transcriptStatus: 'processing',
        transcriptError: null,
        processingStage: 'preparing',
        processingProgress:
          PROCESSING_STAGE_PROGRESS.preparing,
        processingError: null,
      });

      /**
       * STEP 1
       * DOWNLOAD SOURCE FILE
       */
      this.logger.log(
        `[1/5] Downloading source file...`,
      );

      const downloadStartedAt = Date.now();

      const sourcePath = await this.downloadFile(
        payload.fileUrl,
        tempDir,
        this.getSourceFileName(payload),
      );

      this.logger.log(
        `[1/5] Download completed in ${
          Date.now() - downloadStartedAt
        }ms`,
      );

      /**
       * STEP 2
       * PREPARE AUDIO
       */
      this.logger.log(
        `[2/5] Preparing audio...`,
      );

      const audioStartedAt = Date.now();

      const {
        audioUrl,
        audioPath,
      } = await this.prepareAudioFile(
        payload,
        sourcePath,
        tempDir,
      );

      this.logger.log(
        `[2/5] Audio prepared in ${
          Date.now() - audioStartedAt
        }ms`,
      );

      latestProgress =
        PROCESSING_STAGE_PROGRESS.transcribing;

      await this.updateProcessingAnalysis(payload, {
        processingStage: 'transcribing',
        processingProgress: latestProgress,
      });

      /**
       * STEP 3
       * TRANSCRIBE
       */
      this.logger.log(
        `[3/5] Transcribing audio...`,
      );

      const transcribeStartedAt = Date.now();

      const transcript = await this.transcribe(
        audioPath,
      );

      transcriptCompleted = true;

      this.logger.log(
        `[3/5] Transcription completed in ${
          Date.now() - transcribeStartedAt
        }ms`,
      );

      this.logger.debug(
        `[3/5] Transcript preview: ${
          transcript.text.length > 300
            ? `${transcript.text.slice(0, 300)}...`
            : transcript.text
        }`,
      );

      latestProgress =
        PROCESSING_STAGE_PROGRESS.summarizing;

      await this.updateProcessingAnalysis(payload, {
        transcriptStatus: 'success',
        transcriptError: null,
        transcript:
          transcript as unknown as Prisma.JsonValue,
        audioUrl,
        transcriptGeneratedAt: new Date(),
        processingStage: 'summarizing',
        processingProgress: latestProgress,
      });

      /**
       * STEP 4
       * SUMMARISE
       */
      this.logger.log(
        `[4/5] Summarizing transcript...`,
      );

      const summaryStartedAt = Date.now();

      const summary = await this.summarise(
        transcript.text,
        transcript.language,
      );

      this.logger.log(
        `[4/5] Summary completed in ${
          Date.now() - summaryStartedAt
        }ms`,
      );

      latestProgress =
        PROCESSING_STAGE_PROGRESS.moderating;

      await this.updateProcessingAnalysis(payload, {
        summary: summary.summary,
        summaryGeneratedAt: new Date(),
        processingStage: 'moderating',
        processingProgress: latestProgress,
      });

      /**
       * STEP 5
       * MODERATION
       */
      this.logger.log(
        `[5/5] Moderating transcript...`,
      );

      const moderationStartedAt = Date.now();

      const moderation = await this.moderate(
        transcript.text,
      );

      this.logger.log(
        `[5/5] Moderation completed in ${
          Date.now() - moderationStartedAt
        }ms`,
      );

      /**
       * SAVE RESULTS
       */
      this.logger.log(
        `Saving AI analysis results...`,
      );

      await this.upsertAnalysis(
        payload,
        transcript,
        summary,
        moderation,
      );

      await this.updateProcessingAnalysis(payload, {
        processingStage: 'done',
        processingProgress:
          PROCESSING_STAGE_PROGRESS.done,
        processingError: null,
      });

      await this.updateProcessingStatus(
        payload,
        'DONE',
      );

      this.logger.log(
        `Processing finished for ${payload.type}:${payload.itemId} in ${
          Date.now() - startedAt
        }ms`,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      await this.updateProcessingAnalysis(payload, {
        transcriptStatus: transcriptCompleted
          ? 'success'
          : 'error',

        transcriptError: transcriptCompleted
          ? null
          : message,

        processingStage: 'error',

        processingProgress: latestProgress,

        processingError: message,
      }).catch(() => undefined);

      await this.updateProcessingStatus(
        payload,
        'FAILED',
      ).catch(() => undefined);

      this.logger.error(
        `Processing failed for ${payload.type}:${payload.itemId} after ${
          Date.now() - startedAt
        }ms`,
        error instanceof Error
          ? error.stack
          : String(error),
      );

      throw error instanceof Error
        ? error
        : new Error(String(error));
    } finally {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
        this.logger.log(`Removed temp dir ${tempDir}`);
      } catch (err) {
        this.logger.warn(`Failed to remove temp dir ${tempDir}: ${String(err)}`);
      }
    }
  }

  private async updateProcessingStatus(
    payload: ProcessingJobPayload,
    status: ProcessingJobStatus,
  ): Promise<void> {
    const data = {
      processingStatus: status,
    };

    if (payload.type === 'livestream') {
      await this.prisma.postgres.liveStream.update({
        where: {
          id: payload.itemId,
        },
        data,
      });

      return;
    }

    await this.prisma.postgres.document.update({
      where: {
        id: payload.itemId,
      },
      data,
    });
  }

  private async updateProcessingAnalysis(
    payload: ProcessingJobPayload,
    data: Partial<ProcessingAnalysisDocument>,
  ): Promise<void> {
    const itemField =
      payload.type === 'livestream'
        ? { recordingId: payload.itemId, documentId: null }
        : { recordingId: null, documentId: payload.itemId };
    const {
      transcriptStatus: _transcriptStatus,
      transcriptError: _transcriptError,
      processingProgress: _processingProgress,
      processingError: _processingError,
      ...mongoData
    } = data;

    await this.prisma.mongo.$runCommandRaw({
      update: 'ai_transcript_summary',

      updates: [
        {
          q: {
            type:
              payload.type === 'livestream'
                ? 'LIVESTREAM'
                : 'DOCUMENT',

            ...itemField,
          },

          u: {
            $set: {
              id: payload.itemId,

              type:
                payload.type === 'livestream'
                  ? 'LIVESTREAM'
                  : 'DOCUMENT',

              ...itemField,
              ...mongoData,
              updatedAt: new Date(),
            },

            $setOnInsert: {
              id: payload.itemId,

              type:
                payload.type === 'livestream'
                  ? 'LIVESTREAM'
                  : 'DOCUMENT',

              ...itemField,

              createdAt: new Date(),
            },
          },

          upsert: true,
        },
      ],
    });
  }

  private async downloadFile(
    fileUrl: string,
    tempDir: string,
    fileName: string,
  ): Promise<string> {
    const response = await fetch(fileUrl);

    if (!response.ok || !response.body) {
      throw new BadRequestException(
        `Failed to download file (${response.status})`,
      );
    }

    const destinationPath = path.join(
      tempDir,
      fileName,
    );

    await pipeline(
      Readable.fromWeb(response.body as any),
      createWriteStream(destinationPath),
    );

    return destinationPath;
  }

  private async exportAudioIfNeeded(
    sourcePath: string,
    tempDir: string,
    fileUrl: string,
  ): Promise<string> {
    if (!this.isVideoFile(fileUrl)) {
      return sourcePath;
    }

    if (!ffmpegPath) {
      throw new Error(
        'FFmpeg binary not found. Run: npm install ffmpeg-static',
      );
    }

    this.logger.log(
      `Using FFmpeg binary: ${ffmpegPath}`,
    );

    const audioPath = path.join(
      tempDir,
      `${path.parse(sourcePath).name}.wav`,
    );

    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn(ffmpegPath, [
        '-y',
        '-i',
        sourcePath,
        '-vn',
        '-ac',
        '1',
        '-ar',
        '16000',
        '-f',
        'wav',
        audioPath,
      ]);

      let stderr = '';

      ffmpeg.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      ffmpeg.on('error', (error) => {
        reject(error);
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(
          new Error(
            `ffmpeg failed (${code}): ${stderr}`,
          ),
        );
      });
    });

    return audioPath;
  }

  private async prepareAudioFile(
    payload: ProcessingJobPayload,
    sourcePath: string,
    tempDir: string,
  ): Promise<{
    audioUrl: string;
    audioPath: string;
  }> {
    if (!this.isVideoFile(payload.fileUrl)) {
      return {
        audioUrl: payload.fileUrl,
        audioPath: sourcePath,
      };
    }

    const audioPath = await this.exportAudioIfNeeded(
      sourcePath,
      tempDir,
      payload.fileUrl,
    );

    const audioBuffer = await fs.readFile(
      audioPath,
    );

    let audioUrl: string;

    if (payload.type === 'livestream') {
      audioUrl =
        await this.r2StorageService.uploadRecordingAudioByUrl(
          payload.fileUrl,
          audioBuffer,
        );
    } else {
      audioUrl =
        await this.r2StorageService.uploadDocumentAudioByUrl(
          payload.fileUrl,
          audioBuffer,
        );
    }

    return {
      audioUrl,
      audioPath,
    };
  }

  private async transcribe(
    audioPath: string,
  ): Promise<TranscribeResponse> {
    const audioBuffer = await fs.readFile(audioPath);

    const formData = new FormData();

    formData.append(
      'file',
      new Blob([new Uint8Array(audioBuffer)], {
        type: 'audio/wav',
      }),
      'audio.wav',
    );

    const response = await fetch(
      `${this.requireAiServiceUrl()}/transcribe`,
      {
        method: 'POST',
        body: formData,
      },
    );

    if (!response.ok) {
      throw new BadRequestException(
        `Transcribe service error (${response.status}): ${await response.text()}`,
      );
    }

    const payload = (await response.json()) as unknown;
    const parsed = this.parseTranscribePayload(payload);
    const text = parsed.text;

    if (!text) {
      throw new BadRequestException(
        'Transcribe service returned empty transcript',
      );
    }

    return {
      text,
      language: parsed.language,
      timestamps: parsed.timestamps,
    };
  }

  private async summarise(text: string, language: string): Promise<SummariseResponse> {
    const response = await fetch(`${this.requireAiServiceUrl()}/summarize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, language }),
    });

    if (!response.ok) {
      throw new BadRequestException(
        `Summarise service error (${response.status}): ${await response.text()}`,
      );
    }

    const payload = (await response.json()) as unknown;
    const summary = this.parseSummaryPayload(payload);

    if (!summary) {
      throw new BadRequestException(
        'Summarise service returned empty summary',
      );
    }

    return {
      summary,
    };
  }

  private async moderate(text: string): Promise<ModerateResponse> {
    const response = await fetch(`${this.requireAiServiceUrl()}/moderation/text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
     });

    if (!response.ok) {
      throw new BadRequestException(
        `Moderate service error (${response.status}): ${await response.text()}`,
      );
    }

    const payload = (await response.json()) as unknown;
    return this.parseModerationPayload(payload);
  }

  private async upsertAnalysis(
    payload: ProcessingJobPayload,

    transcript: TranscribeResponse,

    summary: SummariseResponse,

    moderation: ModerateResponse,
  ): Promise<void> {
    const type =
      payload.type === 'livestream'
        ? 'LIVESTREAM'
        : 'DOCUMENT';

    const itemField =
      payload.type === 'livestream'
        ? {
            recordingId: payload.itemId,
            documentId: null,
          }
        : {
            recordingId: null,
            documentId: payload.itemId,
          };

    await this.prisma.mongo.aiTranscriptSummary.upsert({
      where: {
        id: payload.itemId,
      },

      create: {
        id: payload.itemId,

        type,

        ...itemField,

        transcript:
          transcript as unknown as Prisma.JsonValue,

        summary: summary.summary,

        moderationResult:
          moderation as unknown as Prisma.InputJsonValue,

        moderationCheckedAt: new Date(),

        transcriptGeneratedAt: new Date(),

        summaryGeneratedAt: new Date(),
      },

      update: {
        type,

        ...itemField,

        transcript:
          transcript as unknown as Prisma.InputJsonValue,

        summary: summary.summary,

        moderationResult:
          moderation as unknown as Prisma.InputJsonValue,

        moderationCheckedAt: new Date(),

        transcriptGeneratedAt: new Date(),

        summaryGeneratedAt: new Date(),
      },
    });
  }

  private parseTranscribePayload(payload: unknown): TranscribeResponse {
    if (!payload || typeof payload !== 'object') {
      return { text: '', language: 'und', timestamps: [] };
    }

    const data = payload as Record<string, unknown>;
    const nestedData = data.data && typeof data.data === 'object' ? (data.data as Record<string, unknown>) : null;
    const result = nestedData?.result && typeof nestedData.result === 'object'
      ? (nestedData.result as Record<string, unknown>)
      : null;

    const textCandidate = result?.text ?? result?.full_text ?? data.text ?? data.transcript;
    const languageCandidate = result?.language ?? nestedData?.language ?? data.language;
    const timestampsCandidate = result?.timestamps ?? nestedData?.timestamps ?? data.timestamps;

    const text = typeof textCandidate === 'string' ? textCandidate.trim() : '';
    const language =
      typeof languageCandidate === 'string' && languageCandidate.trim()
        ? languageCandidate.trim()
        : 'und';
    const timestamps = Array.isArray(timestampsCandidate)
      ? timestampsCandidate as Prisma.JsonValue[]
      : [];

    return { text, language, timestamps };
  }

  private parseSummaryPayload(payload: unknown): string {
    if (typeof payload === 'string') {
      return payload.trim();
    }

    if (!payload || typeof payload !== 'object') {
      return '';
    }

    const data = payload as Record<string, unknown>;
    const nestedData = data.data && typeof data.data === 'object' ? (data.data as Record<string, unknown>) : null;
    const summaryCandidate = data.summary ?? data.result ?? data.text ?? nestedData?.summary ?? nestedData?.result ?? nestedData?.text;

    return typeof summaryCandidate === 'string' ? summaryCandidate.trim() : '';
  }

  private parseModerationPayload(payload: unknown): ModerateResponse {
    if (!payload || typeof payload !== 'object') {
      return {
        status: 'UNKNOWN',
        score: 0,
        categories: [],
        toxic_word: [],
      };
    }

    const data = payload as Record<string, unknown>;
    const nestedData = data.data && typeof data.data === 'object' ? (data.data as Record<string, unknown>) : null;
    const moderation =
      (nestedData?.moderation && typeof nestedData.moderation === 'object'
        ? (nestedData.moderation as Record<string, unknown>)
        : null) ||
      (data.moderation && typeof data.moderation === 'object'
        ? (data.moderation as Record<string, unknown>)
        : data);

    const score = typeof moderation.score === 'number' ? moderation.score : 0;
    const categories = Array.isArray(moderation.categories)
      ? moderation.categories.filter((category): category is string => typeof category === 'string')
      : [];
    const toxicSource = moderation.toxic_word ?? moderation.toxic_words ?? moderation.toxicWords;
    const toxic_word = Array.isArray(toxicSource)
      ? toxicSource
          .map((value) => {
            if (typeof value === 'string') {
              return value.trim();
            }

            if (value && typeof value === 'object') {
              const item = value as Record<string, unknown>;
              const candidate = item.word ?? item.token ?? item.value ?? item.label;
              return typeof candidate === 'string' ? candidate.trim() : '';
            }

            return '';
          })
          .filter((value) => value.length > 0)
      : [];

    return {
      status: typeof moderation.status === 'string' && moderation.status.trim()
        ? moderation.status.trim().toUpperCase()
        : 'UNKNOWN',
      score,
      categories,
      toxic_word: Array.from(new Set(toxic_word)),
    };
  }

  private getSourceFileName(payload: ProcessingJobPayload): string {
    const urlPath = new URL(payload.fileUrl).pathname;
    const extension = path.extname(urlPath) || '.bin';
    return `${payload.itemId}${extension}`;
  }


  private isVideoFile(fileUrl: string): boolean {
    const extension = path.extname(new URL(fileUrl).pathname).toLowerCase();
    return ['.mp4', '.webm', '.mov', '.mkv', '.avi', '.m4v'].includes(extension);
  }

  private requireAiServiceUrl(): string {
    if (!this.aiServiceUrl) {
      throw new BadRequestException(
        'AI_SERVICE_URL is not configured',
      );
    }

    return this.aiServiceUrl;
  }
}

