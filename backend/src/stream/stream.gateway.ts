import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { R2StorageService } from '../r2-storage/r2-storage.service';

// Debounce utility for Redis operations
function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | undefined;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Payload types
interface LivestreamInfo {
  title: string;
  description: string;
  category: string;
}

interface BroadcasterPayload {
  livestreamID: string;
  info?: LivestreamInfo;
}

interface WatcherPayload {
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
  videoChunks?: Buffer[];
  chunkCount?: number;
}
@WebSocketGateway({ cors: { origin: '*' } })
export class StreamGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  // key = livestreamID (unique identifier for each livestream)
  private channels: Record<string, Channel> = {};

  private readonly logger = new Logger(StreamGateway.name);
  private pendingAnalytics: Map<string, { viewerCount: number; timestamp: number }> = new Map();
  private debouncedUpdateViewer: Map<string, ReturnType<typeof debounce>> = new Map();

  constructor(
    private readonly redisService: RedisService,
    private readonly prismaService: PrismaService,
    private readonly r2StorageService: R2StorageService,
  ) {
    // Flush pending analytics every 5 seconds
    setInterval(() => {
      void this.flushPendingAnalytics();
    }, 5000);
  }

  private async flushPendingAnalytics() {
    if (this.pendingAnalytics.size === 0) return;
    
    const updates = Array.from(this.pendingAnalytics.entries());
    this.pendingAnalytics.clear();
    
    // Batch update analytics
    await Promise.allSettled(
      updates.map(([livestreamId, data]) =>
        this.updateAnalyticsBatch(livestreamId, data.viewerCount)
      )
    );
  }

  private async updateAnalyticsBatch(livestreamId: string, viewerCount: number) {
    try {
      await this.prismaService.mongo.liveStreamAnalytics.updateMany({
        where: { livestreamId },
        data: {
          peakViewers: { set: viewerCount },
          totalViews: { increment: 1 },
        },
      });
    } catch (error) {
      console.error('Batch analytics update error:', error);
    }
  }

  private getKey(livestreamID: string) {
    return livestreamID;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  handleConnection(socket: Socket) {
    // Client connected
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
          this.logger.error('Analytics error', err)
        );
        
        delete this.channels[key];
        this.logger.log(`Broadcaster closed channel: ${key}`);
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
          this.logger.error('Redis remove viewer error', err)
        );
      }
    }
  }

  @SubscribeMessage('broadcaster')
  handleBroadcaster(
    @MessageBody() data: BroadcasterPayload,
    @ConnectedSocket() socket: Socket,
  ) {
    this.logger.debug(`Broadcaster connected: ${data.livestreamID}, socket: ${socket.id}`);
    const key = this.getKey(data.livestreamID);
    if (!this.channels[key]) {
      this.channels[key] = { 
        broadcaster: socket.id, 
        watchers: new Set(),
        info: data.info 
      };
      this.logger.log(`Created new channel: ${key}`);
    } else {
      this.channels[key].broadcaster = socket.id;
      if (data.info) {
        this.channels[key].info = data.info;
      }
    }

    // Notify all waiting watchers that broadcaster is online
    socket.broadcast.emit('broadcaster');
    this.logger.log(`Broadcaster started: ${key}`);
  }

  @SubscribeMessage('watcher')
  handleWatcher(
    @MessageBody() data: WatcherPayload,
    @ConnectedSocket() socket: Socket,
  ) {
    this.logger.debug(`Watcher attempting to join: ${data.livestreamID}, socket: ${socket.id}`);
    const key = this.getKey(data.livestreamID);
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

      // Debounced Redis update (batch multiple viewers)
      if (!this.debouncedUpdateViewer.has(data.livestreamID)) {
        this.debouncedUpdateViewer.set(
          data.livestreamID,
          debounce(
            (id: string, socketId: string) => 
              this.redisService.addViewer(id, socketId).catch(err =>
                console.error('Redis add viewer error:', err)
              ),
            1000
          )
        );
      }
      this.debouncedUpdateViewer.get(data.livestreamID)?.(data.livestreamID, socket.id);

      // Queue analytics update (non-blocking batch)
      this.pendingAnalytics.set(data.livestreamID, {
        viewerCount: channel.watchers.size,
        timestamp: Date.now(),
      });

      this.logger.log(`Watcher ${socket.id} joined ${key}, viewers: ${channel.watchers.size}`);
    } else {
      this.logger.warn(`No broadcaster for channel: ${key}, available: ${Object.keys(this.channels).join(', ')}`);
      // Notify the watcher that the stream is not available
      this.server.to(socket.id).emit('stream-not-found', {
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
  handleStreamEnded(@MessageBody() data: BroadcasterPayload & { saveRecording?: boolean }) {
    const key = this.getKey(data.livestreamID);
    const channel = this.channels[key];
    if (channel) {
      this.server.to([...channel.watchers]).emit('stream-ended', data);
      
      // Recording is now handled by frontend upload (not chunk-based)
      // Just clean up the channel
      console.log(`Stream ended for livestream ${data.livestreamID}`);
      
      delete this.channels[key];
    }
  }

  // Video chunks are no longer handled via WebSocket
  // Recording is now uploaded as complete video after stream ends

  @SubscribeMessage('share-document')
  handleShareDocument(
    @MessageBody() data: ShareDocumentPayload,
    @ConnectedSocket() socket: Socket,
  ) {
    const key = this.getKey(data.livestreamID);
    const channel = this.channels[key];
    
    if (channel && channel.broadcaster === socket.id) {
      // Broadcast document to all watchers
      this.server.to([...channel.watchers]).emit('share-document', {
        document: data.document,
      });
    }
  }

  @SubscribeMessage('close-document')
  handleCloseDocument(
    @MessageBody() data: BroadcasterPayload,
    @ConnectedSocket() socket: Socket,
  ) {
    const key = this.getKey(data.livestreamID);
    const channel = this.channels[key];
    
    if (channel && channel.broadcaster === socket.id) {
      // Notify all watchers to close document
      this.server.to([...channel.watchers]).emit('close-document');
    }
  }

  @SubscribeMessage('sync-documents')
  handleSyncDocuments(
    @MessageBody() data: { livestreamID: string; documents: unknown[] },
    @ConnectedSocket() socket: Socket,
  ) {
    const key = this.getKey(data.livestreamID);
    const channel = this.channels[key];
    
    if (channel && channel.broadcaster === socket.id) {
      // Send available documents to all watchers
      this.server.to([...channel.watchers]).emit('sync-documents', {
        documents: data.documents,
      });
    }
  }

  @SubscribeMessage('send-chat-message')
  async handleChatMessage(
    @MessageBody() data: ChatMessagePayload,
    @ConnectedSocket() socket: Socket,
  ) {
    const key = this.getKey(data.livestreamID);
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
      
      // Save chat to MongoDB (fire and forget for performance)
      setImmediate(() => {
        this.saveChatMessage(data).catch(err =>
          console.error('Failed to save chat message:', err)
        );
      });
    }
  }

  // Save chat message to MongoDB
  private async saveChatMessage(data: ChatMessagePayload): Promise<void> {
    try {
      await this.prismaService.mongo.liveStreamChat.create({
        data: {
          livestreamId: data.livestreamID,
          userId: 'anonymous', // TODO: Get actual user ID from auth via socket connection
          username: data.message.username,
          userAvatar: data.message.avatar,
          message: data.message.message,
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
  private async trackViewerJoin(livestreamID: string): Promise<void> {
    try {
      // Get current viewer count from Redis
      const currentViewers = await this.redisService.getViewerCount(livestreamID);
      const viewerCount = typeof currentViewers === 'number' ? currentViewers : 0;
      
      // Update or create analytics record
      const existing = await this.prismaService.mongo.liveStreamAnalytics.findUnique({
        where: { livestreamId: livestreamID },
      });

      if (existing) {
        const currentPeak = Number(existing.peakViewers) || 0;
        const currentTotal = Number(existing.totalViews) || 0;
        const newPeakViewers = Math.max(currentPeak, viewerCount);
        
        await this.prismaService.mongo.liveStreamAnalytics.update({
          where: { id: existing.id },
          data: {
            peakViewers: newPeakViewers,
            totalViews: currentTotal + 1,
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
        this.logger.log(`Stream analytics - ${livestreamID}: Peak ${analytics.peakViewers}, Total ${analytics.totalViews}`);
      }

      console.log(`Stream ended: ${livestreamID}, Final viewers: ${finalViewerCount}`);
    } catch (error) {
      console.error('Error tracking stream end:', error);
      throw error;
    }
  }

  // Save video chunks to R2
  private async saveVideoToR2(livestreamID: string, chunks: Buffer[]): Promise<string> {
    try {
      console.log(`Saving ${chunks.length} video chunks to R2 for livestream ${livestreamID}`);
      
      // Combine all chunks into one buffer
      const completeVideo = Buffer.concat(chunks);
      
      // Convert buffer to stream
      const { Readable } = await import('stream');
      const videoStream = Readable.from(completeVideo);
      
      // Upload to R2
      const videoUrl = await this.r2StorageService.uploadVideo(
        livestreamID,
        videoStream,
        {
          duration: String(chunks.length),
          recordedAt: new Date().toISOString(),
        }
      );
      
      console.log(`Video saved successfully to R2: ${videoUrl}`);
      return videoUrl;
      
    } catch (error) {
      console.error('Error saving video to R2:', error);
      throw error;
    }
  }
}
