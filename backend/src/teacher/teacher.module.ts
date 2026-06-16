import { Module } from '@nestjs/common';
import { TeacherController } from './teacher.controller';
import { TeacherService } from './teacher.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ChatModule } from '../chat/chat.module';
import { RedisModule } from '../redis/redis.module';
import { R2StorageModule } from '../r2-storage/r2-storage.module';

@Module({
  imports: [PrismaModule, ChatModule, RedisModule, R2StorageModule],
  controllers: [TeacherController],
  providers: [TeacherService],
  exports: [TeacherService],
})
export class TeacherModule {}