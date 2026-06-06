import { IsIn } from 'class-validator';
import type { BanDuration } from '../../common/types/ban-duration';

const BAN_DURATIONS: BanDuration[] = ['1d', '1w', '1m', 'forever'];

export class BanUserDto {
  @IsIn(BAN_DURATIONS)
  duration?: BanDuration;
}
