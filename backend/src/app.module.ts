import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AiController } from './ai/ai.controller';
import { AppService } from './app.service';
import { StreamModule } from './stream/stream.module';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { StudentModule } from './student/student.module';
import { TeacherModule } from './teacher/teacher.module';
import { RedisModule } from './redis/redis.module';
import { LivestreamModule } from './livestream/livestream.module';
import { ChatModule } from './chat/chat.module';
import { NotificationModule } from './notification/notification.module';
import { R2StorageModule } from './r2-storage/r2-storage.module';
import { AdminModule } from './admin/admin.module';
import { DocumentModule } from './document/document.module';
import { ProcessingModule } from './processing/processing.module';
import { createRedisConnectionOptions } from './redis/redis.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    BullModule.forRoot({
      redis: createRedisConnectionOptions(),
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    StreamModule,
    AuthModule,
    StudentModule,
    TeacherModule,
    RedisModule,
    LivestreamModule,
    ChatModule,
    R2StorageModule,
    NotificationModule,
    AdminModule,
    DocumentModule,
    ProcessingModule,
  ],
  controllers: [AppController, AiController],
  providers: [AppService],
})
export class AppModule {}
