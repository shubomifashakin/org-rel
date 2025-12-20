import { JWTPayload } from 'jose';
import { v4 as uuid } from 'uuid';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { Users } from '../../../generated/prisma/client.js';

import { SignUpDto } from './common/dtos/sign-up.dto.js';
import {
  compareHashedString,
  generateJwt,
  hashString,
  verifyJwt,
} from '../../common/utils/fns.js';

import env from '../../core/serverEnv/index.js';

import { DatabaseService } from '../../core/database/database.service.js';
import { SecretsManagerService } from '../../core/secrets-manager/secrets-manager.service.js';
import { DAYS_14_MS } from '../../common/utils/constants.js';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { TOKEN } from './common/utils/constants.js';
import { SignInDto } from './common/dtos/sign-in.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly secretsManagerService: SecretsManagerService,
  ) {}

  private async generateJwts(
    accessClaims: JWTPayload,
    refreshClaims: JWTPayload & { tokenId: string },
  ) {
    const secret = await this.secretsManagerService.getSecret<{
      JWT_SECRET: string;
    }>(env.JWT_SECRET_NAME);

    if (!secret.status) {
      console.error('Failed to get secret from secrets manager', secret.error);

      throw new InternalServerErrorException('Internal Server Error');
    }

    const { JWT_SECRET } = secret.data;

    const accessTokenReq = generateJwt(
      JWT_SECRET,
      {
        ...accessClaims,
        type: TOKEN.ACCESS.TYPE,
      },
      TOKEN.ACCESS.EXPIRATION,
    );

    const refreshTokenReq = generateJwt(
      JWT_SECRET,
      { ...refreshClaims, type: TOKEN.REFRESH.TYPE },
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

  private async handleAuthenticate(
    userData: Pick<Users, 'id' | 'email'>,
    ipAddr: string,
    userAgent?: string,
  ) {
    const tokenId = uuid();

    const { accessToken, refreshToken } = await this.generateJwts(
      {
        sub: userData.id,
        email: userData.email,
      },
      {
        tokenId,
        sub: userData.id,
        email: userData.email,
      },
    );

    const { status, data, error } = await hashString(refreshToken);

    if (!status) {
      console.log('failed to hash refresh token', error);

      throw new InternalServerErrorException('Something went wrong');
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

  async signUp(signUpDto: SignUpDto, ipAddr: string, userAgent?: string) {
    try {
      const { status, data, error } = await hashString(signUpDto.password);

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
    try {
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

      const passwordIsCorrect = await compareHashedString(
        existingUser.password,
        body.password,
      );

      if (!passwordIsCorrect) {
        throw new BadRequestException('Invalid Credentials');
      }

      const tokens = await this.handleAuthenticate(
        existingUser,
        ipAddr,
        userAgent,
      );

      return { message: 'success', tokens };
    } catch (error) {
      console.error('Invalid sign in request', error);

      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  async logOut(userId: string, refreshToken?: string) {
    if (!refreshToken) {
      return { message: 'success' };
    }

    const secret = await this.secretsManagerService.getSecret<{
      JWT_SECRET: string;
    }>(env.JWT_SECRET_NAME);

    if (!secret.status) {
      console.error('Failed to get secret from secrets manager', secret.error);

      throw new InternalServerErrorException('Internal Server Error');
    }

    const { status, error, data } = await verifyJwt(
      refreshToken,
      secret.data.JWT_SECRET,
    );

    if (!status) {
      //FIXME:
      console.error('logout error', error);
      throw new UnauthorizedException('Unauthorized');
    }

    const tokenId = data?.tokenId as string;

    if (!tokenId) {
      throw new UnauthorizedException('Unauthorized');
    }

    const sessionExists = await this.databaseService.refreshTokens.findUnique({
      where: {
        userId,
        id: tokenId,
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

    const secret = await this.secretsManagerService.getSecret<{
      JWT_SECRET: string;
    }>(env.JWT_SECRET_NAME);

    if (!secret.status) {
      console.error('Failed to get secret from secrets manager', secret.error);

      throw new InternalServerErrorException('Internal Server Error');
    }

    const { status, error, data } = await verifyJwt(
      oldRefreshToken,
      secret.data.JWT_SECRET,
    );

    if (!status) {
      //FIXME:
      console.error('refresh error', error);
      throw new UnauthorizedException('Unauthorized');
    }

    const tokenId = data?.tokenId as string;

    const refreshTokenExists =
      await this.databaseService.refreshTokens.findUnique({
        where: {
          id: tokenId,
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

    if (refreshTokenExists.expiresAt < new Date()) {
      await this.databaseService.refreshTokens.delete({
        where: { id: tokenId },
      });

      throw new UnauthorizedException('Unauthorized');
    }

    //delete the old refresh token
    await this.databaseService.refreshTokens.delete({
      where: { id: tokenId },
    });

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
