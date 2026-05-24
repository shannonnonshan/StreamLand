import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import { Prisma } from '@prisma/client';
import { Job } from 'bull';
import { createWriteStream, promises as fs } from 'fs';
import { spawn } from 'child_process';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import * as os from 'os';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { R2StorageService } from '../r2-storage/r2-storage.service';
import {
  PROCESSING_JOB_NAME,
  PROCESSING_QUEUE_NAME,
  ProcessingJobPayload,
  ProcessingJobStatus,
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
  score: number;
  label: string;
  categories: string[];
}

@Processor(PROCESSING_QUEUE_NAME)
@Injectable()
export class ProcessingProcessor {
  private readonly logger = new Logger(ProcessingProcessor.name);
  private readonly aiServiceUrl = (process.env.AI_SERVICE_URL || '').replace(/\/$/, '');

  constructor(
    private readonly prisma: PrismaService,
    private readonly r2StorageService: R2StorageService,
  ) {}

  @Process(PROCESSING_JOB_NAME)
  async handle(job: Job<ProcessingJobPayload>): Promise<void> {
    const payload = job.data;
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'streamland-processing-'));

    try {
      this.logger.log(
        `Processing started for ${payload.type}:${payload.itemId} (${payload.title}) [attempt ${job.attemptsMade + 1}/${job.opts.attempts || 1}]`,
      );
      await this.updateProcessingStatus(payload, 'PROCESSING');

      const sourcePath = await this.downloadFile(payload.fileUrl, tempDir, this.getSourceFileName(payload));
      const audioFileUrl = await this.prepareAudioFileUrl(payload, sourcePath, tempDir);

      const transcript = await this.transcribe(audioFileUrl);
      const summary = await this.summarise(transcript.text, transcript.language);
      const moderation = await this.moderate(transcript.text);

      await this.upsertAnalysis(payload, transcript, summary, moderation);
      await this.updateProcessingStatus(payload, 'DONE');
      this.logger.log(`Processing finished for ${payload.type}:${payload.itemId}`);
    } catch (error) {
      await this.updateProcessingStatus(payload, 'FAILED').catch(() => undefined);
      this.logger.error(
        `Processing failed for ${payload.type}:${payload.itemId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error instanceof Error ? error : new Error(String(error));
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private async updateProcessingStatus(
    payload: ProcessingJobPayload,
    status: ProcessingJobStatus,
  ): Promise<void> {
    const data = { processingStatus: status };

    if (payload.type === 'livestream') {
      await this.prisma.postgres.liveStream.update({
        where: { id: payload.itemId },
        data,
      });
      return;
    }

    await this.prisma.postgres.document.update({
      where: { id: payload.itemId },
      data,
    });
  }

  private async downloadFile(fileUrl: string, tempDir: string, fileName: string): Promise<string> {
    const response = await fetch(fileUrl);

    if (!response.ok || !response.body) {
      throw new BadRequestException(`Failed to download file (${response.status})`);
    }

    const destinationPath = path.join(tempDir, fileName);
    await pipeline(Readable.fromWeb(response.body as any), createWriteStream(destinationPath));
    return destinationPath;
  }

  private async exportAudioIfNeeded(sourcePath: string, tempDir: string, fileUrl: string): Promise<string> {
    if (!this.isVideoFile(fileUrl)) {
      return sourcePath;
    }

    const audioPath = path.join(tempDir, `${path.parse(sourcePath).name}.wav`);

    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
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
      ffmpeg.on('error', (error) => reject(error));
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(new Error(`ffmpeg failed with code ${code}: ${stderr}`));
      });
    });

    return audioPath;
  }

  private async prepareAudioFileUrl(payload: ProcessingJobPayload, sourcePath: string, tempDir: string): Promise<string> {
    if (!this.isVideoFile(payload.fileUrl)) {
      return payload.fileUrl;
    }

    const audioPath = await this.exportAudioIfNeeded(sourcePath, tempDir, payload.fileUrl);
    const audioBuffer = await fs.readFile(audioPath);

    if (payload.type === 'livestream') {
      return this.r2StorageService.uploadRecordingAudioByUrl(payload.fileUrl, audioBuffer);
    }

    return this.r2StorageService.uploadDocumentAudioByUrl(payload.fileUrl, audioBuffer);
  }

  private async transcribe(fileUrl: string): Promise<TranscribeResponse> {
    const response = await fetch(`${this.requireAiServiceUrl()}/transcribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fileUrl }),
    });

    if (!response.ok) {
      throw new BadRequestException(`Transcribe service error (${response.status}): ${await response.text()}`);
    }

    const payload = (await response.json()) as Partial<TranscribeResponse>;
    const text = typeof payload.text === 'string' ? payload.text.trim() : '';

    if (!text) {
      throw new BadRequestException('Transcribe service returned an empty transcript');
    }

    return {
      text,
      language: typeof payload.language === 'string' && payload.language.trim() ? payload.language.trim() : 'und',
      timestamps: Array.isArray(payload.timestamps) ? payload.timestamps : [],
    };
  }

  private async summarise(text: string, language: string): Promise<SummariseResponse> {
    const response = await fetch(`${this.requireAiServiceUrl()}/summarise`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, language }),
    });

    if (!response.ok) {
      throw new BadRequestException(`Summarise service error (${response.status}): ${await response.text()}`);
    }

    const payload = (await response.json()) as Partial<SummariseResponse>;
    const summary = typeof payload.summary === 'string' ? payload.summary.trim() : '';

    if (!summary) {
      throw new BadRequestException('Summarise service returned an empty summary');
    }

    return { summary };
  }

  private async moderate(text: string): Promise<ModerateResponse> {
    const response = await fetch(`${this.requireAiServiceUrl()}/moderate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      throw new BadRequestException(`Moderate service error (${response.status}): ${await response.text()}`);
    }

    const payload = (await response.json()) as Partial<ModerateResponse>;

    return {
      score: typeof payload.score === 'number' ? payload.score : 0,
      label: typeof payload.label === 'string' ? payload.label : 'UNKNOWN',
      categories: Array.isArray(payload.categories)
        ? payload.categories.filter((category): category is string => typeof category === 'string')
        : [],
    };
  }

  private async upsertAnalysis(
    payload: ProcessingJobPayload,
    transcript: TranscribeResponse,
    summary: SummariseResponse,
    moderation: ModerateResponse,
  ): Promise<void> {
    const type = payload.type === 'livestream' ? 'LIVESTREAM' : 'DOCUMENT';
    const itemField =
      payload.type === 'livestream'
        ? { recordingId: payload.itemId, documentId: null }
        : { recordingId: null, documentId: payload.itemId };

    await this.prisma.mongo.aiTranscriptSummary.upsert({
      where: {
        id: payload.itemId,
      },
      create: {
        id: payload.itemId,
        type,
        ...itemField,
        transcript: transcript as unknown as Prisma.InputJsonValue,
        summary: summary.summary,
        moderationResult: moderation as unknown as Prisma.InputJsonValue,
        moderationCheckedAt: new Date(),
        transcriptGeneratedAt: new Date(),
        summaryGeneratedAt: new Date(),
      },
      update: {
        type,
        ...itemField,
        transcript: transcript as unknown as Prisma.InputJsonValue,
        summary: summary.summary,
        moderationResult: moderation as unknown as Prisma.InputJsonValue,
        moderationCheckedAt: new Date(),
        transcriptGeneratedAt: new Date(),
        summaryGeneratedAt: new Date(),
      },
    });
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
      throw new BadRequestException('AI_SERVICE_URL is not configured');
    }

    return this.aiServiceUrl;
  }
}