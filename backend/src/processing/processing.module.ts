import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { PrismaModule } from '../prisma/prisma.module';
import { R2StorageModule } from '../r2-storage/r2-storage.module';
import { PROCESSING_QUEUE_NAME } from './processing.types';
import { ProcessingProcessor } from './processing.processor';
import { ProcessingService } from './processing.service';

@Global()
@Module({
  imports: [
    PrismaModule,
    R2StorageModule,
    BullModule.registerQueue({
      name: PROCESSING_QUEUE_NAME,
    }),
  ],
  providers: [ProcessingService, ProcessingProcessor],
  exports: [ProcessingService],
})
export class ProcessingModule {}