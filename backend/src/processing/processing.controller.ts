import { Body, Controller, Get, Param, Post, Request, UseGuards, BadRequestException, Logger } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DocumentService } from '../document/document.service';
import { LivestreamService } from '../livestream/livestream.service';
import { ProcessingService } from './processing.service';
import { ProcessingStateService } from './processing-state.service';
import { ProcessingEntityType } from './processing.types';

@Controller('processing')
@UseGuards(JwtAuthGuard)
export class ProcessingController {
  private readonly logger = new Logger(ProcessingController.name);

  constructor(
    private readonly processingService: ProcessingService,
    private readonly processingStateService: ProcessingStateService,
    private readonly livestreamService: LivestreamService,
    private readonly documentService: DocumentService,
  ) {}

  private parseEntityType(value: string): ProcessingEntityType {
    const normalized = value.trim().toUpperCase();

    if (normalized === 'LIVESTREAM' || normalized === 'DOCUMENT') {
      return normalized;
    }

    throw new BadRequestException('Invalid entity type');
  }

  private assertLivestreamAccess(
    livestream: { teacherId: string; isPublic: boolean; isApprove?: string | boolean | null },
    req: any,
  ) {
    const requesterId = req.user?.sub;
    const requesterRole = req.user?.role;
    const isOwner = requesterId && livestream.teacherId === requesterId;
    const isAdmin = requesterRole === 'ADMIN';
    const isApproved = livestream.isApprove === true || livestream.isApprove === 'TRUE' || livestream.isApprove === 'true';

    if ((!livestream.isPublic || !isApproved) && !isOwner && !isAdmin) {
      throw new BadRequestException('This livestream is not available until it is public and approved.');
    }
  }

  @Get(':entityType/:entityId/status')
  async getStatus(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    const normalizedEntityType = this.parseEntityType(entityType);
    this.logger.log(`GET /processing/${normalizedEntityType}/${entityId}/status`);
    return this.processingStateService.getStatus(normalizedEntityType, entityId);
  }

  @Post(':entityType/:entityId/retry')
  async retryProcessing(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Request() req: any,
  ) {
    const normalizedEntityType = this.parseEntityType(entityType);
    this.logger.log(`POST /processing/${normalizedEntityType}/${entityId}/retry`);

    if (normalizedEntityType === 'LIVESTREAM') {
      const livestream = await this.livestreamService.getLivestreamById(entityId);
      this.assertLivestreamAccess(livestream, req);
    } else {
      await this.documentService.getDocumentAiAnalysis(entityId, req.user, false);
    }

    await this.processingService.retry(normalizedEntityType, entityId);
    return this.processingStateService.getStatus(normalizedEntityType, entityId);
  }

  @Post(':entityType/:entityId/retry-moderation')
  async retryModeration(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Request() req: any,
  ) {
    const normalizedEntityType = this.parseEntityType(entityType);
    this.logger.log(`POST /processing/${normalizedEntityType}/${entityId}/retry-moderation`);

    if (normalizedEntityType === 'LIVESTREAM') {
      const livestream = await this.livestreamService.getLivestreamById(entityId);
      this.assertLivestreamAccess(livestream, req);
      return this.livestreamService.getRecordingModeration(entityId);
    }

    return this.documentService.getDocumentModeration(entityId, req.user);
  }
}