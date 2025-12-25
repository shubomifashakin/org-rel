import { Response, Request } from 'express';
import { ThrottlerException } from '@nestjs/throttler';
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
import { HasherModule } from '../../core/hasher/hasher.module.js';
import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  PrismaClientKnownRequestError,
  PrismaClientUnknownRequestError,
} from '@prisma/client/runtime/client.js';
import { HasherService } from '../../core/hasher/hasher.service.js';
import { JwtServiceService } from '../../core/jwt-service/jwt-service.service.js';
import { AppLoggerService } from '../../core/app-logger/app-logger.service.js';

const mockResponse = {
  cookie: jest.fn(),
  status: jest.fn(),
  json: jest.fn(),
  clearCookie: jest.fn(),
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
    delete: jest.fn(),
    findUnique: jest.fn(),
  },
};

const myRedisServiceMock = {
  getFromCache: jest.fn(),
  setInCache: jest.fn(),
  deleteFromCache: jest.fn(),
};

const mySecretsManagerServiceMock = {
  getSecret: jest.fn(),
};

const myHasherServiceMock = {
  hashString: jest.fn(),
  compareHashedString: jest.fn(),
};

const myJwtServiceMock = {
  sign: jest.fn(),
  verify: jest.fn(),
};

const myLoggerServiceMock = {
  logError: jest.fn(),
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
        HasherModule,
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
    }) //FIXME: IMPLEMENT BETTER OVERRIDES
      .overrideProvider(DatabaseService)
      .useValue(myDatabaseServiceMock)
      .overrideProvider(RedisService)
      .useValue(myRedisServiceMock)
      .overrideProvider(HasherService)
      .useValue(myHasherServiceMock)
      .overrideProvider(JwtServiceService)
      .useValue(myJwtServiceMock)
      .overrideProvider(AppLoggerService)
      .useValue(myLoggerServiceMock)
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

      myHasherServiceMock.hashString.mockResolvedValue({
        status: true,
        data: mockUser.password,
        error: null,
      });

      myJwtServiceMock.sign.mockResolvedValue({
        status: true,
        data: 'mock-jwt',
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
      expect(myJwtServiceMock.sign).toHaveBeenCalled();
    });

    it('signIn - it should signIn the user', async () => {
      myRedisServiceMock.getFromCache.mockResolvedValue({
        status: true,
        data: 0,
        error: null,
      });

      myDatabaseServiceMock.users.findUnique.mockResolvedValue(mockUser);

      myDatabaseServiceMock.refreshTokens.create.mockResolvedValue(null);

      myRedisServiceMock.deleteFromCache.mockResolvedValue({ status: true });

      myHasherServiceMock.compareHashedString.mockResolvedValue({
        status: true,
        data: true,
        error: null,
      });

      myHasherServiceMock.hashString.mockResolvedValue({
        status: true,
        data: 'mock-refresh-hashed',
        error: null,
      });

      myJwtServiceMock.sign.mockResolvedValue({
        status: true,
        data: 'mock-jwt',
        error: null,
      });

      expect(
        await controller.signIn(
          {
            password: 'password',
            username: '545plea',
          },
          mockResponse,
          '127.0.0.1',
        ),
      ).toEqual({ message: 'success' });

      expect(myDatabaseServiceMock.refreshTokens.create).toHaveBeenCalled();
      expect(myJwtServiceMock.sign).toHaveBeenCalled();
      expect(myHasherServiceMock.compareHashedString).toHaveBeenCalledWith({
        hash: mockUser.password,
        plainString: mockUser.password,
      });
    });

    it('signOut - it should signOut the user', async () => {
      myDatabaseServiceMock.refreshTokens.findUnique.mockResolvedValue(null);

      myJwtServiceMock.verify.mockResolvedValue({
        status: true,
        data: { jti: 'mock-jti' },
        error: null,
      });

      myRedisServiceMock.setInCache.mockResolvedValue({
        status: true,
        error: null,
      });

      myDatabaseServiceMock.refreshTokens.findUnique.mockResolvedValue({
        id: 'refresh-id',
      });

      myDatabaseServiceMock.refreshTokens.delete.mockResolvedValue(null);

      expect(
        await controller.signOut(
          {
            user: { id: 'mock-user-id', email: 'test@email.com' },
            cookies: {
              access_token: 'fake-token',
              refresh_token: 'fake-token',
            },
          } as unknown as Request,
          mockResponse,
        ),
      ).toEqual({ message: 'success' });

      expect(myDatabaseServiceMock.refreshTokens.findUnique).toHaveBeenCalled();
      expect(myJwtServiceMock.verify).toHaveBeenCalledTimes(2);
      expect(myDatabaseServiceMock.refreshTokens.delete).toHaveBeenCalled();
    });
  });

  describe('Unsuccessful Requests', () => {
    it('sign Up - it should not create the user due to conflicting records', async () => {
      myDatabaseServiceMock.users.create
        .mockRejectedValueOnce(
          new PrismaClientKnownRequestError('Username is taken', {
            code: 'P2002',
            clientVersion: '7.0',
          }),
        )
        .mockResolvedValue(mockUser);

      myDatabaseServiceMock.refreshTokens.create.mockResolvedValue(null);

      myHasherServiceMock.hashString.mockResolvedValue({
        status: true,
        data: mockUser.password,
        error: null,
      });

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

    it('sign Up - it should fail to sign up because sever failed to generate jwt', async () => {
      myDatabaseServiceMock.users.create.mockResolvedValue(mockUser);

      myDatabaseServiceMock.refreshTokens.create.mockResolvedValue(null);

      myHasherServiceMock.hashString.mockResolvedValue({
        status: true,
        data: mockUser.password,
        error: null,
      });

      myJwtServiceMock.sign.mockResolvedValue({
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

      expect(myLoggerServiceMock.logError).toHaveBeenCalled();
    });

    it('signIn - it should not signIn the user because they are blocked', async () => {
      myRedisServiceMock.getFromCache.mockResolvedValue({
        status: true,
        data: 6,
        error: null,
      });

      await expect(
        controller.signIn(
          {
            password: 'password',
            username: '545plea',
          },
          mockResponse,
          '127.0.0.1',
        ),
      ).rejects.toThrow(ThrottlerException);
    });

    it('signIn - it should not signIn the user because they do not exist', async () => {
      myRedisServiceMock.getFromCache.mockResolvedValue({
        status: true,
        data: 0,
        error: null,
      });

      myDatabaseServiceMock.users.findUnique.mockResolvedValue(null);

      await expect(
        controller.signIn(
          {
            password: 'password',
            username: '545plea',
          },
          mockResponse,
          '127.0.0.1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('signIn - it should not signIn the user because the password is wrong', async () => {
      myRedisServiceMock.getFromCache.mockResolvedValue({
        status: true,
        data: 0,
        error: null,
      });

      myDatabaseServiceMock.users.findUnique.mockResolvedValue(mockUser);

      myHasherServiceMock.compareHashedString.mockResolvedValue({
        status: true,
        data: false,
        error: null,
      });

      myRedisServiceMock.setInCache.mockResolvedValue({
        status: true,
        error: null,
      });

      await expect(
        controller.signIn(
          {
            password: 'password',
            username: '545plea',
          },
          mockResponse,
          '127.0.0.1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('signIn - it should not signIn the user because server failed to generate jwt', async () => {
      myRedisServiceMock.getFromCache.mockResolvedValue({
        status: true,
        data: 0,
        error: null,
      });

      myDatabaseServiceMock.users.findUnique.mockResolvedValue(mockUser);

      myHasherServiceMock.compareHashedString.mockResolvedValue({
        status: true,
        data: true,
        error: null,
      });

      myJwtServiceMock.sign.mockResolvedValue({
        status: false,
        data: 'mock-jwt',
        error: 'Failed to get secret',
      });

      await expect(
        controller.signIn(
          {
            password: 'password',
            username: '545plea',
          },
          mockResponse,
          '127.0.0.1',
        ),
      ).rejects.toThrow(InternalServerErrorException);

      expect(myLoggerServiceMock.logError).toHaveBeenCalled();
    });

    it('signOut - it should fail to signOut the user because accessToken verification failed', async () => {
      myJwtServiceMock.verify.mockResolvedValue({
        status: false,
        data: { jti: 'mock-jti' },
        error: 'failed to verify access token',
      });

      await expect(
        controller.signOut(
          {
            user: { id: 'mock-user-id', email: 'test@email.com' },
            cookies: {
              access_token: 'fake-token',
              refresh_token: 'fake-token',
            },
          } as unknown as Request,
          mockResponse,
        ),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('signOut - it should fail to signOut the user because refreshToken verification failed', async () => {
      myJwtServiceMock.verify
        .mockResolvedValueOnce({
          status: true,
          data: { jti: 'mock-jti' },
          error: null,
        })
        .mockResolvedValue({
          status: false,
          data: { jti: 'mock-jti' },
          error: 'failed to verify access token',
        });

      myRedisServiceMock.setInCache.mockResolvedValue({
        status: true,
      });

      await expect(
        controller.signOut(
          {
            user: { id: 'mock-user-id', email: 'test@email.com' },
            cookies: {
              access_token: 'fake-token',
              refresh_token: 'fake-token',
            },
          } as unknown as Request,
          mockResponse,
        ),
      ).rejects.toThrow(InternalServerErrorException);

      expect(myRedisServiceMock.setInCache).toHaveBeenCalled();
      expect(myJwtServiceMock.verify).toHaveBeenCalledTimes(2);
    });

    it('signOut - it should fail to signOut the user because refreshToken failed to be deleted from database', async () => {
      myJwtServiceMock.verify
        .mockResolvedValueOnce({
          status: true,
          data: { jti: 'mock-jti' },
          error: null,
        })
        .mockResolvedValue({
          status: true,
          data: { jti: 'mock-jti' },
          error: null,
        });

      myRedisServiceMock.setInCache.mockResolvedValue({
        status: true,
      });

      myDatabaseServiceMock.refreshTokens.findUnique.mockRejectedValue(
        new PrismaClientUnknownRequestError('Database failed to connect', {
          clientVersion: '7.0',
        }),
      );

      await expect(
        controller.signOut(
          {
            user: { id: 'mock-user-id', email: 'test@email.com' },
            cookies: {
              access_token: 'fake-token',
              refresh_token: 'fake-token',
            },
          } as unknown as Request,
          mockResponse,
        ),
      ).rejects.toThrow(InternalServerErrorException);

      expect(myRedisServiceMock.setInCache).toHaveBeenCalled();
      expect(myJwtServiceMock.verify).toHaveBeenCalledTimes(2);
      expect(myDatabaseServiceMock.refreshTokens.findUnique).toHaveBeenCalled();
      expect(myDatabaseServiceMock.refreshTokens.delete).not.toHaveBeenCalled();
    });
  });
});
