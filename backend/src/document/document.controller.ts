import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DocumentService } from './document.service';

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Get(':id/ai-analysis')
  async getDocumentAiAnalysis(
    @Param('id') documentId: string,
    @Request() req: { user: { sub: string; role?: string } },
  ) {
    return this.documentService.getDocumentAiAnalysis(documentId, req.user);
  }

  @Post(':id/transcript')
  async generateDocumentTranscript(
    @Param('id') documentId: string,
    @Body() body: { force?: boolean },
    @Request() req: { user: { sub: string; role?: string } },
  ) {
    return this.documentService.generateDocumentTranscript(documentId, !!body?.force, req.user);
  }
}
