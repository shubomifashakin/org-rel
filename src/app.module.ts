import { APP_GUARD } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { seconds, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { DatabaseModule } from './core/database/database.module.js';
import { S3Module } from './core/s3/s3.module.js';

import { OrganizationsModule } from './modules/organizations/organizations.module.js';
import { HealthModule } from './modules/health/health.module.js';

@Module({
  imports: [
    OrganizationsModule,
    DatabaseModule,
    ThrottlerModule.forRoot({
      throttlers: [
        {
          limit: 5,
          ttl: seconds(10),
          name: 'default',
        },
      ],
      errorMessage: 'Too many requests',
    }),
    S3Module,
    HealthModule,
  ],
  controllers: [],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
