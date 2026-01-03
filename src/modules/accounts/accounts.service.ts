import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client.js';

import { S3Service } from '../../core/s3/s3.service.js';
import { DatabaseService } from '../../core/database/database.service.js';
import { AppConfigService } from '../../core/app-config/app-config.service.js';
import { AppLoggerService } from '../../core/app-logger/app-logger.service.js';

import { UpdateAccountDto } from './dtos/update-account.dto.js';
import { RedisService } from '../../core/redis/redis.service.js';
import { UpdateInviteDto } from './dtos/update-invite.dto.js';

type UserInfo = {
  id: string;
  image: string | null;
  fullname: string;
  username: string;
  createdAt: Date;
  email: string;
};

@Injectable()
export class AccountsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly s3Service: S3Service,
    private readonly redisService: RedisService,
    private readonly configService: AppConfigService,
    private readonly loggerService: AppLoggerService,
  ) {}

  async getMyAccountInfo(userId: string): Promise<UserInfo> {
    try {
      const { status, error, data } =
        await this.redisService.getFromCache<UserInfo>(`user:${userId}`);

      if (status && data) {
        return data;
      }

      if (!status) {
        this.loggerService.logError({
          reason: error,
          message: 'Failed to get account info from cache',
          context: `${AccountsService.name}.getMyAccountInfo`,
        });
      }

      const userInfo = await this.databaseService.users.findUnique({
        where: {
          id: userId,
        },
        select: {
          id: true,
          email: true,
          image: true,
          fullname: true,
          username: true,
          createdAt: true,
        },
      });

      if (!userInfo) {
        throw new NotFoundException('User does not exist');
      }

      const storeInCache = await this.redisService.setInCache(
        `user:${userId}`,
        userInfo,
      );

      if (!storeInCache.status) {
        this.loggerService.logError({
          reason: storeInCache.error,
          message: 'Failed to store account info in cache',
          context: `${AccountsService.name}.getMyAccountInfo`,
        });
      }

      return userInfo;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      if (error instanceof Error) {
        this.loggerService.logError({
          reason: error.message,
          message: 'Failed to get account info',
          context: `${AccountsService.name}.getMyAccountInfo`,
        });
      } else {
        this.loggerService.logError({
          reason: error,
          message: 'Failed to get account info',
          context: `${AccountsService.name}.getMyAccountInfo`,
        });
      }

      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  async deleteMyAccount(userId: string) {
    try {
      const userExists = await this.databaseService.users.findUnique({
        where: {
          id: userId,
        },
      });

      if (!userExists) {
        return { message: 'success' };
      }

      await this.databaseService.users.delete({
        where: {
          id: userId,
        },
      });

      const { status, error } = await this.redisService.deleteFromCache(
        `user:${userId}`,
      );

      if (!status) {
        this.loggerService.logError({
          reason: error,
          message: 'Failed to delete account info from cache',
          context: `${AccountsService.name}.deleteMyAccount`,
        });
      }

      return { message: 'success' };
    } catch (error) {
      if (error instanceof Error) {
        this.loggerService.logError({
          reason: `${error.name}: ${error.message}`,
          message: 'Failed to get all invites',
          context: `${AccountsService.name}.deleteMyAccount`,
        });
      } else {
        this.loggerService.logError({
          reason: error,
          message: 'Failed to get all invites',
          context: `${AccountsService.name}.deleteMyAccount`,
        });
      }

      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  async updateMyAccount(
    userId: string,
    updateAccountDto: UpdateAccountDto,
    file?: Express.Multer.File,
  ) {
    try {
      let s3Url: string | undefined = undefined;

      if (file) {
        const bucketName = this.configService.S3BucketName;

        if (!bucketName.status) {
          this.loggerService.logError({
            reason: bucketName.error,
            message: 'Failed to get s3 bucket name',
            context: `${AccountsService.name}.updateMyAccount`,
          });

          throw new InternalServerErrorException('Internal Server Error');
        }

        const { status, data, error } = await this.s3Service.uploadToS3(
          bucketName.data,
          file,
        );

        if (!status) {
          this.loggerService.logError({
            reason: error,
            message: 'Failed to upload updated image to s3',
            context: `${AccountsService.name}.updateMyAccount`,
          });

          throw new InternalServerErrorException('Internal Server Error');
        }

        s3Url = data;
      }

      const userInfo = await this.databaseService.users.update({
        where: {
          id: userId,
        },
        data: {
          image: s3Url,
          email: updateAccountDto.email,
          fullname: updateAccountDto.fullname,
          username: updateAccountDto.username,
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

      const { status, error } = await this.redisService.setInCache(
        `user:${userId}`,
        userInfo,
      );

      if (!status) {
        this.loggerService.logError({
          reason: error,
          message: 'Failed to store account info in cache',
          context: 'AccountsService.updateMyAccount',
        });
      }

      return { message: 'success' };
    } catch (error) {
      this.loggerService.logError({
        reason: error,
        message: 'Failed to update account info',
        context: 'AccountsService.updateMyAccount',
      });

      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException('User does not exist');
        }

        if (error.code === 'P2002') {
          const field =
            (
              error.meta?.driverAdapterError as {
                cause: { constraint: { fields: string[] } };
              }
            )?.cause?.constraint?.fields.join(', ') || 'username or email';

          throw new ConflictException(`${field} is taken`);
        }
      }

      throw error;
    }
  }

  async getAllInvites(email: string) {
    try {
      const invitesReceived = await this.databaseService.invites.findMany({
        where: {
          email,
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

      const transformed = invitesReceived.map((invite) => {
        return {
          id: invite.id,
          role: invite.role,
          status: invite.status,
          expiresAt: invite.expiresAt,
          createdAt: invite.createdAt,
          inviter: invite.inviter?.fullname,
          organization: invite.organization.name,
        };
      });

      return { invites: transformed };
    } catch (error) {
      if (error instanceof Error) {
        this.loggerService.logError({
          reason: `${error.name}: ${error.message}`,
          message: 'Failed to get all invites',
          context: `${AccountsService.name}.getAllInvites`,
        });
      } else {
        this.loggerService.logError({
          reason: error,
          message: 'Failed to get all invites',
          context: `${AccountsService.name}.getAllInvites`,
        });
      }

      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  async updateInviteStatus(
    inviteId: string,
    updateInvite: UpdateInviteDto,
    email: string,
    userId: string,
  ) {
    const inviteExistsForUser = await this.databaseService.invites.findFirst({
      where: {
        id: inviteId,
        email,
      },
    });

    if (!inviteExistsForUser) {
      throw new NotFoundException('Invite does not exist');
    }

    if (new Date() > inviteExistsForUser.expiresAt) {
      throw new BadRequestException('Invite has expired');
    }

    if (inviteExistsForUser.status !== 'PENDING') {
      throw new BadRequestException(
        `Invite already ${inviteExistsForUser.status.toLocaleLowerCase()}`,
      );
    }

    await this.databaseService.$transaction(async (tx) => {
      const status = await tx.invites.update({
        where: {
          email,
          id: inviteId,
        },
        data: {
          status: updateInvite.status,
        },
        select: {
          role: true,
          status: true,
          organizationId: true,
        },
      });

      if (status.status === 'ACCEPTED') {
        await tx.organizationsOnUsers.create({
          data: {
            userId,
            role: status.role,
            organizationId: status.organizationId,
          },
        });
      }
    });

    return { message: 'success' };
  }
}
