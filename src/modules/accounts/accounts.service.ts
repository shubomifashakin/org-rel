import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

import { S3Service } from '../../core/s3/s3.service.js';
import { DatabaseService } from '../../core/database/database.service.js';
import { UpdateAccountDto } from './dtos/update-account.dto.js';
import { RedisService } from '../../core/redis/redis.service.js';

type UserInfo = {
  id: string;
  image: string;
  fullname: string;
  username: string;
  createdAt: string;
};

@Injectable()
export class AccountsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly s3Service: S3Service,
    private readonly redisService: RedisService,
  ) {}

  async getMyAccountInfo(userId: string) {
    const existsInCache = await this.redisService
      .getFromCache<UserInfo>(`user:${userId}`)
      .catch((error) => {
        console.error('Failed to get user info from cache', error);
        return undefined;
      });

    if (existsInCache) {
      return existsInCache;
    }

    const userInfo = await this.databaseService.users.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        image: true,
        fullname: true,
        username: true,
        createdAt: true,
      },
    });

    if (!userInfo) {
      throw new NotFoundException('User does not exist');
    }

    await this.redisService
      .setInCache(`user:${userId}`, userInfo)
      .catch((error) => {
        console.error('Failed to set user info in cache', error);
      });

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

    await this.redisService.deleteFromCache(`user:${userId}`).catch((error) => {
      console.error('Failed to delete user info from cache', error);
    });

    return { message: 'success' };
  }

  async updateMyAccount(
    userId: string,
    updateAccountDto: UpdateAccountDto,
    file?: Express.Multer.File,
  ) {
    let s3Url: string | undefined = undefined;

    if (file) {
      const { status, data, error } = await this.s3Service.uploadToS3(file);

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
      },
    });

    await this.redisService
      .setInCache(`user:${userId}`, userInfo)
      .catch((error) => {
        console.error('Failed to delete user info from cache', error);
      });

    return { message: 'success' };
  }
}
