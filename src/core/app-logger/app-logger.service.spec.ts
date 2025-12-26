import { ClsModule } from 'nestjs-cls';

import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AppLoggerService } from './app-logger.service.js';
import { AppConfigModule } from '../app-config/app-config.module.js';
import { AppConfigService } from '../app-config/app-config.service.js';

const myConfigServiceMock = {
  S3BucketName: { status: true, data: 'eu-west-1' },
  LogLevel: { status: true, data: 'eu-west-1' },
  Environment: { status: true, data: 'test' },
  JWTSecretName: { status: true, data: 'eu-west-1' },
  AWSRegion: { status: true, data: 'eu-west-1' },
  AWSAccessKey: { status: true, data: 'eu-west-1' },
  AWSSecretKey: { status: true, data: 'eu-west-1' },
  ResendApiKey: { status: true, data: 'test-api-key' },
  MailerFrom: { status: true, data: 'example@example.com' },
  DatabaseUrl: { status: true, data: 'test-db-url' },
  RedisUrl: { status: true, data: 'redis://localhost:6379' },
  ServiceName: { status: true, data: 'test-environment' },
  ClientDomainName: { status: true, data: 'test-domain.com' },
};

describe('AppLoggerService', () => {
  let service: AppLoggerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AppLoggerService],
      imports: [
        AppConfigModule,
        ConfigModule.forRoot({
          isGlobal: false,
          envFilePath: ['.env.test.local'],
        }),
        ClsModule.forRoot({
          global: true,
          middleware: {
            mount: true,
            generateId: true,
            idGenerator: () => 'test-request-id',
            setup: (clx) => {
              clx.set('ip', '127.0.0.1');
              clx.set('userAgent', 'test-agent');
            },
          },
        }),
      ],
    })
      .overrideProvider(AppConfigService)
      .useValue(myConfigServiceMock)
      .compile();

    service = module.get<AppLoggerService>(AppLoggerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
