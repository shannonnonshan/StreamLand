import { 
  Controller, 
  Post, 
  Get, 
  Body, 
  Param, 
  Patch,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LivestreamService } from './livestream.service';
import { CreateLivestreamDto } from './dto/create-livestream.dto';

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

  @Get(':id')
  async getLivestreamById(@Param('id') id: string) {
    return await this.livestreamService.getLivestreamById(id);
  }

  @Get('teacher/:teacherId')
  @UseGuards(JwtAuthGuard)
  async getTeacherLivestreams(
    @Param('teacherId') teacherId: string,
    @Request() req: any,
  ) {
    // Only allow teachers to view their own livestreams or admins
    if (req.user.sub !== teacherId && req.user.role !== 'ADMIN') {
      throw new UnauthorizedException('You can only view your own livestreams');
    }

    return await this.livestreamService.getTeacherLivestreams(teacherId);
  }

  @Get('active/all')
  async getActiveLivestreams() {
    return await this.livestreamService.getActiveLivestreams();
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
}
