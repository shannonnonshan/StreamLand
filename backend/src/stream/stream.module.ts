import { Module } from '@nestjs/common';
import { StreamGateway } from './stream.gateway';
import { RedisModule } from '../redis/redis.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [RedisModule, PrismaModule],
  providers: [StreamGateway],
})
export class StreamModule {}
