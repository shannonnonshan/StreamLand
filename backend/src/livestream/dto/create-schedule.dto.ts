import { IsString, IsDateString, IsOptional, IsInt, IsArray, IsBoolean, Min } from 'class-validator';

export class CreateScheduleDto {
  @IsString()
  teacherId: string;

  @IsString()
  title: string;

  @IsDateString()
  startTime: string;

  @IsDateString()
  endTime: string;

  @IsOptional()
  @IsString()
  livestreamId?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  notifyBefore?: number; // minutes before start

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  category?: string; // Category for livestream
}
