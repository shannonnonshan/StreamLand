import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from './redis.service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

describe('RedisService - Livestream Features', () => {
  let service: RedisService;
  let redis: Redis;

  beforeEach(async () => {
    const mockRedis = new Redis({
      host: 'localhost',
      port: 6379,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        {
          provide: InjectRedis(),
          useValue: mockRedis,
        },
      ],
    }).compile();

    service = module.get<RedisService>(RedisService);
    redis = mockRedis;
  });

  afterEach(async () => {
    // Cleanup
    const keys = await redis.keys('test:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });

  describe('Viewer Management', () => {
    const livestreamId = 'test:livestream-123';
    const userId1 = 'user-1';
    const userId2 = 'user-2';

    it('should add viewer and get count', async () => {
      const count = await service.addViewer(livestreamId, userId1);
      expect(count).toBe(1);
    });

    it('should track multiple viewers', async () => {
      await service.addViewer(livestreamId, userId1);
      const count = await service.addViewer(livestreamId, userId2);
      expect(count).toBe(2);
    });

    it('should remove viewer and update count', async () => {
      await service.addViewer(livestreamId, userId1);
      await service.addViewer(livestreamId, userId2);
      
      const count = await service.removeViewer(livestreamId, userId1);
      expect(count).toBe(1);
    });

    it('should get active viewers list', async () => {
      await service.addViewer(livestreamId, userId1);
      await service.addViewer(livestreamId, userId2);
      
      const viewers = await service.getActiveViewers(livestreamId);
      expect(viewers).toHaveLength(2);
      expect(viewers).toContain(userId1);
      expect(viewers).toContain(userId2);
    });

    it('should update viewer heartbeat', async () => {
      await service.addViewer(livestreamId, userId1);
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await service.updateViewerHeartbeat(livestreamId, userId1);
      
      const viewers = await service.getActiveViewers(livestreamId);
      expect(viewers).toContain(userId1);
    });
  });

  describe('Chat Management', () => {
    const livestreamId = 'test:livestream-456';
    const userId = 'user-1';

    it('should check chat rate limit', async () => {
      // First 5 messages should be allowed
      for (let i = 0; i < 5; i++) {
        const allowed = await service.checkChatRateLimit(userId, livestreamId, 5, 10);
        expect(allowed).toBe(true);
      }
      
      // 6th message should be blocked
      const blocked = await service.checkChatRateLimit(userId, livestreamId, 5, 10);
      expect(blocked).toBe(false);
    });

    it('should store and retrieve recent chat messages', async () => {
      const message1 = { id: '1', content: 'Hello', userId };
      const message2 = { id: '2', content: 'World', userId };
      
      await service.addChatMessage(livestreamId, message1);
      await service.addChatMessage(livestreamId, message2);
      
      const messages = await service.getRecentChatMessages(livestreamId);
      expect(messages).toHaveLength(2);
      expect(messages[0]).toEqual(message2); // Latest first
      expect(messages[1]).toEqual(message1);
    });

    it('should limit chat buffer to 100 messages', async () => {
      // Add 150 messages
      for (let i = 0; i < 150; i++) {
        await service.addChatMessage(livestreamId, { id: i.toString(), content: `Message ${i}` });
      }
      
      const messages = await service.getRecentChatMessages(livestreamId, 150);
      expect(messages.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Trending Livestreams', () => {
    it('should update and get trending livestreams', async () => {
      await service.updateTrendingLivestreams('stream-1', 100);
      await service.updateTrendingLivestreams('stream-2', 200);
      await service.updateTrendingLivestreams('stream-3', 50);
      
      const trending = await service.getTrendingLivestreams(2);
      expect(trending).toEqual(['stream-2', 'stream-1']); // Sorted by viewer count desc
    });
  });

  describe('Document Sharing', () => {
    const livestreamId = 'test:livestream-789';
    const document = {
      id: 'doc-1',
      title: 'Lesson 1',
      fileUrl: 'https://example.com/doc.pdf',
    };

    it('should share and retrieve document', async () => {
      await service.shareDocument(livestreamId, document);
      
      const shared = await service.getSharedDocument(livestreamId);
      expect(shared).toEqual(document);
    });

    it('should clear shared document', async () => {
      await service.shareDocument(livestreamId, document);
      await service.clearSharedDocument(livestreamId);
      
      const shared = await service.getSharedDocument(livestreamId);
      expect(shared).toBeNull();
    });
  });

  describe('WebSocket Mapping', () => {
    const socketId = 'socket-abc-123';
    const userId = 'user-1';

    it('should map socket to user', async () => {
      await service.mapSocketToUser(socketId, userId);
      
      const mappedUser = await service.getUserBySocket(socketId);
      expect(mappedUser).toBe(userId);
    });

    it('should remove socket mapping', async () => {
      await service.mapSocketToUser(socketId, userId);
      await service.removeSocketMapping(socketId);
      
      const mappedUser = await service.getUserBySocket(socketId);
      expect(mappedUser).toBeNull();
    });
  });

  describe('OTP Management', () => {
    const email = 'test@example.com';
    const otp = '123456';

    it('should store and verify OTP', async () => {
      await service.storeOTP(email, otp, 60);
      
      const verified = await service.verifyOTP(email, otp);
      expect(verified).toBe(true);
    });

    it('should fail verification with wrong OTP', async () => {
      await service.storeOTP(email, otp, 60);
      
      const verified = await service.verifyOTP(email, 'wrong-otp');
      expect(verified).toBe(false);
    });

    it('should remove OTP after successful verification', async () => {
      await service.storeOTP(email, otp, 60);
      await service.verifyOTP(email, otp);
      
      // Second verification should fail
      const verified = await service.verifyOTP(email, otp);
      expect(verified).toBe(false);
    });
  });

  describe('Cleanup', () => {
    const livestreamId = 'test:livestream-cleanup';

    it('should cleanup all livestream keys', async () => {
      // Create multiple keys
      await service.addViewer(livestreamId, 'user-1');
      await service.addChatMessage(livestreamId, { content: 'test' });
      await service.shareDocument(livestreamId, { id: '1' });
      
      // Cleanup
      await service.cleanupLivestream(livestreamId);
      
      // Verify all keys are gone
      const viewerCount = await service.getViewerCount(livestreamId);
      const chat = await service.getRecentChatMessages(livestreamId);
      const doc = await service.getSharedDocument(livestreamId);
      
      expect(viewerCount).toBe(0);
      expect(chat).toHaveLength(0);
      expect(doc).toBeNull();
    });
  });
});
