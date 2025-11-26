import { IsString, IsDateString, IsOptional, IsInt, IsArray, IsBoolean, Min } from 'class-validator';
import { ScheduleStatus } from '@prisma/client';

export class UpdateScheduleDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsDateString()
  startTime?: string;

  @IsOptional()
  @IsDateString()
  endTime?: string;

  @IsOptional()
  @IsString()
  livestreamId?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  notifyBefore?: number;

  @IsOptional()
  @IsString()
  status?: ScheduleStatus;

  @IsOptional()
  @IsString()
  cancelReason?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxParticipants?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
