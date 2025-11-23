import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Get,
  Res,
  Patch,
  Param,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';

interface OAuthResult {
  isNewUser: boolean;
  provider: string;
  profile?: any;
  accessToken?: string;
  refreshToken?: string;
}
import {
  LoginDto,
  RegisterDto,
  VerifyOtpDto,
  ResetPasswordDto,
  RequestOtpDto,
  GoogleLoginDto,
  GithubLoginDto,
  CompleteOAuthDto,
  UpdateUserProfileDto,
  UpdateStudentProfileDto,
  UpdateTeacherProfileDto,
} from './dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { GithubAuthGuard } from './guards/github-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.authService.verifyOtp(verifyOtpDto);
  }

  @Post('verify-2fa-otp')
  @HttpCode(HttpStatus.OK)
  async verify2FAOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.authService.verify2FAOtp(verifyOtpDto);
  }

  @Post('request-otp')
  @HttpCode(HttpStatus.OK)
  async requestOtp(@Body() requestOtpDto: RequestOtpDto) {
    return this.authService.requestOtp(requestOtpDto);
  }

  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  async resendOtp(@Body() requestOtpDto: RequestOtpDto) {
    // Resend OTP sử dụng cùng logic với request-otp
    return this.authService.requestOtp(requestOtpDto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() body: { refreshToken: string },
    @Request() req: { user: { sub: string } },
  ) {
    return this.authService.refreshToken(req.user.sub, body.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Request() req: { user: { sub: string } }) {
    return this.authService.logout(req.user.sub);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req: { user: { sub: string } }) {
    return this.authService.getProfile(req.user.sub);
  }

  @Get(':id/profile')
  @UseGuards(JwtAuthGuard)
  async getProfileById(@Param('id') id: string) {
    return this.authService.getProfile(id);
  }

  // OAuth2 routes
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  async googleAuth() {
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  googleAuthCallback(@Request() req: { user: any }, @Res() res: Response) {
    const result = req.user as OAuthResult;

    if (result.isNewUser) {
      const profileData = encodeURIComponent(JSON.stringify(result.profile));
      res.redirect(
        `${process.env.FRONTEND_URL}/auth/oauth-complete?provider=${result.provider}&profile=${profileData}`,
      );
    } else {
      // Existing user - redirect with tokens
      const { accessToken, refreshToken } = result;
      res.redirect(
        `${process.env.FRONTEND_URL}/auth/callback?accessToken=${accessToken}&refreshToken=${refreshToken}`,
      );
    }
  }

  @Get('github')
  @UseGuards(GithubAuthGuard)
  async githubAuth() {
    // Initiates GitHub OAuth flow
  }

  @Get('github/callback')
  @UseGuards(GithubAuthGuard)
  githubAuthCallback(@Request() req: { user: any }, @Res() res: Response) {
    const result = req.user as OAuthResult;

    if (result.isNewUser) {
      // New user - redirect to frontend with profile data to complete registration
      const profileData = encodeURIComponent(JSON.stringify(result.profile));
      res.redirect(
        `${process.env.FRONTEND_URL}/auth/oauth-complete?provider=${result.provider}&profile=${profileData}`,
      );
    } else {
      // Existing user - redirect with tokens
      const { accessToken, refreshToken } = result;
      res.redirect(
        `${process.env.FRONTEND_URL}/auth/callback?accessToken=${accessToken}&refreshToken=${refreshToken}`,
      );
    }
  }

  @Post('google')
  @HttpCode(HttpStatus.OK)
  async googleLogin(@Body() body: GoogleLoginDto) {
    return this.authService.googleLogin(body);
  }

  @Post('github')
  @HttpCode(HttpStatus.OK)
  async githubLogin(@Body() body: GithubLoginDto) {
    return this.authService.githubLogin(body);
  }

  @Post('complete-oauth')
  @HttpCode(HttpStatus.CREATED)
  async completeOAuth(@Body() completeOAuthDto: CompleteOAuthDto) {
    return this.authService.completeOAuthRegistration(completeOAuthDto);
  }

  // Profile update routes
  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @Request() req: { user: { sub: string } },
    @Body() updateDto: UpdateUserProfileDto,
  ) {
    return this.authService.updateUserProfile(req.user.sub, updateDto);
  }

  @Patch('profile/student')
  @UseGuards(JwtAuthGuard)
  async updateStudentProfile(
    @Request() req: { user: { sub: string } },
    @Body() updateDto: UpdateStudentProfileDto,
  ) {
    return this.authService.updateStudentProfile(req.user.sub, updateDto);
  }

  @Patch('profile/teacher')
  @UseGuards(JwtAuthGuard)
  async updateTeacherProfile(
    @Request() req: { user: { sub: string } },
    @Body() updateDto: UpdateTeacherProfileDto,
  ) {
    return this.authService.updateTeacherProfile(req.user.sub, updateDto);
  }

  @Patch(':id/2fa')
  @UseGuards(JwtAuthGuard)
  async updateTwoFA(
    @Param('id') id: string,
    @Body('twoFactorEnabled') twoFactorEnabled: boolean,
    @Req() req: { user: { id: string; sub: string } }, 
  ) {
    if (req.user.sub !== id) {
      throw new ForbiddenException("Bạn không được phép chỉnh sửa 2FA của user khác");
    }

    return this.authService.updateTwoFA(id, twoFactorEnabled);
  }
}
