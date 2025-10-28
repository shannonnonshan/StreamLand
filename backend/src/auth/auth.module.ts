import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CleanupService } from './cleanup.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { GithubStrategy } from './strategies/github.strategy';
import { PrismaModule } from '../prisma/prisma.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    PrismaModule,
    MailModule,
    PassportModule,
    JwtModule.register({
      secret:
        process.env.JWT_SECRET || 'your-secret-key-change-this-in-production',
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    CleanupService,
    JwtStrategy,
    GoogleStrategy,
    GithubStrategy,
  ],
  exports: [AuthService],
})
export class AuthModule {}
