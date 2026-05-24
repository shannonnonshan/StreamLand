import { Module } from '@nestjs/common';
import { RedisModule as NestRedisModule } from '@nestjs-modules/ioredis';
import { RedisService } from './redis.service';
import { createRedisConnectionOptions } from './redis.config';

@Module({
  imports: [
    NestRedisModule.forRoot({
      type: 'single',
      options: createRedisConnectionOptions(),
    }),
  ],
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
