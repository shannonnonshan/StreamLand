import { IsString, IsOptional, IsArray, IsInt, Min, Matches, MaxLength, MinLength } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class UpdateUserProfileDto {
  @IsString()
  @IsOptional()
  @MinLength(2, { message: 'Full name must be at least 2 characters' })
  @MaxLength(100, { message: 'Full name must not exceed 100 characters' })
  @Matches(/^[a-zA-Z\s'\-À-ÿ]+$/, {
    message: 'Full name can only contain letters, spaces, hyphens, and apostrophes',
  })
  fullName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'Bio must not exceed 500 characters' })
  bio?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100, { message: 'Location must not exceed 100 characters' })
  @Matches(/^[a-zA-Z0-9\s,.'\-À-ÿ]+$/, {
    message: 'Location contains invalid characters',
  })
  location?: string;

  @IsString()
  @IsOptional()
  avatar?: string;
}

export class UpdateStudentProfileDto {
  @IsString()
  @IsOptional()
  @MaxLength(50, { message: 'Grade must not exceed 50 characters' })
  @Matches(/^[a-zA-Z0-9\s\-]+$/, {
    message: 'Grade can only contain letters, numbers, spaces, and hyphens',
  })
  grade?: string;

  @IsString()
  @IsOptional()
  @MinLength(2, { message: 'School name must be at least 2 characters' })
  @MaxLength(200, { message: 'School name must not exceed 200 characters' })
  @Matches(/^[a-zA-Z0-9\s.'\-À-ÿ]+$/, {
    message: 'School name can only contain letters, numbers, spaces, periods, hyphens, and apostrophes',
  })
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
  @Type(() => Number)
  @Transform(({ value }) => {
    if (value === '' || value === null || value === undefined) return undefined;
    const num = parseInt(value, 10);
    return isNaN(num) ? undefined : num;
  })
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

export class UploadTeacherCVDto {
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  subjects?: string[];

  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  @Transform(({ value }) => {
    if (value === '' || value === null || value === undefined) return undefined;
    const num = parseInt(value, 10);
    return isNaN(num) ? undefined : num;
  })
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
}
