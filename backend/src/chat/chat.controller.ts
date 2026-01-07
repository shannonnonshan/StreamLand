import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Request,
  Post,
  UseInterceptors,
  UploadedFiles,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChatService } from './chat.service';
import { RequestWithUser } from './dto';
import { R2StorageService } from '../r2-storage/r2-storage.service';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly r2StorageService: R2StorageService,
  ) {}

  @Get('conversation/:partnerId')
  async getConversation(
    @Param('partnerId') partnerId: string,
    @Request() req: RequestWithUser,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    const userId = req.user.sub || req.user.id;
    const limitNum = limit ? parseInt(limit, 10) : 50;
    const skipNum = skip ? parseInt(skip, 10) : 0;

    return this.chatService.getConversation(userId, partnerId, limitNum, skipNum);
  }

  @Get('conversations')
  async getRecentConversations(@Request() req: RequestWithUser) {
    const userId = req.user.sub || req.user.id;
    const result = await this.chatService.getRecentConversations(userId);
    return result;
  }

  @Get('unread-count')
  async getUnreadCount(@Request() req: RequestWithUser) {
    const userId = req.user.sub || req.user.id;
    const count = await this.chatService.getUnreadCount(userId);
    return { count };
  }

  @Post('send-message')
  @UseInterceptors(FilesInterceptor('images', 2)) // Max 2 images
  async sendMessage(
    @Request() req: RequestWithUser,
    @Body('receiverId') receiverId: string,
    @Body('content') content: string,
    @UploadedFiles() images?: Express.Multer.File[],
  ) {
    const userId = req.user.sub || req.user.id;

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
      senderId: userId,
      receiverId,
      content: content || '',
      attachments,
    });
  }

  @Post('message/:messageId/remove-attachment')
  async removeAttachment(
    @Request() req: RequestWithUser,
    @Param('messageId') messageId: string,
    @Body('attachmentUrl') attachmentUrl: string,
  ) {
    const userId = req.user.sub || req.user.id;

    if (!attachmentUrl) {
      throw new BadRequestException('Attachment URL is required');
    }

    // Delete from R2
    await this.r2StorageService.deleteChatImage(attachmentUrl);

    // Remove from database
    return await this.chatService.removeAttachment(messageId, userId, attachmentUrl);
  }
}
