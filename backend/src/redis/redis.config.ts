export interface RedisConnectionOptions {
  host: string;
  port: number;
  password?: string;
  retryStrategy: (times: number) => number;
}

export const createRedisConnectionOptions = (): RedisConnectionOptions => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 2000, 15000);
    console.log(` Redis reconnecting in ${delay / 1000}s...`);
    return delay;
  },
});