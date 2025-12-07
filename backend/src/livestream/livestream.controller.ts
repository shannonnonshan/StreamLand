import { 
  Controller, 
  Post, 
  Get, 
  Body, 
  Param, 
  Patch,
  Delete,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LivestreamService } from './livestream.service';
import { CreateLivestreamDto } from './dto/create-livestream.dto';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';

@Controller('livestream')
export class LivestreamController {
  constructor(private readonly livestreamService: LivestreamService) {}

  @Post('create')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createLivestream(
    @Body() createLivestreamDto: CreateLivestreamDto,
    @Request() req: any,
  ) {
    // Check if req.user exists (JWT auth passed)
    if (!req.user) {
      throw new UnauthorizedException('Authentication failed - no user in request');
    }

    // Verify that the authenticated user is the teacher creating the livestream
    if (req.user.sub !== createLivestreamDto.teacherId) {
      throw new UnauthorizedException(`You can only create livestreams for yourself. Your ID: ${req.user.sub}, Request ID: ${createLivestreamDto.teacherId}`);
    }

    // Verify that the user has TEACHER role
    if (req.user.role !== 'TEACHER') {
      throw new UnauthorizedException(`Only teachers can create livestreams. Your role: ${req.user.role}`);
    }
    return await this.livestreamService.createLivestream(createLivestreamDto);
  }

  // IMPORTANT: Specific routes MUST come BEFORE generic :id routes
  // Otherwise :id will match everything
  
  @Get('teacher/:teacherId/recordings')
  @UseGuards(JwtAuthGuard)
  async getTeacherRecordedLivestreams(
    @Param('teacherId') teacherId: string,
    @Query('limit') limit: string,
    @Request() req: any,
  ) {
    // Only allow teachers to view their own recordings or admins
    if (req.user.sub !== teacherId && req.user.role !== 'ADMIN') {
      throw new UnauthorizedException('You can only view your own recordings');
    }

    const limitNum = limit ? parseInt(limit, 10) : 50;
    return await this.livestreamService.getTeacherRecordedLivestreams(teacherId, limitNum);
  }

  @Get('teacher/:teacherId/ended')
  @UseGuards(JwtAuthGuard)
  async getTeacherEndedLivestreams(
    @Param('teacherId') teacherId: string,
    @Query('limit') limit: string,
    @Request() req: any,
  ) {
    // Only allow teachers to view their own livestreams or admins
    if (req.user.sub !== teacherId && req.user.role !== 'ADMIN') {
      throw new UnauthorizedException('You can only view your own livestreams');
    }

    const limitNum = limit ? parseInt(limit, 10) : 50;
    return await this.livestreamService.getTeacherEndedLivestreams(teacherId, limitNum);
  }

  @Get('teacher/:teacherId')
  @UseGuards(JwtAuthGuard)
  async getTeacherLivestreams(
    @Param('teacherId') teacherId: string,
    @Query('status') status: string,
    @Request() req: any,
  ) {
    // Only allow teachers to view their own livestreams or admins
    if (req.user.sub !== teacherId && req.user.role !== 'ADMIN') {
      throw new UnauthorizedException('You can only view your own livestreams');
    }

    // Auto-check and cancel expired scheduled livestreams
    await this.livestreamService.autoCheckAndCancelExpiredLivestreams(teacherId);

    return await this.livestreamService.getTeacherLivestreams(teacherId, status);
  }

  @Get('active/all')
  async getActiveLivestreams() {
    return await this.livestreamService.getActiveLivestreams();
  }

  @Get('top/livestreams')
  async getTopLivestreams() {
    return await this.livestreamService.getTopLivestreams(20);
  }

  @Get('trending/videos')
  async getTrendingVideos() {
    return await this.livestreamService.getTrendingVideos(20);
  }

  @Get('recorded/all')
  async getRecordedLivestreams(@Query('limit') limit: string) {
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return await this.livestreamService.getRecordedLivestreams(limitNum);
  }

