import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private authService: AuthService) {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: `${process.env.APP_URL}/auth/google/callback`,
      scope: ['email', 'profile'],
      passReqToCallback: true, // Enable passing request to callback
    });
  }

  async validate(
    request: { query?: { state?: string } },
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<any> {
    const { id, emails, displayName, photos } = profile;

    // Extract role from state parameter
    let role: 'STUDENT' | 'TEACHER' | undefined;
    try {
      if (request.query?.state) {
        const decoded = JSON.parse(
          Buffer.from(request.query.state, 'base64').toString(),
        ) as { role?: 'STUDENT' | 'TEACHER' };
        role = decoded.role;
      }
    } catch (error) {
      // If state parsing fails, continue without role
      console.error('Failed to parse OAuth state:', error);
    }

    const user = await this.authService.googleLogin({
      googleId: id,
      email: emails?.[0]?.value || '',
      fullName: displayName,
      avatar: photos?.[0]?.value,
      role, // Pass role to auth service
    });

    done(null, user);
  }
}
