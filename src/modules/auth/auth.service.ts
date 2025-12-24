import { type Request } from 'express';
import { REQUEST } from '@nestjs/core';
import { ThrottlerException } from '@nestjs/throttler';
import { JWTPayload } from 'jose';
import { v4 as uuid } from 'uuid';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { Users } from '../../../generated/prisma/client.js';

import { SignUpDto } from './common/dtos/sign-up.dto.js';
import {
  compareHashedString,
  generateSuspiciousLoginMail,
  hashString,
  makeBlacklistedKey,
} from '../../common/utils/fns.js';

import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';

import { SignInDto } from './common/dtos/sign-in.dto.js';

import { DatabaseService } from '../../core/database/database.service.js';
import { RedisService } from '../../core/redis/redis.service.js';
import { MailerService } from '../../core/mailer/mailer.service.js';
import { S3Service } from '../../core/s3/s3.service.js';
import { JwtServiceService } from '../../core/jwt-service/jwt-service.service.js';
import { AppConfigService } from '../../core/app-config/app-config.service.js';
import { AppLoggerService } from '../../core/app-logger/app-logger.service.js';

import { DAYS_14_MS, MINUTES_10 } from '../../common/utils/constants.js';
import { TOKEN } from '../../common/utils/constants.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly redisService: RedisService,
    private readonly mailerService: MailerService,
    private readonly s3Service: S3Service,
    private readonly configService: AppConfigService,
    private readonly jwtService: JwtServiceService,
    private readonly loggerService: AppLoggerService,
    @Inject(REQUEST) private readonly request: Request,
  ) {}

  private async generateJwts(
    accessClaims: JWTPayload,
    refreshClaims: JWTPayload,
  ) {
    const accessTokenReq = this.jwtService.sign(
      {
        ...accessClaims,
        type: TOKEN.ACCESS.TYPE,
      },
      TOKEN.ACCESS.EXPIRATION,
    );

    const refreshTokenReq = this.jwtService.sign(
      { ...refreshClaims, type: TOKEN.REFRESH.TYPE },
      TOKEN.REFRESH.EXPIRATION,
    );

    const [accessToken, refreshToken] = await Promise.all([
      accessTokenReq,
      refreshTokenReq,
    ]);

    if (!accessToken.status || !refreshToken.status) {
      this.loggerService.logUnauthenticatedError({
        req: this.request,
        reason: accessToken?.error || refreshToken?.error,
        message: 'Failed to generate access or refresh token',
      });

      throw new InternalServerErrorException('Internal Server Error');
    }

    return { accessToken: accessToken.data, refreshToken: refreshToken.data };
  }

  private async handleAuthenticate(
    userData: Pick<Users, 'id' | 'email'>,
    ipAddr: string,
    userAgent?: string,
  ) {
    const tokenId = uuid();
    const accessTokenId = uuid();

    const { accessToken, refreshToken } = await this.generateJwts(
      {
        jti: accessTokenId,
        sub: userData.id,
        email: userData.email,
      },
      {
        jti: tokenId,
        sub: userData.id,
        email: userData.email,
      },
    );

    const { status, data, error } = await hashString(refreshToken);

    if (!status) {
      this.loggerService.logUnauthenticatedError({
        reason: error,
        req: this.request,
        message: 'Failed to hash refresh token',
      });

      throw new InternalServerErrorException('Internal Server Error');
    }

    await this.databaseService.refreshTokens.create({
      data: {
        userAgent,
        id: tokenId,
        ipAddress: ipAddr,
        userId: userData.id,
        token: data,
        expiresAt: new Date(Date.now() + DAYS_14_MS),
      },
    });

    return { accessToken, refreshToken };
  }

  async signUp(
    signUpDto: SignUpDto,
    ipAddr: string,
    file?: Express.Multer.File,
    userAgent?: string,
  ) {
    try {
      let s3Url: string | undefined;

      if (file) {
        const bucketName = this.configService.S3BucketName;

        if (!bucketName.status) {
          this.loggerService.logUnauthenticatedError({
            req: this.request,
            reason: bucketName.error,
            message: 'Failed to get S3 bucket name',
          });

          throw new InternalServerErrorException('Internal Server Error');
        }

        const { status, data, error } = await this.s3Service.uploadToS3(
          bucketName.data,
          file,
        );

        if (!status) {
          this.loggerService.logUnauthenticatedError({
            req: this.request,
            reason: error,
            message: 'Failed to upload file',
          });

          throw new InternalServerErrorException('Internal Server Error');
        } else {
          s3Url = data;
        }
      }

      const { status, data, error } = await hashString(signUpDto.password);

      if (!status) {
        this.loggerService.logUnauthenticatedError({
          req: this.request,
          reason: error,
          message: 'Failed to hash password',
        });

        throw new InternalServerErrorException('Internal Server Error');
      }

      const userData = await this.databaseService.users.create({
        data: {
          password: data,
          email: signUpDto.email,
          fullname: signUpDto.fullname,
          username: signUpDto.username,
          image: s3Url,
        },
        select: {
          id: true,
          email: true,
          username: true,
        },
      });

      const tokens = await this.handleAuthenticate(userData, ipAddr, userAgent);

      return { message: 'success', tokens };
    } catch (error: unknown) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException('Email or username already exists');
        }
      }

      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  async signIn(body: SignInDto, ipAddr: string, userAgent?: string) {
    const attemptKey = `attempts:${body.username}:${ipAddr}`;
    const attempts = await this.redisService.getFromCache<number>(attemptKey);

    if (!attempts.status) {
      this.loggerService.logUnauthenticatedError({
        req: this.request,
        reason: attempts.error,
        message: 'Failed to get login attempts',
      });
    }

    const currentAttempts = attempts?.data || 1;

    if (currentAttempts >= 5) {
      throw new ThrottlerException('Too many login attempts');
    }

    const totalAttempts = attempts.data ? attempts.data + 1 : 1;

    const existingUser = await this.databaseService.users.findUnique({
      where: {
        username: body.username,
      },
      select: {
        id: true,
        email: true,
        password: true,
        username: true,
      },
    });

    if (!existingUser) {
      throw new NotFoundException('User does not exist');
    }

    const { status, error, data } = await compareHashedString({
      plainString: body.password,
      hash: existingUser.password,
    });

    if (!status) {
      this.loggerService.logUnauthenticatedError({
        req: this.request,
        reason: error,
        message: 'Failed to compare hashed password',
      });

      throw new InternalServerErrorException('Internal Server Error');
    }

    if (!data) {
      const { status, error } = await this.redisService.setInCache(
        attemptKey,
        totalAttempts,
        MINUTES_10,
      );

      if (!status) {
        this.loggerService.logUnauthenticatedError({
          req: this.request,
          reason: error,
          message: 'Failed to set login attempts',
        });
      }

      if (totalAttempts >= 5) {
        console.warn(
          `TOO MAY LOGIN ATTEMPTS FOR ${existingUser.username} from ${ipAddr}`,
        );

        const mailerFrom = this.configService.MailerFrom;

        if (!mailerFrom.status) {
          this.loggerService.logUnauthenticatedError({
            req: this.request,
            reason: mailerFrom.error,
            message: 'Failed to get mailerFrom',
          });
        }

        if (mailerFrom.status) {
          const { error } = await this.mailerService.emails.send({
            to: existingUser.email,
            subject: 'Suspicious Login Attempt',
            html: generateSuspiciousLoginMail(ipAddr),
            from: mailerFrom.data,
          });

          if (error) {
            this.loggerService.logUnauthenticatedError({
              req: this.request,
              reason: error,
              message: 'Failed to send suspicious login mail',
            });
          }
        }
      }

      throw new BadRequestException('Invalid Credentials');
    }

    const tokens = await this.handleAuthenticate(
      existingUser,
      ipAddr,
      userAgent,
    );

    const deleteFromCache = await this.redisService.deleteFromCache(attemptKey);

    if (!deleteFromCache.status) {
      this.loggerService.logUnauthenticatedError({
        req: this.request,
        reason: deleteFromCache.error,
        message: 'Failed to delete login attempts from cache',
      });
    }

    return { message: 'success', tokens };
  }

  async signOut(userId: string, refreshToken: string, accessToken: string) {
    const accessKeyReq = await this.jwtService.verify(accessToken);

    if (!accessKeyReq.status) {
      this.loggerService.logUnauthenticatedError({
        req: this.request,
        reason: accessKeyReq.error,
        message: 'Failed to verify access token',
      });

      throw new InternalServerErrorException();
    }

    if (accessKeyReq.data?.jti) {
      //blacklist the accesstoken immeidiately
      const accessKeyId = accessKeyReq.data.jti;

      const { status, error } = await this.redisService.setInCache(
        makeBlacklistedKey(accessKeyId),
        true,
        MINUTES_10,
      );

      if (!status) {
        this.loggerService.logUnauthenticatedError({
          reason: error,
          req: this.request,
          message: 'Failed to blacklist access token',
        });
      }
    }

    const { status, error, data } = await this.jwtService.verify(refreshToken);

    if (!status) {
      this.loggerService.logUnauthenticatedError({
        reason: error,
        req: this.request,
        message: 'Failed to verify refresh token',
      });

      throw new InternalServerErrorException('Internal Server Error');
    }

    if (!data?.jti) {
      //if theres no jti then nothing to revoke
      return { message: 'success' };
    }

    const refreshTokenJti = data.jti;

    const sessionExists = await this.databaseService.refreshTokens.findUnique({
      where: {
        userId,
        id: refreshTokenJti,
      },
      select: {
        id: true,
      },
    });

    if (sessionExists) {
      await this.databaseService.refreshTokens.delete({
        where: { id: sessionExists.id },
      });
    }

    return { message: 'success' };
  }

  async refresh(ipAddr: string, oldRefreshToken?: string, userAgent?: string) {
    if (!oldRefreshToken) {
      throw new UnauthorizedException('Unauthorized');
    }

    const { status, error, data } =
      await this.jwtService.verify(oldRefreshToken);

    if (!status) {
      this.loggerService.logUnauthenticatedError({
        reason: error,
        req: this.request,
        message: 'Failed to verify refresh token',
      });

      throw new InternalServerErrorException('Internal Server Error');
    }

    if (!data?.jti) {
      throw new UnauthorizedException('Unauthorized');
    }

    const refreshTokenJti = data?.jti;

    const refreshTokenExists =
      await this.databaseService.refreshTokens.findUnique({
        where: {
          id: refreshTokenJti,
        },
        select: {
          expiresAt: true,
          userId: true,
          user: {
            select: {
              email: true,
            },
          },
        },
      });

    if (!refreshTokenExists) {
      throw new UnauthorizedException('Unauthorized');
    }

    //delete the old token
    await this.databaseService.refreshTokens.delete({
      where: { id: refreshTokenJti },
    });

    if (refreshTokenExists.expiresAt < new Date()) {
      throw new UnauthorizedException('Unauthorized');
    }

    //generate new ones
    const tokens = await this.handleAuthenticate(
      {
        id: refreshTokenExists.userId,
        email: refreshTokenExists.user.email,
      },
      ipAddr,
      userAgent,
    );

    return tokens;
  }
}
