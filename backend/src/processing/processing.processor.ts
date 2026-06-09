import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import { Prisma, RecordingApprovalStatus } from '@prisma/client';
import { Job } from 'bull';
import { createWriteStream, promises as fs } from 'fs';
import { inspect } from 'util';
import { spawn } from 'child_process';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import * as os from 'os';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { R2StorageService } from '../r2-storage/r2-storage.service';
import logFetch from '../utils/aiFetch';
import { ProcessingStateService } from './processing-state.service';
import { ProcessingGateway } from './processing.gateway';
import {
  PROCESSING_JOB_NAME,
  PROCESSING_QUEUE_NAME,
  PROCESSING_STAGE_PROGRESS,
  ProcessingEntityType,
  ProcessingJobPayload,
  ProcessingJobStatus,
  ProcessingStep,
  ProcessingStepStatus,
} from './processing.types';

interface TranscribeResponse {
  text: string;
  language: string;
  timestamps: Prisma.JsonValue[];
  payload: Prisma.JsonValue;
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
  processingStage?: 'extracting_audio' | 'uploading_audio' | 'transcribing' | 'done' | 'error';
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

@Processor(PROCESSING_QUEUE_NAME)
@Injectable()
export class ProcessingProcessor {
  private readonly logger = new Logger(ProcessingProcessor.name);
  private readonly aiServiceUrl = (process.env.AI_SERVICE_URL || '').replace(/\/$/, '');

  constructor(
    private readonly prisma: PrismaService,
    private readonly r2StorageService: R2StorageService,
    private readonly processingStateService: ProcessingStateService,
    private readonly processingGateway: ProcessingGateway,
  ) {}

  private async emitStep(
    entityType: ProcessingEntityType,
    entityId: string,
    step: ProcessingStep,
    status: ProcessingStepStatus,
    message?: string,
  ): Promise<void> {
    await this.processingStateService.updateStep({ entityType, entityId, step, status, message });
    this.processingGateway.emitProcessingStepUpdate({
      entityId,
      entityType,
      step,
      status,
      message,
      timestamp: new Date().toISOString(),
    });
  }

  @Process(PROCESSING_JOB_NAME)
  async handle(job: Job<ProcessingJobPayload>): Promise<void> {
    const payload = job.data;
    const entityType: ProcessingEntityType = payload.type === 'livestream' ? 'LIVESTREAM' : 'DOCUMENT';
    const entityId = payload.itemId;
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'streamland-processing-'));
    let latestProgress = PROCESSING_STAGE_PROGRESS.preparing;
    let transcriptCompleted = false;

