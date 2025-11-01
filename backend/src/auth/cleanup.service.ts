import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(private prisma: PrismaService) {}

  // Chạy mỗi 2 phút để xóa pending registrations hết hạn
  @Cron('*/2 * * * *')
  async cleanupExpiredPendingRegistrations() {
    try {
      const now = new Date();
      // Xóa các pending registration có OTP đã hết hạn
      const result = await this.prisma.pendingRegistration.deleteMany({
        where: {
          otpExpiry: {
            lt: now,
          },
        },
      });

      if (result.count > 0) {
        this.logger.log(`Cleaned up ${result.count} expired pending registrations`);
      }
    } catch (error) {
      this.logger.error(
        'Failed to cleanup expired pending registrations:',
        error,
      );
    }
  }

  // Xóa các pending registration quá cũ (hơn 1 giờ, phòng trường hợp otpExpiry bị lỗi)
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupOldPendingRegistrations() {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const result = await this.prisma.pendingRegistration.deleteMany({
        where: {
          createdAt: {
            lt: oneHourAgo,
          },
        },
      });

      if (result.count > 0) {
        this.logger.log(
          `Cleaned up ${result.count} old pending registrations (>1 hour)`,
        );
      }
    } catch (error) {
      this.logger.error('Failed to cleanup old pending registrations:', error);
    }
  }
}
