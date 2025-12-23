import { Module } from '@nestjs/common';
import { MailerService } from './mailer.service.js';
import { AppConfigModule } from '../app-config/app-config.module.js';

@Module({
  providers: [MailerService],
  exports: [MailerService],
  imports: [AppConfigModule],
})
export class MailerModule {}
