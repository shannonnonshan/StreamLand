import { IsString, IsOptional, IsArray, IsInt, Min } from 'class-validator';

export class UpdateUserProfileDto {
  @IsString()
  @IsOptional()
  fullName?: string;

  @IsString()
  @IsOptional()
  bio?: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsString()
  @IsOptional()
  avatar?: string;
}

export class UpdateStudentProfileDto {
  @IsString()
  @IsOptional()
  grade?: string;

  @IsString()
  @IsOptional()
  school?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  interests?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  learningGoals?: string[];
}

export class UpdateTeacherProfileDto {
  @IsString()
  @IsOptional()
  cvUrl?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  subjects?: string[];

  @IsInt()
  @Min(0)
  @IsOptional()
  experience?: number;

  @IsString()
  @IsOptional()
  education?: string;

  @IsString()
  @IsOptional()
  website?: string;

  @IsString()
  @IsOptional()
  linkedin?: string;

  @IsString()
  @IsOptional()
  youtube?: string;
}
