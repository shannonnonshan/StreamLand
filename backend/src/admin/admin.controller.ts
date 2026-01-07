import { Controller, Get, Patch, Param, Body, Query, UseGuards, Request, BadRequestException, Post, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminService } from './admin.service';
import { ChatService } from '../chat/chat.service';
import { R2StorageService } from '../r2-storage/r2-storage.service';

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly chatService: ChatService,
    private readonly r2StorageService: R2StorageService,
  ) {}

  // Get all pending teacher approvals
  @Get('teachers/pending')
  async getPendingTeachers(@Request() req: { user: { sub: string; role: string } }) {
    if (req.user.role !== 'ADMIN') {
      throw new BadRequestException('Only admins can access this endpoint');
    }
    return this.adminService.getPendingTeachers();
  }

  // Get all teachers (with filter)
  @Get('teachers')
  async getAllTeachers(
    @Query('status') status: string,
    @Request() req: { user: { sub: string; role: string } }
  ) {
    if (req.user.role !== 'ADMIN') {
      throw new BadRequestException('Only admins can access this endpoint');
    }
    return this.adminService.getAllTeachers(status);
  }

  // Approve teacher
  @Patch('teachers/:id/approve')
  async approveTeacher(
    @Param('id') teacherId: string,
    @Request() req: { user: { sub: string; role: string } }
  ) {
    if (req.user.role !== 'ADMIN') {
      throw new BadRequestException('Only admins can approve teachers');
    }
    return this.adminService.approveTeacher(teacherId);
  }

  // Reject teacher
  @Patch('teachers/:id/reject')
  async rejectTeacher(
    @Param('id') teacherId: string,
    @Body('reason') reason: string,
    @Request() req: { user: { sub: string; role: string } }
  ) {
    if (req.user.role !== 'ADMIN') {
      throw new BadRequestException('Only admins can reject teachers');
    }
    return this.adminService.rejectTeacher(teacherId, reason);
  }

  // Get dashboard stats for admin
  @Get('dashboard/stats')
  async getDashboardStats(@Request() req: { user: { sub: string; role: string } }) {
    if (req.user.role !== 'ADMIN') {
      throw new BadRequestException('Only admins can access dashboard stats');
    }
    return this.adminService.getDashboardStats();
  }

  // Get all users
  @Get('users')
  async getAllUsers(
    @Query('role') role: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Request() req: { user: { sub: string; role: string } }
  ) {
    if (req.user.role !== 'ADMIN') {
      throw new BadRequestException('Only admins can access user list');
    }
    
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    
    return this.adminService.getAllUsers(role, pageNum, limitNum);
  }

  // Get all livestreams
  @Get('livestreams')
  async getAllLivestreams(
    @Query('status') status: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Request() req: { user: { sub: string; role: string } }
  ) {
    if (req.user.role !== 'ADMIN') {
      throw new BadRequestException('Only admins can access livestream list');
    }
    
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    
    return this.adminService.getAllLivestreams(status, pageNum, limitNum);
  }

  // Get all conversations with admin
  @Get('messages')
  async getAdminMessages(@Request() req: { user: { sub: string; role: string } }) {
    if (req.user.role !== 'ADMIN') {
      throw new BadRequestException('Only admins can access messages');
    }
    return this.adminService.getAdminConversations();
  }

  // Get conversation with specific user
  @Get('messages/:userId')
  async getConversationWithUser(
    @Param('userId') userId: string,
    @Request() req: { user: { sub: string; role: string } }
  ) {
    if (req.user.role !== 'ADMIN') {
      throw new BadRequestException('Only admins can access messages');
    }
    return this.chatService.getConversation('ADMIN', userId);
  }

  // Reply to user message
  @Post('messages/:userId/reply')
  @UseInterceptors(FilesInterceptor('images', 2)) // Max 2 images
  async replyToUser(
    @Param('userId') userId: string,
    @Body('content') content: string,
    @UploadedFiles() images: Express.Multer.File[],
    @Request() req: { user: { sub: string; role: string } }
  ) {
    if (req.user.role !== 'ADMIN') {
      throw new BadRequestException('Only admins can send messages');
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

    return this.chatService.createMessage({
      senderId: 'ADMIN',
      receiverId: userId,
      content: content || '',
      attachments,
    });
  }

  // Remove attachment from message
  @Post('messages/:messageId/remove-attachment')
  async removeAttachment(
    @Param('messageId') messageId: string,
    @Body('attachmentUrl') attachmentUrl: string,
    @Request() req: { user: { sub: string; role: string } }
  ) {
    if (req.user.role !== 'ADMIN') {
      throw new BadRequestException('Only admins can remove attachments');
    }

    if (!attachmentUrl) {
      throw new BadRequestException('Attachment URL is required');
    }

    // Delete from R2
    await this.r2StorageService.deleteChatImage(attachmentUrl);

    // Remove from database
    return await this.chatService.removeAttachment(messageId, 'ADMIN', attachmentUrl);
  }

  // Create new admin
  @Post('admins')
  async createAdmin(
    @Body() body: { email: string; password: string; fullName: string },
    @Request() req: { user: { sub: string; role: string } }
  ) {
    if (req.user.role !== 'ADMIN') {
      throw new BadRequestException('Only admins can create other admins');
    }
    return this.adminService.createAdmin(body.email, body.password, body.fullName);
  }

  // Delete admin
  @Patch('admins/:id/delete')
  async deleteAdmin(
    @Param('id') adminId: string,
    @Request() req: { user: { sub: string; role: string } }
  ) {
    if (req.user.role !== 'ADMIN') {
      throw new BadRequestException('Only admins can delete other admins');
    }
    return this.adminService.deleteAdmin(adminId);
  }

  // Change password
  @Post('change-password')
  async changePassword(
    @Body() passwords: { currentPassword: string; newPassword: string },
    @Request() req: { user: { sub: string; role: string } }
  ) {
    if (req.user.role !== 'ADMIN') {
      throw new BadRequestException('Only admins can change password');
    }
    return this.adminService.changePassword(req.user.sub, passwords);
  }
}
