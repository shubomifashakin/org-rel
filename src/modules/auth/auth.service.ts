import { JWTPayload } from 'jose';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

import { SignUpDto } from './common/dtos/sign-up.dto.js';
import { generateJwt, hashPassword } from '../../common/utils/fns.js';

import env from '../../core/serverEnv/index.js';
import { DatabaseService } from '../../core/database/database.service.js';
import { SecretsManagerService } from '../../core/secrets-manager/secrets-manager.service.js';

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
      throw new InternalServerErrorException('Something went wrong');
    }

    const jwtSecret = getJwtSecret.SecretString;

    const jwt = await generateJwt(jwtSecret, claims);

    if (!jwt.status) {
      //FIXME: USE BETTER LOGGER IMPLEMENTATION
      console.error('Failed to generate jwt', jwt.error);

      throw new InternalServerErrorException('Something went wrong');
    }

    return jwt.data;
  }

  async signUp(signUpDto: SignUpDto) {
    //FIXME: HASH THE PASSWORD
    const { status, data, error } = await hashPassword(signUpDto.password);

    if (!status) {
      //FIXME: USE A BETTER LOGGER IMPLEMENTATIO
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

    const jwt = await this.generateJwt({
      sub: userData.id,
      email: userData.email,
    });

    return { message: 'success', jwt };
  }

  async logOut() {
    const sessionExists = await this.databaseService.sessions.findUnique({
      where: {
        id: '',
      },
    });

    if (!sessionExists) {
      return { message: 'success' };
    }

    await this.databaseService.sessions.delete({
      where: {
        id: sessionExists.id,
      },
    });

    return { message: 'success' };
  }

  signIn() {
    return { message: 'hello world' };
  }
}
