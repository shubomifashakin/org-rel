import { JWTPayload } from 'jose';
import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

import { SignUpDto } from './common/dtos/sign-up.dto.js';
import { generateJwt, hashPassword } from '../../common/utils/fns.js';

import env from '../../core/serverEnv/index.js';
import { DatabaseService } from '../../core/database/database.service.js';
import { SecretsManagerService } from '../../core/secrets-manager/secrets-manager.service.js';
import { DAYS_14_MS } from '../../common/utils/constants.js';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';

const TOKEN = {
  ACCESS: {
    TYPE: 'access' as const,
    EXPIRATION: '10m',
  },
  REFRESH: {
    TYPE: 'refresh' as const,
    EXPIRATION: '14d',
  },
} as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly secretsManagerService: SecretsManagerService,
  ) {}

  private async generateJwt(claims: JWTPayload) {
    const getJwtSecret = await this.secretsManagerService.send(
      new GetSecretValueCommand({
        SecretId: env.JWT_SECRET_NAME,
      }),
    );

    if (!getJwtSecret.SecretString) {
      console.log('failed to get secret from secrets manager');

      throw new InternalServerErrorException('Something went wrong');
    }

    const jwtSecret = JSON.parse(getJwtSecret.SecretString) as {
      JWT_SECRET: string;
    };

    const accessTokenReq = generateJwt(jwtSecret.JWT_SECRET, {
      ...claims,
      type: TOKEN.ACCESS.TYPE,
    });

    const refreshTokenReq = generateJwt(
      jwtSecret.JWT_SECRET,
      { ...claims, type: TOKEN.REFRESH.TYPE },
      TOKEN.REFRESH.EXPIRATION,
    );

    const [accessToken, refreshToken] = await Promise.all([
      accessTokenReq,
      refreshTokenReq,
    ]);

    if (!accessToken.status || !refreshToken.status) {
      //FIXME: USE BETTER LOGGER IMPLEMENTATION
      console.error(
        'Failed to generate access or refresh token',
        accessToken.error || refreshToken.error,
      );

      throw new InternalServerErrorException('Something went wrong');
    }

    return { accessToken: accessToken.data, refreshToken: refreshToken.data };
  }

  async signUp(signUpDto: SignUpDto, ipAddr: string, userAgent?: string) {
    try {
      const { status, data, error } = await hashPassword(signUpDto.password);

      if (!status) {
        //FIXME: USE A BETTER LOGGER IMPLEMENTATION
        console.error(error);

        throw new InternalServerErrorException('Something went wrong');
      }

      const userData = await this.databaseService.users.create({
        data: {
          password: data,
          email: signUpDto.email,
          fullname: signUpDto.fullname,
          username: signUpDto.username,
        },
        select: {
          id: true,
          email: true,
          username: true,
        },
      });

      const tokens = await this.generateJwt({
        sub: userData.id,
        email: userData.email,
      });

      await this.databaseService.refreshTokens.create({
        data: {
          userAgent,
          ipAddress: ipAddr,
          userId: userData.id,
          token: tokens.refreshToken,
          expiresAt: new Date(Date.now() + DAYS_14_MS),
        },
      });

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

  async logOut(userId: string, refreshToken?: string) {
    if (!refreshToken) {
      return { message: 'success' };
    }

    const sessionExists = await this.databaseService.refreshTokens.findUnique({
      where: {
        userId,
        token: refreshToken,
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

  signIn() {
    return { message: 'hello world' };
  }
}
