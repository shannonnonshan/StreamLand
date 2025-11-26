import { Controller, Get, Patch, Body, Param, UseGuards, Request, Post, UploadedFile, UseInterceptors, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TeacherService } from './teacher.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';

@Controller('teacher')
export class TeacherController {
  constructor(private readonly teacherService: TeacherService) {}

  // Get teacher profile by ID (public endpoint)
  @Public()
  @Get(':id/profile')
  async getProfile(@Param('id') teacherId: string) {
    return this.teacherService.getProfile(teacherId);
  }

  // Update teacher bio (protected endpoint)
  @UseGuards(JwtAuthGuard)
  @Patch(':id/bio')
  async updateBio(
    @Param('id') teacherId: string,
    @Body('bio') bio: string,
    @Request() req: { user: { sub: string } }
  ) {
    // Verify that the user is updating their own profile
    if (req.user.sub !== teacherId) {
      throw new Error('Unauthorized');
    }
    return this.teacherService.updateBio(teacherId, bio);
  }

  // Update teacher avatar (protected endpoint)
  @UseGuards(JwtAuthGuard)
  @Patch(':id/avatar')
  async updateAvatar(
    @Param('id') teacherId: string,
    @Body('avatarUrl') avatarUrl: string,
    @Request() req: { user: { sub: string } }
  ) {
    // Verify that the user is updating their own profile
    if (req.user.sub !== teacherId) {
      throw new Error('Unauthorized');
    }
    return this.teacherService.updateAvatar(teacherId, avatarUrl);
  }

  // Upload document for livestream
  @UseGuards(JwtAuthGuard)
  @Post(':id/upload-document')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @Param('id') teacherId: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: { user: { sub: string } }
  ) {
    // Verify that the user is uploading to their own account
    if (req.user.sub !== teacherId) {
      throw new BadRequestException('Unauthorized');
    }

    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    return this.teacherService.uploadDocument(teacherId, file);
  }
}
