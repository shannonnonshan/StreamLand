import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import {
  PROCESSING_STEPS,
  ProcessingEntityType,
  ProcessingJobStatus,
  ProcessingStatusResponse,
  ProcessingStep,
  ProcessingStepState,
  ProcessingStepStatus,
} from './processing.types';

type EntityRecord = {
  id: string;
  title: string;
  processingStatus: ProcessingJobStatus;
  isApprove: string | boolean | null;
  rejectReason?: string | null;
};

type AnalysisRecord = {
  transcript?: Prisma.JsonValue | null;
  summary?: string | null;
  audioUrl?: string | null;
  moderationResult?: Prisma.JsonValue | null;
  moderationCheckedAt?: Date | null;
  transcriptStatus?: string | null;
  transcriptError?: string | null;
  transcriptGeneratedAt?: Date | null;
  summaryGeneratedAt?: Date | null;
  processingStage?: string | null;
  processingProgress?: number | null;
  processingError?: string | null;
  validationRate?: number | null;
  toxicWords?: string[] | null;
  moderationLabel?: string | null;
  moderationCategories?: string[] | null;
};

@Injectable()
export class ProcessingStateService {
  private readonly logger = new Logger(ProcessingStateService.name);
  private readonly memoryState = new Map<string, ProcessingStatusResponse>();
  private readonly redisKeyPrefix = 'processing:state';
  private readonly aiTranscriptSummaryCollection = 'ai_transcript_summary';

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  private getStateKey(entityType: ProcessingEntityType, entityId: string) {
    return `${this.redisKeyPrefix}:${entityType}:${entityId}`;
  }

  private toEntityType(value: string): ProcessingEntityType {
    return value.trim().toUpperCase() === 'DOCUMENT' ? 'DOCUMENT' : 'LIVESTREAM';
  }

  private toJobStatus(value: unknown): ProcessingJobStatus {
    const status = typeof value === 'string' ? value.trim().toUpperCase() : '';

    if (status === 'PROCESSING') return 'PROCESSING';
    if (status === 'DONE') return 'DONE';
    if (status === 'FAILED') return 'FAILED';
    return 'PENDING';
  }

  private toApprovalValue(value: unknown): string | boolean | null {
    if (typeof value === 'string') {
      const normalized = value.trim().toUpperCase();
      if (normalized === 'TRUE' || normalized === 'FALSE' || normalized === 'REJECTED') {
        return normalized;
      }

      return value;
    }

    if (typeof value === 'boolean') {
      return value;
    }

    return null;
  }

  private isFinalApproval(value: string | boolean | null): boolean {
    if (value === true) return true;
    if (typeof value === 'string') {
      const normalized = value.trim().toUpperCase();
      return normalized === 'TRUE' || normalized === 'REJECTED';
    }

    return false;
  }

  private isWaitingForApproval(status: ProcessingJobStatus, isApprove: string | boolean | null): boolean {
    return status === 'DONE' && !this.isFinalApproval(isApprove);
  }

  private createDefaultSteps(): ProcessingStepState[] {
    const timestamp = new Date().toISOString();

    return PROCESSING_STEPS.map((step) => ({
      step,
      status: 'pending',
      message: null,
      timestamp,
    }));
  }

  private buildStatusResponse(params: {
    entityId: string;
    entityType: ProcessingEntityType;
    processingStatus: ProcessingJobStatus;
    isApprove: string | boolean | null;
    rejectReason?: string | null;
    steps?: ProcessingStepState[];
    activeStep?: ProcessingStep | null;
    lastFailedStep?: ProcessingStep | null;
    completed?: boolean;
    waitingForApproval?: boolean;
    updatedAt?: string;
    title?: string | null;
  }): ProcessingStatusResponse {
    return {
      entityId: params.entityId,
      entityType: params.entityType,
      processingStatus: params.processingStatus,
      isApprove: params.isApprove,
      steps: params.steps || this.createDefaultSteps(),
      activeStep: params.activeStep ?? null,
      lastFailedStep: params.lastFailedStep ?? null,
      completed: params.completed ?? false,
      waitingForApproval: params.waitingForApproval ?? false,
      updatedAt: params.updatedAt || new Date().toISOString(),
      title: params.title ?? null,
    };
  }

