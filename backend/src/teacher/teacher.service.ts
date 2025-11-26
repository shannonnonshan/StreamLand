import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TeacherService {
  constructor(private prisma: PrismaService) {}

  // Get teacher profile by ID
  async getProfile(teacherId: string) {
    const teacher = await this.prisma.postgres.user.findUnique({
      where: { 
        id: teacherId,
      },
      include: {
        teacherProfile: {
          include: {
            followers: true,
          },
        },
      },
    });

    if (!teacher || !teacher.teacherProfile) {
      throw new NotFoundException('Teacher not found');
    }

    // Count total videos/recordings for this teacher
    // This would require a Recording/Video model - for now using 0
    const totalVideos = 0; // TODO: Implement when Recording model is created

    return {
      id: teacher.id,
      name: teacher.fullName,
      username: teacher.email.split('@')[0], // Generate username from email
      avatar: teacher.avatar || '/logo.png',
      bio: teacher.bio || '',
      subscribers: teacher.teacherProfile.followers.length,
      totalVideos,
      rating: teacher.teacherProfile.rating,
      createAt: teacher.createdAt,
      address: teacher.location || null,
      substantiate: teacher.teacherProfile.education || null,
      yearOfWorking: teacher.teacherProfile.experience || null,
      subjects: teacher.teacherProfile.subjects || [],
      website: teacher.teacherProfile.website || null,
      linkedin: teacher.teacherProfile.linkedin || null,
      youtube: teacher.teacherProfile.youtube || null,
    };
  }

  // Update teacher bio
  async updateBio(teacherId: string, bio: string) {
    const teacher = await this.prisma.postgres.user.findUnique({
      where: { id: teacherId },
      include: { teacherProfile: true },
    });

    if (!teacher || !teacher.teacherProfile) {
      throw new NotFoundException('Teacher not found');
    }

    const updatedTeacher = await this.prisma.postgres.user.update({
      where: { id: teacherId },
      data: { bio },
    });

    return {
      message: 'Bio updated successfully',
      bio: updatedTeacher.bio,
    };
  }

  // Update teacher avatar
  async updateAvatar(teacherId: string, avatarUrl: string) {
    const teacher = await this.prisma.postgres.user.findUnique({
      where: { id: teacherId },
      include: { teacherProfile: true },
    });

    if (!teacher || !teacher.teacherProfile) {
      throw new NotFoundException('Teacher not found');
    }

    const updatedTeacher = await this.prisma.postgres.user.update({
      where: { id: teacherId },
      data: { avatar: avatarUrl },
    });

    return {
      message: 'Avatar updated successfully',
      avatar: updatedTeacher.avatar,
    };
  }
}
