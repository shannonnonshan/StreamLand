import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { WsJwtGuard } from '../auth/guards/ws-jwt.guard';

@WebSocketGateway({
  namespace: 'notifications',
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
})
@UseGuards(WsJwtGuard)
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private userSockets = new Map<string, string>(); // userId -> socketId

  handleConnection(@ConnectedSocket() client: Socket) {
    const userId = (client as any).user?.sub || (client as any).user?.id;
    if (userId && typeof userId === 'string') {
      this.userSockets.set(userId, client.id);
      console.log(`✅ Notification client connected: ${userId}`);
    }
  }

  handleDisconnect(@ConnectedSocket() client: Socket) {
    const userId = (client as any).user?.sub || (client as any).user?.id;
    if (userId && typeof userId === 'string') {
      this.userSockets.delete(userId);
      console.log(`❌ Notification client disconnected: ${userId}`);
    }
  }

  @SubscribeMessage('register')
  handleRegister(@ConnectedSocket() client: Socket) {
    const userId = (client as any).user?.sub || (client as any).user?.id;
    if (userId && typeof userId === 'string') {
      this.userSockets.set(userId, client.id);
      console.log(`📝 User registered for notifications: ${userId}`);
    }
  }

  // Send notification to specific user
  sendNotificationToUser(userId: string, notification: any) {
    const socketId = this.userSockets.get(userId);
    console.log(`🔍 Looking for user ${userId} socket:`, socketId);
    console.log(`🔍 All registered users:`, Array.from(this.userSockets.keys()));
    if (socketId) {
      this.server.to(socketId).emit('newNotification', notification);
      console.log(`🔔 Sent notification to user ${userId}:`, notification.type);
    } else {
      console.log(`⚠️ User ${userId} not connected, notification saved to DB only`);
    }
  }

  // Send notification to multiple users
  sendNotificationToUsers(userIds: string[], notification: any) {
    userIds.forEach((userId) => {
      this.sendNotificationToUser(userId, notification);
    });
  }
}
