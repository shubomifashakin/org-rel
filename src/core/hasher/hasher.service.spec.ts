import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';

import { HasherService } from './hasher.service.js';
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

describe('HasherService', () => {
  let service: HasherService;
  let hashedString: string;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HasherService],
      imports: [
        ConfigModule.forRoot({
          isGlobal: false,
          envFilePath: ['.env.test.local'],
        }),
      ],
    })
      .overrideProvider(AppConfigService)
      .useValue(myConfigServiceMock)
      .compile();

    service = module.get<HasherService>(HasherService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('hashString - it should hash a string', async () => {
    const result = await service.hashString('test');
    expect(result.status).toBe(true);
    expect(result.error).toBe(null);
    expect(result.data).toStrictEqual(expect.any(String));
    hashedString = result.data!;
  });

  it('compareHashString - it should be valid', async () => {
    const result = await service.compareHashedString({
      plainString: 'test',
      hash: hashedString,
    });
    expect(result.status).toBe(true);
    expect(result.error).toBe(null);
    expect(result.data).toBe(true);
  });

  it('compareHashString - it should not be valid', async () => {
    const result = await service.compareHashedString({
      plainString: 'testss',
      hash: hashedString,
    });
    expect(result.status).toBe(true);
    expect(result.error).toBe(null);
    expect(result.data).toBe(false);
  });
});