    try {
      this.logger.log(`Processing started for ${payload.type}:${entityId} (${payload.title})`);

      await this.updateProcessingStatus(payload, 'PROCESSING');

      const audioUrl = payload.audioUrl || null;

      if (!audioUrl) {
        await this.updateProcessingAnalysis(payload, {
          transcriptStatus: 'processing',
          transcriptError: null,
          processingStage: 'extracting_audio',
          processingProgress: PROCESSING_STAGE_PROGRESS.preparing,
          processingError: null,
        });

        this.logger.log(`[1/5] Downloading source file...`);
        const sourcePath = await this.downloadFile(payload.fileUrl, tempDir, this.getSourceFileName(payload));

        this.logger.log(`[2/5] Preparing audio...`);
        await this.updateProcessingAnalysis(payload, {
          processingStage: 'uploading_audio',
          processingProgress: 25,
          processingError: null,
        });

        const preparedAudioUrl = await this.prepareAudioFileUrl(payload, sourcePath, tempDir);
        payload.audioUrl = preparedAudioUrl;
      } else {
        this.logger.log(`[1/5] Reusing existing audio URL, skipping extract/upload...`);
        await this.updateProcessingAnalysis(payload, {
          transcriptStatus: 'processing',
          transcriptError: null,
          processingStage: 'transcribing',
          processingProgress: PROCESSING_STAGE_PROGRESS.transcribing,
          processingError: null,
        });
      }

      const effectiveAudioUrl = payload.audioUrl || audioUrl;

      latestProgress = PROCESSING_STAGE_PROGRESS.transcribing;
      await this.updateProcessingAnalysis(payload, {
        processingStage: 'transcribing',
        processingProgress: latestProgress,
      });

      this.logger.log(`[3/5] Transcribing audio...`);
      await this.waitForAiService();
      const transcript = await this.transcribe(effectiveAudioUrl as string);
      transcriptCompleted = true;

      latestProgress = PROCESSING_STAGE_PROGRESS.summarizing;
      await this.updateProcessingAnalysis(payload, {
        transcriptStatus: 'success',
        transcriptError: null,
        transcript: transcript as unknown as Prisma.JsonValue,
        transcriptGeneratedAt: new Date(),
        processingStage: 'transcribing',
        processingProgress: latestProgress,
      });

      await this.waitForAiService();
      this.logger.log(`[4/5] Summarizing transcript... (detected language: ${transcript.language})`);
      const summary = await this.summarise(transcript.text, transcript.language);

      latestProgress = PROCESSING_STAGE_PROGRESS.moderating;
      await this.updateProcessingAnalysis(payload, {
        summary: summary.summary,
        summaryGeneratedAt: new Date(),
        processingStage: 'transcribing',
        processingProgress: latestProgress,
      });

      this.logger.log(`[5/5] Moderating transcript...`);
      const moderation = await this.moderate(transcript.text);
      let approvalStatus: RecordingApprovalStatus;
      switch (moderation.status) {
        case 'SAFE':
          approvalStatus = 'TRUE';
          break;

        case 'REVIEW':
          approvalStatus = 'FALSE';
          break;

        case 'BLOCK':
          approvalStatus = 'REJECTED';
          break;

        default:
          approvalStatus = 'FALSE';
      }
      this.logger.log(`Saving AI analysis results...`);
      await this.upsertAnalysis(payload, transcript, summary, moderation);
      if (payload.type === 'livestream') {
        await this.prisma.postgres.liveStream.update({
          where: { id: payload.itemId },
          data: {
            isApprove: approvalStatus,
          },
        });
      } else {
        await this.prisma.postgres.document.update({
          where: { id: payload.itemId },
          data: {
            isApprove: approvalStatus,
          },
        });
      }
      await this.updateProcessingAnalysis(payload, {
        processingStage: 'done',
        processingProgress: PROCESSING_STAGE_PROGRESS.done,
        processingError: null,
      });

      await this.updateProcessingStatus(payload, 'DONE');

      this.logger.log(`Processing finished for ${payload.type}:${entityId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      await this.updateProcessingAnalysis(payload, {
        transcriptStatus: transcriptCompleted ? 'success' : 'error',
        transcriptError: transcriptCompleted ? null : message,
        processingStage: 'error',
        processingProgress: latestProgress,
        processingError: message,
      }).catch(() => undefined);

      await this.updateProcessingStatus(payload, 'FAILED').catch(() => undefined);

      this.logger.error(
        `Processing failed for ${payload.type}:${entityId}`,
        error instanceof Error ? error.stack : String(error),
      );

      throw error instanceof Error ? error : new Error(String(error));
    } finally {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
        this.logger.log(`Removed temp dir ${tempDir}`);
      } catch (err) {
        this.logger.warn(`Failed to remove temp dir ${tempDir}: ${String(err)}`);
      }
    }
  }
  private async waitForAiService(maxWaitMs = 5 * 60 * 1000): Promise<void> {
    const interval = 15000; 
    const start = Date.now();

    while (Date.now() - start < maxWaitMs) {
      try {
        const res = await fetch(`${this.requireAiServiceUrl()}/health`, {
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          this.logger.log('[AI] Service is up');
          return;
        }
      } catch {
        this.logger.warn('[AI] Service not ready, waiting...');
      }
      await new Promise(res => setTimeout(res, interval));
    }

    throw new Error('AI service unavailable after waiting');
  }
  private async updateProcessingStatus(
    payload: ProcessingJobPayload,
    status: ProcessingJobStatus,
  ): Promise<void> {
    const data = { processingStatus: status };
    if (payload.type === 'livestream') {
      await this.prisma.postgres.liveStream.update({ where: { id: payload.itemId }, data });
      return;
    }
    await this.prisma.postgres.document.update({ where: { id: payload.itemId }, data });
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
            type: payload.type === 'livestream' ? 'LIVESTREAM' : 'DOCUMENT',
            ...itemField,
          },
          u: {
            $set: {
              id: payload.itemId,
              type: payload.type === 'livestream' ? 'LIVESTREAM' : 'DOCUMENT',
              ...itemField,
              ...mongoData,
              updatedAt: new Date(),
            },
            $setOnInsert: {
              id: payload.itemId,
              type: payload.type === 'livestream' ? 'LIVESTREAM' : 'DOCUMENT',
              ...itemField,
              createdAt: new Date(),
            },
          },
          upsert: true,
        },
      ],
    });
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

    await this.prisma.mongo.$runCommandRaw({
      update: 'ai_transcript_summary',
      updates: [
        {
          q: {
            type,
            ...itemField,
          },
          u: {
            $set: {
              transcript: transcript as unknown as Prisma.InputJsonValue,
              summary: summary.summary,
              moderationResult: moderation as unknown as Prisma.InputJsonValue,
              moderationCheckedAt: new Date(),
              transcriptGeneratedAt: new Date(),
              summaryGeneratedAt: new Date(),
              updatedAt: new Date(),
            },
            $setOnInsert: {
              type,
              ...itemField,
              createdAt: new Date(),
            },
          },
          upsert: true,
        },
      ],
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

  private async exportAudioToWav(sourcePath: string, tempDir: string): Promise<string> {
    const audioPath = path.join(tempDir, `${path.parse(sourcePath).name}.wav`);
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-y', '-i', sourcePath,
        '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', '-f', 'wav',
        audioPath,
      ]);
      let stderr = '';
      ffmpeg.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
      ffmpeg.on('error', (error) => reject(error));
      ffmpeg.on('close', (code) => {
        if (code === 0) { resolve(); return; }
        reject(new Error(`ffmpeg failed with code ${code}: ${stderr}`));
      });
    });
    return audioPath;
  }

  private async prepareAudioFileUrl(payload: ProcessingJobPayload, sourcePath: string, tempDir: string): Promise<string> {
    const audioPath = await this.exportAudioToWav(sourcePath, tempDir);
    const audioBuffer = await fs.readFile(audioPath);
    const audioUrl = payload.type === 'livestream'
      ? await this.r2StorageService.uploadRecordingAudioById(payload.itemId, audioBuffer)
      : await this.r2StorageService.uploadDocumentAudioById(payload.itemId, audioBuffer);

    await Promise.all([
      fs.unlink(audioPath).catch(() => undefined),
      fs.unlink(sourcePath).catch(() => undefined),
    ]);

    try {
      if (payload.type === 'livestream') {
        const updated = await this.prisma.postgres.liveStream.update({ where: { id: payload.itemId }, data: { audioUrl } as any });
        this.logger.log(`[Processor] Persisted audioUrl for livestream ${payload.itemId}: ${String(updated.audioUrl)}`);
      } else {
        const updated = await this.prisma.postgres.document.update({ where: { id: payload.itemId }, data: { audioUrl } as any });
        this.logger.log(`[Processor] Persisted audioUrl for document ${payload.itemId}: ${String((updated as any).audioUrl)}`);
      }
    } catch (err) {
      this.logger.warn('Failed to persist audioUrl to Postgres', String(err));
    }

    return audioUrl;
  }

  private async transcribe(fileUrl: string): Promise<TranscribeResponse> {
    const formData = new FormData();
    formData.append('file_url', fileUrl);
    const response = await logFetch(`${this.requireAiServiceUrl()}/transcribe`, {
      method: 'POST',
      body: formData,
      timeoutMs: 30 * 60 * 1000,
    }, this.logger as any);

    if (!response.ok) {
      throw new BadRequestException(`Transcribe service error (${response.status}): ${await response.text()}`);
    }

    const reader = (response.body as any).getReader();
    const decoder = new TextDecoder();
    let responseText = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      responseText += decoder.decode(value, { stream: true });
    }
    responseText += decoder.decode();
    const parsed = this.parseTranscribeNdjsonPayload(responseText);
    if (!parsed.text) {
      throw new BadRequestException('Transcribe service returned an empty transcript');
    }
    return { text: parsed.text, language: parsed.language, timestamps: parsed.timestamps, payload: parsed.payload };
  }

  /**
   * Detect whether text is more likely Vietnamese or English.
   *
   * Strategy:
   *  1. If Whisper already returned a supported language, trust it.
   *  2. Otherwise count Vietnamese diacritic characters in the text.
   *     Vietnamese has a high density of tone marks (à á ả ã ạ ă â ê ô ơ ư đ …).
   *     A ratio > 8 % of total chars strongly suggests Vietnamese.
   *  3. If still ambiguous (ratio 2–8 %), call the summarize API with both
   *     languages concurrently and pick the longer (more coherent) result.
   */
  private detectLanguage(whisperLang: string, text: string): 'en' | 'vi' | 'ambiguous' {
    const lang = whisperLang.trim().toLowerCase();
    if (lang === 'vi' || lang === 'vietnamese') return 'vi';
    if (lang === 'en' || lang === 'english') return 'en';

    // Heuristic: Vietnamese-specific characters (incl. tone marks and special vowels)
    const viChars = (text.match(/[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ]/g) || []).length;
    const ratio = text.length > 0 ? viChars / text.length : 0;

    this.logger.log(`[Summarise] Language detection: whisper="${whisperLang}" viCharRatio=${(ratio * 100).toFixed(1)}%`);

    if (ratio > 0.08) return 'vi';
    if (ratio < 0.02) return 'en';
    return 'ambiguous';
  }

  private async summariseWithLanguage(text: string, language: 'en' | 'vi'): Promise<string | null> {
    const response = await logFetch(`${this.requireAiServiceUrl()}/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, language }),
    }, this.logger as any);

    if (!response.ok) {
      this.logger.warn(`[Summarise] ${language} attempt failed (${response.status})`);
      return null;
    }

    const payload = (await response.json()) as unknown;
    return this.parseSummaryPayload(payload) || null;
  }

  private async summarise(text: string, whisperLanguage: string): Promise<SummariseResponse> {
    const detected = this.detectLanguage(whisperLanguage, text);

    if (detected !== 'ambiguous') {
      this.logger.log(`[Summarise] Using language "${detected}" (detected from whisper="${whisperLanguage}")`);
      const response = await logFetch(`${this.requireAiServiceUrl()}/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language: detected }),
      }, this.logger as any);

      if (!response.ok) {
        throw new BadRequestException(`Summarise service error (${response.status}): ${await response.text()}`);
      }

      const payload = (await response.json()) as unknown;
      const summary = this.parseSummaryPayload(payload);
      if (!summary) {
        throw new BadRequestException('Summarise service returned an empty summary');
      }
      return { summary };
    }

    // Ambiguous language: call both concurrently and pick the better (longer) result
    this.logger.log(`[Summarise] Ambiguous language — calling both "en" and "vi" concurrently`);
    const [enSummary, viSummary] = await Promise.all([
      this.summariseWithLanguage(text, 'en'),
      this.summariseWithLanguage(text, 'vi'),
    ]);

    this.logger.log(`[Summarise] Dual-call results — en=${enSummary?.length ?? 0} chars, vi=${viSummary?.length ?? 0} chars`);

    const summary = (enSummary?.length ?? 0) >= (viSummary?.length ?? 0)
      ? enSummary
      : viSummary;

    if (!summary) {
      throw new BadRequestException('Summarise service returned empty results for both en and vi');
    }

    return { summary };
  }

  private async moderate(text: string): Promise<ModerateResponse> {
      const MAX_RETRIES = 10;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const response = await logFetch(`${this.requireAiServiceUrl()}/moderation/text`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
          }, this.logger as any);

          if (!response.ok) {
            throw new BadRequestException(`Moderate service error (${response.status}): ${await response.text()}`);
          }

          const payload = (await response.json()) as unknown;
          return this.parseModerationPayload(payload);

        } catch (err) {
          this.logger.warn(`[MODERATION] Attempt ${attempt + 1}/${MAX_RETRIES + 1} failed: ${String(err)}`);
          if (attempt < MAX_RETRIES) {
            await new Promise(res => setTimeout(res, 3000 * (attempt + 1)));
          }
        }
      }

      this.logger.error('[MODERATION] All retries exhausted, returning default REVIEW result');
      return this.parseModerationPayload({
        status: 'success',
        moderation: {
          status: 'REVIEW',
          toxic_word: [],
          score: 0.0,
          categories: [],
        },
      });
    }

  private async logTranscriptReadback(payload: ProcessingJobPayload): Promise<void> {
    const itemField =
      payload.type === 'livestream'
        ? { recordingId: payload.itemId, documentId: null }
        : { recordingId: null, documentId: payload.itemId };

    const rawResult = await this.prisma.mongo.$runCommandRaw({
      find: 'ai_transcript_summary',
      filter: { type: payload.type === 'livestream' ? 'LIVESTREAM' : 'DOCUMENT', ...itemField },
      limit: 1,
    });

    const firstBatch = (rawResult as { cursor?: { firstBatch?: Array<Record<string, unknown>> } }).cursor?.firstBatch || [];
    const transcriptRecord = firstBatch[0] || null;
    this.logger.log(
      `[Transcript readback] documentId=${transcriptRecord?.documentId ?? null} transcriptExists=${Boolean(transcriptRecord?.transcript)} transcriptGeneratedAt=${transcriptRecord?.transcriptGeneratedAt ?? null}`,
    );
    this.logger.log(`[Transcript readback raw result] ${inspect(rawResult, { depth: null, compact: false })}`);
  }

  private parseTranscribeNdjsonPayload(payloadText: string): TranscribeResponse {
    const lines = payloadText.split('\n').map((line) => line.trim()).filter(Boolean);
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line) as { status?: unknown; data?: unknown };
        if (parsed.status !== 'success') continue;
        return this.parseTranscribePayload(parsed.data);
      } catch { continue; }
    }
    return { text: '', language: 'und', timestamps: [], payload: null };
  }

  private parseTranscribePayload(payload: unknown): TranscribeResponse {
    if (!payload || typeof payload !== 'object') return { text: '', language: 'und', timestamps: [], payload: null };
    const data = payload as Record<string, unknown>;
    const result = data.result && typeof data.result === 'object' ? (data.result as Record<string, unknown>) : null;
    const textCandidate = result?.text ?? data.text ?? data.transcript ?? data.full_text;
    const languageCandidate = result?.language ?? data.language;
    const timestampsCandidate = result?.timestamps ?? data.timestamps ?? result?.segments ?? data.segments;
    const text = typeof textCandidate === 'string' ? textCandidate.trim() : '';
    const language = typeof languageCandidate === 'string' && languageCandidate.trim() ? languageCandidate.trim() : 'und';
    const timestamps = Array.isArray(timestampsCandidate) ? timestampsCandidate as Prisma.JsonValue[] : [];
    return { text, language, timestamps, payload: data as Prisma.JsonValue };
  }

  private parseSummaryPayload(payload: unknown): string {
    if (typeof payload === 'string') return payload.trim();
    if (!payload || typeof payload !== 'object') return '';
    const data = payload as Record<string, unknown>;
    const nestedData = data.data && typeof data.data === 'object' ? (data.data as Record<string, unknown>) : null;
    const summaryCandidate = data.summary ?? data.result ?? data.text ?? nestedData?.summary ?? nestedData?.result ?? nestedData?.text;
    return typeof summaryCandidate === 'string' ? summaryCandidate.trim() : '';
  }

  private parseModerationPayload(payload: unknown): ModerateResponse {
    if (!payload || typeof payload !== 'object') return { status: 'UNKNOWN', score: 0, categories: [], toxic_word: [] };
    const data = payload as Record<string, unknown>;
    const nestedData = data.data && typeof data.data === 'object' ? (data.data as Record<string, unknown>) : null;
    const moderation =
      (nestedData?.moderation && typeof nestedData.moderation === 'object' ? (nestedData.moderation as Record<string, unknown>) : null) ||
      (data.moderation && typeof data.moderation === 'object' ? (data.moderation as Record<string, unknown>) : data);
    const score = typeof moderation.score === 'number' ? moderation.score : 0;
    const categories = Array.isArray(moderation.categories)
      ? moderation.categories.filter((c): c is string => typeof c === 'string')
      : [];
    const toxicSource = moderation.toxic_word ?? moderation.toxic_words ?? moderation.toxicWords;
    const toxic_word = Array.isArray(toxicSource)
      ? toxicSource.map((value) => {
          if (typeof value === 'string') return value.trim();
          if (value && typeof value === 'object') {
            const item = value as Record<string, unknown>;
            const candidate = item.word ?? item.token ?? item.value ?? item.label;
            return typeof candidate === 'string' ? candidate.trim() : '';
          }
          return '';
        }).filter((v) => v.length > 0)
      : [];
    return {
      status: typeof moderation.status === 'string' && moderation.status.trim() ? moderation.status.trim().toUpperCase() : 'UNKNOWN',
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
    if (!this.aiServiceUrl) throw new BadRequestException('AI_SERVICE_URL is not configured');
    return this.aiServiceUrl;
  }
}