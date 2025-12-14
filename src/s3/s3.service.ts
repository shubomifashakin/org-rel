import { S3Client } from '@aws-sdk/client-s3';
import { Injectable, OnModuleInit } from '@nestjs/common';

@Injectable()
export class S3Service extends S3Client implements OnModuleInit {
  constructor() {
    super({
      region: process.env.AWS_REGION!,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY!,
        secretAccessKey: process.env.AWS_SECRET_KEY!,
      },
    });
  }
  async onModuleInit(): Promise<void> {}

  onModuleDestroy() {
    this.destroy();
  }
}
