import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { PrismaModule } from '../prisma/prisma.module';
import { R2StorageModule } from '../r2-storage/r2-storage.module';
import { RedisModule } from '../redis/redis.module';
import { DocumentModule } from '../document/document.module';
import { LivestreamModule } from '../livestream/livestream.module';
import { PROCESSING_QUEUE_NAME } from './processing.types';
import { ProcessingProcessor } from './processing.processor';
import { ProcessingController } from './processing.controller';
import { ProcessingGateway } from './processing.gateway';
import { ProcessingService } from './processing.service';
import { ProcessingStateService } from './processing-state.service';

@Global()
@Module({
  imports: [
    PrismaModule,
    R2StorageModule,
    RedisModule,
    DocumentModule,
    LivestreamModule,
    BullModule.registerQueue({
      name: PROCESSING_QUEUE_NAME,
    }),
  ],
  controllers: [ProcessingController],
  providers: [ProcessingService, ProcessingProcessor, ProcessingStateService, ProcessingGateway],
  exports: [ProcessingService],
})
export class ProcessingModule {}