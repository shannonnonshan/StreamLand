import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  constructor(@InjectRedis() private readonly redis: Redis) {
    this.redis.on('connect', () => this.logger.log('Redis connected'));
    this.redis.on('error', (err) => this.logger.error(`Redis error: ${err.message}`));
    this.redis.on('reconnecting', () => this.logger.warn('Redis reconnecting...'));
  }

  // Set key with TTL (time-to-live in seconds)
  async set(key: string, value: any, ttl?: number) {
    const stringValue = JSON.stringify(value);
    if (ttl) {
      await this.redis.set(key, stringValue, 'EX', ttl);
    } else {
      await this.redis.set(key, stringValue);
    }
  }

  // Get key
  async get<T = any>(key: string): Promise<T | null> {
    const value = await this.redis.get(key);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return value ? JSON.parse(value) : null;
  }

  async del(key: string) {
    return this.redis.del(key);
  }

  async deleteByPattern(pattern: string) {
    const keys = await this.redis.keys(pattern);

    if (keys.length > 0) {
      return this.redis.del(...keys);
    }

    return 0;
  }

  async incr(key: string) {
    return this.redis.incr(key);
  }

  async exists(key: string) {
    return this.redis.exists(key);
  }

  // ============= LIVESTREAM SPECIFIC METHODS =============

  // Track active viewers for a livestream with pipeline for better performance
  async addViewer(livestreamId: string, viewerId: string, metadata?: any) {
    const key = `livestream:${livestreamId}:viewers`;
    const score = Date.now();
    
    // Use pipeline to batch commands for better performance
    const pipeline = this.redis.pipeline();
    
    // Add to sorted set with timestamp as score
    pipeline.zadd(key, score, viewerId);
    
    // Store viewer metadata if provided
    if (metadata) {
      pipeline.hset(
        `livestream:${livestreamId}:viewer:${viewerId}`,
        'metadata',
        JSON.stringify(metadata)
      );
    }
    
    // Set TTL for cleanup (1 hour)
    pipeline.expire(key, 3600);
    
    // Execute all commands at once
    await pipeline.exec();
    
    return this.getViewerCount(livestreamId);
  }

  // Remove viewer from livestream with pipeline
  async removeViewer(livestreamId: string, viewerId: string) {
    const key = `livestream:${livestreamId}:viewers`;
    
    // Use pipeline for batch deletion
    const pipeline = this.redis.pipeline();
    pipeline.zrem(key, viewerId);
    pipeline.del(`livestream:${livestreamId}:viewer:${viewerId}`);
    await pipeline.exec();
    
    return this.getViewerCount(livestreamId);
  }

  // Get current viewer count
  async getViewerCount(livestreamId: string): Promise<number> {
    const key = `livestream:${livestreamId}:viewers`;
    return this.redis.zcard(key);
  }

  // Get all active viewers
  async getActiveViewers(livestreamId: string): Promise<string[]> {
    const key = `livestream:${livestreamId}:viewers`;
    
    // Remove stale viewers (inactive for 30 seconds)
    const cutoff = Date.now() - 30000;
    await this.redis.zremrangebyscore(key, 0, cutoff);
    
    return this.redis.zrange(key, 0, -1);
  }

  // Update viewer heartbeat
  async updateViewerHeartbeat(livestreamId: string, viewerId: string) {
    const key = `livestream:${livestreamId}:viewers`;
    const score = Date.now();
    await this.redis.zadd(key, score, viewerId);
  }

  // Cache livestream data
  async cacheLivestream(livestreamId: string, data: any, ttl = 300) {
    const key = `livestream:${livestreamId}:data`;
    await this.set(key, data, ttl);
  }

  async getCachedLivestream(livestreamId: string) {
    const key = `livestream:${livestreamId}:data`;
    return this.get(key);
  }

  // Rate limiting for chat messages
  async checkChatRateLimit(userId: string, livestreamId: string, limit = 5, window = 10): Promise<boolean> {
    const key = `ratelimit:chat:${livestreamId}:${userId}`;
    const current = await this.redis.incr(key);
    
    if (current === 1) {
      await this.redis.expire(key, window);
    }
    
    return current <= limit;
  }

  // Store recent chat messages (circular buffer)
  async addChatMessage(livestreamId: string, message: any) {
    const key = `livestream:${livestreamId}:recent_chat`;
    await this.redis.lpush(key, JSON.stringify(message));
    await this.redis.ltrim(key, 0, 99); // Keep last 100 messages
    await this.redis.expire(key, 3600); // 1 hour TTL
  }

  async getRecentChatMessages(livestreamId: string, count = 50): Promise<any[]> {
    const key = `livestream:${livestreamId}:recent_chat`;
    const messages = await this.redis.lrange(key, 0, count - 1);
    return messages.map(msg => JSON.parse(msg));
  }

  // WebSocket connection mapping
  async mapSocketToUser(socketId: string, userId: string, ttl = 3600) {
    await this.redis.set(`socket:${socketId}`, userId, 'EX', ttl);
  }

  async getUserBySocket(socketId: string): Promise<string | null> {
    return this.redis.get(`socket:${socketId}`);
  }

  async removeSocketMapping(socketId: string) {
    await this.redis.del(`socket:${socketId}`);
  }

  // Trending livestreams (based on viewer count)
  async updateTrendingLivestreams(livestreamId: string, viewerCount: number) {
    const key = 'trending:livestreams';
    await this.redis.zadd(key, viewerCount, livestreamId);
    await this.redis.expire(key, 300); // 5 minutes TTL
  }

  async getTrendingLivestreams(limit = 10): Promise<string[]> {
    const key = 'trending:livestreams';
    return this.redis.zrevrange(key, 0, limit - 1);
  }

  // ============= VIEW COUNT DEDUPLICATION HELPERS =============
  // Check whether a given viewerId has already been counted for this video
  async hasCountedView(itemType: 'video' | 'livestream', itemId: string, viewerId: string): Promise<boolean> {
    const key = `${itemType}:${itemId}:counted_views`;
    const res = await this.redis.sismember(key, viewerId);
    return res === 1;
  }

  // Mark that a given viewerId has been counted for this video (with optional TTL days)
  async markCountedView(itemType: 'video' | 'livestream', itemId: string, viewerId: string, ttlDays = 30) {
    const key = `${itemType}:${itemId}:counted_views`;
    await this.redis.sadd(key, viewerId);
    // Set TTL only if not already set
    const ttl = await this.redis.ttl(key);
    if (ttl === -1) {
      await this.redis.expire(key, ttlDays * 24 * 60 * 60);
    }
  }

  // Session management
  async createSession(sessionId: string, userId: string, ttl = 86400) {
    await this.redis.set(`session:${sessionId}`, userId, 'EX', ttl);
  }

  async getSession(sessionId: string): Promise<string | null> {
    return this.redis.get(`session:${sessionId}`);
  }

  async deleteSession(sessionId: string) {
    await this.redis.del(`session:${sessionId}`);
  }

  // OTP storage (short-lived)
  async storeOTP(email: string, otp: string, ttl = 600) {
    const key = `otp:${email}`;
    await this.redis.set(key, otp, 'EX', ttl);
  }

  async verifyOTP(email: string, otp: string): Promise<boolean> {
    const key = `otp:${email}`;
    const stored = await this.redis.get(key);
    
    if (stored === otp) {
      await this.redis.del(key);
      return true;
    }
    
    return false;
  }

  // Document sharing state
  async shareDocument(livestreamId: string, documentData: any) {
    const key = `livestream:${livestreamId}:shared_document`;
    await this.set(key, documentData, 3600);
  }

  async getSharedDocument(livestreamId: string) {
    const key = `livestream:${livestreamId}:shared_document`;
    return this.get(key);
  }

  async clearSharedDocument(livestreamId: string) {
    const key = `livestream:${livestreamId}:shared_document`;
    await this.del(key);
  }

  // Notification queue
  async queueNotification(userId: string, notification: any) {
    const key = `notifications:${userId}`;
    await this.redis.lpush(key, JSON.stringify(notification));
    await this.redis.ltrim(key, 0, 49); // Keep last 50
    await this.redis.expire(key, 86400); // 24 hours
  }

  async getNotifications(userId: string): Promise<any[]> {
    const key = `notifications:${userId}`;
    const notifications = await this.redis.lrange(key, 0, -1);
    return notifications.map(n => JSON.parse(n));
  }

  // Cleanup methods
  async cleanupLivestream(livestreamId: string) {
    const pattern = `livestream:${livestreamId}:*`;
    const keys = await this.redis.keys(pattern);
    
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  // ============= CHANNEL MANAGEMENT FOR MULTI-INSTANCE =============

  // Store channel data in Redis (replaces in-memory channels)
  async setChannel(livestreamId: string, channelData: {
    broadcaster: string;
    watchers: string[];
    info?: any;
  }) {
    const key = `channel:${livestreamId}`;
    await this.set(key, channelData, 7200); // 2 hours TTL
  }

  async getChannel(livestreamId: string): Promise<{
    broadcaster: string;
    watchers: string[];
    info?: any;
  } | null> {
    const key = `channel:${livestreamId}`;
    return this.get(key);
  }

  async addWatcherToChannel(livestreamId: string, socketId: string) {
    const channel = await this.getChannel(livestreamId);
    if (!channel) return null;
    
    if (!channel.watchers.includes(socketId)) {
      channel.watchers.push(socketId);
      await this.setChannel(livestreamId, channel);
    }
    
    return channel.watchers.length;
  }

  async removeWatcherFromChannel(livestreamId: string, socketId: string) {
    const channel = await this.getChannel(livestreamId);
    if (!channel) return null;
    
    channel.watchers = channel.watchers.filter(id => id !== socketId);
    await this.setChannel(livestreamId, channel);
    
    return channel.watchers.length;
  }

  async deleteChannel(livestreamId: string) {
    const key = `channel:${livestreamId}`;
    await this.del(key);
  }

  async getAllChannels(): Promise<string[]> {
    const keys = await this.redis.keys('channel:*');
    return keys.map(key => key.replace('channel:', ''));
  }

  onModuleDestroy() {
    void this.redis.quit();
  }
}
