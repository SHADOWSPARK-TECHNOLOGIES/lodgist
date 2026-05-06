import Redis from 'ioredis';

let redis: Redis;

declare global {
  var __redis: Redis | undefined;
}

if (process.env.NODE_ENV === 'production') {
  redis = new Redis(process.env.REDIS_URL as string);
} else {
  if (!global.__redis) {
    global.__redis = new Redis(process.env.REDIS_URL as string);
  }
  redis = global.__redis;
}

export default redis;