import { Module } from '@nestjs/common';
import { S3Service } from './s3.service.js';
import { AppConfigModule } from '../app-config/app-config.module.js';

@Module({
  exports: [S3Service],
  providers: [S3Service],
  imports: [AppConfigModule],
})
export class S3Module {}
