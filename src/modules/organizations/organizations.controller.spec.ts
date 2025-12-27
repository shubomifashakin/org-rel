import { Request } from 'express';
import { ClsModule } from 'nestjs-cls';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { makeOrganizationCacheKey, makeUserCacheKey } from './common/utils.js';
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
import { Readable } from 'node:stream';
import { S3Service } from '../../core/s3/s3.service.js';
import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { MINUTES_10 } from '../../common/utils/constants.js';

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
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  organizationsOnUsers: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
};

const myRedisServiceMock = {
  setInCache: jest.fn(),
  getFromCache: jest.fn(),
  deleteFromCache: jest.fn(),
};

const myLoggerServiceMock = {
  logError: jest.fn(),
};

const myS3ServiceMock = {
  uploadToS3: jest.fn(),
};

const organizationName = 'test-organizations';
const organizationId = 'test-org-id';

const userId = 'test-user';

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
      .overrideProvider(S3Service)
      .useValue(myS3ServiceMock)
      .compile();

    controller = module.get<OrganizationsController>(OrganizationsController);
    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('Succesful Requests', () => {
    it('createOrganization - should create organization', async () => {
      const createdAt = new Date();
      myDatabaseServiceMock.organizations.create.mockResolvedValue({
        name: organizationName,
        id: organizationId,
        createdAt,
        image: null,
      });

      myRedisServiceMock.setInCache.mockResolvedValue({ status: true });

      const result = await controller.createOrganization(
        {
          name: organizationName,
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
      expect(result.id).toBe(organizationId);
      expect(myRedisServiceMock.setInCache).toHaveBeenCalledWith(
        makeOrganizationCacheKey(organizationId),
        expect.objectContaining({
          id: organizationId,
          name: organizationName,
          image: null,
          createdAt,
        }),
      );
    });

    it('createOrganization - should create organization with an image', async () => {
      const imageUrl = 'https://test-bucket.s3.amazonaws.com/test-key';

      const createdAt = new Date();
      myDatabaseServiceMock.organizations.create.mockResolvedValue({
        name: organizationName,
        id: organizationId,
        createdAt,
        image: imageUrl,
      });

      myRedisServiceMock.setInCache.mockResolvedValue({ status: true });

      myS3ServiceMock.uploadToS3.mockResolvedValue({
        status: true,
        data: imageUrl,
        error: null,
      });

      const result = await controller.createOrganization(
        {
          name: organizationName,
        },
        {
          user: { id: 'mock-user-id', email: 'test@email.com' },
          cookies: {
            access_token: 'fake-token',
            refresh_token: 'fake-token',
          },
        } as unknown as Request,
        {
          buffer: Buffer.from('hello'),
          fieldname: 'file',
          mimetype: 'image/jpeg',
          size: 1024,
          originalname: 'test-image.jpg',
          encoding: '7bit',
          filename: 'test-image-12345.jpg',
          path: '/tmp/test-image-12345.jpg',
          stream: new Readable(),
          destination: '',
        },
      );

      expect(myS3ServiceMock.uploadToS3).toHaveBeenCalled();
      expect(myDatabaseServiceMock.organizations.create).toHaveBeenCalledWith({
        data: {
          name: organizationName,
          image: imageUrl,
          users: {
            create: {
              userId: 'mock-user-id',
              role: 'ADMIN',
            },
          },
        },
        select: {
          id: true,
          name: true,
          image: true,
          createdAt: true,
        },
      });
      expect(result).toBeDefined();
      expect(result.id).toBe(organizationId);
      expect(myRedisServiceMock.setInCache).toHaveBeenCalledWith(
        makeOrganizationCacheKey(organizationId),
        expect.objectContaining({
          id: organizationId,
          name: organizationName,
          image: imageUrl,
          createdAt,
        }),
      );
    });

    it('getOrganizationsUserIsMemberOf - should get an organization the user is a member of', async () => {
      const imageUrl = 'https://test-bucket.s3.amazonaws.com/test-key';

      const assignedAt = new Date();
      myDatabaseServiceMock.organizationsOnUsers.findMany.mockResolvedValue([
        {
          role: 'ADMIN',
          organization: {
            id: organizationId,
            name: organizationName,
            image: imageUrl,
          },
          assignedAt,
        },
      ]);

      const result = await controller.getAllOrganizationsUserIsMemberOf({
        user: { id: 'mock-user-id', email: 'test@email.com' },
        cookies: {
          access_token: 'fake-token',
          refresh_token: 'fake-token',
        },
      } as unknown as Request);

      expect(
        myDatabaseServiceMock.organizationsOnUsers.findMany,
      ).toHaveBeenCalled();

      expect(result).toEqual({
        organizations: [
          {
            role: 'ADMIN',
            id: organizationId,
            name: organizationName,
            image: imageUrl,
            assignedAt,
          },
        ],
        hasNextPage: false,
      });

      expect(result).toBeDefined();
    });

    it('getOneOrganization - should get a single organization from database', async () => {
      const imageUrl = 'https://test-bucket.s3.amazonaws.com/test-key';

      myRedisServiceMock.setInCache.mockResolvedValue({ status: true });
      myRedisServiceMock.getFromCache.mockResolvedValue({
        status: true,
        data: null,
      });

      const createdAt = new Date();
      myDatabaseServiceMock.organizations.findUnique.mockResolvedValue({
        name: organizationName,
        id: organizationId,
        image: imageUrl,
        createdAt,
      });

      const result = await controller.getOneOrganization(organizationId);

      expect(myDatabaseServiceMock.organizations.findUnique).toHaveBeenCalled();
      expect(myRedisServiceMock.getFromCache).toHaveBeenCalled();
      expect(result).toEqual({
        name: organizationName,
        id: organizationId,
        image: imageUrl,
        createdAt,
      });

      expect(result).toBeDefined();
    });

    it('getOneOrganization - should get a single organization from cache', async () => {
      const imageUrl = 'https://test-bucket.s3.amazonaws.com/test-key';
      const createdAt = new Date();

      myRedisServiceMock.getFromCache.mockResolvedValue({
        status: true,
        data: {
          name: organizationName,
          id: organizationId,
          image: imageUrl,
          createdAt,
        },
      });

      const result = await controller.getOneOrganization(organizationId);

      expect(
        myDatabaseServiceMock.organizations.findUnique,
      ).not.toHaveBeenCalled();
      expect(myRedisServiceMock.getFromCache).toHaveBeenCalled();

      expect(result).toEqual({
        name: organizationName,
        id: organizationId,
        image: imageUrl,
        createdAt,
      });

      expect(result).toBeDefined();
    });

    it('updateOneOrganization - should update a single organization', async () => {
      const createdAt = new Date();

      const resolvedObject = {
        id: organizationId,
        name: 'Updated Name',
        image: null,
        createdAt,
      };

      myRedisServiceMock.setInCache.mockResolvedValue({ status: true });

      myDatabaseServiceMock.organizations.update.mockResolvedValue(
        resolvedObject,
      );

      const result = await controller.updateOneOrganization(organizationId, {
        name: 'Updated Name',
      });

      expect(myRedisServiceMock.setInCache).toHaveBeenCalledWith(
        makeOrganizationCacheKey(organizationId),
        resolvedObject,
      );

      expect(result).toEqual({
        message: 'success',
      });
    });

    it('deleteOneOrganization - should delete a single organization', async () => {
      myRedisServiceMock.deleteFromCache.mockResolvedValue({ status: true });

      myDatabaseServiceMock.organizations.findUnique.mockResolvedValue({});
      myDatabaseServiceMock.organizations.delete.mockResolvedValue(null);

      const result = await controller.deleteOneOrganization(organizationId);

      expect(
        myDatabaseServiceMock.organizations.findUnique,
      ).toHaveBeenCalledWith({ where: { id: organizationId } });

      expect(myDatabaseServiceMock.organizations.delete).toHaveBeenCalledWith({
        where: { id: organizationId },
      });

      expect(myRedisServiceMock.deleteFromCache).toHaveBeenCalledWith(
        makeOrganizationCacheKey(organizationId),
      );

      expect(result).toEqual({
        message: 'success',
      });
    });

    it('deleteOneOrganization - should delete from database because organization did not exist', async () => {
      myDatabaseServiceMock.organizations.findUnique.mockResolvedValue(null);

      const result = await controller.deleteOneOrganization(organizationId);

      expect(
        myDatabaseServiceMock.organizations.findUnique,
      ).toHaveBeenCalledWith({ where: { id: organizationId } });

      expect(myDatabaseServiceMock.organizations.delete).not.toHaveBeenCalled();

      expect(result).toEqual({
        message: 'success',
      });
    });

    it('deleteOneOrganization - should delete a single organization but fail to delete from cache', async () => {
      myRedisServiceMock.deleteFromCache.mockResolvedValue({
        status: false,
        error: 'Failed to delete',
      });

      myDatabaseServiceMock.organizations.findUnique.mockResolvedValue({});
      myDatabaseServiceMock.organizations.delete.mockResolvedValue(null);

      const result = await controller.deleteOneOrganization(organizationId);

      expect(
        myDatabaseServiceMock.organizations.findUnique,
      ).toHaveBeenCalledWith({ where: { id: organizationId } });

      expect(myDatabaseServiceMock.organizations.delete).toHaveBeenCalledWith({
        where: { id: organizationId },
      });

      expect(myRedisServiceMock.deleteFromCache).toHaveBeenCalledWith(
        makeOrganizationCacheKey(organizationId),
      );

      expect(myLoggerServiceMock.logError).toHaveBeenCalledWith({
        reason: 'Failed to delete',
        message: `Failed to delete ${makeOrganizationCacheKey(organizationId)} info from cache`,
      });

      expect(result).toEqual({
        message: 'success',
      });
    });

    it('getOrgUsers - it should get all organization Users', async () => {
      myDatabaseServiceMock.organizationsOnUsers.findMany.mockResolvedValue([
        {
          role: 'ADMIN',
          user: {
            id: userId,
            image: null,
            email: 'test@example.com',
            fullname: 'Test User',
            username: 'testuser',
          },
        },
      ]);

      const result = await controller.getOrgUsers(organizationId);

      expect(
        myDatabaseServiceMock.organizationsOnUsers.findMany,
      ).toHaveBeenCalledWith({
        where: {
          organizationId,
        },
        select: {
          role: true,
          user: {
            select: {
              id: true,
              email: true,
              image: true,
              username: true,
              fullname: true,
            },
          },
        },
        take: 11,
        cursor: undefined,
      });

      expect(result).toEqual({
        users: [
          {
            role: 'ADMIN',
            id: userId,
            image: null,
            email: 'test@example.com',
            fullname: 'Test User',
            username: 'testuser',
          },
        ],
        hasNextPage: false,
      });
    });

    it('getOneOrgUser - it should get an organization user', async () => {
      myRedisServiceMock.getFromCache.mockResolvedValue({
        status: true,
        data: null,
      });
      myRedisServiceMock.setInCache.mockResolvedValue({ status: true });

      const resultObj = {
        id: userId,
        email: 'test@example.com',
        fullname: 'Test User',
        image: null,
        username: 'testuser',
        role: 'ADMIN',
      };

      myDatabaseServiceMock.organizationsOnUsers.findUnique.mockResolvedValue({
        role: 'ADMIN',
        user: {
          id: userId,
          image: null,
          email: 'test@example.com',
          fullname: 'Test User',
          username: 'testuser',
        },
      });

      const result = await controller.getOneOrgUser(organizationId, userId);

      expect(
        myDatabaseServiceMock.organizationsOnUsers.findUnique,
      ).toHaveBeenCalledWith({
        where: {
          organizationId_userId: {
            userId,
            organizationId,
          },
        },
        select: {
          role: true,
          user: {
            select: {
              id: true,
              email: true,
              image: true,
              username: true,
              fullname: true,
            },
          },
        },
      });

      expect(result).toEqual(resultObj);

      expect(myRedisServiceMock.setInCache).toHaveBeenCalledWith(
        makeUserCacheKey(organizationId, userId),
        resultObj,
        MINUTES_10,
      );
    });
  });

  describe('Unsuccesful Requests', () => {
    it('createOrganization - should not create the org when database fails', async () => {
      myDatabaseServiceMock.organizations.create.mockRejectedValue(
        new Error('Database failure'),
      );

      await expect(
        controller.createOrganization(
          {
            name: organizationName,
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

    it('createOrganization - should log the error when redis fails', async () => {
      const createdAt = new Date();
      myDatabaseServiceMock.organizations.create.mockResolvedValue({
        name: organizationName,
        id: organizationId,
        createdAt,
        image: null,
      });

      myRedisServiceMock.setInCache.mockResolvedValue({
        status: false,
        error: 'Failed to store in cache',
      });

      const result = await controller.createOrganization(
        {
          name: organizationName,
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
      expect(result.id).toBe(organizationId);
      expect(myRedisServiceMock.setInCache).toHaveBeenCalledWith(
        makeOrganizationCacheKey(organizationId),
        expect.objectContaining({
          id: organizationId,
          name: organizationName,
          image: null,
          createdAt,
        }),
      );

      expect(myLoggerServiceMock.logError).toHaveBeenCalledWith({
        reason: 'Failed to store in cache',
        message: 'Failed to store organization info in cache',
      });
    });

    it('getOrganizationsUserIsMemberOf - should fail to get an organization the user is a member of', async () => {
      await expect(
        controller.getAllOrganizationsUserIsMemberOf({
          user: { id: 'mock-user-id', email: 'test@email.com' },
          cookies: {
            access_token: 'fake-token',
            refresh_token: 'fake-token',
          },
        } as unknown as Request),
      ).rejects.toThrow(Error);

      expect(
        myDatabaseServiceMock.organizationsOnUsers.findMany,
      ).toHaveBeenCalled();
    });

    it('getOneOrganization - should fail to get a single organization from database because the organization did not exist', async () => {
      myRedisServiceMock.setInCache.mockResolvedValue({ status: true });
      myRedisServiceMock.getFromCache.mockResolvedValue({
        status: true,
        data: null,
      });

      myDatabaseServiceMock.organizations.findUnique.mockResolvedValue(null);

      await expect(
        controller.getOneOrganization(organizationId),
      ).rejects.toThrow(NotFoundException);

      expect(myDatabaseServiceMock.organizations.findUnique).toHaveBeenCalled();
      expect(myRedisServiceMock.getFromCache).toHaveBeenCalled();
    });

    it('updateOneOrganization - should fail to update a single organization', async () => {
      myDatabaseServiceMock.organizations.update.mockRejectedValue(
        new Error('Update failed'),
      );

      await expect(
        controller.updateOneOrganization(organizationId, {
          name: 'Updated Name',
        }),
      ).rejects.toThrow(Error);

      expect(myRedisServiceMock.setInCache).not.toHaveBeenCalled();
    });

    it('updateOneOrganization - should handle S3 upload failure', async () => {
      const updateDto = { name: 'Updated Org Name' };

      const mockFile = {
        buffer: Buffer.from('test'),
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
      } as Express.Multer.File;

      const error = 'upload failed';

      myS3ServiceMock.uploadToS3.mockResolvedValue({
        status: false,
        error: error,
      });

      await expect(
        controller.updateOneOrganization(organizationId, updateDto, mockFile),
      ).rejects.toThrow(InternalServerErrorException);

      expect(myLoggerServiceMock.logError).toHaveBeenCalledWith({
        reason: error,
        message: 'Failed to upload image to S3',
      });
    });

    it('deleteOneOrganization - should not delete a single organization because database failed', async () => {
      myRedisServiceMock.deleteFromCache.mockResolvedValue({ status: true });

      myDatabaseServiceMock.organizations.findUnique.mockResolvedValue({});
      myDatabaseServiceMock.organizations.delete.mockRejectedValue(new Error());

      await expect(
        controller.deleteOneOrganization(organizationId),
      ).rejects.toThrow(Error);

      expect(
        myDatabaseServiceMock.organizations.findUnique,
      ).toHaveBeenCalledWith({ where: { id: organizationId } });

      expect(myDatabaseServiceMock.organizations.delete).toHaveBeenCalledWith({
        where: { id: organizationId },
      });

      expect(myRedisServiceMock.deleteFromCache).not.toHaveBeenCalled();
    });

    it('getOrgUsers - it should fail to get all organization Users because database failed', async () => {
      myDatabaseServiceMock.organizationsOnUsers.findMany.mockRejectedValue(
        new Error('Database error'),
      );
      await expect(controller.getOrgUsers(organizationId)).rejects.toThrow(
        Error,
      );
    });

    it('getOneOrgUser - it should not get an organization user because the user doesnot exist', async () => {
      myRedisServiceMock.getFromCache.mockResolvedValue({
        status: true,
        data: null,
      });
      myRedisServiceMock.setInCache.mockResolvedValue({ status: true });

      myDatabaseServiceMock.organizationsOnUsers.findUnique.mockResolvedValue(
        null,
      );

      await expect(
        controller.getOneOrgUser(organizationId, userId),
      ).rejects.toThrow(NotFoundException);

      expect(
        myDatabaseServiceMock.organizationsOnUsers.findUnique,
      ).toHaveBeenCalledWith({
        where: {
          organizationId_userId: {
            userId,
            organizationId,
          },
        },
        select: {
          role: true,
          user: {
            select: {
              id: true,
              email: true,
              image: true,
              username: true,
              fullname: true,
            },
          },
        },
      });
    });
  });
});
