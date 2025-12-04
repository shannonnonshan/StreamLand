import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  namespace: 'notifications',
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
})
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private userSockets = new Map<string, string>(); // userId -> socketId

  constructor(private jwtService: JwtService) {}

  async handleConnection(@ConnectedSocket() client: Socket) {
    try {
      // Extract token from handshake
      const token =
        client.handshake?.auth?.token ||
        client.handshake?.headers?.authorization?.replace('Bearer ', '') ||
        client.handshake?.query?.token;

      if (!token) {
        console.error('❌ No token provided for notification socket');
        client.disconnect();
        return;
      }

      // Verify JWT token
      const payload = await this.jwtService.verifyAsync(token as string, {
        secret: process.env.JWT_SECRET,
      });

      // Attach user data to socket
      client.data.user = payload;
      const userId = payload.sub;

      if (userId && typeof userId === 'string') {
        this.userSockets.set(userId, client.id);
        console.log(`✅ Notification socket connected for user: ${userId}`);
      }
    } catch (error) {
      console.error('❌ Notification socket authentication failed:', error);
      client.disconnect();
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
    console.log(`📤 Sending notification to user ${userId}, socketId: ${socketId}`);
    if (socketId) {
      this.server.to(socketId).emit('newNotification', notification);
      console.log(`✅ Notification sent to socket ${socketId}`);
    } else {
      console.log(`⚠️ User ${userId} not connected to notification socket`);
    }
  }

  // Send notification to multiple users
  sendNotificationToUsers(userIds: string[], notification: any) {
    userIds.forEach((userId) => {
      this.sendNotificationToUser(userId, notification);
    });
  }
}
