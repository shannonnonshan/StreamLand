import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import {
  LoginDto,
  RegisterDto,
  VerifyOtpDto,
  ResetPasswordDto,
  RequestOtpDto,
  CompleteOAuthDto,
  UpdateUserProfileDto,
  UpdateStudentProfileDto,
  UpdateTeacherProfileDto,
  Role,
} from './dto';

@Injectable()
export class AuthService {
  // Rate limiting map: email -> last OTP sent timestamp
  private otpRateLimitMap = new Map<string, number>();
  private readonly OTP_RATE_LIMIT_MS = 60 * 1000; // 1 minute

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mailService: MailService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, password, fullName, role } = registerDto;

    // Check if user already exists
    const existingUser = await this.prisma.postgres.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Check if pending registration exists
    const existingPending = await this.prisma.postgres.pendingRegistration.findUnique({
      where: { email },
    });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate OTP
    const otp = this.generateOTP();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Create or update pending registration
    if (existingPending) {
      await this.prisma.postgres.pendingRegistration.update({
        where: { email },
        data: {
          password: hashedPassword,
          fullName,
          role: role || 'STUDENT',
          otp,
          otpExpiry,
        },
      });
    } else {
      await this.prisma.postgres.pendingRegistration.create({
        data: {
          email,
          password: hashedPassword,
          fullName,
          role: role || 'STUDENT',
          otp,
          otpExpiry,
        },
      });
    }

    // Send OTP email
    await this.mailService.sendOTP(email, otp, fullName);

    return {
      message: 'Registration successful. Please verify your email with OTP.',
      email,
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Find user
    const user = await this.prisma.postgres.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is verified
    if (!user.isVerified) {
      throw new UnauthorizedException('Please verify your email first');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if 2FA is enabled
    if (user.twoFactorEnabled) {
      // Generate OTP for 2FA
      const otp = this.generateOTP();
      const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      // Update user with OTP
      await this.prisma.postgres.user.update({
        where: { id: user.id },
        data: {
          otp,
          otpExpiry,
        },
      });

      // Send OTP email
      await this.mailService.sendOTP(email, otp, user.fullName);

      return {
        message: '2FA OTP sent to your email',
        requires2FA: true,
        email: user.email,
      };
    }

    // Generate tokens (no 2FA)
    const tokens = await this.generateTokens(user.id, user.email, user.role);

    // Create session
    await this.prisma.postgres.session.create({
      data: {
        userId: user.id,
        token: tokens.refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return {
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        avatar: user.avatar,
        twoFactorEnabled: user.twoFactorEnabled,
      },
      ...tokens,
    };
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto) {
    const { email, otp } = verifyOtpDto;

    // Find pending registration
    const pendingReg = await this.prisma.postgres.pendingRegistration.findUnique({
      where: { email },
    });

    if (!pendingReg) {
      throw new BadRequestException(
        'Registration not found. Please register first.',
      );
    }

    // Check OTP
    if (pendingReg.otp !== otp) {
      throw new BadRequestException('Invalid OTP');
    }

    // Check OTP expiration
    if (pendingReg.otpExpiry < new Date()) {
      throw new BadRequestException('OTP expired. Please request a new one.');
    }

    // Create user in database
    const user = await this.prisma.postgres.user.create({
      data: {
        email: pendingReg.email,
        password: pendingReg.password,
        fullName: pendingReg.fullName,
        role: pendingReg.role,
        isVerified: true,
      },
    });

    // Create role-specific profile
    if (pendingReg.role === 'TEACHER') {
      await this.prisma.postgres.teacherProfile.create({
        data: {
          userId: user.id,
        },
      });
    } else if (pendingReg.role === 'STUDENT') {
      await this.prisma.postgres.studentProfile.create({
        data: {
          userId: user.id,
        },
      });
    }

    // Delete pending registration
    await this.prisma.postgres.pendingRegistration.delete({
      where: { email },
    });

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email, user.role);

    // Create session
    await this.prisma.postgres.session.create({
      data: {
        userId: user.id,
        token: tokens.refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      message: 'Email verified successfully',
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        avatar: user.avatar,
        twoFactorEnabled: user.twoFactorEnabled,
      },
      ...tokens,
    };
  }

  async verify2FAOtp(verifyOtpDto: VerifyOtpDto) {
    const { email, otp } = verifyOtpDto;

    // Find user
    const user = await this.prisma.postgres.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Check if 2FA is enabled
    if (!user.twoFactorEnabled) {
      throw new BadRequestException('2FA is not enabled for this account');
    }

    // Check OTP
    if (user.otp !== otp) {
      throw new UnauthorizedException('Invalid OTP');
    }

    // Check OTP expiration
    if (!user.otpExpiry || user.otpExpiry < new Date()) {
      throw new UnauthorizedException('OTP expired. Please login again.');
    }

    // Clear OTP after successful verification
    await this.prisma.postgres.user.update({
      where: { id: user.id },
      data: {
        otp: null,
        otpExpiry: null,
      },
    });

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email, user.role);

    // Create session
    await this.prisma.postgres.session.create({
      data: {
        userId: user.id,
        token: tokens.refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return {
      message: '2FA verification successful',
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        avatar: user.avatar,
        twoFactorEnabled: user.twoFactorEnabled,
      },
      ...tokens,
    };
  }

  async requestOtp(requestOtpDto: RequestOtpDto) {
    const { email } = requestOtpDto;

    // Rate limiting: Check if OTP was sent recently
    const lastSent = this.otpRateLimitMap.get(email);
    if (lastSent && Date.now() - lastSent < this.OTP_RATE_LIMIT_MS) {
      const remainingSeconds = Math.ceil(
        (this.OTP_RATE_LIMIT_MS - (Date.now() - lastSent)) / 1000,
      );
      throw new BadRequestException(
        `Please wait ${remainingSeconds} seconds before requesting another OTP`,
      );
    }

    // Check if this is a pending registration
    const pendingReg = await this.prisma.postgres.pendingRegistration.findUnique({
      where: { email },
    });

    // Generate new OTP
    const otp = this.generateOTP();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    if (pendingReg) {
      // Update pending registration with new OTP
      await this.prisma.postgres.pendingRegistration.update({
        where: { email },
        data: { otp, otpExpiry },
      });

      // Send OTP email
      await this.mailService.sendOTP(email, otp, pendingReg.fullName);

      // Update rate limit map
      this.otpRateLimitMap.set(email, Date.now());

      return {
        message: 'OTP sent to your email',
      };
    }

    // Otherwise check for existing user (for password reset)
    const user = await this.prisma.postgres.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new BadRequestException('Email not found. Please register first.');
    }

    // Update user with new OTP
    await this.prisma.postgres.user.update({
      where: { id: user.id },
      data: { otp, otpExpiry },
    });

    // Send OTP email for password reset
    await this.mailService.sendPasswordResetOTP(email, otp, user.fullName);

    // Update rate limit map
    this.otpRateLimitMap.set(email, Date.now());

    return {
      message: 'OTP sent to your email',
    };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { email, newPassword } = resetPasswordDto;

    // Find user
    const user = await this.prisma.postgres.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await this.prisma.postgres.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    return {
      message: 'Password reset successfully',
    };
  }

  async refreshToken(userId: string, refreshToken: string) {
    // Find active session
    const session = await this.prisma.postgres.session.findFirst({
      where: {
        userId,
        token: refreshToken,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.postgres.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);

    // Update session with new refresh token
    await this.prisma.postgres.session.update({
      where: { id: session.id },
      data: {
        token: tokens.refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return tokens;
  }

  async refreshTokenByToken(refreshToken: string) {
    // Find active session by refresh token only
    const session = await this.prisma.postgres.session.findFirst({
      where: {
        token: refreshToken,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (!session) {
      console.error('❌ Session not found for refresh token');
      throw new UnauthorizedException('Invalid refresh token');
    }

    console.log('✅ Session found, userId:', session.userId);

    const user = await this.prisma.postgres.user.findUnique({
      where: { id: session.userId },
    });

    if (!user) {
      console.error('❌ User not found for session userId:', session.userId);
      throw new UnauthorizedException('User not found');
    }

    console.log('✅ User found, generating new tokens');

    const tokens = await this.generateTokens(user.id, user.email, user.role);

    // Update session with new refresh token
    await this.prisma.postgres.session.update({
      where: { id: session.id },
      data: {
        token: tokens.refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    console.log('✅ Token refreshed successfully for user:', user.email);

    return tokens;
  }

  async logout(userId: string) {
    // Delete all sessions for user
    await this.prisma.postgres.session.deleteMany({
      where: { userId },
    });

    return { message: 'Logout successful' };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.postgres.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        avatar: true,
        bio: true,
        location: true,
        isVerified: true,
        twoFactorEnabled: true,
        studentProfile: true,
        teacherProfile: true,
      },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    return user;
  }

  private async generateTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, { expiresIn: '15m' }),
      this.jwtService.signAsync(payload, { expiresIn: '7d' }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  private generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Social login methods
  async googleLogin(googleData: {
    googleId: string;
    email: string;
    fullName: string;
    avatar?: string;
    role?: Role;
  }) {
    // Check if user exists with this googleId
    let user = await this.prisma.postgres.user.findUnique({
      where: { googleId: googleData.googleId },
    });

    if (!user) {
      // Check if user exists with this email
      user = await this.prisma.postgres.user.findUnique({
        where: { email: googleData.email },
      });

      if (user) {
        // Link Google account to existing user
        user = await this.prisma.postgres.user.update({
          where: { id: user.id },
          data: {
            googleId: googleData.googleId,
            avatar: googleData.avatar || user.avatar,
            isVerified: true,
          },
        });
      } else {
        // New user - return profile data without creating account yet
        return {
          isNewUser: true,
          provider: 'google',
          profile: {
            googleId: googleData.googleId,
            email: googleData.email,
            fullName: googleData.fullName,
            avatar: googleData.avatar,
          },
        };
      }
    }

    // Existing user - generate tokens and login
    const tokens = await this.generateTokens(user.id, user.email, user.role);

    // Create session
    await this.prisma.postgres.session.create({
      data: {
        userId: user.id,
        token: tokens.refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return {
      isNewUser: false,
      message: 'Google login successful',
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        avatar: user.avatar,
        twoFactorEnabled: user.twoFactorEnabled,
      },
      ...tokens,
    };
  }

  async githubLogin(githubData: {
    githubId: string;
    email: string;
    fullName: string;
    avatar?: string;
    role?: Role;
  }) {
    // Check if user exists with this githubId
    let user = await this.prisma.postgres.user.findUnique({
      where: { githubId: githubData.githubId },
    });

    if (!user) {
      // Check if user exists with this email
      user = await this.prisma.postgres.user.findUnique({
        where: { email: githubData.email },
      });

      if (user) {
        // Link GitHub account to existing user
        user = await this.prisma.postgres.user.update({
          where: { id: user.id },
          data: {
            githubId: githubData.githubId,
            avatar: githubData.avatar || user.avatar,
            isVerified: true,
          },
        });
      } else {
        // New user - return profile data without creating account yet
        return {
          isNewUser: true,
          provider: 'github',
          profile: {
            githubId: githubData.githubId,
            email: githubData.email,
            fullName: githubData.fullName,
            avatar: githubData.avatar,
          },
        };
      }
    }

    // Existing user - generate tokens and login
    const tokens = await this.generateTokens(user.id, user.email, user.role);

    // Create session
    await this.prisma.postgres.session.create({
      data: {
        userId: user.id,
        token: tokens.refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return {
      isNewUser: false,
      message: 'GitHub login successful',
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        avatar: user.avatar,
        twoFactorEnabled: user.twoFactorEnabled,
      },
      ...tokens,
    };
  }

  async completeOAuthRegistration(completeOAuthDto: CompleteOAuthDto) {
    const {
      provider,
      socialId,
      email,
      fullName,
      avatar,
      role,
      // Teacher fields
      teacherIntroduction,
      // Student fields
      studentSchool,
      studentClass,
    } = completeOAuthDto;

    // Check if user already exists with this email or social ID
    const existingUser = await this.prisma.postgres.user.findFirst({
      where: {
        OR: [
          { email },
          provider === 'google'
            ? { googleId: socialId }
            : { githubId: socialId },
        ],
      },
    });

    if (existingUser) {
      throw new ConflictException(
        'User already exists with this email or social account',
      );
    }

    // Prepare user data
    const userData: {
      email: string;
      fullName: string;
      googleId?: string;
      githubId?: string;
      avatar?: string;
      role: Role;
      password: string;
      isVerified: boolean;
      bio?: string;
    } = {
      email,
      fullName,
      ...(provider === 'google'
        ? { googleId: socialId }
        : { githubId: socialId }),
      avatar,
      role,
      password: '', // No password for social login
      isVerified: true, // OAuth users are already verified
    };

    // Add role-specific fields
    if (role === 'TEACHER') {
      // Note: File uploads (teacherCV, teacherCertificates) would need to be handled
      // by a file upload service and stored separately.
      // For now, we'll store introduction in the bio field
      if (teacherIntroduction) userData.bio = teacherIntroduction;
      // TODO: Add teacherSubjects, teacherExperience, teacherSpecialty to Prisma schema
      // TODO: Implement file upload handling for CV and certificates
    }

    // Create new user with OAuth data
    const user = await this.prisma.postgres.user.create({
      data: userData,
    });

    // Create role-specific profile
    if (role === 'TEACHER') {
      await this.prisma.postgres.teacherProfile.create({
        data: {
          userId: user.id,
        },
      });
    } else if (role === 'STUDENT') {
      await this.prisma.postgres.studentProfile.create({
        data: {
          userId: user.id,
          school: studentSchool,
          grade: studentClass, // studentClass maps to grade in schema
        },
      });
    }

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email, user.role);

    // Create session
    await this.prisma.postgres.session.create({
      data: {
        userId: user.id,
        token: tokens.refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return {
      message: 'OAuth registration completed successfully',
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        avatar: user.avatar,
        twoFactorEnabled: user.twoFactorEnabled,
      },
      ...tokens,
    };
  }

  // Update user profile methods
  async updateUserProfile(userId: string, updateDto: UpdateUserProfileDto) {
    const user = await this.prisma.postgres.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updatedUser = await this.prisma.postgres.user.update({
      where: { id: userId },
      data: updateDto,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        avatar: true,
        bio: true,
        location: true,
        isVerified: true,
        studentProfile: true,
        teacherProfile: true,
      },
    });

    return updatedUser;
  }

  async updateStudentProfile(
    userId: string,
    updateDto: UpdateStudentProfileDto,
  ) {
    const user = await this.prisma.postgres.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role !== 'STUDENT') {
      throw new BadRequestException('User is not a student');
    }

    // Create profile if it doesn't exist
    if (!user.studentProfile) {
      await this.prisma.postgres.studentProfile.create({
        data: {
          userId: user.id,
          ...updateDto,
        },
      });
    } else {
      await this.prisma.postgres.studentProfile.update({
        where: { userId: user.id },
        data: updateDto,
      });
    }

    // Return updated user with profile
    return await this.prisma.postgres.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true },
    });
  }

  async updateTeacherProfile(
    userId: string,
    updateDto: UpdateTeacherProfileDto,
  ) {
    const user = await this.prisma.postgres.user.findUnique({
      where: { id: userId },
      include: { teacherProfile: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role !== 'TEACHER') {
      throw new BadRequestException('User is not a teacher');
    }

    // Create profile if it doesn't exist
    if (!user.teacherProfile) {
      await this.prisma.postgres.teacherProfile.create({
        data: {
          userId: user.id,
          ...updateDto,
        },
      });
    } else {
      await this.prisma.postgres.teacherProfile.update({
        where: { userId: user.id },
        data: updateDto,
      });
    }

    // Return updated user with profile
    return await this.prisma.postgres.user.findUnique({
      where: { id: userId },
      include: { teacherProfile: true },
    });
  }
    async updateTwoFA(userId: string, twoFactorEnabled: boolean) {
    return this.prisma.postgres.user.update({
      where: { id: userId },
      data: { twoFactorEnabled },
      select: { id: true, twoFactorEnabled: true },
    });
  }
}
