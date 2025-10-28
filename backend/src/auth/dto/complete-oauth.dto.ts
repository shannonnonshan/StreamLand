import {
  IsString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsNotEmpty,
} from 'class-validator';
import { Role } from './register.dto';

export class CompleteOAuthDto {
  @IsString()
  @IsNotEmpty()
  provider: 'google' | 'github';

  @IsString()
  @IsNotEmpty()
  socialId: string; // googleId or githubId

  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsString()
  @IsOptional()
  avatar?: string;

  @IsEnum(Role)
  role: Role;

  // Teacher fields
  @IsOptional()
  teacherCV?: any; // File upload

  @IsOptional()
  teacherCertificates?: any[]; // File uploads

  @IsString()
  @IsOptional()
  teacherSubjects?: string;

  @IsString()
  @IsOptional()
  teacherExperience?: string;

  @IsString()
  @IsOptional()
  teacherSpecialty?: string;

  @IsString()
  @IsOptional()
  teacherIntroduction?: string;

  // Student fields
  @IsString()
  @IsOptional()
  studentID?: string;

  @IsString()
  @IsOptional()
  studentSchool?: string;

  @IsString()
  @IsOptional()
  studentClass?: string;
}
