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

const mockResponse = {
  cookie: jest.fn().mockReturnThis(),
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
} as unknown as Response;

const mockUser = {
  id: 'mock-user-id',
  username: 'testuser',
  email: 'test@example.com',
};

const myDatabaseServiceMock = {
  users: {
    create: jest.fn().mockResolvedValue(mockUser),
    findUnique: jest.fn().mockResolvedValue(null),
  },
  refreshTokens: {
    create: jest.fn().mockResolvedValue(null),
  },
};

const mockRedisServiceMock = {
  getFromCache: jest.fn().mockResolvedValue({
    status: true,
    data: { JWT_SECRET: '123456' },
    error: null,
  }),
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
        AppLoggerModule,
      ],
      providers: [AuthService],
    })
      .overrideProvider(DatabaseService)
      .useValue(myDatabaseServiceMock)
      .overrideProvider(RedisService)
      .useValue(mockRedisServiceMock)
      .compile();

    controller = await module.resolve<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('Successful Requests', () => {
    describe('Sign Up', () => {
      it('signUp - it should create the user', async () => {
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
        expect(mockRedisServiceMock.getFromCache).toHaveBeenCalled();
      });
    });
  });
});
