import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

import { FnResult } from '../../types/fnResult.js';

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: NestConfigService) {}

  get S3BucketName(): FnResult<string> {
    try {
      const data = this.configService.getOrThrow<string>('S3_BUCKET_NAME');

      return { status: true, data, error: null };
    } catch (error) {
      if (error instanceof Error) {
        return { status: false, data: null, error: error.message };
      }
      return {
        status: false,
        data: null,
        error: `Failed to get env variable S3_BUCKET_NAME`,
      };
    }
  }
  get Environment(): FnResult<string> {
    try {
      const data = this.configService.getOrThrow<string>('NODE_ENV');

      return { status: true, data, error: null };
    } catch (error) {
      if (error instanceof Error) {
        return { status: false, data: null, error: error.message };
      }
      return {
        status: false,
        data: null,
        error: `Failed to get env variable NODE_ENV`,
      };
    }
  }

  get JWTSecretName(): FnResult<string> {
    try {
      const data = this.configService.getOrThrow<string>('JWT_SECRET_NAME');

      return { status: true, data, error: null };
    } catch (error) {
      if (error instanceof Error) {
        return { status: false, data: null, error: error.message };
      }
      return {
        status: false,
        data: null,
        error: `Failed to get env variable JWT_SECRET_NAME`,
      };
    }
  }

  get AWSRegion(): FnResult<string> {
    try {
      const data = this.configService.getOrThrow<string>('AWS_REGION');

      return { status: true, data, error: null };
    } catch (error) {
      if (error instanceof Error) {
        return { status: false, data: null, error: error.message };
      }

      return {
        data: null,
        status: false,
        error: `Failed to get env variable AWS_REGION`,
      };
    }
  }

  get AWSAccessKey(): FnResult<string> {
    try {
      const data = this.configService.getOrThrow<string>('AWS_ACCESS_KEY');

      return { status: true, data, error: null };
    } catch (error) {
      if (error instanceof Error) {
        return { status: false, data: null, error: error.message };
      }

      return {
        data: null,
        status: false,
        error: `Failed to get env variable AWS_ACCESS_KEY`,
      };
    }
  }

  get AWSSecretKey(): FnResult<string> {
    try {
      const data = this.configService.getOrThrow<string>('AWS_SECRET_KEY');

      return { status: true, data, error: null };
    } catch (error) {
      if (error instanceof Error) {
        return { status: false, data: null, error: error.message };
      }

      return {
        data: null,
        status: false,
        error: `Failed to get env variable AWS_SECRET_KEY`,
      };
    }
  }

  get ResendApiKey(): FnResult<string> {
    try {
      const data = this.configService.getOrThrow<string>('RESEND_API_KEY');

      return { status: true, data, error: null };
    } catch (error) {
      if (error instanceof Error) {
        return { status: false, data: null, error: error.message };
      }

      return {
        data: null,
        status: false,
        error: `Failed to get env variable RESEND_API_KEY`,
      };
    }
  }

  get MailerFrom(): FnResult<string> {
    try {
      const data = this.configService.getOrThrow<string>('MAILER_FROM');

      return { status: true, data, error: null };
    } catch (error) {
      if (error instanceof Error) {
        return { status: false, data: null, error: error.message };
      }

      return {
        data: null,
        status: false,
        error: `Failed to get env variable MAILER_FROM`,
      };
    }
  }

  get DatabaseUrl(): FnResult<string> {
    try {
      const data = this.configService.getOrThrow<string>('DATABASE_URL');

      return { status: true, data, error: null };
    } catch (error) {
      if (error instanceof Error) {
        return { status: false, data: null, error: error.message };
      }

      return {
        data: null,
        status: false,
        error: `Failed to get env variable DATABASE_URL`,
      };
    }
  }

  get RedisUrl(): FnResult<string> {
    try {
      const data = this.configService.getOrThrow<string>('REDIS_URL');

      return { status: true, data, error: null };
    } catch (error) {
      if (error instanceof Error) {
        return { status: false, data: null, error: error.message };
      }

      return {
        data: null,
        status: false,
        error: `Failed to get env variable REDIS_URL`,
      };
    }
  }

  get ServiceName(): FnResult<string> {
    try {
      const data = this.configService.getOrThrow<string>('SERVICE_NAME');

      return { status: true, data, error: null };
    } catch (error) {
      if (error instanceof Error) {
        return { status: false, data: null, error: error.message };
      }

      return {
        data: null,
        status: false,
        error: `Failed to get env variable SERVICE_NAME`,
      };
    }
  }

  get ClientDomainName(): FnResult<string> {
    try {
      const data = this.configService.getOrThrow<string>('CLIENT_DOMAIN');

      return { status: true, data, error: null };
    } catch (error) {
      if (error instanceof Error) {
        return { status: false, data: null, error: error.message };
      }

      return {
        data: null,
        status: false,
        error: `Failed to get env variable CLIENT_DOMAIN`,
      };
    }
  }
}
