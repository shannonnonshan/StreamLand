import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationService } from './notification.service';
import { RequestWithUser } from '../chat/dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async getNotifications(
    @Request() req: RequestWithUser,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    const userId = req.user.sub || req.user.id;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    const skipNum = skip ? parseInt(skip, 10) : 0;

    return this.notificationService.getNotifications(userId, limitNum, skipNum);
  }

  @Get('unread-count')
  async getUnreadCount(@Request() req: RequestWithUser) {
    const userId = req.user.sub || req.user.id;
    const count = await this.notificationService.getUnreadCount(userId);
    return { count };
  }

  @Patch(':id/read')
  async markAsRead(
    @Param('id') notificationId: string,
    @Request() req: RequestWithUser,
  ) {
    const userId = req.user.sub || req.user.id;
    return this.notificationService.markAsRead(notificationId, userId);
  }

  @Patch('mark-all-read')
  async markAllAsRead(@Request() req: RequestWithUser) {
    const userId = req.user.sub || req.user.id;
    return this.notificationService.markAllAsRead(userId);
  }

  @Delete(':id')
  async deleteNotification(
    @Param('id') notificationId: string,
    @Request() req: RequestWithUser,
  ) {
    const userId = req.user.sub || req.user.id;
    return this.notificationService.deleteNotification(notificationId, userId);
  }
}
