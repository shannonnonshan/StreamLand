import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Request, UploadedFile, UseGuards, UseInterceptors, NotFoundException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { DocumentService } from './document.service';

type MulterFile = {
  fieldname: string;
  originalname: string;
  encoding?: string;
  mimetype: string;
  size: number;
  buffer?: Buffer;
  destination?: string;
  filename?: string;
  path?: string;
};

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  // ── PUBLIC endpoints (no auth required) ──────────────────────────────────

  // Get single approved+processed document video by ID (for student video player)
  @Public()
  @Get('public/:documentId')
  async getPublicDocument(@Param('documentId') documentId: string) {
    const doc = await this.documentService.getPublicDocumentById(documentId);
    if (!doc) throw new NotFoundException('Document not found or not approved');
    return doc;
  }

  // Get AI analysis for an approved document video (for student video player)
  @Public()
  @Get('public/:documentId/ai-analysis')
  async getPublicDocumentAiAnalysis(@Param('documentId') documentId: string) {
    const analysis = await this.documentService.getPublicDocumentAiAnalysis(documentId);
    if (!analysis) throw new NotFoundException('Document not found or not approved');
    return analysis;
  }

  // ── AUTHENTICATED endpoints ───────────────────────────────────────────────

  @Get('teacher/:teacherId')
  async getTeacherDocuments(
    @Param('teacherId') teacherId: string,
    @Query('fileType') fileType: string,
    @Request() req: { user: { sub: string; role?: string } },
  ) {
    if (req.user.sub !== teacherId && req.user.role !== 'ADMIN') {
      throw new BadRequestException('You can only access your own documents');
    }

    return this.documentService.getTeacherDocuments(teacherId, fileType);
  }

  @Post('teacher/:teacherId/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadTeacherDocument(
    @Param('teacherId') teacherId: string,
    @UploadedFile() file: MulterFile,
    @Body('description') description: string | undefined,
    @Body('title') title: string | undefined,
    @Request() req: { user: { sub: string } },
  ) {
    if (req.user.sub !== teacherId) {
      throw new BadRequestException('Unauthorized');
    }

    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    return this.documentService.uploadTeacherDocument(teacherId, file, description, title);
  }

  @Patch('teacher/:teacherId/:documentId/description')
  async updateTeacherDocumentDescription(
    @Param('teacherId') teacherId: string,
    @Param('documentId') documentId: string,
    @Body('description') description: string | undefined,
    @Request() req: { user: { sub: string; role?: string } },
  ) {
    if (req.user.sub !== teacherId && req.user.role !== 'ADMIN') {
      throw new BadRequestException('Unauthorized');
    }

    return this.documentService.updateTeacherDocumentDescription(teacherId, documentId, description);
  }

  @Patch('teacher/:teacherId/:documentId')
  async updateTeacherDocument(
    @Param('teacherId') teacherId: string,
    @Param('documentId') documentId: string,
    @Body('title') title: string | undefined,
    @Body('description') description: string | undefined,
    @Request() req: { user: { sub: string; role?: string } },
  ) {
    if (req.user.sub !== teacherId && req.user.role !== 'ADMIN') {
      throw new BadRequestException('Unauthorized');
    }

    return this.documentService.updateTeacherDocument(teacherId, documentId, title, description);
  }

  @Delete('teacher/:teacherId/:documentId')
  async deleteTeacherDocument(
    @Param('teacherId') teacherId: string,
    @Param('documentId') documentId: string,
    @Request() req: { user: { sub: string; role?: string } },
  ) {
    if (req.user.sub !== teacherId && req.user.role !== 'ADMIN') {
      throw new BadRequestException('Unauthorized');
    }

    return this.documentService.deleteTeacherDocument(teacherId, documentId);
  }

  @Get(':id/ai-analysis')
  async getDocumentAiAnalysis(
    @Param('id') documentId: string,
    @Query('autoTranscribe') autoTranscribe: string | undefined,
    @Request() req: { user: { sub: string; role?: string } },
  ) {
    return this.documentService.getDocumentAiAnalysis(documentId, req.user, autoTranscribe === 'true');
  }

  @Get(':id/moderation')
  async getDocumentModeration(
    @Param('id') documentId: string,
    @Request() req: { user: { sub: string; role?: string } },
  ) {
    return this.documentService.getDocumentModeration(documentId, req.user);
  }

  @Post(':id/transcript')
  async generateDocumentTranscript(
    @Param('id') documentId: string,
    @Body() body: { force?: boolean },
    @Request() req: { user: { sub: string; role?: string } },
  ) {
    return this.documentService.generateDocumentTranscript(documentId, !!body?.force, req.user);
  }

  @Post(':id/summary')
  async generateDocumentSummary(
    @Param('id') documentId: string,
    @Body() body: { force?: boolean },
    @Request() req: { user: { sub: string; role?: string } },
  ) {
    return this.documentService.generateDocumentSummary(documentId, !!body?.force, req.user);
  }
}