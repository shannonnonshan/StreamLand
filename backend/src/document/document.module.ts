import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { R2StorageModule } from '../r2-storage/r2-storage.module';
import { DocumentController } from './document.controller';
import { DocumentService } from './document.service';

@Module({
  imports: [PrismaModule, R2StorageModule],
  controllers: [DocumentController],
  providers: [DocumentService],
})
export class DocumentModule {}
