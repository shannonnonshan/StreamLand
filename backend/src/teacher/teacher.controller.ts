import { Controller, Get, Patch, Body, Param, Query, UseGuards, Request, Post, UploadedFile, UseInterceptors, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TeacherService } from './teacher.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { ChatService } from '../chat/chat.service';

@Controller('teacher')
export class TeacherController {
  constructor(
    private readonly teacherService: TeacherService,
    private readonly chatService: ChatService,
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
    @Request() req: { user: { sub: string } }
  ): Promise<any> {
    console.log('Dashboard request - teacherId:', teacherId, 'user.sub:', req.user.sub);
    
    if (req.user.sub !== teacherId) {
      throw new BadRequestException('Unauthorized - user ID mismatch');
    }
    return await this.teacherService.getDashboardStats(teacherId);
  }

  // Update teacher bio (protected endpoint)
  @UseGuards(JwtAuthGuard)
  @Patch(':id/bio')
  async updateBio(
    @Param('id') teacherId: string,
    @Body('bio') bio: string,
    @Request() req: { user: { sub: string } }
  ) {
    // Verify that the user is updating their own profile
    if (req.user.sub !== teacherId) {
      throw new Error('Unauthorized');
    }
    return this.teacherService.updateBio(teacherId, bio);
  }

  // Update teacher avatar (protected endpoint)
  @UseGuards(JwtAuthGuard)
  @Patch(':id/avatar')
  async updateAvatar(
    @Param('id') teacherId: string,
    @Body('avatarUrl') avatarUrl: string,
    @Request() req: { user: { sub: string } }
  ) {
    // Verify that the user is updating their own profile
    if (req.user.sub !== teacherId) {
      throw new Error('Unauthorized');
    }
    return this.teacherService.updateAvatar(teacherId, avatarUrl);
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
    @Request() req: { user: { sub: string } }
  ) {
    // Verify that the user is uploading to their own account
    if (req.user.sub !== teacherId) {
      throw new BadRequestException('Unauthorized');
    }

    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    return this.teacherService.uploadDocument(teacherId, file);
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
  async messageAdmin(
    @Param('id') teacherId: string,
    @Body('content') content: string,
    @Request() req: { user: { sub: string } }
  ) {
    if (req.user.sub !== teacherId) {
      throw new BadRequestException('Unauthorized');
    }
    return this.chatService.createMessage({
      senderId: teacherId,
      receiverId: 'ADMIN',
      content: content || '', // Ensure content is never undefined
    });
  }

  // Get conversation with admin
  @UseGuards(JwtAuthGuard)
  @Get(':id/admin-conversation')
  async getAdminConversation(
    @Param('id') teacherId: string,
    @Request() req: { user: { sub: string } }
  ) {
    if (req.user.sub !== teacherId) {
      throw new BadRequestException('Unauthorized');
    }
    return this.chatService.getConversation(teacherId, 'ADMIN');
  }
}
