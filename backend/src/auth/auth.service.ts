import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { R2StorageService } from '../r2-storage/r2-storage.service';
import { normalizeVideoCategory } from '../common/constants/video-categories';
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
  private otpRateLimitMap = new Map<string, number>();
  private readonly OTP_RATE_LIMIT_MS = 60 * 1000; // 1 minute
    private pendingTeacherData = new Map<string, {
    subjects?: string[];
    experience?: number;
    education?: string;
    bio?: string;
    cvUrl?: string;
  }>();
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mailService: MailService,
    private r2StorageService: R2StorageService,
  ) {}

  private normalizeStudentInterests(interests?: string[] | null) {
    if (!interests || interests.length === 0) {
      return undefined;
    }

    const normalized = interests
      .map((interest) => normalizeVideoCategory(interest))
      .map((interest) => interest.trim())
      .filter((interest) => interest.length > 0)

    return Array.from(new Set(normalized));
  }

  private async assertUserNotBanned(userId: string, banUntil?: Date | null) {
    if (!banUntil) {
      return;
    }

    const now = new Date();
    if (banUntil > now) {
      throw new ForbiddenException({
        message: 'Your account is temporarily banned',
        bannedUntil: banUntil,
      });
    }

    await this.prisma.postgres.user.update({
      where: { id: userId },
      data: { banUntil: null },
    });
  }

  async register(registerDto: RegisterDto, cvFile?: any) {
    const { email, password, fullName, role } = registerDto;

    const existingUser = await this.prisma.postgres.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('This email address is already registered. Please use a different email or login.');
    }

    const existingPending = await this.prisma.postgres.pendingRegistration.findUnique({
      where: { email },
    });

    const hashedPassword = await bcrypt.hash(password, 10);

    const otp = this.generateOTP();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    let cvUrl: string | undefined;
    if (role === 'TEACHER' && cvFile) {
      cvUrl = await this.r2StorageService.uploadCV(
        email,
        cvFile.originalname,
        cvFile.buffer,
        cvFile.mimetype,
      );
    }

    // Lưu teacher data vào Map
    if (role === 'TEACHER') {
      this.pendingTeacherData.set(email, {
        subjects: registerDto.subjects,
        experience: registerDto.experience,
        education: registerDto.education,
        bio: registerDto.teacherIntroduction,
        cvUrl,
      });
    }
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

    const sendResult = await this.mailService.sendOTP(email, otp, fullName);
    
    if (!sendResult.success) {
      await this.prisma.postgres.pendingRegistration.delete({
        where: { email },
      });
      throw new BadRequestException(
        `Failed to send verification email: ${sendResult.error || 'Unknown error'}. Please try again.`,
      );
    }

    return {
      message: 'Registration successful. Please check your email for the verification code (OTP).',
      email,
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.prisma.postgres.user.findUnique({
      where: { email },
      include: {
        teacherProfile: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password. Please check your credentials and try again.');
    }

    if (!user.isVerified) {
      throw new UnauthorizedException('Email verification required. Please verify your email address before logging in.');
    }

    if (user.role === 'TEACHER') {
      if (!user.teacherProfile || !user.teacherProfile.isApproved) {
        throw new UnauthorizedException({
          message: 'Your teacher account is pending approval. Please wait for admin review (usually within 4 hours).',
          isApproved: false,
        });
      }
        
      if (user.teacherProfile.rejectedAt) {
        const reason = user.teacherProfile.rejectionReason || 'No reason provided';
        throw new UnauthorizedException(
          `Your teacher account was rejected. Reason: ${reason}. Please contact support.`
        );
      }
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password. Please check your credentials and try again.');
    }

    await this.assertUserNotBanned(user.id, user.banUntil);

    if (user.twoFactorEnabled) {
      const otp = this.generateOTP();
      const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      await this.prisma.postgres.user.update({
        where: { id: user.id },
        data: {
          otp,
          otpExpiry,
        },
      });

      const sendResult = await this.mailService.sendOTP(email, otp, user.fullName);
      
      if (!sendResult.success) {
        await this.prisma.postgres.user.update({
          where: { id: user.id },
          data: {
            otp: null,
            otpExpiry: null,
          },
        });
        throw new BadRequestException(
          `Failed to send 2FA code: ${sendResult.error || 'Unknown error'}. Please try again.`,
        );
      }

      return {
        message: 'Two-factor authentication required. A verification code has been sent to your email.',
        requires2FA: true,
        email: user.email,
      };
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);

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

    const pendingReg = await this.prisma.postgres.pendingRegistration.findUnique({
      where: { email },
    });

    if (!pendingReg) {
      throw new BadRequestException(
        'No pending registration found for this email. Please register first.',
      );
    }

    if (pendingReg.otp !== otp) {
      throw new BadRequestException('Invalid verification code. Please check the code and try again.');
    }

    if (pendingReg.otpExpiry < new Date()) {
      throw new BadRequestException('Verification code has expired. Please request a new code.');
    }

    const user = await this.prisma.postgres.user.create({
      data: {
        email: pendingReg.email,
        password: pendingReg.password,
        fullName: pendingReg.fullName,
        role: pendingReg.role,
        isVerified: true,
      },
    });

    if (pendingReg.role === 'TEACHER') {
        const teacherData = this.pendingTeacherData.get(email) || {};

        await this.prisma.postgres.teacherProfile.create({
          data: {
            userId: user.id,
            subjects: teacherData.subjects || [],
            experience: teacherData.experience,
            education: teacherData.education,
            cvUrl: teacherData.cvUrl,
          },
        });

        if (teacherData.bio) {
          await this.prisma.postgres.user.update({
            where: { id: user.id },
            data: { bio: teacherData.bio },
          });
        }

        this.pendingTeacherData.delete(email); // cleanup
      } else if (pendingReg.role === 'STUDENT') {
      await this.prisma.postgres.studentProfile.create({
        data: {
          userId: user.id,
        },
      });
    }

    await this.prisma.postgres.pendingRegistration.delete({
      where: { email },
    });

    if (user.role === 'TEACHER') {
      return {
        message:
          'Email verified successfully. Your teacher account is pending admin approval (usually within 4 hours). You will be able to login once approved.',
        requiresApproval: true,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
        },
      };
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);

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

    const user = await this.prisma.postgres.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('User account not found. Please check your email and try again.');
    }

    if (!user.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is not enabled for this account.');
    }

    if (user.otp !== otp) {
      throw new UnauthorizedException('Invalid verification code. Please check the code and try again.');
    }

    if (!user.otpExpiry || user.otpExpiry < new Date()) {
      throw new UnauthorizedException('Verification code has expired. Please login again to receive a new code.');
    }

    await this.prisma.postgres.user.update({
      where: { id: user.id },
      data: {
        otp: null,
        otpExpiry: null,
      },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role);

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

    const lastSent = this.otpRateLimitMap.get(email);
    if (lastSent && Date.now() - lastSent < this.OTP_RATE_LIMIT_MS) {
      const remainingSeconds = Math.ceil(
        (this.OTP_RATE_LIMIT_MS - (Date.now() - lastSent)) / 1000,
      );
      throw new BadRequestException(
        `Too many requests. Please wait ${remainingSeconds} seconds before requesting another verification code.`,
      );
    }

    const pendingReg = await this.prisma.postgres.pendingRegistration.findUnique({
      where: { email },
    });

    const otp = this.generateOTP();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    if (pendingReg) {
      await this.prisma.postgres.pendingRegistration.update({
        where: { email },
        data: { otp, otpExpiry },
      });

      const sendResult = await this.mailService.sendOTP(email, otp, pendingReg.fullName);
      
      if (!sendResult.success) {
        throw new BadRequestException(
          `Failed to send verification code: ${sendResult.error || 'Unknown error'}. Please try again.`,
        );
      }

      this.otpRateLimitMap.set(email, Date.now());

      return {
        message: 'Verification code sent successfully. Please check your email.',
      };
    }

    const user = await this.prisma.postgres.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new BadRequestException('No account found with this email address. Please register first.');
    }

    await this.prisma.postgres.user.update({
      where: { id: user.id },
      data: { otp, otpExpiry },
    });

    const sendResult = await this.mailService.sendPasswordResetOTP(email, otp, user.fullName);
    
    if (!sendResult.success) {
      await this.prisma.postgres.user.update({
        where: { id: user.id },
        data: { otp: null, otpExpiry: null },
      });
      throw new BadRequestException(
        `Failed to send password reset code: ${sendResult.error || 'Unknown error'}. Please try again.`,
      );
    }

    this.otpRateLimitMap.set(email, Date.now());

    return {
      message: 'Password reset code sent successfully. Please check your email.',
    };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { email, newPassword } = resetPasswordDto;

    const user = await this.prisma.postgres.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new BadRequestException('User account not found. Please check your email and try again.');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.postgres.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    return {
      message: 'Password reset successful. You can now login with your new password.',
    };
  }

  async refreshToken(userId: string, refreshToken: string) {
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

    if (user.studentProfile?.interests) {
      return {
        ...user,
        studentProfile: {
          ...user.studentProfile,
          interests: this.normalizeStudentInterests(user.studentProfile.interests) || [],
        },
      };
    }

    return user;
  }

  private async generateTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, { expiresIn: '30m' }),
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

  async googleLogin(googleData: {
    googleId: string;
    email: string;
    fullName: string;
    avatar?: string;
    role?: Role;
  }) {
    let user = await this.prisma.postgres.user.findUnique({
      where: { googleId: googleData.googleId },
    });

    if (!user) {
      user = await this.prisma.postgres.user.findUnique({
        where: { email: googleData.email },
      });

      if (user) {
        user = await this.prisma.postgres.user.update({
          where: { id: user.id },
          data: {
            googleId: googleData.googleId,
            avatar: googleData.avatar || user.avatar,
            isVerified: true,
          },
        });
      } else {
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

    await this.assertUserNotBanned(user.id, user.banUntil);

    if (user.role === 'TEACHER') {
      const teacherProfile = await this.prisma.postgres.teacherProfile.findUnique({
        where: { userId: user.id },
      });

      if (teacherProfile?.rejectedAt) {
        const reason =
          teacherProfile.rejectionReason || 'No reason provided';

        throw new UnauthorizedException({
          message: `Your teacher account was rejected. Reason: ${reason}. Please contact support.`,
          isApproved: false,
        });
      }

      if (!teacherProfile || !teacherProfile.isApproved) {
        throw new UnauthorizedException({
          message:
            'Your teacher account is pending approval. Please wait for admin review (usually within 4 hours).',
          isApproved: false,
        });
      }
    }
    const tokens = await this.generateTokens(user.id, user.email, user.role);

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
    let user = await this.prisma.postgres.user.findUnique({
      where: { githubId: githubData.githubId },
    });

    if (!user) {
      user = await this.prisma.postgres.user.findUnique({
        where: { email: githubData.email },
      });

      if (user) {
        user = await this.prisma.postgres.user.update({
          where: { id: user.id },
          data: {
            githubId: githubData.githubId,
            avatar: githubData.avatar || user.avatar,
            isVerified: true,
          },
        });
      } else {
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

    await this.assertUserNotBanned(user.id, user.banUntil);
    if (user.role === 'TEACHER') {
      const teacherProfile = await this.prisma.postgres.teacherProfile.findUnique({
        where: { userId: user.id },
      });

      if (teacherProfile?.rejectedAt) {
        const reason =
          teacherProfile.rejectionReason || 'No reason provided';

        throw new UnauthorizedException({
          message: `Your teacher account was rejected. Reason: ${reason}. Please contact support.`,
          isApproved: false,
        });
      }

      if (!teacherProfile || !teacherProfile.isApproved) {
        throw new UnauthorizedException({
          message:
            'Your teacher account is pending approval. Please wait for admin review (usually within 4 hours).',
          isApproved: false,
        });
      }
    }
    const tokens = await this.generateTokens(user.id, user.email, user.role);

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

  async completeOAuthRegistration(completeOAuthDto: CompleteOAuthDto, cvFile?: any) {
    const {
      provider, socialId, email, fullName, avatar, role,
      teacherIntroduction, studentSchool, studentClass,
      subjects, experience, education, website, linkedin,
    } = completeOAuthDto;
    
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
      password: '',
      isVerified: true,
    };

    if (role === 'TEACHER') {
      if (teacherIntroduction) userData.bio = teacherIntroduction;
    }

    const user = await this.prisma.postgres.user.create({
      data: userData,
    });

    let cvUrl: string | undefined;
    if (role === 'TEACHER' && cvFile) {
      cvUrl = await this.r2StorageService.uploadCV(
        user.id,
        cvFile.originalname,
        cvFile.buffer,
        cvFile.mimetype,
      );
    }
    if (role === 'TEACHER') {
      await this.prisma.postgres.teacherProfile.create({
        data: {
          userId: user.id,
          ...(subjects && { subjects }),
          ...(education && { education }),
          ...(experience && { experience }),
          ...(website && { website }),
          ...(linkedin && { linkedin }),
          ...(cvUrl && { cvUrl }),
        },
      });
    } else if (role === 'STUDENT') {
      await this.prisma.postgres.studentProfile.create({
        data: {
          userId: user.id,
          school: studentSchool,
          grade: studentClass,
        },
      });
    }

    if (role === 'TEACHER') {
      return {
        message:
          'Registration completed. Your teacher account is pending admin approval (usually within 4 hours). You will be able to login once approved.',
        requiresApproval: true,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
        },
      };
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);

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
    const normalizedInterests = this.normalizeStudentInterests(updateDto.interests);

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

    if (!user.studentProfile) {
      await this.prisma.postgres.studentProfile.create({
        data: {
          userId: user.id,
          ...updateDto,
          ...(normalizedInterests ? { interests: normalizedInterests } : {}),
        },
      });
    } else {
      await this.prisma.postgres.studentProfile.update({
        where: { userId: user.id },
        data: {
          ...updateDto,
          ...(normalizedInterests ? { interests: normalizedInterests } : {}),
        },
      });
    }

    return await this.prisma.postgres.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true },
    });
  }

  async updateTeacherProfile(
    userId: string,
    updateDto: UpdateTeacherProfileDto,
    cvFile?: any,
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

    let cvUrl: string | undefined;
    if (cvFile) {
      cvUrl = await this.r2StorageService.uploadCV(
        userId,
        cvFile.originalname,
        cvFile.buffer,
        cvFile.mimetype,
      );
    }

    const updateData = { ...updateDto };
    if (cvUrl) {
      updateData.cvUrl = cvUrl;
    }

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

    return await this.prisma.postgres.user.findUnique({
      where: { id: userId },
      include: { teacherProfile: true },
    });
  }
  
  async uploadTeacherCV(
    userId: string,
    cvFile: any,
    updateDto: UploadTeacherCVDto,
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

    let cvUrl: string | null = null;
    if (cvFile) {
      cvUrl = await this.r2StorageService.uploadCV(
        userId,
        cvFile.originalname,
        cvFile.buffer,
        cvFile.mimetype,
      );
    }

    const updateData: any = { ...updateDto };
    if (cvUrl) {
      updateData.cvUrl = cvUrl;
    }

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