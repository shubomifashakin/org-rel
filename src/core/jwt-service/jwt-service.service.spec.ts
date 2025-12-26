import { ClsModule } from 'nestjs-cls';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';

import { JwtServiceService } from './jwt-service.service.js';
import { AppConfigModule } from '../app-config/app-config.module.js';
import { SecretsManagerModule } from '../secrets-manager/secrets-manager.module.js';
import { SecretsManagerService } from '../secrets-manager/secrets-manager.service.js';

const mockSecretManagerService = {
  getSecret: jest.fn(),
};

describe('JwtServiceService', () => {
  let service: JwtServiceService;
  let jwt: string;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [JwtServiceService],
      imports: [
        SecretsManagerModule,
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
      .overrideProvider(SecretsManagerService)
      .useValue(mockSecretManagerService)
      .compile();

    service = module.get<JwtServiceService>(JwtServiceService);

    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should sign the jwt', async () => {
    mockSecretManagerService.getSecret.mockResolvedValue({
      status: true,
      data: { JWT_SECRET: 'fake-jwt-secret', error: null },
    });

    const res = await service.sign({ jti: 'fake-token-id', sub: 'user-id' });

    expect(res.status).toBe(true);
    expect(res.data).toStrictEqual(expect.any(String));
    jwt = res.data!;
  });

  it('should verify the jwt', async () => {
    mockSecretManagerService.getSecret.mockResolvedValue({
      status: true,
      data: { JWT_SECRET: 'fake-jwt-secret', error: null },
    });

    const res = await service.verify(jwt);

    expect(res.status).toBe(true);
    expect(res.data?.jti).toBe('fake-token-id');
  });

  it('should confirm that the jwt was not signed by the server', async () => {
    mockSecretManagerService.getSecret.mockResolvedValue({
      status: true,
      data: { JWT_SECRET: 'new-jwt', error: null },
    });

    const res = await service.verify(jwt);

    expect(res.status).toBe(false);
  });
});
