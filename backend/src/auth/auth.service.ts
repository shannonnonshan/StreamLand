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
import { R2StorageService } from '../r2-storage/r2-storage.service';
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
  UploadTeacherCVDto,
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
    private r2StorageService: R2StorageService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, password, fullName, role } = registerDto;

    // Check if user already exists
    const existingUser = await this.prisma.postgres.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('This email address is already registered. Please use a different email or login.');
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
      message: 'Registration successful. Please check your email for the verification code (OTP).',
      email,
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Find user
    const user = await this.prisma.postgres.user.findUnique({
      where: { email },
      include: {
        teacherProfile: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password. Please check your credentials and try again.');
    }

    // Check if user is verified
    if (!user.isVerified) {
      throw new UnauthorizedException('Email verification required. Please verify your email address before logging in.');
    }

    // Check if teacher is approved (for TEACHER role only)
    if (user.role === 'TEACHER' && user.teacherProfile) {
      if (!user.teacherProfile.isApproved) {
        throw new UnauthorizedException(
          'Your teacher account is pending approval. Please wait for admin review (usually within 4 hours).'
        );
      }
      
      // Check if teacher was rejected
      if (user.teacherProfile.rejectedAt) {
        const reason = user.teacherProfile.rejectionReason || 'No reason provided';
        throw new UnauthorizedException(
          `Your teacher account was rejected. Reason: ${reason}. Please contact support.`
        );
      }
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password. Please check your credentials and try again.');
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
        message: 'Two-factor authentication required. A verification code has been sent to your email.',
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
      message: 'Login successful. Welcome back!',
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
        'No pending registration found for this email. Please register first.',
      );
    }

    // Check OTP
    if (pendingReg.otp !== otp) {
      throw new BadRequestException('Invalid verification code. Please check the code and try again.');
    }

    // Check OTP expiration
    if (pendingReg.otpExpiry < new Date()) {
      throw new BadRequestException('Verification code has expired. Please request a new code.');
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
      message: 'Email verified successfully. Your account is now active!',
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
      throw new UnauthorizedException('User account not found. Please check your email and try again.');
    }

    // Check if 2FA is enabled
    if (!user.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is not enabled for this account.');
    }

    // Check OTP
    if (user.otp !== otp) {
      throw new UnauthorizedException('Invalid verification code. Please check the code and try again.');
    }

    // Check OTP expiration
    if (!user.otpExpiry || user.otpExpiry < new Date()) {
      throw new UnauthorizedException('Verification code has expired. Please login again to receive a new code.');
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
      message: 'Two-factor authentication successful. Welcome back!',
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
        `Too many requests. Please wait ${remainingSeconds} seconds before requesting another verification code.`,
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
        message: 'Verification code sent successfully. Please check your email.',
      };
    }

    // Otherwise check for existing user (for password reset)
    const user = await this.prisma.postgres.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new BadRequestException('No account found with this email address. Please register first.');
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
      message: 'Password reset code sent successfully. Please check your email.',
    };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { email, newPassword } = resetPasswordDto;

    // Find user
    const user = await this.prisma.postgres.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new BadRequestException('User account not found. Please check your email and try again.');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await this.prisma.postgres.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    return {
      message: 'Password reset successful. You can now login with your new password.',
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
      throw new UnauthorizedException('Invalid or expired session. Please login again.');
    }

    const user = await this.prisma.postgres.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User account not found. Please login again.');
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
      throw new UnauthorizedException('Invalid or expired session. Please login again.');
    }

    console.log('✅ Session found, userId:', session.userId);

    const user = await this.prisma.postgres.user.findUnique({
      where: { id: session.userId },
    });

    if (!user) {
      console.error('❌ User not found for session userId:', session.userId);
      throw new UnauthorizedException('User account not found. Please login again.');
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

    return { message: 'Logged out successfully. See you soon!' };
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
      throw new BadRequestException('User profile not found. Please login again.');
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
      message: 'Google login successful. Welcome back!',
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
      message: 'GitHub login successful. Welcome back!',
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
        'An account already exists with this email or social account. Please login instead.',
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
      message: 'Registration completed successfully. Welcome to StreamLand!',
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
      throw new NotFoundException('User profile not found. Please login again.');
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
      throw new NotFoundException('User profile not found. Please login again.');
    }

    if (user.role !== 'STUDENT') {
      throw new BadRequestException('Access denied. This action is only available for student accounts.');
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
      throw new NotFoundException('User profile not found. Please login again.');
    }

    if (user.role !== 'TEACHER') {
      throw new BadRequestException('Access denied. This action is only available for teacher accounts.');
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
  
  async uploadTeacherCV(
    userId: string,
    cvFile: Express.Multer.File | undefined,
    updateDto: UploadTeacherCVDto,
  ) {
    // Verify user exists and is a teacher
    const user = await this.prisma.postgres.user.findUnique({
      where: { id: userId },
      include: { teacherProfile: true },
    });

    if (!user) {
      throw new NotFoundException('User profile not found. Please login again.');
    }

    if (user.role !== 'TEACHER') {
      throw new BadRequestException('Access denied. This action is only available for teacher accounts.');
    }

    // Upload CV to R2
    let cvUrl: string | null = null;
    if (cvFile) {
      cvUrl = await this.r2StorageService.uploadDocument(
        userId,
        `cv_${Date.now()}_${cvFile.originalname}`,
        cvFile.buffer,
        cvFile.mimetype,
      );
    }

    // Prepare update data
    const updateData: any = { ...updateDto };
    if (cvUrl) {
      updateData.cvUrl = cvUrl;
    }

    // Create or update teacher profile
    if (!user.teacherProfile) {
      await this.prisma.postgres.teacherProfile.create({
        data: {
          userId: user.id,
          ...updateData,
        },
      });
    } else {
      await this.prisma.postgres.teacherProfile.update({
        where: { userId: user.id },
        data: updateData,
      });
    }

    // Return updated profile
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