  private async loadEntityRecord(
    entityType: ProcessingEntityType,
    entityId: string,
  ): Promise<{ entity: EntityRecord; analysis: AnalysisRecord | null }> {
    if (entityType === 'LIVESTREAM') {
      const entity = await this.prisma.postgres.liveStream.findUnique({
        where: { id: entityId },
        select: {
          id: true,
          title: true,
          processingStatus: true,
          isApprove: true,
        },
      });

      if (!entity) {
        throw new NotFoundException('Livestream not found');
      }

      const analysis = await this.getAnalysis(entityType, entityId);

      return {
        entity: {
          id: entity.id,
          title: entity.title,
          processingStatus: this.toJobStatus(entity.processingStatus),
          isApprove: this.toApprovalValue(entity.isApprove),
        },
        analysis,
      };
    }

    const entity = await this.prisma.postgres.document.findUnique({
      where: { id: entityId },
      select: {
        id: true,
        title: true,
        processingStatus: true,
        isApprove: true,
      },
    });

    if (!entity) {
      throw new NotFoundException('Document not found');
    }

    const analysis = await this.getAnalysis(entityType, entityId);

    return {
      entity: {
        id: entity.id,
        title: entity.title,
        processingStatus: this.toJobStatus(entity.processingStatus),
        isApprove: this.toApprovalValue(entity.isApprove),
      },
      analysis,
    };
  }

  private async getAnalysis(entityType: ProcessingEntityType, entityId: string): Promise<AnalysisRecord | null> {
    const field = entityType === 'LIVESTREAM' ? 'recordingId' : 'documentId';
    const result = await this.prisma.mongo.$runCommandRaw({
      find: this.aiTranscriptSummaryCollection,
      filter: {
        type: entityType,
        [field]: entityId,
      },
      limit: 1,
    });

    const firstBatch = (result as { cursor?: { firstBatch?: AnalysisRecord[] } }).cursor?.firstBatch || [];
    return firstBatch[0] || null;
  }

