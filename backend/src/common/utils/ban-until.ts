import type { BanDuration } from '../types/ban-duration';

export function calculateBanUntil(duration: BanDuration): Date {
  const now = new Date();

  switch (duration) {
    case '1d':
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case '1w':
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    case '1m':
      return new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        now.getDate(),
        now.getHours(),
        now.getMinutes(),
        now.getSeconds(),
        now.getMilliseconds(),
      );
    case 'forever':
      return new Date('2999-12-31T23:59:59.999Z');
  }
}
