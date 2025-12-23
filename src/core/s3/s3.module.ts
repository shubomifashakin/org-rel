import { Module } from '@nestjs/common';
import { S3Service } from './s3.service.js';
import { ConfigModule } from '@nestjs/config';

@Module({
  exports: [S3Service],
  providers: [S3Service],
  imports: [ConfigModule],
})
export class S3Module {}
