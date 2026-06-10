import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GithubAuthGuard extends AuthGuard('github') {
  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      const message =
        err?.response?.message ||
        err?.message ||
        info?.message ||
        'GitHub authentication failed. Please try again.';

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