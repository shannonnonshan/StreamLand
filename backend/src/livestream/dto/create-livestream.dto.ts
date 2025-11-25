import { IsString, IsUUID, IsBoolean, IsOptional, Length, MaxLength } from 'class-validator';

export class CreateLivestreamDto {
  @IsUUID()
  id: string;

  @IsUUID()
  teacherId: string;

  @IsString()
  @Length(5, 100, { message: 'Title must be between 5 and 100 characters' })
  title: string;

  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'Description must be less than 500 characters' })
  description?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @IsBoolean()
  @IsOptional()
  allowComments?: boolean;
}
