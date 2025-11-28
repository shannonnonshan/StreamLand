import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChatService } from './chat.service';
import { RequestWithUser } from './dto';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

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
}
