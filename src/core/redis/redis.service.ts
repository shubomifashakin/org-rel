import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';
import env from '../serverEnv/index.js';
import { REDIS_7_DAYS } from '../../common/utils/constants.js';
import { ThrottlerStorage } from '@nestjs/throttler';
import { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface.js';

@Injectable()
export class RedisService
  implements ThrottlerStorage, OnModuleInit, OnModuleDestroy
{
  private client: RedisClientType;
  private isConnected = false;

  constructor() {
    this.client = createClient({
      url: env.REDIS_URL,
      name: 'org-rel',
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
    if (!this.isConnected) {
      await this.client.connect();
      this.isConnected = true;

      this.client.on('error', (err) => {
        //FIXME: Implement proper error handling
        console.error('Redis connection error:', err);
      });
    }
  }

  async onModuleDestroy() {
    if (!this.isConnected) {
      //FIXME: USE BETTER LOGGING LIB
      console.log('closing redis connection');

      await this.client.quit();
      this.isConnected = false;
    }
  }

  async setInCache(key: string, data: any, exp?: number) {
    await this.client.set(key, JSON.stringify(data), {
      expiration: { type: 'EX', value: exp || REDIS_7_DAYS },
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
