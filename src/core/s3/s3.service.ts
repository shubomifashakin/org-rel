import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable, OnModuleDestroy } from '@nestjs/common';

import { v4 as uuid } from 'uuid';

import env from '../serverEnv/index.js';
import { FnResult } from '../../types/fnResult.js';

@Injectable()
export class S3Service extends S3Client implements OnModuleDestroy {
  constructor() {
    super({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY,
        secretAccessKey: env.AWS_SECRET_KEY,
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
