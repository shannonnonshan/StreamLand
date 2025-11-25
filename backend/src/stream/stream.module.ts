import { Module } from '@nestjs/common';
import { StreamGateway } from './stream.gateway';
import { RedisModule } from '../redis/redis.module';
import { PrismaModule } from '../prisma/prisma.module';
import { R2StorageModule } from '../r2-storage/r2-storage.module';

@Module({
  imports: [RedisModule, PrismaModule, R2StorageModule],
  providers: [StreamGateway],
})
export class StreamModule {}
