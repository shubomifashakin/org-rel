import { Module } from '@nestjs/common';
import { RedisService } from './redis.service.js';
import { ConfigModule } from '@nestjs/config';

@Module({
  providers: [RedisService],
  imports: [ConfigModule],
  exports: [RedisService],
})
export class RedisModule {}
