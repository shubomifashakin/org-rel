import { Request, Response } from 'express';
import { ClsModule } from 'nestjs-cls';
import { Test, TestingModule } from '@nestjs/testing';

import { AccountsController } from './accounts.controller.js';
import { AccountsService } from './accounts.service.js';

import { S3Module } from '../../core/s3/s3.module.js';
import { RedisModule } from '../../core/redis/redis.module.js';
import { RedisService } from '../../core/redis/redis.service.js';
import { DatabaseModule } from '../../core/database/database.module.js';
import { DatabaseService } from '../../core/database/database.service.js';
import { AppConfigModule } from '../../core/app-config/app-config.module.js';
import { AppLoggerModule } from '../../core/app-logger/app-logger.module.js';
import { JwtServiceModule } from '../../core/jwt-service/jwt-service.module.js';
import { SecretsManagerModule } from '../../core/secrets-manager/secrets-manager.module.js';
import { AppLoggerService } from '../../core/app-logger/app-logger.service.js';

import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

const mockResponse = {
  cookie: jest.fn(),
  status: jest.fn(),
  json: jest.fn(),
  clearCookie: jest.fn(),
} as unknown as Response;

const mockUser = {
  id: 'mock-user-id',
  email: 'test@example.com',
  image: '',
  fullname: 'Test User',
  username: 'testuser',
  password: 'password',
  createdAt: new Date(),
};

const myDatabaseServiceMock = {
  users: {
    create: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
  },
  refreshTokens: {
    create: jest.fn(),
    delete: jest.fn(),
    findUnique: jest.fn(),
  },
  invites: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
  $transaction: jest.fn(),
};

const myRedisServiceMock = {
  getFromCache: jest.fn(),
  setInCache: jest.fn(),
  deleteFromCache: jest.fn(),
};

// const mySecretsManagerServiceMock = {
//   getSecret: jest.fn(),
// };

// const myHasherServiceMock = {
//   hashString: jest.fn(),
//   compareHashedString: jest.fn(),
// };

// const myJwtServiceMock = {
//   sign: jest.fn(),
//   verify: jest.fn(),
// };

const myLoggerServiceMock = {
  logError: jest.fn(),
};

