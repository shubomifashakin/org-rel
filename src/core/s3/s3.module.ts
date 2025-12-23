import { Module } from '@nestjs/common';
import { S3Service } from './s3.service.js';
import { AppConfigModule } from '../app-config/app-config.module.js';
import { AppLoggerModule } from '../app-logger/app-logger.module.js';

@Module({
  exports: [S3Service],
  providers: [S3Service],
  imports: [AppConfigModule, AppLoggerModule],
})
export class S3Module {}
