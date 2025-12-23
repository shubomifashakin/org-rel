import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import * as jose from 'jose';

import { SecretsManagerService } from '../secrets-manager/secrets-manager.service.js';
import { FnResult } from '../../types/fnResult.js';

type JWT_SECRET = {
  JWT_SECRET: string;
};

@Injectable()
export class JwtServiceService {
  constructor(
    private readonly configService: ConfigService,
    private readonly secretsManagerService: SecretsManagerService,
  ) {}

  async sign(payload: jose.JWTPayload, exp = '5m'): Promise<FnResult<string>> {
    try {
      const secretName =
        this.configService.getOrThrow<string>('JWT_SECRET_NAME');
      const serviceName = this.configService.getOrThrow<string>('SERVICE_NAME');
      const clientDomain =
        this.configService.getOrThrow<string>('CLIENT_DOMAIN');

      const secret =
        await this.secretsManagerService.getSecret<JWT_SECRET>(secretName);

      if (!secret.status) {
        console.error(
          'Failed to get secret from secrets manager',
          secret.error,
        );

        throw new Error(secret.error);
      }

      const { JWT_SECRET } = secret.data;

      const encodedSecret = new TextEncoder().encode(JWT_SECRET);

      const jwt = await new jose.SignJWT(payload)
        .setProtectedHeader({
          alg: 'HS256',
        })
        .setIssuedAt()
        .setIssuer(serviceName)
        .setAudience(clientDomain)
        .setExpirationTime(exp)
        .sign(encodedSecret);

      return { status: true, data: jwt, error: null };
    } catch (error) {
      if (error instanceof Error) {
        return { status: false, data: null, error: error.message };
      }

      return { status: false, data: null, error: 'Failed to generate JWT' };
    }
  }

  async verify(jwt: string): Promise<FnResult<jose.JWTPayload | null>> {
    try {
      const secretName =
        this.configService.getOrThrow<string>('JWT_SECRET_NAME');

      const secret =
        await this.secretsManagerService.getSecret<JWT_SECRET>(secretName);

      if (!secret.status) {
        throw new Error(secret.error);
      }

      const serviceName = this.configService.getOrThrow<string>('SERVICE_NAME');
      const clientDomain =
        this.configService.getOrThrow<string>('CLIENT_DOMAIN');

      const { payload } = await jose.jwtVerify(
        jwt,
        new TextEncoder().encode(secret.data.JWT_SECRET),
        {
          issuer: serviceName,
          audience: clientDomain,
        },
      );

      return { status: true, data: payload, error: null };
    } catch (error: unknown) {
      if (error instanceof jose.errors.JWTExpired) {
        return { status: true, data: null, error: null };
      }

      if (error instanceof jose.errors.JWTClaimValidationFailed) {
        return { status: true, data: null, error: null };
      }

      if (error instanceof jose.errors.JWSInvalid) {
        return { status: true, data: null, error: null };
      }

      if (error instanceof Error) {
        return { status: false, data: null, error: error.message };
      }
      return { status: false, data: null, error: 'Failed to verify JWT' };
    }
  }
}
