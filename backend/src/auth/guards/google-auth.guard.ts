import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      const message =
        err?.response?.message ||
        err?.message ||
        info?.message ||
        'Google authentication failed. Please try again.';

      return {
        oauthError: true,
        message,
        isApproved: err?.response?.isApproved ?? undefined,
        bannedUntil: err?.response?.bannedUntil ?? undefined,
      };
    }
    return user;
  }
}