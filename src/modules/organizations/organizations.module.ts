import { Module } from '@nestjs/common';

import { OrganizationsController } from './organizations.controller.js';

import { OrganizationsService } from './organizations.service.js';
import { OrganizationsInviteService } from './services/organizations-invite.service.js';
import { OrganizationsUserService } from './services/organizations-user.service.js';
import { OrganizationsProjectsService } from './services/organizations-projects.service.js';

import { S3Module } from '../../core/s3/s3.module.js';
import { RedisModule } from '../../core/redis/redis.module.js';
import { MailerModule } from '../../core/mailer/mailer.module.js';
import { DatabaseModule } from '../../core/database/database.module.js';
import { SecretsManagerModule } from '../../core/secrets-manager/secrets-manager.module.js';

@Module({
  imports: [
    DatabaseModule,
    S3Module,
    RedisModule,
    SecretsManagerModule,
    MailerModule,
  ],
  providers: [
    OrganizationsService,
    OrganizationsUserService,
    OrganizationsInviteService,
    OrganizationsProjectsService,
  ],
  controllers: [OrganizationsController],
})
export class OrganizationsModule {}
