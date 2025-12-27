import { Request } from 'express';
import { ClsModule } from 'nestjs-cls';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { makeOrganizationCacheKey } from './common/utils.js';
import { OrganizationsController } from './organizations.controller.js';
import { OrganizationsService } from './organizations.service.js';
import { OrganizationsUserService } from './services/organizations-user.service.js';
import { OrganizationsInviteService } from './services/organizations-invite.service.js';
import { OrganizationsProjectsService } from './services/organizations-projects.service.js';

import { S3Module } from '../../core/s3/s3.module.js';
import { RedisModule } from '../../core/redis/redis.module.js';
import { RedisService } from '../../core/redis/redis.service.js';
import { MailerModule } from '../../core/mailer/mailer.module.js';
import { DatabaseModule } from '../../core/database/database.module.js';
import { DatabaseService } from '../../core/database/database.service.js';
import { AppConfigModule } from '../../core/app-config/app-config.module.js';
import { AppLoggerModule } from '../../core/app-logger/app-logger.module.js';
import { AppLoggerService } from '../../core/app-logger/app-logger.service.js';
import { AppConfigService } from '../../core/app-config/app-config.service.js';
import { JwtServiceModule } from '../../core/jwt-service/jwt-service.module.js';
import { SecretsManagerModule } from '../../core/secrets-manager/secrets-manager.module.js';

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

const myDatabaseServiceMock = {
  organizations: {
    create: jest.fn(),
  },
};

const myRedisServiceMock = {
  setInCache: jest.fn(),
};

const myLoggerServiceMock = {
  logError: jest.fn(),
};

describe('OrganizationsController', () => {
  let controller: OrganizationsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganizationsController],
      providers: [
        OrganizationsService,
        OrganizationsUserService,
        OrganizationsInviteService,
        OrganizationsProjectsService,
      ],
      imports: [
        DatabaseModule,
        S3Module,
        RedisModule,
        SecretsManagerModule,
        MailerModule,
        AppConfigModule,
        JwtServiceModule,
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
      .overrideProvider(DatabaseService)
      .useValue(myDatabaseServiceMock)
      .overrideProvider(RedisService)
      .useValue(myRedisServiceMock)
      .overrideProvider(AppLoggerService)
      .useValue(myLoggerServiceMock)
      .compile();

    controller = module.get<OrganizationsController>(OrganizationsController);
    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('Succesful Requests', () => {
    it('should create organization', async () => {
      const createdAt = new Date();
      myDatabaseServiceMock.organizations.create.mockResolvedValue({
        name: 'test-organizations',
        id: 'test-org-id',
        createdAt,
        image: null,
      });

      myRedisServiceMock.setInCache.mockResolvedValue({ status: true });

      const result = await controller.createOrganization(
        {
          name: 'test-organizations',
        },
        {
          user: { id: 'mock-user-id', email: 'test@email.com' },
          cookies: {
            access_token: 'fake-token',
            refresh_token: 'fake-token',
          },
        } as unknown as Request,
      );

      expect(result).toBeDefined();
      expect(result.id).toBe('test-org-id');
      expect(myRedisServiceMock.setInCache).toHaveBeenCalledWith(
        makeOrganizationCacheKey('test-org-id'),
        expect.objectContaining({
          id: 'test-org-id',
          name: 'test-organizations',
          image: null,
          createdAt,
        }),
      );
    });
  });

  describe('Unsuccesful Requests', () => {
    it('should not create the org when database fails', async () => {
      myDatabaseServiceMock.organizations.create.mockRejectedValue(
        new Error('Database failure'),
      );

      await expect(
        controller.createOrganization(
          {
            name: 'test-organizations',
          },
          {
            user: { id: 'mock-user-id', email: 'test@email.com' },
            cookies: {
              access_token: 'fake-token',
              refresh_token: 'fake-token',
            },
          } as unknown as Request,
        ),
      ).rejects.toThrow(Error);

      expect(myRedisServiceMock.setInCache).not.toHaveBeenCalled();
    });

    it('should log the error when redis fails', async () => {
      const createdAt = new Date();
      myDatabaseServiceMock.organizations.create.mockResolvedValue({
        name: 'test-organizations',
        id: 'test-org-id',
        createdAt,
        image: null,
      });

      myRedisServiceMock.setInCache.mockResolvedValue({
        status: false,
        error: 'Failed to store in cache',
      });

      const result = await controller.createOrganization(
        {
          name: 'test-organizations',
        },
        {
          user: { id: 'mock-user-id', email: 'test@email.com' },
          cookies: {
            access_token: 'fake-token',
            refresh_token: 'fake-token',
          },
        } as unknown as Request,
      );

      expect(result).toBeDefined();
      expect(result.id).toBe('test-org-id');
      expect(myRedisServiceMock.setInCache).toHaveBeenCalledWith(
        makeOrganizationCacheKey('test-org-id'),
        expect.objectContaining({
          id: 'test-org-id',
          name: 'test-organizations',
          image: null,
          createdAt,
        }),
      );

      expect(myLoggerServiceMock.logError).toHaveBeenCalledWith({
        reason: 'Failed to store in cache',
        message: 'Failed to store organization info in cache',
      });
    });
  });
});