describe('AccountsController', () => {
  let controller: AccountsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AccountsController],
      providers: [AccountsService],
      imports: [
        DatabaseModule,
        SecretsManagerModule,
        S3Module,
        RedisModule,
        AppConfigModule,
        JwtServiceModule,
        AppLoggerModule,
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
      .overrideProvider(DatabaseService)
      .useValue(myDatabaseServiceMock)
      .overrideProvider(RedisService)
      .useValue(myRedisServiceMock)
      .overrideProvider(AppLoggerService)
      .useValue(myLoggerServiceMock)
      .compile();

    controller = module.get<AccountsController>(AccountsController);

    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('Successful Requests', () => {
    it('getMyAccountInfo - it should get my account info', async () => {
      myRedisServiceMock.getFromCache.mockResolvedValue({
        status: true,
        data: null,
        error: null,
      });

      myDatabaseServiceMock.users.findUnique.mockResolvedValue(mockUser);

      myRedisServiceMock.setInCache.mockResolvedValue({
        status: true,
        data: null,
        error: null,
      });

      expect(
        await controller.getMyAccountInfo({
          user: { id: mockUser.id, email: mockUser.email },
        } as unknown as Request),
      ).toEqual(mockUser);

      expect(myRedisServiceMock.getFromCache).toHaveBeenCalled();
    });

    it('deleteMyAccount - it should delete my account info', async () => {
      myDatabaseServiceMock.users.findUnique.mockResolvedValue(mockUser);

      myDatabaseServiceMock.users.delete.mockResolvedValue(null);

      myRedisServiceMock.deleteFromCache.mockResolvedValue({
        status: true,
        data: null,
        error: null,
      });

      expect(
        await controller.deleteMyAccount(
          {
            user: { id: mockUser.id, email: mockUser.email },
          } as unknown as Request,
          mockResponse,
        ),
      ).toEqual({ message: 'success' });

      expect(myDatabaseServiceMock.users.findUnique).toHaveBeenCalledWith({
        where: {
          id: mockUser.id,
        },
      });
      expect(myDatabaseServiceMock.users.delete).toHaveBeenCalledWith({
        where: {
          id: mockUser.id,
        },
      });
      expect(myRedisServiceMock.deleteFromCache).toHaveBeenCalledWith(
        `user:${mockUser.id}`,
      );
    });

    it('deleteMyAccount - it should not delete account info if user does not exist', async () => {
      myDatabaseServiceMock.users.findUnique.mockResolvedValue(null);

      expect(
        await controller.deleteMyAccount(
          {
            user: { id: mockUser.id, email: mockUser.email },
          } as unknown as Request,
          mockResponse,
        ),
      ).toEqual({ message: 'success' });

      expect(myDatabaseServiceMock.users.findUnique).toHaveBeenCalledWith({
        where: {
          id: mockUser.id,
        },
      });

      expect(myDatabaseServiceMock.users.delete).not.toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockResponse.clearCookie).toHaveBeenCalledTimes(2);
    });

    it('updateMyAccount - it should update my account', async () => {
      myDatabaseServiceMock.users.update.mockResolvedValue({
        ...mockUser,
        email: 'newemail@gmail.com',
      });

      myRedisServiceMock.setInCache.mockResolvedValue({
        status: true,
        error: null,
      });

      expect(
        await controller.updateMyAccount(
          {
            user: { id: mockUser.id, email: mockUser.email },
          } as unknown as Request,
          { email: 'newemail@gmail.com' },
        ),
      ).toEqual({ message: 'success' });

      expect(myDatabaseServiceMock.users.update).toHaveBeenCalledWith({
        where: {
          id: mockUser.id,
        },
        data: {
          email: 'newemail@gmail.com',
        },
        select: {
          id: true,
          image: true,
          fullname: true,
          username: true,
          createdAt: true,
          email: true,
        },
      });
    });

    it('getAllInvites - it should get all my invites', async () => {
      myDatabaseServiceMock.invites.findMany.mockResolvedValue([]);

      myRedisServiceMock.setInCache.mockResolvedValue({
        status: true,
        error: null,
      });

      expect(
        await controller.getAllInvites({
          user: { id: mockUser.id, email: mockUser.email },
        } as unknown as Request),
      ).toEqual({ invites: [] });

      expect(myDatabaseServiceMock.invites.findMany).toHaveBeenCalledWith({
        where: {
          email: mockUser.email,
        },
        select: {
          id: true,
          createdAt: true,
          expiresAt: true,
          role: true,
          status: true,
          organization: {
            select: {
              name: true,
            },
          },
          inviter: {
            select: {
              fullname: true,
            },
          },
        },
      });
    });

    it('updateInviteStatus - it should update an invite', async () => {
      myDatabaseServiceMock.invites.findFirst.mockResolvedValue({
        expiresAt: new Date(Date.now() * 10),
        status: 'PENDING',
      });

      expect(
        await controller.updateInviteStatus('1244', { status: 'ACCEPTED' }, {
          user: { id: mockUser.id, email: mockUser.email },
        } as unknown as Request),
      ).toEqual({ message: 'success' });

      expect(myDatabaseServiceMock.invites.findFirst).toHaveBeenCalledWith({
        where: {
          email: mockUser.email,
          id: '1244',
        },
      });

      expect(myDatabaseServiceMock.$transaction).toHaveBeenCalled();
    });
  });

  describe('Unsuccessful Requests', () => {
    it('getMyAccountInfo - it should not get a non existent user', async () => {
      myRedisServiceMock.getFromCache.mockResolvedValue({
        status: false,
        data: null,
        error: 'Failed to get from cache',
      });

      myDatabaseServiceMock.users.findUnique.mockResolvedValue(null);

      myRedisServiceMock.setInCache.mockResolvedValue({
        status: true,
        data: null,
        error: null,
      });

      await expect(
        controller.getMyAccountInfo({
          user: { id: mockUser.id, email: mockUser.email },
        } as unknown as Request),
      ).rejects.toThrow(NotFoundException);

      expect(myRedisServiceMock.getFromCache).toHaveBeenCalled();
      expect(myRedisServiceMock.getFromCache).toHaveBeenCalledWith(
        `user:${mockUser.id}`,
      );
      expect(myLoggerServiceMock.logError).toHaveBeenCalled();
    });

    it('getAllInvites - it should not get invites because database failed', async () => {
      myDatabaseServiceMock.invites.findMany.mockRejectedValue(
        new InternalServerErrorException(),
      );

      await expect(
        controller.getAllInvites({
          user: { id: mockUser.id, email: mockUser.email },
        } as unknown as Request),
      ).rejects.toThrow(InternalServerErrorException);

      expect(myDatabaseServiceMock.invites.findMany).toHaveBeenCalledWith({
        where: {
          email: mockUser.email,
        },
        select: {
          id: true,
          createdAt: true,
          expiresAt: true,
          role: true,
          status: true,
          organization: {
            select: {
              name: true,
            },
          },
          inviter: {
            select: {
              fullname: true,
            },
          },
        },
      });
    });

    it('updateInviteStatus - it should not update a non-existent invite', async () => {
      myDatabaseServiceMock.invites.findFirst.mockResolvedValue(null);

      await expect(
        controller.updateInviteStatus('1244', { status: 'ACCEPTED' }, {
          user: { id: mockUser.id, email: mockUser.email },
        } as unknown as Request),
      ).rejects.toThrow(NotFoundException);

      expect(myDatabaseServiceMock.invites.findFirst).toHaveBeenCalledWith({
        where: {
          email: mockUser.email,
          id: '1244',
        },
      });
    });

    it('updateInviteStatus - it should not update an invite because it has expired', async () => {
      myDatabaseServiceMock.invites.findFirst.mockResolvedValue({
        expiresAt: new Date(Date.now() / 10),
        status: 'PENDING',
      });

      await expect(
        controller.updateInviteStatus('1244', { status: 'ACCEPTED' }, {
          user: { id: mockUser.id, email: mockUser.email },
        } as unknown as Request),
      ).rejects.toThrow(BadRequestException);

      expect(myDatabaseServiceMock.invites.findFirst).toHaveBeenCalledWith({
        where: {
          email: mockUser.email,
          id: '1244',
        },
      });
    });

    it('updateInviteStatus - it should not update an invite because it has been responded to', async () => {
      myDatabaseServiceMock.invites.findFirst.mockResolvedValue({
        expiresAt: new Date(Date.now() * 10),
        status: 'ACCEPTED',
      });

      await expect(
        controller.updateInviteStatus('1244', { status: 'ACCEPTED' }, {
          user: { id: mockUser.id, email: mockUser.email },
        } as unknown as Request),
      ).rejects.toThrow(BadRequestException);

      expect(myDatabaseServiceMock.invites.findFirst).toHaveBeenCalledWith({
        where: {
          email: mockUser.email,
          id: '1244',
        },
      });
    });
  });
});
