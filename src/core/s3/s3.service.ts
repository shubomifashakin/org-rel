import { S3Client } from '@aws-sdk/client-s3';
import { Injectable, OnModuleInit } from '@nestjs/common';

import env from '../serverEnv/index.js';

@Injectable()
export class S3Service extends S3Client implements OnModuleInit {
  constructor() {
    super({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY,
        secretAccessKey: env.AWS_SECRET_KEY,
      },
    });
  }
  async onModuleInit(): Promise<void> {}

  onModuleDestroy() {
    this.destroy();
  }
}
