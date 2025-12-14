import { Injectable, OnModuleInit } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';
import env from '../serverEnv/index.js';
import { REDIS_7_DAYS } from '../../common/utils/constants.js';

@Injectable()
export class RedisService implements OnModuleInit {
  private client: RedisClientType;

  constructor() {
    this.client = createClient({
      url: env.REDIS_URL,
      name: 'org-rel',
    });
  }

  async onModuleInit() {
    await this.client.connect();
  }

  async onModuleDestroy() {
    await this.client.quit();
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
