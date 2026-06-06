import {
  IsString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsNotEmpty,
  Matches,
} from 'class-validator';
import { IsArray, IsInt, Min } from 'class-validator';
import { Type} from 'class-transformer';
import { Role } from './register.dto';

export class CompleteOAuthDto {
  @IsString()
  @IsNotEmpty()
  provider!: 'google' | 'github';

  @IsString()
  @IsNotEmpty()
  socialId!: string;

  @IsEmail()
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9._-]*[a-zA-Z0-9]@[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9]\.[a-zA-Z]{2,}$/, {
    message: 'Invalid email format. Please use a valid email address',
  })
  email!: string;

  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsString()
  @IsOptional()
  avatar?: string;

  @IsEnum(Role)
  role!: Role;

  @IsString()
  @IsOptional()
  teacherIntroduction?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  subjects?: string[];

  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
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

  // Student fields
  @IsString()
  @IsOptional()
  studentSchool?: string;

  @IsString()
  @IsOptional()
  studentClass?: string;
}
