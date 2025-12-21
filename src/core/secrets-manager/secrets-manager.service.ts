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

import env from '../serverEnv/index.js';

import { MINUTES_10 } from '../../common/utils/constants.js';

type FnResult<T> =
  | { status: true; data: T; error: null }
  | { status: false; data: null; error: string };

@Injectable()
export class SecretsManagerService
  extends SecretsManagerClient
  implements OnModuleDestroy
{
  private readonly redisService: RedisService;

  constructor(redisService: RedisService) {
    super({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY,
        secretAccessKey: env.AWS_SECRET_KEY,
      },
    });

    this.redisService = redisService;
  }

  onModuleDestroy() {
    //FIXME: LOG PROPERLY
    console.log('destroying secrets manager service');
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
        console.error(error);
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
        console.error(storeInCache.error);
      }

      return { status: true, data: jwtSecret as T, error: null };
    } catch (err) {
      if (err instanceof Error) {
        return { status: false, data: null, error: err.message };
      }

      return {
        status: false,
        data: null,
        error: 'Failed to get secret from secrets maanger',
      };
    }
  }
}
