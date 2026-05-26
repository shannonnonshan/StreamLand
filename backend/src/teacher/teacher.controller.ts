import { Controller, Get, Patch, Body, Param, Query, UseGuards, Request, Post, UploadedFile, UseInterceptors, BadRequestException, UploadedFiles } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { TeacherService } from './teacher.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { ChatService } from '../chat/chat.service';
import { R2StorageService } from '../r2-storage/r2-storage.service';

@Controller('teacher')
export class TeacherController {
  constructor(
    private readonly teacherService: TeacherService,
    private readonly chatService: ChatService,
    private readonly r2StorageService: R2StorageService,
  ) {}

  // Get teacher profile by ID (public endpoint)
  @Public()
  @Get(':id/profile')
  async getProfile(@Param('id') teacherId: string) {
    return this.teacherService.getProfile(teacherId);
  }

  // Get teacher videos/livestreams (public endpoint)
  @Public()
  @Get(':id/videos')
  async getTeacherVideos(
    @Param('id') teacherId: string,
    @Query('limit') limit?: string,
  ) {
    const limitNum = limit ? parseInt(limit) : 20;
    return this.teacherService.getTeacherVideos(teacherId, limitNum);
  }

  // Get teacher dashboard stats (protected endpoint)
  @UseGuards(JwtAuthGuard)
  @Get(':id/dashboard/stats')
  async getDashboardStats(
    @Param('id') teacherId: string,
    @Query('filter') filter: string,
    @Request() req: { user: { sub: string } }
  ): Promise<any> {
    console.log('Dashboard request - teacherId:', teacherId, 'user.sub:', req.user.sub, 'filter:', filter);
    
    if (req.user.sub !== teacherId) {
      throw new BadRequestException('Unauthorized - user ID mismatch');
    }
    return await this.teacherService.getDashboardStats(teacherId, filter);
  }

  // Get teacher documents
  @UseGuards(JwtAuthGuard)
  @Get(':id/documents')
  async getDocuments(
    @Param('id') teacherId: string,
    @Query('fileType') fileType: string,
    @Request() req: { user: { sub: string; role?: string } }
  ): Promise<any> {
    // Allow access to own documents or if user is admin
    if (req.user.sub !== teacherId && req.user.role !== 'ADMIN') {
      throw new BadRequestException('You can only access your own documents');
    }

    return await this.teacherService.getDocuments(teacherId, fileType);
  }

  // Upload document for livestream
  @UseGuards(JwtAuthGuard)
  @Post(':id/upload-document')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @Param('id') teacherId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('description') description: string | undefined,
    @Request() req: { user: { sub: string } }
  ) {
    // Verify that the user is uploading to their own account
    if (req.user.sub !== teacherId) {
      throw new BadRequestException('Unauthorized');
    }

    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    return this.teacherService.uploadDocument(teacherId, file, description);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/documents/:documentId/description')
  async updateDocumentDescription(
    @Param('id') teacherId: string,
    @Param('documentId') documentId: string,
    @Body('description') description: string | undefined,
    @Request() req: { user: { sub: string; role?: string } },
  ) {
    if (req.user.sub !== teacherId && req.user.role !== 'ADMIN') {
      throw new BadRequestException('Unauthorized');
    }

    return this.teacherService.updateDocumentDescription(teacherId, documentId, description);
  }

  // Update teacher settings (profile info)
  @UseGuards(JwtAuthGuard)
  @Patch(':id/settings')
  async updateSettings(
    @Param('id') teacherId: string,
    @Body() settings: { email?: string; phone?: string; address?: string; gender?: string; substantiate?: string; yearOfWorking?: number },
    @Request() req: { user: { sub: string } }
  ) {
    if (req.user.sub !== teacherId) {
      throw new BadRequestException('Unauthorized');
    }
    return this.teacherService.updateSettings(teacherId, settings);
  }

  // Change password
  @UseGuards(JwtAuthGuard)
  @Post(':id/change-password')
  async changePassword(
    @Param('id') teacherId: string,
    @Body() passwords: { currentPassword: string; newPassword: string },
    @Request() req: { user: { sub: string } }
  ) {
    if (req.user.sub !== teacherId) {
      throw new BadRequestException('Unauthorized');
    }
    return this.teacherService.changePassword(teacherId, passwords);
  }

  // Toggle 2FA
  @UseGuards(JwtAuthGuard)
  @Patch(':id/toggle-2fa')
  async toggle2FA(
    @Param('id') teacherId: string,
    @Body('enabled') enabled: boolean,
    @Request() req: { user: { sub: string } }
  ) {
    if (req.user.sub !== teacherId) {
      throw new BadRequestException('Unauthorized');
    }
    return this.teacherService.toggle2FA(teacherId, enabled);
  }

  // Send message to admin
  @UseGuards(JwtAuthGuard)
  @Post(':id/message-admin')
  @UseInterceptors(FilesInterceptor('images', 2)) // Max 2 images
  async messageAdmin(
    @Param('id') teacherId: string,
    @Body('content') content: string,
    @UploadedFiles() images: Express.Multer.File[],
    @Request() req: { user: { sub: string } }
  ): Promise<any> {
    if (req.user.sub !== teacherId) {
      throw new BadRequestException('Unauthorized');
    }

    if (!content?.trim() && (!images || images.length === 0)) {
      throw new BadRequestException('Message must have content or images');
    }

    // Upload images to R2 if provided
    let attachments: string[] = [];
    if (images && images.length > 0) {
      if (images.length > 2) {
        throw new BadRequestException('Maximum 2 images allowed');
      }

      // Validate image types
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      for (const image of images) {
        if (!allowedTypes.includes(image.mimetype)) {
          throw new BadRequestException('Only image files are allowed');
        }
      }

      // Upload all images
      attachments = await Promise.all(
        images.map(async (image) => {
          return await this.r2StorageService.uploadChatImage(
            image.originalname,
            image.buffer,
            image.mimetype,
          );
        })
      );
    }

    return await this.chatService.createMessage({
      senderId: teacherId,
      receiverId: 'ADMIN',
      content: content || '',
      attachments,
    });
  }

  // Get conversation with admin
  @UseGuards(JwtAuthGuard)
  @Get(':id/admin-conversation')
  async getAdminConversation(
    @Param('id') teacherId: string,
    @Request() req: { user: { sub: string } }
  ): Promise<any> {
    if (req.user.sub !== teacherId) {
      throw new BadRequestException('Unauthorized');
    }
    return await this.chatService.getConversation(teacherId, 'ADMIN');
  }

  // Remove attachment from message
  @UseGuards(JwtAuthGuard)
  @Post(':id/message/:messageId/remove-attachment')
  async removeAttachment(
    @Param('id') teacherId: string,
    @Param('messageId') messageId: string,
    @Body('attachmentUrl') attachmentUrl: string,
    @Request() req: { user: { sub: string } }
  ): Promise<any> {
    if (req.user.sub !== teacherId) {
      throw new BadRequestException('Unauthorized');
    }

    if (!attachmentUrl) {
      throw new BadRequestException('Attachment URL is required');
    }

    // Delete from R2
    await this.r2StorageService.deleteChatImage(attachmentUrl);

    // Remove from database
    return await this.chatService.removeAttachment(messageId, teacherId, attachmentUrl);
  }
}
