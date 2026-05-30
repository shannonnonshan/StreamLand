import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Job, Queue } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import { ProcessingStateService } from './processing-state.service';
import {
  PROCESSING_JOB_NAME,
  PROCESSING_QUEUE_NAME,
  ProcessingJobPayload,
  ProcessingEntityType,
} from './processing.types';

@Injectable()
export class ProcessingService {
  private readonly logger = new Logger(ProcessingService.name);

  constructor(
    @InjectQueue(PROCESSING_QUEUE_NAME)
    private readonly processingQueue: Queue<ProcessingJobPayload>,
    private readonly prisma: PrismaService,
    private readonly processingStateService: ProcessingStateService,
  ) {}

  private getJobId(payload: ProcessingJobPayload): string {
    return `${payload.type}:${payload.itemId}`;
  }

  async enqueue(payload: ProcessingJobPayload): Promise<Job<ProcessingJobPayload> | null> {
    try {
      this.logger.log(`Queueing processing job for ${payload.type}:${payload.itemId} (${payload.title})`);
      return await this.processingQueue.add(PROCESSING_JOB_NAME, payload, {
        jobId: this.getJobId(payload),
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      });
    } catch (error) {
      this.logger.error(
        `Failed to enqueue processing job for ${payload.type}:${payload.itemId}`,
        error instanceof Error ? error.stack : String(error),
      );
      return null;
    }
  }

  async retry(entityType: ProcessingEntityType, entityId: string): Promise<Job<ProcessingJobPayload> | null> {
    this.logger.log(`Retry requested for ${entityType}:${entityId}`);
    const payload = await this.resolvePayload(entityType, entityId);
    this.logger.log(`[Retry] Payload resolved: ${JSON.stringify(payload)}`); 
    await this.processingStateService.resetForRetry(entityType, entityId);

    if (entityType === 'LIVESTREAM') {
      await this.prisma.postgres.liveStream.update({
        where: { id: entityId },
        data: {
          processingStatus: 'PENDING',
        },
      });
    } else {
      await this.prisma.postgres.document.update({
        where: { id: entityId },
        data: {
          processingStatus: 'PENDING',
        },
      });
    }

    const existingJob = await this.processingQueue.getJob(this.getJobId(payload));
    if (existingJob) {
      const state = await existingJob.getState();
      if (state === 'active' || state === 'waiting' || state === 'delayed' || state === 'paused') {
        this.logger.log(`Retry skipped for ${entityType}:${entityId} because job is already ${state}`);
        return existingJob;
      }

      await existingJob.remove();
    }

    return this.enqueue(payload);
  }

  private async resolvePayload(entityType: ProcessingEntityType, entityId: string): Promise<ProcessingJobPayload> {
    if (entityType === 'LIVESTREAM') {
      const livestream = await this.prisma.postgres.liveStream.findUnique({
        where: { id: entityId },
        select: {
          id: true,
          title: true,
          recordingUrl: true,
          audioUrl: true,
        },
      });

      if (!livestream) {
        throw new NotFoundException('Livestream not found');
      }

      if (!livestream.recordingUrl) {
        throw new BadRequestException('Recording URL is missing');
      }

      return {
        type: 'livestream',
        itemId: livestream.id,
        fileUrl: livestream.recordingUrl,
        title: livestream.title,
        audioUrl: livestream.audioUrl ?? null,
      };
    }

    const document = await this.prisma.postgres.document.findUnique({
      where: { id: entityId },
      select: {
        id: true,
        title: true,
        fileUrl: true,
        audioUrl: true,
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    return {
      type: 'document',
      itemId: document.id,
      fileUrl: document.fileUrl,
      title: document.title,
      audioUrl: document.audioUrl ?? null,
    };
  }
}