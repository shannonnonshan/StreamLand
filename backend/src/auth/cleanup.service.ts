import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(private prisma: PrismaService) {}

  // Run every 2 minutes to delete expired pending registrations
  @Cron('*/2 * * * *')
  async cleanupExpiredPendingRegistrations() {
    try {
      const now = new Date();
      // Delete pending registrations with expired OTP
      const result = await this.prisma.postgres.pendingRegistration.deleteMany({
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

  // Delete old pending registrations (older than 1 hour, in case otpExpiry has an error)
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupOldPendingRegistrations() {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const result = await this.prisma.postgres.pendingRegistration.deleteMany({
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
