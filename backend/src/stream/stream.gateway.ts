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
import { R2StorageService } from '../r2-storage/r2-storage.service';

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

interface VideoChunkPayload extends BroadcasterPayload {
  chunk: string; // Base64 encoded video data
  chunkIndex: number;
}

@WebSocketGateway({ cors: { origin: '*' } })
export class StreamGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  // key = livestreamID (unique identifier for each livestream)
  private channels: Record<string, Channel> = {};

  constructor(
    private readonly redisService: RedisService,
    private readonly prismaService: PrismaService,
    private readonly r2StorageService: R2StorageService,
  ) {}

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
    console.log('[Gateway] Broadcaster event received:', { livestreamID: data.livestreamID, socketId: socket.id });
    const key = this.getKey(data.livestreamID);
    console.log('[Gateway] Channel key:', key);
    if (!this.channels[key]) {
      this.channels[key] = { 
        broadcaster: socket.id, 
        watchers: new Set(),
        info: data.info 
      };
      console.log('[Gateway] Created new channel:', key);
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
    console.log('[Gateway] Watcher event received:', { livestreamID: data.livestreamID, socketId: socket.id });
    const key = this.getKey(data.livestreamID);
    console.log('[Gateway] Looking for channel:', key);
    console.log('[Gateway] Available channels:', Object.keys(this.channels));
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
      this.trackViewerJoin(data.livestreamID).catch(err =>
        console.error('Analytics error:', err)
      );

      console.log('Watcher joined channel:', socket.id, 'for', key);
      console.log('Current viewers:', channel.watchers.size);
    } else {
      console.log('[Gateway] No broadcaster found for channel:', key);
      console.log('[Gateway] Current channels:', Object.keys(this.channels));
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
      
      // Check if recording should be saved
      const shouldSaveRecording = data.saveRecording !== false; // Default to true for backward compatibility
      
      // Save video chunks to R2 if available and saveRecording is true
      if (shouldSaveRecording && channel.videoChunks && channel.videoChunks.length > 0) {
        try {
          console.log(`Saving recording for livestream ${data.livestreamID}...`);
          const videoUrl = await this.saveVideoToR2(data.livestreamID, channel.videoChunks);
          console.log(`Recording saved successfully: ${videoUrl}`);
          
          // Update livestream with recording URL
          await this.prismaService.postgres.liveStream.update({
            where: { id: data.livestreamID },
            data: { 
              recordingUrl: videoUrl,
              isRecorded: true,
            },
          });
        } catch (error) {
          console.error('Failed to save video to R2:', error);
        }
      } else if (!shouldSaveRecording) {
        console.log(`Recording not saved for livestream ${data.livestreamID} (user choice)`);
      } else {
        console.log(`No video chunks available for livestream ${data.livestreamID}`);
      }
      
      delete this.channels[key];
    }
  }

  @SubscribeMessage('video-chunk')
  async handleVideoChunk(
    @MessageBody() data: VideoChunkPayload,
    @ConnectedSocket() socket: Socket,
  ) {
    const key = this.getKey(data.livestreamID);
    const channel = this.channels[key];
    
    if (channel && channel.broadcaster === socket.id) {
      // Initialize video chunks array if not exists
      if (!channel.videoChunks) {
        channel.videoChunks = [];
        channel.chunkCount = 0;
      }
      
      // Decode base64 chunk and store
      const chunkBuffer = Buffer.from(data.chunk, 'base64');
      channel.videoChunks.push(chunkBuffer);
      channel.chunkCount = (channel.chunkCount || 0) + 1;
      
      console.log(`Received video chunk ${data.chunkIndex} for livestream ${data.livestreamID}`);
      
      // Optional: Upload chunk immediately to R2 (for better reliability)
      try {
        await this.r2StorageService.uploadChunk(
          data.livestreamID,
          data.chunkIndex,
          chunkBuffer,
        );
      } catch (error) {
        console.error('Failed to upload chunk to R2:', error);
      }
    }
  }

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
      
      // Save chat to MongoDB
      this.saveChatMessage(data).catch(err =>
        console.error('Failed to save chat message:', err)
      );
    }
  }

  // Save chat message to MongoDB
  private async saveChatMessage(data: ChatMessagePayload): Promise<void> {
    try {
      await this.prismaService.mongo.comment.create({
        data: {
          livestreamId: data.livestreamID,
          userId: 'anonymous', // TODO: Get actual user ID from auth via socket connection
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
        console.log(`Stream ended: ${livestreamID}, Peak viewers: ${analytics.peakViewers}, Total views: ${analytics.totalViews}`);
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
