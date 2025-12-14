import { Module } from '@nestjs/common';

import { OrganizationsService } from './organizations.service.js';
import { OrganizationsController } from './organizations.controller.js';

import { DatabaseModule } from '../../core/database/database.module.js';
import { S3Module } from '../../core/s3/s3.module.js';
import { RedisModule } from '../../core/redis/redis.module.js';

@Module({
  imports: [DatabaseModule, S3Module, RedisModule],
  providers: [OrganizationsService],
  controllers: [OrganizationsController],
})
export class OrganizationsModule {}
