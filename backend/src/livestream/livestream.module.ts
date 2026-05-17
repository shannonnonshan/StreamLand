import { Module } from '@nestjs/common';
import { LivestreamController } from './livestream.controller';
import { LivestreamService } from './livestream.service';
import { PrismaModule } from '../prisma/prisma.module';
import { R2StorageModule } from '../r2-storage/r2-storage.module';
import { RedisModule } from '../redis/redis.module';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';

@Module({
  imports: [PrismaModule, R2StorageModule, RedisModule],
  controllers: [LivestreamController],
  providers: [LivestreamService, OptionalJwtAuthGuard],
  exports: [LivestreamService],
})
export class LivestreamModule {}