  private buildResolvedSteps(
    entityType: ProcessingEntityType,
    entity: EntityRecord,
    analysis: AnalysisRecord | null,
    existingSteps?: ProcessingStepState[],
  ): ProcessingStatusResponse {
    const baseSteps = existingSteps ? existingSteps.map((step) => ({ ...step })) : this.createDefaultSteps();
    const timestamp = new Date().toISOString();

    const hasTranscript = Boolean(analysis?.transcript);
    const hasSummary = typeof analysis?.summary === 'string' && analysis.summary.trim().length > 0;
    const hasModeration = Boolean(analysis?.moderationResult) && Boolean(analysis?.moderationCheckedAt);
    const hasAudio = Boolean(analysis?.audioUrl);
    const saveResultsDone = entity.processingStatus === 'DONE';
    const isRejected = entity.isApprove === 'REJECTED';

    const completed =
      !isRejected &&
      saveResultsDone &&
      hasTranscript &&
      hasSummary &&
      hasModeration &&
      this.isFinalApproval(entity.isApprove);

    const waitingForApproval =
      !isRejected &&
      this.isWaitingForApproval(entity.processingStatus, entity.isApprove);

    const nextStatus = (step: ProcessingStep, status: ProcessingStepStatus, message?: string | null) => {
      const entry = baseSteps.find((item) => item.step === step);
      if (!entry) return;

      entry.status = status;
      entry.message = message ?? entry.message ?? null;
      entry.timestamp = timestamp;
    };

    if (hasAudio || hasTranscript || hasSummary || hasModeration || saveResultsDone) {
      nextStatus('EXTRACT_AUDIO', 'done', hasAudio ? 'Audio is ready' : 'We will prepare the audio again when you retry');
      nextStatus('UPLOAD_AUDIO', 'done', hasAudio ? 'Audio uploaded successfully' : 'Audio will be uploaded when you retry');
    }

    if (hasTranscript) {
      nextStatus('TRANSCRIBE', 'done', 'Transcript is ready');
    }

    if (hasSummary) {
      nextStatus('SUMMARIZE', 'done', 'Summary is ready');
    }

    if (hasModeration) {
      nextStatus('MODERATION', 'done', 'Safety check is complete');
    }

    if (saveResultsDone) {
      nextStatus('SAVE_RESULTS', 'done', 'Results have been saved');
    }

    if (isRejected) {
      nextStatus('COMPLETED', 'failed', entity.rejectReason ?? 'This content was rejected.');
    } else if (completed) {
      nextStatus('COMPLETED', 'done', 'Processing completed');
    } else if (waitingForApproval) {
      nextStatus('COMPLETED', 'pending', 'Waiting for approval');
    }

    const failedStep = baseSteps.find((step) => step.status === 'failed')?.step || null;
    const runningStep = baseSteps.find((step) => step.status === 'running')?.step || null;
    const activeStep = runningStep || failedStep || baseSteps.find((step) => step.status === 'pending')?.step || null;

    return this.buildStatusResponse({
      entityId: entity.id,
      entityType,
      processingStatus: entity.processingStatus,
      isApprove: entity.isApprove,
      rejectReason: entity.rejectReason ?? null,
      steps: baseSteps,
      activeStep,
      lastFailedStep: failedStep,
      completed,
      waitingForApproval,
      updatedAt: analysis?.summaryGeneratedAt?.toISOString?.() || analysis?.transcriptGeneratedAt?.toISOString?.() || timestamp,
      title: entity.title,
    });
  }

  async getStatus(entityType: ProcessingEntityType, entityId: string): Promise<ProcessingStatusResponse> {
    const key = this.getStateKey(entityType, entityId);

    const cached = await this.redisService.get<ProcessingStatusResponse>(key).catch(() => null);
    if (cached) {
      this.memoryState.set(key, cached);
      return cached;
    }

    const memory = this.memoryState.get(key);
    if (memory) {
      return memory;
    }

    const { entity, analysis } = await this.loadEntityRecord(entityType, entityId);
    const derived = this.buildResolvedSteps(entityType, entity, analysis);
    await this.persist(derived);
    return derived;
  }

  async persist(status: ProcessingStatusResponse): Promise<void> {
    const key = this.getStateKey(status.entityType, status.entityId);
    this.memoryState.set(key, status);

    await this.redisService.set(key, status, 86400).catch((error) => {
      this.logger.warn(`Failed to persist processing state for ${status.entityType}:${status.entityId}: ${String(error)}`);
    });
  }

  async updateStep(params: {
    entityType: ProcessingEntityType;
    entityId: string;
    step: ProcessingStep;
    status: ProcessingStepStatus;
    message?: string;
  }): Promise<ProcessingStatusResponse> {
    const current = await this.getStatus(params.entityType, params.entityId);
    const currentSteps = current.steps ?? this.createDefaultSteps();
    const updatedSteps = currentSteps.map((item) => {
      if (item.step !== params.step) {
        return item;
      }

      return {
        ...item,
        status: params.status,
        message: params.message ?? item.message ?? null,
        timestamp: new Date().toISOString(),
      };
    });

    const failedStep = params.status === 'failed' ? params.step : current.lastFailedStep;
    const runningStep = params.status === 'running' ? params.step : current.activeStep;
    const activeStep = params.status === 'failed'
      ? params.step
      : params.status === 'running'
        ? params.step
        : updatedSteps.find((item) => item.status === 'running')?.step
          || updatedSteps.find((item) => item.status === 'failed')?.step
          || updatedSteps.find((item) => item.status === 'pending')?.step
          || null;

    const nextState: ProcessingStatusResponse = {
      ...current,
      steps: updatedSteps,
      activeStep,
      lastFailedStep: failedStep,
      processingStatus: params.status === 'failed' ? 'FAILED' : params.status === 'running' ? 'PROCESSING' : current.processingStatus,
      waitingForApproval: current.waitingForApproval,
      completed: current.completed,
      updatedAt: new Date().toISOString(),
    };

    await this.persist(nextState);
    return nextState;
  }

