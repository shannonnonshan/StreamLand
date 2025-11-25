import { 
  Controller, 
  Post, 
  Get, 
  Body, 
  Param, 
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
    console.log('=== Livestream Create Request ===');
    console.log('Auth user:', req.user);
    console.log('Request teacherId:', createLivestreamDto.teacherId);
    console.log('User sub:', req.user?.sub);
    console.log('User role:', req.user?.role);
    console.log('================================');

    // Check if req.user exists (JWT auth passed)
    if (!req.user) {
      console.error('No user in request - JWT auth failed');
      throw new UnauthorizedException('Authentication failed - no user in request');
    }

    // Verify that the authenticated user is the teacher creating the livestream
    if (req.user.sub !== createLivestreamDto.teacherId) {
      console.error('User ID mismatch:', { userSub: req.user.sub, teacherId: createLivestreamDto.teacherId });
      throw new UnauthorizedException(`You can only create livestreams for yourself. Your ID: ${req.user.sub}, Request ID: ${createLivestreamDto.teacherId}`);
    }

    // Verify that the user has TEACHER role
    if (req.user.role !== 'TEACHER') {
      console.error('Role mismatch:', { userRole: req.user.role, required: 'TEACHER' });
      throw new UnauthorizedException(`Only teachers can create livestreams. Your role: ${req.user.role}`);
    }

    console.log('All checks passed, creating livestream...');
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
}
