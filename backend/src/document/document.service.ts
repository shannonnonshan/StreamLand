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
import { createWriteStream, promises as fs } from 'fs';
import { spawn } from 'child_process';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
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

export interface DocumentAiAnalysisResponse {
  documentId: string;
  transcript: Prisma.JsonValue | null;
  summary: string | null;
  audioUrl: string | null;
  toxicWords: string[];
  validationRate: number;
  moderationLabel: string | null;
  moderationCategories: string[];
  transcriptStatus: 'idle' | 'processing' | 'success' | 'error';
  transcriptError: string | null;
  transcriptGeneratedAt: Date | null;
  summaryGeneratedAt: Date | null;
  cached?: boolean;
}

@Injectable()
export class DocumentService {
  private readonly aiTranscriptSummaryCollection = 'ai_transcript_summary';
  private readonly logger = new Logger(DocumentService.name);
  private readonly localAiBaseUrl = (process.env.LOCAL_AI_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');

  constructor(
    private prisma: PrismaService,
    private r2StorageService: R2StorageService,
  ) {}

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

  private async downloadToBuffer(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new BadRequestException(`Cannot download file: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
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

    if (user.role === 'ADMIN') {
      return document;
    }

    if (user.role === 'TEACHER') {
      if (document.teacherId !== user.sub) {
        throw new ForbiddenException('You can only access your own documents');
      }
      return document;
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
    autoTranscribe: boolean = true,
  ): Promise<DocumentAiAnalysisResponse> {
    await this.assertDocumentAccess(documentId, user);
    const analysis = await this.getDocumentAiAnalysisDocument(documentId);

    if (autoTranscribe && (!analysis || !analysis.transcript)) {
      return await this.generateDocumentTranscript(documentId, false, user);
    }

    return {
      documentId,
      transcript: analysis?.transcript || null,
      summary: analysis?.summary || null,
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

  async getDocumentModeration(documentId: string, user: { sub: string; role?: string }) {
    const analysis = await this.getDocumentAiAnalysis(documentId, user, false);
    const transcriptText = this.getTranscriptText(analysis.transcript);
    if (transcriptText) {
      this.logger.log(`[Moderation] Document ${documentId} - invoking moderation API; textLen=${transcriptText.length}`);
    }
    const moderationResult = transcriptText ? await this.callModerationApi(transcriptText) : null;

    if (moderationResult) {
      const { score, toxic_word, label, categories } = moderationResult;

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
        const moderationResult = await this.callModerationApi(transcriptText);

        if (moderationResult) {
          const { score, toxic_word, label, categories } = moderationResult;

          await this.upsertDocumentAiAnalysis(documentId, {
            toxicWords: toxic_word || [],
            validationRate: typeof score === 'number' ? score : 0,
            moderationLabel: label || null,
            moderationCategories: categories || [],
          });
        }
      } catch (modErr) {
        this.logger.warn('Moderation call failed', String(modErr));
      }

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
      await this.upsertDocumentAiAnalysis(documentId, {
        transcriptStatus: 'processing',
        transcriptError: null,
      });

      const audioExists = await this.r2StorageService.documentAudioExistsById(documentId);
      let audioUrl = existing?.audioUrl || (audioExists ? this.r2StorageService.getDocumentAudioUrlById(documentId) : null);
      let audioBuffer: Buffer | null = null;

      if (audioUrl) {
        audioBuffer = await this.downloadToBuffer(audioUrl);
      } else {
        const response = await fetch(document.fileUrl);
        if (!response.ok || !response.body) {
          throw new BadRequestException(`Cannot download document file: ${response.status}`);
        }

        const tempBase = `document-${documentId}-${Date.now()}`;
        const inputPath = path.join(os.tmpdir(), `${tempBase}.${this.getInputExtension(document.mimeType)}`);
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
          audioUrl = await this.r2StorageService.uploadDocumentAudioById(documentId, audioBuffer);
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
      formData.append('file', new Blob([audioBytes], { type: 'audio/wav' }), `${documentId}.wav`);

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
        await this.upsertDocumentAiAnalysis(documentId, {
          transcriptStatus: 'error',
          transcriptError: 'Transcribe service returned empty transcript',
        });
        throw new BadRequestException('Transcribe service returned empty transcript');
      }

      await this.upsertDocumentAiAnalysis(documentId, {
        transcriptStatus: 'success',
        transcriptError: null,
        transcript,
        audioUrl: audioUrl || undefined,
        transcriptGeneratedAt: new Date(),
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
      }).catch(() => undefined);
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
    if (!transcript) {
      return await this.generateDocumentTranscript(documentId, false, user);
    }

    const transcriptText = this.getTranscriptText(transcript);
    if (!transcriptText) {
      throw new BadRequestException('Transcript is required before summarizing');
    }

    if (transcriptText) {
      this.logger.log(`[Moderation] Document ${documentId} - invoking moderation API during summarization (will call after summarize); textLen=${transcriptText.length}`);
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

    await this.upsertDocumentAiAnalysis(documentId, {
      summary,
      summaryGeneratedAt: new Date(),
    });

    if (shouldModerate) {
      try {
        const transcriptText = this.getTranscriptText(transcript);
        if (transcriptText) {
          this.logger.log(`[Moderation] Document ${documentId} - invoking moderation API after summarization; textLen=${transcriptText.length}`);
        }
        const moderationResult = await this.callModerationApi(transcriptText);

        if (moderationResult) {
          const { score, toxic_word, label, categories } = moderationResult;

          await this.upsertDocumentAiAnalysis(documentId, {
            toxicWords: toxic_word || [],
            validationRate: typeof score === 'number' ? score : 0,
            moderationLabel: label || null,
            moderationCategories: categories || [],
          });

          if (!transcriptText || transcriptText.length === 0) {
            await this.prisma.postgres.document.update({
              where: { id: documentId },
              data: {
                isApprove: 'TRUE',
              },
            }).catch(() => undefined);
          } else if (score >= 0.5) {
            await this.prisma.postgres.document.update({
              where: { id: documentId },
              data: {
                isApprove: 'REJECTED',
              },
            }).catch(() => undefined);
          }
        }
      } catch (modErr) {
        this.logger.warn('Moderation call failed', String(modErr));
      }
    }

    return {
      ...(await this.getDocumentAiAnalysis(documentId, user, false)),
      cached: false,
    };
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

  private async callModerationApi(text: string | null | undefined) {
    const api = `${this.localAiBaseUrl}/moderation/text`;
    try {
      const payload = { text: text || '', rewrite: true };
      this.logger.log(`[Moderation] POST ${api} | payloadLen=${(text || '').length}`);

      const res = await fetch(api, {
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
    const summaryCandidate = data.summary ?? data.result ?? data.text;
    if (typeof summaryCandidate === 'string') {
      return summaryCandidate.trim() || null;
    }

    return null;
  }
}
