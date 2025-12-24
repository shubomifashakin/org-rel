import {
  Injectable,
  InternalServerErrorException,
  OnModuleDestroy,
} from '@nestjs/common';
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';

import { RedisService } from '../redis/redis.service.js';

import { AppConfigService } from '../app-config/app-config.service.js';
import { AppLoggerService } from '../app-logger/app-logger.service.js';

import { MINUTES_10 } from '../../common/utils/constants.js';
import { FnResult } from '../../types/fnResult.js';

@Injectable()
export class SecretsManagerService
  extends SecretsManagerClient
  implements OnModuleDestroy
{
  constructor(
    configService: AppConfigService,
    private readonly redisService: RedisService,
    private readonly loggerService: AppLoggerService,
  ) {
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
    this.loggerService.log('destroying secrets manager service');
    this.destroy();
  }

  async getSecret<T>(secretId: string): Promise<FnResult<T>> {
    try {
      const { status, error, data } =
        await this.redisService.getFromCache<T>(secretId);

      if (status && data) {
        return { status: true, error: null, data };
      }

      if (!status) {
        this.loggerService.error(error);
      }

      const secret = await this.send(
        new GetSecretValueCommand({
          SecretId: secretId,
        }),
      );

      if (!secret.SecretString) {
        throw new InternalServerErrorException('Secret string is empty');
      }

      const jwtSecret = JSON.parse(secret.SecretString) as {
        JWT_SECRET: string;
      };

      const storeInCache = await this.redisService.setInCache(
        secretId,
        jwtSecret,
        MINUTES_10,
      );

      if (!storeInCache.status) {
        this.loggerService.error(storeInCache.error);
      }

      return { status: true, data: jwtSecret as T, error: null };
    } catch (err) {
      if (err instanceof Error) {
        return {
          status: false,
          data: null,
          error: `${err.name}: ${err.message}`,
        };
      }

      return {
        status: false,
        data: null,
        error: 'Failed to get secret from secrets maanger',
      };
    }
  }
}