  @Get('scheduled/upcoming')
  async getUpcomingScheduledStreams(@Query('limit') limit: string) {
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return await this.livestreamService.getUpcomingScheduledStreams(limitNum);
  }

  // Routes with :id param - MUST be after specific routes
  @Get(':id/documents')
  async getLivestreamDocuments(@Param('id') id: string) {
    return await this.livestreamService.getLivestreamDocuments(id);
  }

  @Get(':id')
  async getLivestreamById(@Param('id') id: string) {
    return await this.livestreamService.getLivestreamById(id);
  }

  @Post(':id/increment-view')
  async incrementViewCount(@Param('id') id: string) {
    return await this.livestreamService.incrementViewCount(id);
  }

  @Patch(':id/start')
  @UseGuards(JwtAuthGuard)
  async startLivestream(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    // Get livestream to verify ownership
    const livestream = await this.livestreamService.getLivestreamById(id);
    
    if (!livestream) {
      throw new UnauthorizedException('Livestream not found');
    }

    if (livestream.teacherId !== req.user.sub && req.user.role !== 'ADMIN') {
      throw new UnauthorizedException('You can only start your own livestreams');
    }

    return await this.livestreamService.startLivestream(id);
  }

  @Post(':id/start-early')
  @UseGuards(JwtAuthGuard)
  async startLivestreamEarly(
    @Param('id') id: string,
    @Body() body: { title: string; category?: string },
    @Request() req: any,
  ) {
    // Get livestream (schedule's livestream) to verify ownership
    const livestream = await this.livestreamService.getLivestreamById(id);
    
    if (!livestream) {
      throw new NotFoundException('Livestream not found');
    }

    if (livestream.teacherId !== req.user.sub && req.user.role !== 'ADMIN') {
      throw new UnauthorizedException('You can only start your own livestreams');
    }

    // Check if scheduled livestream is in the future
    const now = new Date();
    if (livestream.scheduledAt && new Date(livestream.scheduledAt) <= now) {
      throw new BadRequestException('This livestream is not in the future. Cannot start early.');
    }

    // Create a new livestream to start right now with same category
    return await this.livestreamService.createAndStartLivestreamEarly(
      req.user.sub,
      body.title || livestream.title,
      livestream.category || body.category,
    );
  }

  @Patch(':id/end')
  @UseGuards(JwtAuthGuard)
  async endLivestream(
    @Param('id') id: string,
    @Body() body: { saveRecording: boolean },
    @Request() req: any,
  ) {
    // Get livestream to verify ownership
    const livestream = await this.livestreamService.getLivestreamById(id);
    
    if (!livestream) {
      throw new UnauthorizedException('Livestream not found');
    }

    if (livestream.teacherId !== req.user.sub && req.user.role !== 'ADMIN') {
      throw new UnauthorizedException('You can only end your own livestreams');
    }

    return await this.livestreamService.endLivestream(id, body.saveRecording);
  }

  @Patch(':id/update-viewers')
  @UseGuards(JwtAuthGuard)
  async updateViewers(
    @Param('id') id: string,
    @Body() body: { totalViewers: number },
    @Request() req: any,
  ) {
    // Get livestream to verify ownership
    const livestream = await this.livestreamService.getLivestreamById(id);
    
    if (!livestream) {
      throw new UnauthorizedException('Livestream not found');
    }

    if (livestream.teacherId !== req.user.sub && req.user.role !== 'ADMIN') {
      throw new UnauthorizedException('You can only update your own livestream viewers');
    }

    return await this.livestreamService.updateTotalViewers(id, body.totalViewers);
  }

  @Post(':id/upload-recording')
  @UseGuards(JwtAuthGuard)
  async uploadRecording(
    @Param('id') id: string,
    @Body() body: { video: string },
    @Request() req: any,
  ) {
    // Get livestream to verify ownership
    const livestream = await this.livestreamService.getLivestreamById(id);
    
    if (!livestream) {
      throw new UnauthorizedException('Livestream not found');
    }

    if (livestream.teacherId !== req.user.sub && req.user.role !== 'ADMIN') {
      throw new UnauthorizedException('You can only upload recordings for your own livestreams');
    }

    return await this.livestreamService.uploadRecording(id, body.video);
  }