  async setProcessingStatus(
    entityType: ProcessingEntityType,
    entityId: string,
    processingStatus: ProcessingJobStatus,
    options?: Partial<Pick<ProcessingStatusResponse, 'waitingForApproval' | 'completed' | 'activeStep' | 'lastFailedStep' | 'title'>>,
  ): Promise<ProcessingStatusResponse> {
    const current = await this.getStatus(entityType, entityId);
    const nextState: ProcessingStatusResponse = {
      ...current,
      processingStatus,
      waitingForApproval: options?.waitingForApproval ?? current.waitingForApproval,
      completed: options?.completed ?? current.completed,
      activeStep: options?.activeStep ?? current.activeStep,
      lastFailedStep: options?.lastFailedStep ?? current.lastFailedStep,
      title: options?.title ?? current.title,
      updatedAt: new Date().toISOString(),
    };

    await this.persist(nextState);
    return nextState;
  }

  async resetForRetry(entityType: ProcessingEntityType, entityId: string): Promise<ProcessingStatusResponse> {
    const current = await this.getStatus(entityType, entityId);
    const failedIndex = current.lastFailedStep ? PROCESSING_STEPS.indexOf(current.lastFailedStep) : -1;
    const currentSteps = current.steps ?? this.createDefaultSteps();
    const updatedSteps: ProcessingStepState[] = currentSteps.map((step, index) => {
      if (failedIndex >= 0 && index < failedIndex) {
        return step.status === 'done'
          ? step
          : { ...step, status: 'done' as ProcessingStepStatus, message: step.message ?? null, timestamp: new Date().toISOString() };
      }

      if (failedIndex >= 0 && index >= failedIndex) {
        return {
          ...step,
          status: 'pending' as ProcessingStepStatus,
          message: null,
          timestamp: new Date().toISOString(),
        };
      }

      return {
        ...step,
        status: (step.status === 'done' ? 'done' : 'pending') as ProcessingStepStatus,
      };
    });

    const nextState: ProcessingStatusResponse = {
      ...current,
      processingStatus: 'PENDING',
      steps: updatedSteps,
      activeStep: failedIndex >= 0 ? PROCESSING_STEPS[failedIndex] : current.activeStep,
      lastFailedStep: failedIndex >= 0 ? current.lastFailedStep : null,
      completed: false,
      waitingForApproval: false,
      updatedAt: new Date().toISOString(),
    };

    await this.persist(nextState);
    return nextState;
  }

  async markEntityCompleted(entityType: ProcessingEntityType, entityId: string): Promise<ProcessingStatusResponse> {
    return this.setProcessingStatus(entityType, entityId, 'DONE', {
      completed: true,
      waitingForApproval: false,
      activeStep: null,
      lastFailedStep: null,
    });
  }

  async markEntityFailed(entityType: ProcessingEntityType, entityId: string): Promise<ProcessingStatusResponse> {
    return this.setProcessingStatus(entityType, entityId, 'FAILED', {
      completed: false,
    });
  }

  async markEntityProcessing(entityType: ProcessingEntityType, entityId: string, title?: string): Promise<ProcessingStatusResponse> {
    const current = await this.getStatus(entityType, entityId);
    const nextState: ProcessingStatusResponse = {
      ...current,
      processingStatus: 'PROCESSING',
      activeStep: current.activeStep || 'EXTRACT_AUDIO',
      completed: false,
      waitingForApproval: false,
      title: title ?? current.title,
      updatedAt: new Date().toISOString(),
    };

    await this.persist(nextState);
    return nextState;
  }

}