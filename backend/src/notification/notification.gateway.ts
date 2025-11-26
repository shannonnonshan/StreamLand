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
    const userId = client.data.user?.sub;
    if (userId && typeof userId === 'string') {
      this.userSockets.set(userId, client.id);
    }
  }

  handleDisconnect(@ConnectedSocket() client: Socket) {
    const userId = client.data.user?.sub;
    if (userId && typeof userId === 'string') {
      this.userSockets.delete(userId);
    }
  }

  @SubscribeMessage('register')
  handleRegister(@ConnectedSocket() client: Socket) {
    const userId = client.data.user?.sub;
    if (userId && typeof userId === 'string') {
      this.userSockets.set(userId, client.id);
      client.emit('registered', { success: true, userId });
    } else {
      client.emit('registered', { success: false, error: 'No valid userId' });
    }
  }

  // Send notification to specific user
  sendNotificationToUser(userId: string, notification: any) {
    const socketId = this.userSockets.get(userId);
    if (socketId) {
      this.server.to(socketId).emit('newNotification', notification);
    }
  }

  // Send notification to multiple users
  sendNotificationToUsers(userIds: string[], notification: any) {
    userIds.forEach((userId) => {
      this.sendNotificationToUser(userId, notification);
    });
  }
}
