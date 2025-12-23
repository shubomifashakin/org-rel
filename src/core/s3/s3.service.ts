import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable, OnModuleDestroy } from '@nestjs/common';

import { v4 as uuid } from 'uuid';

import { FnResult } from '../../types/fnResult.js';
import { AppConfigService } from '../app-config/app-config.service.js';

@Injectable()
export class S3Service extends S3Client implements OnModuleDestroy {
  constructor(configService: AppConfigService) {
    const awsRegion = configService.AWSRegion;
    const awsAccessKey = configService.AWSAccessKey;
    const awsSecretKey = configService.AWSSecretKey;

    if (!awsRegion.status) {
      throw new Error(awsRegion.error);
    }

    if (!awsAccessKey.status) {
      throw new Error(awsAccessKey.error);
    }

    if (!awsSecretKey.status) {
      throw new Error(awsSecretKey.error);
    }

    super({
      region: awsRegion.data,
      credentials: {
        accessKeyId: awsAccessKey.data,
        secretAccessKey: awsSecretKey.data,
      },
    });
  }

  onModuleDestroy() {
    //FIXME: LOG PROPERLY
    console.log('S3Service is being destroyed');
    this.destroy();
  }

  async uploadToS3(
    bucket: string,
    image: Express.Multer.File,
    key = uuid(),
  ): Promise<FnResult<string>> {
    try {
      await this.send(
        new PutObjectCommand({
          Key: key,
          Bucket: bucket,
          Body: image.buffer,
          ContentType: image.mimetype,
        }),
      );

      return {
        status: true,
        data: `https://${bucket}.s3.amazonaws.com/${key}`,
        error: null,
      };
    } catch (error) {
      if (error instanceof Error) {
        return {
          status: false,
          data: null,
          error: error.message,
        };
      }

      return {
        status: false,
        data: null,
        error: 'Failed to upload image to s3',
      };
    }
  }
}
