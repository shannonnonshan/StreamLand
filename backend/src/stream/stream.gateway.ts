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
        // Broadcaster closed stream unexpectedly (not via stream-ended)
        // Note: Normal stream ends should go through handleStreamEnded
        const livestreamID = key; // keys are livestreamIDs
        
        this.server.to([...channel.watchers]).emit('stream-ended', {
          livestreamID,
        });
        
        // Cleanup Redis viewers
        this.redisService.cleanupLivestream(livestreamID).catch(() => {
          // Silently handle redis cleanup error
        });
        delete this.channels[key];
      } else if (channel.watchers.has(socket.id)) {
        // Watcher left, notify broadcaster
        channel.watchers.delete(socket.id);
        this.server.to(channel.broadcaster).emit('bye', socket.id);
        
        // Emit updated viewer count to broadcaster AND all remaining clients
        const viewerCount = channel.watchers.size;
        this.server
          .to(channel.broadcaster)
          .emit('viewerCount', viewerCount);
        
        // Also broadcast to all students still in the room
        this.server.to(this.getKey(Object.keys(this.channels).find(
          k => this.channels[k].watchers.has(socket.id)
        ) || ''))
          .emit('viewerCount', viewerCount);
        
        // Remove viewer from Redis
        const livestreamID = key; // keys are livestreamIDs
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
    const key = this.getKey(data.livestreamID);
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
  }

  @SubscribeMessage('watcher')
  handleWatcher(
    @MessageBody() data: WatcherPayload,
    @ConnectedSocket() socket: Socket,
  ) {
    const key = this.getKey(data.livestreamID);
    const channel = this.channels[key];

    if (channel) {
      // Add student socket to the room so they receive all broadcasts
      socket.join(key);
      
      channel.watchers.add(socket.id);
      // Send watcher info to broadcaster with object format
      this.server.to(channel.broadcaster).emit('watcher', { id: socket.id });

      // Send livestream info to the watcher
      if (channel.info) {
        this.server.to(socket.id).emit('livestream-info', channel.info);
      }

      // Emit current viewer count to BOTH broadcaster AND all clients in room
      const viewerCount = channel.watchers.size;
      this.server
        .to(channel.broadcaster)
        .emit('viewerCount', viewerCount);
      
      // Also broadcast to all students in this livestream room
      this.server.to(key).emit('viewerCount', viewerCount);

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
    } else {
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
  async handleStreamEnded(@MessageBody() data: BroadcasterPayload & { saveRecording?: boolean }) {
    const key = this.getKey(data.livestreamID);
    const channel = this.channels[key];
    if (channel) {
      this.server.to([...channel.watchers]).emit('stream-ended', data);
      
      const teacherID = key.split(':')[0];
      
      // Track analytics and save video chunks BEFORE cleanup
      try {
        await this.trackStreamEnd(teacherID, data.livestreamID, channel.watchers.size);
      } catch (error) {
        this.logger.error(`Error tracking stream end for ${data.livestreamID}:`, error);
      }
      
      // Cleanup Redis viewers
      this.redisService.cleanupLivestream(data.livestreamID).catch(() => {
        // Silently handle redis cleanup error
      });
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

  @SubscribeMessage('document-uploaded')
  handleDocumentUploaded(
    @MessageBody() data: { livestreamID: string; document: unknown },
    @ConnectedSocket() socket: Socket,
  ) {
    const key = this.getKey(data.livestreamID);
    const channel = this.channels[key];
    
    if (channel && channel.broadcaster === socket.id) {
      // Broadcast new document to all watchers
      this.server.to([...channel.watchers]).emit('document-uploaded', {
        document: data.document,
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
        data.message.id,
        data.livestreamID,
        5,
        10
      ); // Max 5 messages per second
      
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

  // Handle video chunk uploads from broadcaster
  @SubscribeMessage('video-chunk')
  handleVideoChunk(
    @MessageBody() data: { livestreamID: string; chunk: string; chunkIndex: number; totalSize: number },
  ) {
    try {
      const key = this.getKey(data.livestreamID);
      const channel = this.channels[key];

      if (!channel) {
        return;
      }

      // Initialize video chunks array if needed
      if (!channel.videoChunks) {
        channel.videoChunks = [];
        channel.chunkCount = 0;
      }

      // Convert base64 chunk to Buffer
      const chunkBuffer = Buffer.from(data.chunk, 'base64');
      channel.videoChunks[data.chunkIndex] = chunkBuffer;
      channel.chunkCount = (channel.chunkCount || 0) + 1;
    } catch (error) {
      this.logger.error('Error handling video chunk:', error);
    }
  }

  // Handle viewer count updates from broadcaster
  @SubscribeMessage('updateCurrentViewers')
  handleUpdateCurrentViewers(
    @MessageBody() data: { livestreamID: string; currentViewers: number },
    @ConnectedSocket() socket: Socket,
  ) {
    try {
      const key = this.getKey(data.livestreamID);
      const channel = this.channels[key];

      if (!channel) {
        return;
      }

      // Broadcast viewer count to ALL clients in this livestream (teacher + students)
      this.server.to(key).emit('viewerCount', data.currentViewers);
    } catch (error) {
      this.logger.error('Error handling viewer count update:', error);
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
      // Get analytics from MongoDB
      const analytics = await this.prismaService.mongo.liveStreamAnalytics.findUnique({
        where: { livestreamId: livestreamID },
      });

      if (analytics) {
        
        // Update PostgreSQL livestream with final peakViewers and currentViewers from MongoDB
        await this.prismaService.postgres.liveStream.update({
          where: { id: livestreamID },
          data: {
            peakViewers: analytics.peakViewers,
            currentViewers: finalViewerCount,
            totalViews: analytics.totalViews,
          },
        });
      }

      // Save video chunks from memory if available
      const key = this.getKey(livestreamID);
      const channel = this.channels[key];
      if (channel && channel.videoChunks && channel.videoChunks.length > 0) {
        const validChunks = channel.videoChunks.filter(c => c && c.length > 0);
        if (validChunks.length > 0) {
          try {
            await this.saveVideoToR2(livestreamID, validChunks);
          } catch (error) {
            this.logger.error(`Failed to save video chunks for livestream ${livestreamID}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Error tracking stream end:', error);
      throw error;
    }
  }

  // Save video chunks to R2
  private async saveVideoToR2(livestreamID: string, chunks: Buffer[]): Promise<string> {
    try {
      
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
      
      return videoUrl;
      
    } catch (error) {
      throw error;
    }
  }
}
