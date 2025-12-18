import * as argon2 from 'argon2';
import * as jose from 'jose';

import env from '../../core/serverEnv/index.js';

type FnResult =
  | { status: true; data: string; error: null }
  | { status: false; data: null; error: string };

export async function hashPassword(password: string): Promise<FnResult> {
  try {
    const hash = await argon2.hash(password, {
      timeCost: 4,
      hashLength: 32,
      memoryCost: 65536,
      type: argon2.argon2id,
    });

    return { status: true, data: hash, error: null };
  } catch (error: unknown) {
    //FIXME: USE A BETTER LOGGER
    console.log(error);

    if (error instanceof Error) {
      return { status: false, data: null, error: error.message };
    }

    return { status: false, data: null, error: 'Failed to hash password' };
  }
}

export async function generateJwt(
  jwtSecret: string,
  claims: jose.JWTPayload,
): Promise<FnResult> {
  try {
    const secret = new TextEncoder().encode(jwtSecret);

    const jwt = await new jose.SignJWT(claims)
      .setProtectedHeader({
        alg: 'HS256',
      })
      .setIssuedAt()
      .setIssuer(env.SERVICE_NAME)
      .setAudience(env.CLIENT_DOMAIN)
      .setExpirationTime('10m')
      .sign(secret);

    return { status: true, data: jwt, error: null };
  } catch (error: unknown) {
    if (error instanceof Error) {
      return { status: false, data: null, error: error.message };
    }

    return { status: false, data: null, error: 'Failed to generate JWT' };
  }
}
