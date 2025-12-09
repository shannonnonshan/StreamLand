import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { StudentService } from './student.service';
import { SendFriendRequestDto, UpdateFriendRequestDto, FollowTeacherDto, UnfollowTeacherDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { FriendStatus } from '@prisma/client';

@Controller('student')
@UseGuards(JwtAuthGuard)
export class StudentController {
  constructor(private readonly studentService: StudentService) {}

  // Send friend request
  @Post('friends/request')
  async sendFriendRequest(
    @Request() req: { user: { sub: string } },
    @Body() dto: SendFriendRequestDto,
  ) {
    return this.studentService.sendFriendRequest(req.user.sub, dto);
  }

  // Update friend request (accept/reject/block)
  @Patch('friends/request/:requestId')
  async updateFriendRequest(
    @Request() req: { user: { sub: string } },
    @Param('requestId') requestId: string,
    @Body() dto: UpdateFriendRequestDto,
  ) {
    return this.studentService.updateFriendRequest(req.user.sub, requestId, dto);
  }

  // Get friend requests
  @Get('friends/requests')
  async getFriendRequests(
    @Request() req: { user: { sub: string } },
    @Query('type') type: 'sent' | 'received' | 'all' = 'all',
    @Query('status') status?: FriendStatus,
  ) {
    return this.studentService.getFriendRequests(req.user.sub, type, status);
  }

  // Get friends list (only ACCEPTED)
  @Get('friends')
  async getFriends(@Request() req: { user: { sub: string } }) {
    return this.studentService.getFriends(req.user.sub);
  }

  // Search for students (potential friends)
  @Get('search')
  async searchStudents(
    @Request() req: { user: { sub: string } },
    @Query('q') query: string,
  ) {
    return this.studentService.searchStudents(req.user.sub, query);
  }

  // Get friend suggestions
  @Get('suggestions')
  async getSuggestions(@Request() req: { user: { sub: string } }) {
    return this.studentService.getSuggestions(req.user.sub);
  }

  // Get blocked users
  @Get('friends/blocked')
  async getBlockedUsers(@Request() req: { user: { sub: string } }) {
    return this.studentService.getBlockedUsers(req.user.sub);
  }

  // Check friendship status with another user
  @Get('friendship-status/:userId')
  async getFriendshipStatus(
    @Request() req: { user: { sub: string } },
    @Param('userId') userId: string,
  ) {
    return this.studentService.getFriendshipStatus(req.user.sub, userId);
  }

  // Remove friend
  @Delete('friends/:friendshipId')
  async removeFriend(
    @Request() req: { user: { sub: string } },
    @Param('friendshipId') friendshipId: string,
  ) {
    return this.studentService.removeFriend(req.user.sub, friendshipId);
  }

  // Follow a teacher
  @Post('follow')
  async followTeacher(
    @Request() req: { user: { sub: string } },
    @Body() dto: FollowTeacherDto,
  ) {
    return this.studentService.followTeacher(req.user.sub, dto);
  }

  // Unfollow a teacher
  @Post('unfollow')
  async unfollowTeacher(
    @Request() req: { user: { sub: string } },
    @Body() dto: UnfollowTeacherDto,
  ) {
    return this.studentService.unfollowTeacher(req.user.sub, dto);
  }

  // Get list of followed teachers
  @Get('followed-teachers')
  async getFollowedTeachers(@Request() req: { user: { sub: string } }) {
    return this.studentService.getFollowedTeachers(req.user.sub);
  }

  // Check if following a specific teacher
  @Get('is-following/:teacherId')
  async isFollowingTeacher(
    @Request() req: { user: { sub: string } },
    @Param('teacherId') teacherId: string,
  ) {
    return this.studentService.isFollowingTeacher(req.user.sub, teacherId);
  }

  // Get livestreams from followed teachers
  @Get('followed-livestreams')
  async getFollowedLivestreams(@Request() req: { user: { sub: string } }) {
    return this.studentService.getFollowedLivestreams(req.user.sub);
  }

  // Get videos (ended livestreams with recordings) from followed teachers
  @Get('followed-videos')
  async getFollowedVideos(@Request() req: { user: { sub: string } }) {
    return this.studentService.getFollowedVideos(req.user.sub);
  }

  // Get all teachers (for search functionality - public endpoint)
  @Public()
  @Get('teachers/all')
  async getAllTeachers() {
    return this.studentService.getAllTeachers();
  }

  // Track watch activity (livestream or video)
  @Post('track-activity')
  async trackWatchActivity(
    @Request() req: { user: { sub: string } },
    @Body() body: { contentType: 'livestream' | 'video'; contentId: string },
  ) {
    return this.studentService.trackWatchActivity(
      req.user.sub,
      body.contentType,
      body.contentId,
    );
  }

  // Get student statistics
  @Get('stats')
  async getStudentStats(@Request() req: { user: { sub: string } }) {
    return this.studentService.getStudentStats(req.user.sub);
  }

  // Get stats for a specific student (by userId)
  @Get('stats/:userId')
  async getStudentStatsByUserId(@Param('userId') userId: string) {
    return this.studentService.getStudentStats(userId);
  }

  // Save document from livestream
  @Post('documents/save')
  async saveDocument(
    @Request() req: { user: { sub: string } },
    @Body() data: {
      livestreamId: string;
      documentId: string;
      title: string;
      filename: string;
      fileType: string;
      fileUrl: string;
      fileSize: number;
      folder?: string;
      tags?: string[];
    },
  ) {
    return this.studentService.saveDocument(req.user.sub, data);
  }

  // Get all saved documents
  @Get('documents/saved')
  async getSavedDocuments(
    @Request() req: { user: { sub: string } },
    @Query('folder') folder?: string,
    @Query('isPinned') isPinned?: string,
    @Query('tags') tags?: string,
  ) {
    const filters: any = {};
    if (folder) filters.folder = folder;
    if (isPinned !== undefined) filters.isPinned = isPinned === 'true';
    if (tags) filters.tags = tags.split(',');

    return this.studentService.getSavedDocuments(req.user.sub, filters);
  }

  // Update saved document
  @Patch('documents/saved/:documentId')
  async updateSavedDocument(
    @Request() req: { user: { sub: string } },
    @Param('documentId') documentId: string,
    @Body() data: {
      notes?: string;
      tags?: string[];
      isPinned?: boolean;
      folder?: string;
    },
  ) {
    return this.studentService.updateSavedDocument(req.user.sub, documentId, data);
  }

  // Remove saved document
  @Delete('documents/saved/:documentId')
  async removeSavedDocument(
    @Request() req: { user: { sub: string } },
    @Param('documentId') documentId: string,
  ) {
    return this.studentService.removeSavedDocument(req.user.sub, documentId);
  }

  // Check if document is saved
  @Get('documents/check')
  async isDocumentSaved(
    @Request() req: { user: { sub: string } },
    @Query('livestreamId') livestreamId: string,
    @Query('documentId') documentId: string,
  ) {
    return this.studentService.isDocumentSaved(req.user.sub, livestreamId, documentId);
  }
}
