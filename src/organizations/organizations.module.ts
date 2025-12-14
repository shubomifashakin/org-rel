import { Module } from '@nestjs/common';
import { OrganizationsService } from './organizations.service.js';
import { OrganizationsController } from './organizations.controller.js';
import { DatabaseModule } from '../database/database.module.js';
import { S3Module } from '../s3/s3.module.js';

@Module({
  imports: [DatabaseModule, S3Module],
  providers: [OrganizationsService],
  controllers: [OrganizationsController],
})
export class OrganizationsModule {}
