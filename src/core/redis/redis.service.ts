import { ThrottlerStorage } from '@nestjs/throttler';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface.js';

import { createClient, RedisClientType } from 'redis';

import { AppLoggerService } from '../app-logger/app-logger.service.js';
import { AppConfigService } from '../app-config/app-config.service.js';

import { DAYS_7 } from '../../common/utils/constants.js';
import { FnResult } from '../../types/fnResult.js';

@Injectable()
export class RedisService
  implements ThrottlerStorage, OnModuleInit, OnModuleDestroy
{
  private client: RedisClientType;

  constructor(
    configService: AppConfigService,
    private readonly loggerService: AppLoggerService,
  ) {
    const redisUrl = configService.RedisUrl;
    const serviceName = configService.ServiceName;

    if (!redisUrl.status) {
      throw new Error(redisUrl.error);
    }

    if (!serviceName.status) {
      throw new Error(serviceName.error);
    }

    this.client = createClient({
      pingInterval: 10,
      url: redisUrl.data,
      name: serviceName.data,
    });
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
  ): Promise<ThrottlerStorageRecord> {
    const currentCount = await this.client.incr(key);

    if (currentCount === 1) {
      await this.client.expire(key, ttl);
    }
    const resetTime = Date.now() + ttl * 1000;
    const isBlocked = currentCount > limit;

    if (isBlocked && currentCount === limit + 1) {
      await this.client.expire(key, ttl + blockDuration);
    }

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
      this.loggerService.error('Redis connection error:', err);
    });
  }

  async onModuleDestroy() {
    this.loggerService.log('closing redis connection');

    await this.client.quit();
  }

  /**
   *
   * @param key identifier
   * @param data data to store
   * @param exp in seconds
   */
  async setInCache(
    key: string,
    data: any,
    exp: number = DAYS_7,
  ): Promise<FnResult<null>> {
    try {
      await this.client.set(key, JSON.stringify(data), {
        expiration: { type: 'EX', value: exp },
      });

      return { status: true, data: null, error: null };
    } catch (error) {
      if (error instanceof Error) {
        return { status: false, data: null, error: error.message };
      }

      return {
        status: false,
        data: null,
        error: `Failed to set ${key} in cache`,
      };
    }
  }

  async getFromCache<T>(key: string): Promise<FnResult<T | null>> {
    try {
      const data = await this.client.get(key);

      return {
        status: true,
        data: data ? (JSON.parse(data) as T) : null,
        error: null,
      };
    } catch (error) {
      if (error instanceof Error) {
        return { status: false, data: null, error: error.message };
      }

      return {
        status: false,
        data: null,
        error: `Failed to set ${key} in cache`,
      };
    }
  }

  async deleteFromCache(key: string): Promise<FnResult<null>> {
    try {
      await this.client.del(key);

      return { status: true, data: null, error: null };
    } catch (error) {
      if (error instanceof Error) {
        return { status: false, data: null, error: error.message };
      }

      return {
        status: false,
        data: null,
        error: `Failed to delete ${key} from cache cache`,
      };
    }
  }
}
