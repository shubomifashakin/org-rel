import { Injectable } from '@nestjs/common';

import * as jose from 'jose';

import { AppConfigService } from '../app-config/app-config.service.js';
import { SecretsManagerService } from '../secrets-manager/secrets-manager.service.js';

import { FnResult } from '../../types/fnResult.js';

type JWT_SECRET = {
  JWT_SECRET: string;
};

@Injectable()
export class JwtServiceService {
  constructor(
    private readonly configService: AppConfigService,
    private readonly secretsManagerService: SecretsManagerService,
  ) {}

  async sign(payload: jose.JWTPayload, exp = '5m'): Promise<FnResult<string>> {
    try {
      const secretName = this.configService.JWTSecretName;

      if (!secretName.status) {
        throw new Error(secretName.error);
      }

      const serviceName = this.configService.ServiceName;

      if (!serviceName.status) {
        throw new Error(serviceName.error);
      }

      const audience = this.configService.ClientDomainName;
      if (!audience.status) {
        throw new Error(audience.error);
      }

      const secret = await this.secretsManagerService.getSecret<JWT_SECRET>(
        secretName.data,
      );

      if (!secret.status) {
        throw new Error(secret.error);
      }

      const { JWT_SECRET } = secret.data;

      const encodedSecret = new TextEncoder().encode(JWT_SECRET);

      const jwt = await new jose.SignJWT(payload)
        .setProtectedHeader({
          alg: 'HS256',
        })
        .setIssuedAt()
        .setIssuer(serviceName.data)
        .setAudience(audience.data)
        .setExpirationTime(exp)
        .setJti(payload.jti!)
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
      const secretName = this.configService.JWTSecretName;

      if (!secretName.status) {
        throw new Error(secretName.error);
      }

      const secret = await this.secretsManagerService.getSecret<JWT_SECRET>(
        secretName.data,
      );

      if (!secret.status) {
        throw new Error(secret.error);
      }

      const serviceName = this.configService.ServiceName;

      if (!serviceName.status) {
        throw new Error(serviceName.error);
      }

      const audience = this.configService.ClientDomainName;

      if (!audience.status) {
        throw new Error(audience.error);
      }

      const { payload } = await jose.jwtVerify(
        jwt,
        new TextEncoder().encode(secret.data.JWT_SECRET),
        {
          issuer: serviceName.data,
          audience: audience.data,
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
