import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType } from '@prisma/mongodb-client';
import { NotificationGateway } from './notification.gateway';

export interface CreateNotificationDto {
  userId: string;
  type: NotificationType;
  title: string;
  content: string;
  data?: any;
}

@Injectable()
export class NotificationService {
  constructor(
    private prisma: PrismaService,
    private notificationGateway: NotificationGateway,
  ) {}

  async createNotification(dto: CreateNotificationDto) {
    const notification = await this.prisma.mongo.notification.create({
      data: {
        userId: dto.userId,
        type: dto.type,
        title: dto.title,
        content: dto.content,
        data: dto.data || {},
        read: false,
      },
    });

    // Send real-time notification via WebSocket
    this.notificationGateway.sendNotificationToUser(dto.userId, notification);

    return notification;
  }

  async createFriendRequestNotification(receiverId: string, requesterId: string, requesterName: string, requesterAvatar: string, friendRequestId: string) {
    return this.createNotification({
      userId: receiverId,
      type: 'FRIEND_REQUEST' as NotificationType,
      title: 'New Friend Request',
      content: `${requesterName} sent you a friend request`,
      data: {
        requesterId,
        requesterName,
        requesterAvatar,
        friendRequestId,
        type: 'friend_request',
      },
    });
  }

  async createFriendRequestAcceptedNotification(requesterId: string, accepterId: string, accepterName: string, accepterAvatar: string) {
    return this.createNotification({
      userId: requesterId,
      type: 'FRIEND_REQUEST_ACCEPTED' as NotificationType,
      title: 'Friend Request Accepted',
      content: `${accepterName} accepted your friend request`,
      data: {
        accepterId,
        accepterName,
        accepterAvatar,
        type: 'friend_request_accepted',
      },
    });
  }

  async createFollowNotification(teacherId: string, studentId: string, studentName: string, studentAvatar: string) {
    return this.createNotification({
      userId: teacherId,
      type: 'NEW_FOLLOWER' as NotificationType,
      title: 'New Follower',
      content: `${studentName} started following you`,
      data: {
        studentId,
        studentName,
        studentAvatar,
        type: 'new_follower',
      },
    });
  }

  async createLivestreamNotification(studentIds: string[], teacherId: string, teacherName: string, livestreamId: string, livestreamTitle: string) {
    const notifications = await Promise.all(
      studentIds.map((studentId) =>
        this.createNotification({
          userId: studentId,
          type: 'LIVESTREAM_START' as NotificationType,
          title: 'New Livestream',
          content: `${teacherName} started a livestream: ${livestreamTitle}`,
          data: {
            teacherId,
            teacherName,
            livestreamId,
            livestreamTitle,
            type: 'livestream_start',
          },
        })
      )
    );

    return notifications;
  }

  async createVideoNotification(studentIds: string[], teacherId: string, teacherName: string, videoId: string, videoTitle: string) {
    const notifications = await Promise.all(
      studentIds.map((studentId) =>
        this.createNotification({
          userId: studentId,
          type: 'COURSE_UPDATE' as NotificationType,
          title: 'New Video',
          content: `${teacherName} posted a new video: ${videoTitle}`,
          data: {
            teacherId,
            teacherName,
            videoId,
            videoTitle,
            type: 'new_video',
          },
        })
      )
    );

    return notifications;
  }

  async getNotifications(userId: string, limit = 20, skip = 0) {
    return this.prisma.mongo.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip,
    });
  }

  async getUnreadCount(userId: string) {
    return this.prisma.mongo.notification.count({
      where: { userId, read: false },
    });
  }

  async markAsRead(notificationId: string, userId: string) {
    const notification = await this.prisma.mongo.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification || notification.userId !== userId) {
      throw new Error('Notification not found or unauthorized');
    }

    return this.prisma.mongo.notification.update({
      where: { id: notificationId },
      data: { read: true },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.mongo.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }

  async deleteNotification(notificationId: string, userId: string) {
    const notification = await this.prisma.mongo.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification || notification.userId !== userId) {
      throw new Error('Notification not found or unauthorized');
    }

    return this.prisma.mongo.notification.delete({
      where: { id: notificationId },
    });
  }
}
