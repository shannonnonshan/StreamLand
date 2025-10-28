import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { Role } from '@prisma/client';

export class GithubLoginDto {
  @IsString()
  @IsNotEmpty()
  githubId: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsString()
  @IsOptional()
  avatar?: string;

  @IsEnum(Role)
  @IsOptional()
  role?: Role;
}
