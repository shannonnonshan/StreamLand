import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';
import { AuthService } from '../auth.service';
import { Request } from 'express';

interface GithubProfile {
  id: string;
  emails?: Array<{ value: string }>;
  displayName?: string;
  username: string;
  photos?: Array<{ value: string }>;
}

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(private authService: AuthService) {
    super({
      clientID: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      callbackURL: process.env.GITHUB_CALLBACK_URL!,
      scope: ['user:email'],
      passReqToCallback: true, // Enable passing request to callback
    });
  }
  async validate(
    request: Request,
    accessToken: string,
    refreshToken: string,
    profile: GithubProfile,
    done: (error: any, user?: any) => void,
  ): Promise<any> {
    const { id, emails, displayName, username, photos } = profile;
    // Extract role from state parameter
    let role: 'STUDENT' | 'TEACHER' | undefined;
    try {
      if (request.query.state && typeof request.query.state === 'string') {
        const decoded = JSON.parse(
          Buffer.from(request.query.state, 'base64').toString(),
        ) as { role?: 'STUDENT' | 'TEACHER' };
        role = decoded.role;
        role = decoded.role;
      }
    } catch (error) {
      console.error('Failed to parse OAuth state:', error);
    }

    const user = await this.authService.githubLogin({
      githubId: String(id),
      email: (emails?.[0]?.value as string) || `${username}@github.com`,
      fullName: displayName || username,
      avatar: photos?.[0]?.value,
      role, // Pass role to auth service
    });

    done(null, user);
  }
}
