import { ClsModule } from 'nestjs-cls';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { RedisService } from './redis.service.js';
import { AppConfigModule } from '../app-config/app-config.module.js';
import { AppLoggerModule } from '../app-logger/app-logger.module.js';
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

describe('RedisService', () => {
  let service: RedisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RedisService],
      imports: [
        AppConfigModule,
        AppLoggerModule,
        ConfigModule.forRoot({
          isGlobal: false,
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

    service = module.get<RedisService>(RedisService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
