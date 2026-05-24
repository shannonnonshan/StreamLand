import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Job, Queue } from 'bull';
import {
  PROCESSING_JOB_NAME,
  PROCESSING_QUEUE_NAME,
  ProcessingJobPayload,
} from './processing.types';

@Injectable()
export class ProcessingService {
  private readonly logger = new Logger(ProcessingService.name);

  constructor(
    @InjectQueue(PROCESSING_QUEUE_NAME)
    private readonly processingQueue: Queue<ProcessingJobPayload>,
  ) {}

  async enqueue(payload: ProcessingJobPayload): Promise<Job<ProcessingJobPayload> | null> {
    try {
      return await this.processingQueue.add(PROCESSING_JOB_NAME, payload, {
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
}