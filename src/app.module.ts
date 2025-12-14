import { Request } from 'express';
import { APP_GUARD } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { DatabaseModule } from './core/database/database.module.js';
import { S3Module } from './core/s3/s3.module.js';

import { OrganizationsModule } from './modules/organizations/organizations.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { RedisModule } from './core/redis/redis.module.js';
import { RedisService } from './core/redis/redis.service.js';

@Module({
  imports: [
    OrganizationsModule,
    DatabaseModule,
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [RedisService],
      useFactory: (redisService: RedisService) => {
        return {
          throttlers: [
            {
              ttl: 10,
              limit: 5,
              name: 'default',
            },
          ],
          errorMessage: 'Too many requests',
          generateKey: (ctx) => {
            const req = ctx.switchToHttp().getRequest<Request>();
            return req?.user?.id || req?.ip || req?.ips?.[0] || 'unknown-ip';
          },

          storage: redisService,
        };
      },
    }),
    S3Module,
    HealthModule,
  ],
  controllers: [],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
