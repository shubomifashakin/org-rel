import { Response } from 'express';
import { Test, TestingModule } from '@nestjs/testing';

import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';

import { DatabaseModule } from '../../core/database/database.module.js';
import { S3Module } from '../../core/s3/s3.module.js';
import { MailerModule } from '../../core/mailer/mailer.module.js';
import { RedisModule } from '../../core/redis/redis.module.js';
import { JwtServiceModule } from '../../core/jwt-service/jwt-service.module.js';
import { AppConfigModule } from '../../core/app-config/app-config.module.js';
import { AppLoggerModule } from '../../core/app-logger/app-logger.module.js';
import { DatabaseService } from '../../core/database/database.service.js';
import { RedisService } from '../../core/redis/redis.service.js';
import { ClsModule } from 'nestjs-cls';
import { SecretsManagerService } from '../../core/secrets-manager/secrets-manager.service.js';
import {
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client.js';

const mockResponse = {
  cookie: jest.fn(),
  status: jest.fn(),
  json: jest.fn(),
} as unknown as Response;

const mockUser = {
  id: 'mock-user-id',
  username: 'testuser',
  email: 'test@example.com',
  password: 'password',
};

const myDatabaseServiceMock = {
  users: {
    create: jest.fn(),
    findUnique: jest.fn(),
  },
  refreshTokens: {
    create: jest.fn(),
  },
};

const myRedisServiceMock = {
  getFromCache: jest.fn(),
  setInCache: jest.fn(),
};

const mySecretsManagerServiceMock = {
  getSecret: jest.fn(),
};

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      imports: [
        DatabaseModule,
        MailerModule,
        RedisModule,
        S3Module,
        AppConfigModule,
        JwtServiceModule,
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
        AppLoggerModule,
      ],
      providers: [AuthService],
    })
      .overrideProvider(DatabaseService)
      .useValue(myDatabaseServiceMock)
      .overrideProvider(RedisService)
      .useValue(myRedisServiceMock)
      .overrideProvider(SecretsManagerService)
      .useValue(mySecretsManagerServiceMock)
      .compile();

    controller = await module.resolve<AuthController>(AuthController);

    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('Successful Requests', () => {
    it('signUp - it should create the user', async () => {
      myDatabaseServiceMock.users.create.mockResolvedValue(mockUser);

      myDatabaseServiceMock.refreshTokens.create.mockResolvedValue(null);

      mySecretsManagerServiceMock.getSecret.mockResolvedValue({
        status: true,
        data: { JWT_SECRET: '123456' },
        error: null,
      });

      expect(
        await controller.signUp(
          {
            email: 'testUser@icloud.com',
            password: 'password',
            fullname: 'subomi',
            username: '545plea',
          },
          mockResponse,
          '127.0.0.1',
        ),
      ).toEqual({ message: 'success' });

      expect(myDatabaseServiceMock.refreshTokens.create).toHaveBeenCalled();
      expect(mySecretsManagerServiceMock.getSecret).toHaveBeenCalled();
    });

    // it('signIn - it should signIn the user', async () => {
    //   myRedisServiceMock.getFromCache.mockResolvedValue({
    //     status: true,
    //     data: 0,
    //     error: null,
    //   });

    //   myDatabaseServiceMock.users.findUnique.mockResolvedValue(mockUser);

    //   myDatabaseServiceMock.refreshTokens.create.mockResolvedValue(null);

    //   mySecretsManagerServiceMock.getSecret.mockResolvedValue({
    //     status: true,
    //     data: { JWT_SECRET: '123456' },
    //     error: null,
    //   });

    //   expect(
    //     await controller.signIn(
    //       {
    //         password: 'password',
    //         username: '545plea',
    //       },
    //       mockResponse,
    //       '127.0.0.1',
    //     ),
    //   ).toEqual({ message: 'success' });

    //   expect(myDatabaseServiceMock.refreshTokens.create).toHaveBeenCalled();
    //   expect(mySecretsManagerServiceMock.getSecret).toHaveBeenCalled();
    // });
  });

  describe('Unsuccessfull Requests', () => {
    it('it should not create the user due to conflicting records', async () => {
      myDatabaseServiceMock.users.create
        .mockRejectedValueOnce(
          new PrismaClientKnownRequestError('Username is taken', {
            code: 'P2002',
            clientVersion: '7.0',
          }),
        )
        .mockResolvedValue(mockUser);

      myDatabaseServiceMock.refreshTokens.create.mockResolvedValue(null);

      mySecretsManagerServiceMock.getSecret.mockResolvedValueOnce({
        status: false,
        data: null,
        error: 'Failed to get secret',
      });

      await expect(
        controller.signUp(
          {
            email: 'testUser@icloud.com',
            password: 'password',
            fullname: 'subomi',
            username: '545plea',
          },
          mockResponse,
          '127.0.0.1',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('it should fail because it failed to get secrets', async () => {
      myDatabaseServiceMock.users.create.mockResolvedValue(mockUser);

      myDatabaseServiceMock.refreshTokens.create.mockResolvedValue(null);

      mySecretsManagerServiceMock.getSecret.mockResolvedValue({
        status: false,
        data: null,
        error: 'Failed to get secret',
      });

      await expect(
        controller.signUp(
          {
            email: 'testUser@icloud.com',
            password: 'password',
            fullname: 'subomi',
            username: '545plea',
          },
          mockResponse,
          '127.0.0.1',
        ),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });
});
