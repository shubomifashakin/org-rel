import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client.js';

import env from '../../core/serverEnv/index.js';
import { S3Service } from '../../core/s3/s3.service.js';
import { DatabaseService } from '../../core/database/database.service.js';
import { UpdateAccountDto } from './dtos/update-account.dto.js';
import { RedisService } from '../../core/redis/redis.service.js';

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
  ) {}

  async getMyAccountInfo(userId: string): Promise<UserInfo> {
    const { status, error, data } =
      await this.redisService.getFromCache<UserInfo>(`user:${userId}`);

    if (status && data) {
      return data;
    }

    if (!status) {
      console.error(error);
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
      console.error(storeInCache.error);
    }

    return userInfo;
  }

  async deleteMyAccount(userId: string) {
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
      console.error(error);
    }

    return { message: 'success' };
  }

  async updateMyAccount(
    userId: string,
    updateAccountDto: UpdateAccountDto,
    file?: Express.Multer.File,
  ) {
    try {
      let s3Url: string | undefined = undefined;

      if (file) {
        const { status, data, error } = await this.s3Service.uploadToS3(
          env.S3_BUCKET_NAME,
          file,
        );

        if (!status) {
          console.error('Failed to upload image to s3', error);
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
        console.error(error);
      }

      return { message: 'success' };
    } catch (error) {
      console.error(error);
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
}
