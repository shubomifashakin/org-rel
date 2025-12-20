import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';
import env from '../serverEnv/index.js';
import { DAYS_7 } from '../../common/utils/constants.js';
import { ThrottlerStorage } from '@nestjs/throttler';
import { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface.js';

@Injectable()
export class RedisService
  implements ThrottlerStorage, OnModuleInit, OnModuleDestroy
{
  private client: RedisClientType;

  constructor() {
    this.client = createClient({
      pingInterval: 10,
      url: env.REDIS_URL,
      name: env.SERVICE_NAME,
    });
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
  ): Promise<ThrottlerStorageRecord> {
    const currentCount = await this.client.incr(key);

    const resetTime = Date.now() + ttl * 1000;

    await this.client.expire(key, ttl);

    const obj = {
      totalHits: currentCount,
      isBlocked: currentCount >= limit,
      timeToExpire: resetTime,
      timeToBlockExpire: resetTime + blockDuration * 1000,
    };

    return obj;
  }

  async onModuleInit() {
    await this.client.connect();

    this.client.on('error', (err) => {
      //FIXME: Implement proper error handling
      console.error('Redis connection error:', err);
    });
  }

  async onModuleDestroy() {
    //FIXME: USE BETTER LOGGING LIB
    console.log('closing redis connection');

    await this.client.quit();
  }

  /**
   *
   * @param key identifier
   * @param data data to store
   * @param exp in seconds
   */
  async setInCache(key: string, data: any, exp?: number) {
    await this.client.set(key, JSON.stringify(data), {
      expiration: { type: 'EX', value: exp || DAYS_7 },
    });
  }

  async getFromCache<T>(key: string): Promise<T | null> {
    const data = await this.client.get(key);
    return data ? (JSON.parse(data) as T) : null;
  }

  async deleteFromCache(key: string) {
    await this.client.del(key);
  }
}
