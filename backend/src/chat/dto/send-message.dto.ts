import { IsString, IsOptional, IsArray, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @MaxLength(5000)
  content: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];
}
