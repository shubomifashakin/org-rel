import { APP_GUARD } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { seconds, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { OrganizationsModule } from './organizations/organizations.module.js';
import { DatabaseModule } from './database/database.module.js';
import { S3Module } from './s3/s3.module.js';

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
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
