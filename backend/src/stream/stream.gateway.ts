import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';

// Payload types
interface LivestreamInfo {
  title: string;
  description: string;
  category: string;
}

interface BroadcasterPayload {
  teacherID: string;
  livestreamID: string;
  info?: LivestreamInfo;
}

interface WatcherPayload {
  teacherID: string;
  livestreamID: string;
}

interface OfferPayload extends BroadcasterPayload {
  to: string;
  sdp: unknown;
}

interface AnswerPayload extends BroadcasterPayload {
  to: string;
  sdp: unknown;
}

interface CandidatePayload extends BroadcasterPayload {
  to: string;
  candidate: unknown;
}

interface ShareDocumentPayload extends BroadcasterPayload {
  document: {
    id: number;
    name: string;
    type: string;
    url: string;
    uploadedAt: string;
    size?: number;
  };
}

interface ChatMessagePayload extends BroadcasterPayload {
  message: {
    id: string;
    username: string;
    userRole: 'teacher' | 'student';
    message: string;
    timestamp: string;
    avatar?: string;
  };
}

interface Channel {
  broadcaster: string;
  watchers: Set<string>;
  info?: LivestreamInfo;
}

@WebSocketGateway({ cors: { origin: '*' } })
export class StreamGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  // key = `${teacherID}:${livestreamID}`
  private channels: Record<string, Channel> = {};

  constructor(
    private readonly redisService: RedisService,
    private readonly prismaService: PrismaService,
  ) {}

  private getKey(teacherID: string, livestreamID: string) {
    return `${teacherID}:${livestreamID}`;
  }

  handleConnection(socket: Socket) {
    console.log('Client connected:', socket.id);
  }

  handleDisconnect(socket: Socket) {
    for (const key of Object.keys(this.channels)) {
      const channel = this.channels[key];

      if (channel.broadcaster === socket.id) {
        // Broadcaster closed stream, notify watchers
        const teacherID = key.split(':')[0];
        const livestreamID = key.split(':')[1];
        
        this.server.to([...channel.watchers]).emit('stream-ended', {
          teacherID,
          livestreamID,
        });
        
        // Cleanup Redis viewers
        this.redisService.cleanupLivestream(livestreamID).catch(err => 
          console.error('Redis cleanup error:', err)
        );
        
        // Track stream end analytics
        this.trackStreamEnd(teacherID, livestreamID, channel.watchers.size).catch(err =>
          console.error('Analytics error:', err)
        );
        
        delete this.channels[key];
        console.log('Broadcaster closed channel:', key);
      } else if (channel.watchers.has(socket.id)) {
        // Watcher left, notify broadcaster
        channel.watchers.delete(socket.id);
        this.server.to(channel.broadcaster).emit('bye', socket.id);
        this.server
          .to(channel.broadcaster)
          .emit('viewerCount', channel.watchers.size);
        
        // Remove viewer from Redis
        const livestreamID = key.split(':')[1];
        this.redisService.removeViewer(livestreamID, socket.id).catch(err =>
          console.error('Redis remove viewer error:', err)
        );
      }
    }
  }

  @SubscribeMessage('broadcaster')
  handleBroadcaster(
    @MessageBody() data: BroadcasterPayload,
    @ConnectedSocket() socket: Socket,
  ) {
    const key = this.getKey(data.teacherID, data.livestreamID);
    if (!this.channels[key]) {
      this.channels[key] = { 
        broadcaster: socket.id, 
        watchers: new Set(),
        info: data.info 
      };
    } else {
      this.channels[key].broadcaster = socket.id;
      if (data.info) {
        this.channels[key].info = data.info;
      }
    }

    // Notify all waiting watchers that broadcaster is online
    socket.broadcast.emit('broadcaster');
    console.log('Broadcaster started:', key);
  }

  @SubscribeMessage('watcher')
  handleWatcher(
    @MessageBody() data: WatcherPayload,
    @ConnectedSocket() socket: Socket,
  ) {
    const key = this.getKey(data.teacherID, data.livestreamID);
    const channel = this.channels[key];

    if (channel) {
      channel.watchers.add(socket.id);
      // Send watcher info to broadcaster with object format
      this.server.to(channel.broadcaster).emit('watcher', { id: socket.id });

      // Send livestream info to the watcher
      if (channel.info) {
        this.server.to(socket.id).emit('livestream-info', channel.info);
      }

      // Emit current viewer count to broadcaster
      this.server
        .to(channel.broadcaster)
        .emit('viewerCount', channel.watchers.size);

      // Track viewer in Redis
      this.redisService.addViewer(data.livestreamID, socket.id).catch(err =>
        console.error('Redis add viewer error:', err)
      );

      // Track analytics
      this.trackViewerJoin(data.teacherID, data.livestreamID).catch(err =>
        console.error('Analytics error:', err)
      );

      console.log('Watcher joined channel:', socket.id, 'for', key);
      console.log('Current viewers:', channel.watchers.size);
    } else {
      console.log('No broadcaster found for channel:', key);
      // Notify the watcher that the stream is not available
      this.server.to(socket.id).emit('stream-not-found', {
        teacherID: data.teacherID,
        livestreamID: data.livestreamID,
      });
    }
  }
  @SubscribeMessage('offer')
  handleOffer(
    @MessageBody() data: OfferPayload,
    @ConnectedSocket() socket: Socket,
  ) {
    this.server.to(data.to).emit('offer', { from: socket.id, sdp: data.sdp });
  }

  @SubscribeMessage('answer')
  handleAnswer(
    @MessageBody() data: AnswerPayload,
    @ConnectedSocket() socket: Socket,
  ) {
    this.server.to(data.to).emit('answer', { from: socket.id, sdp: data.sdp });
  }

  @SubscribeMessage('candidate')
  handleCandidate(
    @MessageBody() data: CandidatePayload,
    @ConnectedSocket() socket: Socket,
  ) {
    this.server
      .to(data.to)
      .emit('candidate', { from: socket.id, candidate: data.candidate });
  }

  @SubscribeMessage('stream-ended')
  handleStreamEnded(@MessageBody() data: BroadcasterPayload) {
    const key = this.getKey(data.teacherID, data.livestreamID);
    const channel = this.channels[key];
    if (channel) {
      this.server.to([...channel.watchers]).emit('stream-ended', data);
      delete this.channels[key];
    }
  }

  @SubscribeMessage('share-document')
  handleShareDocument(
    @MessageBody() data: ShareDocumentPayload,
    @ConnectedSocket() socket: Socket,
  ) {
    const key = this.getKey(data.teacherID, data.livestreamID);
    const channel = this.channels[key];
    
    if (channel && channel.broadcaster === socket.id) {
      // Broadcast document to all watchers
      this.server.to([...channel.watchers]).emit('share-document', {
        document: data.document,
      });
      console.log('Document shared to', channel.watchers.size, 'viewers:', data.document.name);
    } else {
      console.log('Cannot share document - channel not found or not broadcaster');
    }
  }

  @SubscribeMessage('close-document')
  handleCloseDocument(
    @MessageBody() data: BroadcasterPayload,
    @ConnectedSocket() socket: Socket,
  ) {
    const key = this.getKey(data.teacherID, data.livestreamID);
    const channel = this.channels[key];
    
    if (channel && channel.broadcaster === socket.id) {
      // Notify all watchers to close document
      this.server.to([...channel.watchers]).emit('close-document');
      console.log('Document closed for', channel.watchers.size, 'viewers');
    }
  }

  @SubscribeMessage('sync-documents')
  handleSyncDocuments(
    @MessageBody() data: { teacherID: string; livestreamID: string; documents: unknown[] },
    @ConnectedSocket() socket: Socket,
  ) {
    const key = this.getKey(data.teacherID, data.livestreamID);
    const channel = this.channels[key];
    
    if (channel && channel.broadcaster === socket.id) {
      // Send available documents to all watchers
      this.server.to([...channel.watchers]).emit('sync-documents', {
        documents: data.documents,
      });
      console.log('Documents synced to', channel.watchers.size, 'viewers');
    }
  }

  @SubscribeMessage('send-chat-message')
  async handleChatMessage(
    @MessageBody() data: ChatMessagePayload,
    @ConnectedSocket() socket: Socket,
  ) {
    const key = this.getKey(data.teacherID, data.livestreamID);
    const channel = this.channels[key];
    
    if (channel) {
      // Rate limiting check
      const canSend = await this.redisService.checkChatRateLimit(
        data.livestreamID,
        socket.id,
      );
      
      if (!canSend) {
        this.server.to(socket.id).emit('rate-limit-exceeded', {
          message: 'Sending messages too fast. Please wait a moment.',
        });
        return;
      }

      // Broadcast message to everyone in the channel (broadcaster + all watchers)
      const allParticipants = [channel.broadcaster, ...Array.from(channel.watchers)];
      this.server.to(allParticipants).emit('chat-message', data.message);
      
      // Save chat to MongoDB
      this.saveChatMessage(data).catch(err =>
        console.error('Failed to save chat message:', err)
      );
      
      console.log('Chat message from', data.message.username, '(', data.message.userRole, '):', data.message.message);
    }
  }

  // Save chat message to MongoDB
  private async saveChatMessage(data: ChatMessagePayload): Promise<void> {
    try {
      await this.prismaService.mongo.comment.create({
        data: {
          livestreamId: data.livestreamID,
          userId: data.teacherID, // TODO: Get actual user ID from auth
          userName: data.message.username,
          userAvatar: data.message.avatar,
          content: data.message.message,
          likes: 0,
          replies: 0,
        },
      });

      // Increment comment count in analytics
      await this.prismaService.mongo.liveStreamAnalytics.updateMany({
        where: { livestreamId: data.livestreamID },
        data: {
          totalComments: { increment: 1 },
        },
      });
    } catch (error) {
      console.error('Error saving chat to MongoDB:', error);
      throw error;
    }
  }

  // Track viewer join analytics
  private async trackViewerJoin(teacherID: string, livestreamID: string): Promise<void> {
    try {
      // Get current viewer count from Redis
      const currentViewers = await this.redisService.getViewerCount(livestreamID);
      
      // Update or create analytics record
      const existing = await this.prismaService.mongo.liveStreamAnalytics.findUnique({
        where: { livestreamId: livestreamID },
      });

      if (existing) {
        await this.prismaService.mongo.liveStreamAnalytics.update({
          where: { id: existing.id },
          data: {
            peakViewers: Math.max(existing.peakViewers, currentViewers),
            totalViews: existing.totalViews + 1,
          },
        });
      } else {
        await this.prismaService.mongo.liveStreamAnalytics.create({
          data: {
            livestreamId: livestreamID,
            totalViews: 1,
            uniqueViewers: 1,
            peakViewers: currentViewers,
            avgWatchTime: 0,
            totalComments: 0,
            totalLikes: 0,
            totalShares: 0,
            totalQuestions: 0,
          },
        });
      }
    } catch (error) {
      console.error('Error tracking viewer join:', error);
      throw error;
    }
  }

  // Track stream end analytics
  private async trackStreamEnd(teacherID: string, livestreamID: string, finalViewerCount: number): Promise<void> {
    try {
      const analytics = await this.prismaService.mongo.liveStreamAnalytics.findUnique({
        where: { livestreamId: livestreamID },
      });

      if (analytics) {
        // Just log the end - schema doesn't have endedAt field
        console.log(`Stream ended: ${livestreamID}, Peak viewers: ${analytics.peakViewers}, Total views: ${analytics.totalViews}`);
      }

      console.log(`Stream ended: ${livestreamID}, Final viewers: ${finalViewerCount}`);
    } catch (error) {
      console.error('Error tracking stream end:', error);
      throw error;
    }
  }
}
