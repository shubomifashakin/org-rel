import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../generated/prisma/client.js';
import { AppConfigService } from '../app-config/app-config.service.js';

@Injectable()
export class DatabaseService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(configService: AppConfigService) {
    const { error, data, status } = configService.DatabaseUrl;

    if (!status) {
      throw new Error(error);
    }

    super({
      adapter: new PrismaPg({ connectionString: data }),
      transactionOptions: { maxWait: 10000, timeout: 10000 },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    console.log('disconnecting database');
    await this.$disconnect();
  }
}
