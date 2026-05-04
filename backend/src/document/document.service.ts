import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
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
  type: 'recording' | 'document';
  recordingId?: string;
  documentId?: string;
  transcript?: string;
  summary?: string;
  audioUrl?: string;
  transcriptGeneratedAt?: Date;
  summaryGeneratedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

@Injectable()
export class DocumentService {
  private readonly aiTranscriptSummaryCollection = 'ai_transcript_summary';
  private readonly logger = new Logger(DocumentService.name);
  private readonly localAiBaseUrl = (process.env.LOCAL_AI_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');

  constructor(
    private prisma: PrismaService,
    private r2StorageService: R2StorageService,
  ) {}

  private async getDocumentAiAnalysisDocument(documentId: string): Promise<AiTranscriptSummaryDocument | null> {
    const result = await this.prisma.mongo.$runCommandRaw({
      find: this.aiTranscriptSummaryCollection,
      filter: { type: 'document', documentId },
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
          q: { type: 'document', documentId },
          u: {
            $set: {
              id: documentId,
              type: 'document',
              documentId,
              recordingId: null,
              ...payload,
              updatedAt: new Date(),
            },
            $setOnInsert: {
              id: documentId,
              type: 'document',
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

  async getDocumentAiAnalysis(documentId: string, user: { sub: string; role?: string }) {
    await this.assertDocumentAccess(documentId, user);
    const analysis = await this.getDocumentAiAnalysisDocument(documentId);

    return {
      documentId,
      transcript: analysis?.transcript || null,
      summary: analysis?.summary || null,
      audioUrl: analysis?.audioUrl || null,
      transcriptGeneratedAt: analysis?.transcriptGeneratedAt || null,
      summaryGeneratedAt: analysis?.summaryGeneratedAt || null,
    };
  }

  async generateDocumentTranscript(
    documentId: string,
    force: boolean,
    user: { sub: string; role?: string },
  ) {
    const document = await this.assertDocumentAccess(documentId, user);

    if (!this.isTranscribable(document.mimeType, document.fileType)) {
      throw new BadRequestException('Document type is not supported for transcription');
    }

    const existing = await this.getDocumentAiAnalysisDocument(documentId);
    if (!force && existing?.transcript) {
      return {
        ...(await this.getDocumentAiAnalysis(documentId, user)),
        cached: true,
      };
    }

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

    // Set 10-minute timeout for transcribe to complete (transcription takes time)
    const aiResponse = await (await import('../utils/aiFetch')).logFetch(`${this.localAiBaseUrl}/transcribe`, {
      method: 'POST',
      body: formData,
      timeoutMs: 10 * 60 * 1000, // 10 minutes
    }, this.logger as any);

    if (!aiResponse.ok) {
      const errorBody = await aiResponse.text();
      throw new BadRequestException(`Transcribe service error (${aiResponse.status}): ${errorBody}`);
    }

    const aiPayload = await aiResponse.json();
    const aiError = this.extractAiErrorFromPayload(aiPayload);
    if (aiError) {
      throw new BadRequestException(`Transcribe service error: ${aiError}`);
    }

    const transcript = this.extractTranscriptFromPayload(aiPayload);

    if (!transcript) {
      throw new BadRequestException('Transcribe service returned empty transcript');
    }

    await this.upsertDocumentAiAnalysis(documentId, {
      transcript,
      audioUrl: audioUrl || undefined,
      transcriptGeneratedAt: new Date(),
    });

    return {
      ...(await this.getDocumentAiAnalysis(documentId, user)),
      cached: false,
    };
  }

  private extractTranscriptFromPayload(payload: unknown): string | null {
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
      const resultData = transcriptCandidate as Record<string, unknown>;
      const resultText = resultData.text ?? resultData.transcript;
      if (typeof resultText === 'string') {
        return resultText.trim() || null;
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
}
