import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  Matches,
  IsOptional,
  IsEnum,
  IsArray,
  IsInt,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { Role } from '@prisma/client';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsEmail()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9._-]*[a-zA-Z0-9]@[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9]\.[a-zA-Z]{2,}$/, {
    message: 'Invalid email format. Please use a valid email address',
  })
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  password!: string;

  @IsEnum(Role)
  @IsNotEmpty()
  @IsOptional()
  role!: Role;

  // Teacher fields
  @IsString()
  @IsOptional()
  teacherIntroduction?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  @Transform(({ value }) => Array.isArray(value) ? value : [value].filter(Boolean))
  subjects?: string[];

  @IsInt()
  @Min(0)
  @IsOptional()
  @Transform(({ value }) => value ? parseInt(value, 10) : undefined)
  experience?: number;

  @IsString()
  @IsOptional()
  education?: string;
}

export { Role };