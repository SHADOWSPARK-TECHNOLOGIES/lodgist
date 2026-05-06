/* eslint-disable @typescript-eslint/no-explicit-any */
declare module "ioredis" {
  import { EventEmitter } from "events";

  interface RedisOptions {
    port?: number;
    host?: string;
    password?: string;
    db?: number;
    keyPrefix?: string;
    retryStrategy?: (times: number) => number | void | null;
    maxRetriesPerRequest?: number;
    lazyConnect?: boolean;
    enableReadyCheck?: boolean;
    connectTimeout?: number;
    commandTimeout?: number;
    tls?: Record<string, unknown>;
    showFriendlyErrorStack?: boolean;
  }

  class Redis extends EventEmitter {
    constructor(url?: string, options?: RedisOptions);
    constructor(options?: RedisOptions);
    connect(): Promise<void>;
    disconnect(): void;
    quit(): Promise<"OK">;
    get(key: string): Promise<string | null>;
    set(key: string, value: string | number | Buffer): Promise<"OK">;
    set(key: string, value: string | number | Buffer, mode: string, duration: number): Promise<"OK">;
    del(...keys: string[]): Promise<number>;
    incr(key: string): Promise<number>;
    expire(key: string, seconds: number): Promise<number>;
    ttl(key: string): Promise<number>;
    hget(key: string, field: string): Promise<string | null>;
    hset(key: string, field: string, value: string | number | Buffer): Promise<number>;
    hgetall(key: string): Promise<Record<string, string>>;
    hdel(key: string, ...fields: string[]): Promise<number>;
    lpush(key: string, ...values: (string | number | Buffer)[]): Promise<number>;
    rpush(key: string, ...values: (string | number | Buffer)[]): Promise<number>;
    lpop(key: string): Promise<string | null>;
    rpop(key: string): Promise<string | null>;
    llen(key: string): Promise<number>;
    lrange(key: string, start: number, stop: number): Promise<string[]>;
    sadd(key: string, ...members: (string | number | Buffer)[]): Promise<number>;
    srem(key: string, ...members: (string | number | Buffer)[]): Promise<number>;
    smembers(key: string): Promise<string[]>;
    sismember(key: string, member: string | number | Buffer): Promise<number>;
    zadd(key: string, score: number, member: string | number | Buffer): Promise<number>;
    zrem(key: string, ...members: (string | number | Buffer)[]): Promise<number>;
    zrange(key: string, start: number, stop: number, withScores?: "WITHSCORES"): Promise<string[]>;
    zrank(key: string, member: string | number | Buffer): Promise<number | null>;
    zcard(key: string): Promise<number>;
    zscore(key: string, member: string | number | Buffer): Promise<string | null>;
    multi(): Pipeline;
    exec(): Promise<[Error | null, unknown][]>;
    keys(pattern: string): Promise<string[]>;
    ping(): Promise<string>;
    flushall(): Promise<"OK">;
    flushdb(): Promise<"OK">;
    publish(channel: string, message: string): Promise<number>;
    subscribe(...channels: string[]): Promise<void>;
    status: string;
    connected: boolean;
  }

  interface Pipeline {
    get(key: string): Pipeline;
    set(key: string, value: string | number | Buffer): Pipeline;
    del(...keys: string[]): Pipeline;
    hget(key: string, field: string): Pipeline;
    hset(key: string, field: string, value: string | number | Buffer): Pipeline;
    hgetall(key: string): Pipeline;
    exec(): Promise<[Error | null, unknown][]>;
  }

  export = Redis;
}
