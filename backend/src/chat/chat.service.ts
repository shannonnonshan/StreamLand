import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MessageType } from '@prisma/mongodb-client';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  async createMessage(data: {
    senderId: string;
    receiverId: string;
    content: string;
    type?: MessageType;
    attachments?: string[];
  }) {
    return await this.prisma.mongo.chatMessage.create({
      data: {
        senderId: data.senderId,
        receiverId: data.receiverId,
        content: data.content,
        type: data.type || MessageType.TEXT,
        attachments: data.attachments || [],
      },
    });
  }

  async getConversation(userId1: string, userId2: string, limit = 50, skip = 0) {
    return await this.prisma.mongo.chatMessage.findMany({
      where: {
        OR: [
          { senderId: userId1, receiverId: userId2 },
          { senderId: userId2, receiverId: userId1 },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip,
    });
  }

  async markAsRead(messageId: string) {
    return await this.prisma.mongo.chatMessage.update({
      where: { id: messageId },
      data: { readAt: new Date() },
    });
  }

  async markConversationAsRead(userId: string, partnerId: string) {
    return await this.prisma.mongo.chatMessage.updateMany({
      where: {
        senderId: partnerId,
        receiverId: userId,
        readAt: null,
      },
      data: { readAt: new Date() },
    });
  }

  async getUnreadCount(userId: string) {
    return await this.prisma.mongo.chatMessage.count({
      where: {
        receiverId: userId,
        readAt: null,
      },
    });
  }

  async getRecentConversations(userId: string) {
    console.log('🔍 getRecentConversations called for userId:', userId);
    
    const messages = await this.prisma.mongo.chatMessage.findMany({
      where: {
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log(`📦 Found ${messages.length} messages for user ${userId}`);
    if (messages.length > 0) {
      console.log('📝 Sample message:', messages[0]);
    }

    // Group by conversation partner
    const conversationsMap = new Map<string, {
      partnerId: string;
      lastMessage: typeof messages[0];
      unreadCount: number;
    }>();
    
    for (const message of messages) {
      const partnerId = message.senderId === userId ? message.receiverId : message.senderId;
      
      if (!conversationsMap.has(partnerId)) {
        conversationsMap.set(partnerId, {
          partnerId,
          lastMessage: message,
          unreadCount: 0,
        });
      }
      
      // Count unread messages
      if (message.receiverId === userId && !message.readAt) {
        conversationsMap.get(partnerId)!.unreadCount++;
      }
    }

    const result = Array.from(conversationsMap.values());
    console.log(`✅ Returning ${result.length} conversations:`, result);
    return result;
  }

  async deleteMessage(messageId: string, userId: string) {
    const message = await this.prisma.mongo.chatMessage.findUnique({
      where: { id: messageId },
    });

    if (!message || message.senderId !== userId) {
      throw new Error('Unauthorized to delete this message');
    }

    return await this.prisma.mongo.chatMessage.delete({
      where: { id: messageId },
    });
  }
}
