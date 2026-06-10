import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ChatModule } from '../chat/chat.module';
import { R2StorageModule } from '../r2-storage/r2-storage.module';
import { MailModule } from '../mail/mail.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [PrismaModule, ChatModule, R2StorageModule, MailModule, NotificationModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}