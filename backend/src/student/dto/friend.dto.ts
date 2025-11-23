import { IsString, IsEnum, IsOptional } from 'class-validator';
import { FriendStatus } from '@prisma/client';

export class SendFriendRequestDto {
  @IsString()
  receiverId: string;
}

export class UpdateFriendRequestDto {
  @IsEnum(FriendStatus)
  status: FriendStatus;
}

export class GetFriendsDto {
  @IsOptional()
  @IsEnum(FriendStatus)
  status?: FriendStatus;
}

export class FollowTeacherDto {
  @IsString()
  teacherId: string;
}

export class UnfollowTeacherDto {
  @IsString()
  teacherId: string;
}
