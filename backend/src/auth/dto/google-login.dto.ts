import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { Role } from '@prisma/client';

export class GoogleLoginDto {
  @IsString()
  @IsNotEmpty()
  googleId: string;

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