  // Schedule Endpoints

  @Post('schedule')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createSchedule(
    @Body() createScheduleDto: CreateScheduleDto,
    @Request() req: any,
  ) {
    // Verify that the authenticated user is the teacher creating the schedule
    if (req.user.sub !== createScheduleDto.teacherId) {
      throw new UnauthorizedException('You can only create schedules for yourself');
    }

    if (req.user.role !== 'TEACHER') {
      throw new UnauthorizedException('Only teachers can create schedules');
    }

    return await this.livestreamService.createSchedule(createScheduleDto);
  }

  @Get('schedule/:id')
  async getScheduleById(@Param('id') id: string) {
    return await this.livestreamService.getScheduleById(id);
  }

  @Get('schedule/teacher/:teacherId')
  @UseGuards(JwtAuthGuard)
  async getTeacherSchedules(
    @Param('teacherId') teacherId: string,
    @Query('includeCompleted') includeCompleted: string,
    @Request() req: any,
  ) {
    // Only allow teachers to view their own schedules or admins
    if (req.user.sub !== teacherId && req.user.role !== 'ADMIN') {
      throw new UnauthorizedException('You can only view your own schedules');
    }

    const includeCompletedBool = includeCompleted === 'true';
    return await this.livestreamService.getTeacherSchedules(teacherId, includeCompletedBool);
  }

  @Get('schedule/upcoming/all')
  async getUpcomingSchedules(
    @Query('limit') limit: string,
    @Request() req: any,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    // Pass userId if authenticated, otherwise undefined
    const userId = req.user?.sub as string | undefined;
    return await this.livestreamService.getUpcomingSchedules(limitNum, userId);
  }

  @Patch('schedule/:id')
  @UseGuards(JwtAuthGuard)
  async updateSchedule(
    @Param('id') id: string,
    @Body() updateScheduleDto: UpdateScheduleDto,
    @Request() req: any,
  ) {
    // Get schedule to verify ownership
    const schedule = await this.livestreamService.getScheduleById(id);
    
    if (!schedule) {
      throw new UnauthorizedException('Schedule not found');
    }

    if (schedule.teacherId !== req.user.sub && req.user.role !== 'ADMIN') {
      throw new UnauthorizedException('You can only update your own schedules');
    }

    return await this.livestreamService.updateSchedule(id, updateScheduleDto);
  }

  @Delete('schedule/:id')
  @UseGuards(JwtAuthGuard)
  async deleteSchedule(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    // Get schedule to verify ownership
    const schedule = await this.livestreamService.getScheduleById(id);
    
    if (!schedule) {
      throw new UnauthorizedException('Schedule not found');
    }

    if (schedule.teacherId !== req.user.sub && req.user.role !== 'ADMIN') {
      throw new UnauthorizedException('You can only delete your own schedules');
    }

    return await this.livestreamService.deleteSchedule(id);
  }

  @Post('schedule/:id/register')
  @UseGuards(JwtAuthGuard)
  async registerForSchedule(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return await this.livestreamService.registerAttendee(id, req.user.sub as string);
  }

  // Chat Endpoints
  @Post(':id/save-chat')
  @UseGuards(JwtAuthGuard)
  async saveChatMessage(
    @Param('id') id: string,
    @Body() body: { username: string; userAvatar?: string; message: string; type?: string },
    @Request() req: any,
  ) {
    return await this.livestreamService.saveChatMessage(id, req.user.sub, body.username, body.userAvatar, body.message, body.type);
  }

  @Get(':id/get-chat')
  async getChatMessages(
    @Param('id') id: string,
    @Query('limit') limit: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 100;
    return await this.livestreamService.getChatMessages(id, limitNum);
  }
}
