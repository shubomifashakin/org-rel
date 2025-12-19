import * as argon2 from 'argon2';
import * as jose from 'jose';

import env from '../../core/serverEnv/index.js';

type FnResult =
  | { status: true; data: string; error: null }
  | { status: false; data: null; error: string };

export async function hashString(password: string): Promise<FnResult> {
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

export async function compareHashedString(plainString: string, hash: string) {
  try {
    const isTheSame = await argon2.verify(hash, plainString);

    return { status: true, data: isTheSame, error: null };
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
  payload: jose.JWTPayload,
  exp = '5m',
): Promise<FnResult> {
  try {
    const secret = new TextEncoder().encode(jwtSecret);

    const jwt = await new jose.SignJWT(payload)
      .setProtectedHeader({
        alg: 'HS256',
      })
      .setIssuedAt()
      .setIssuer(env.SERVICE_NAME)
      .setAudience(env.CLIENT_DOMAIN)
      .setExpirationTime(exp)
      .sign(secret);

    return { status: true, data: jwt, error: null };
  } catch (error: unknown) {
    if (error instanceof Error) {
      return { status: false, data: null, error: error.message };
    }

    return { status: false, data: null, error: 'Failed to generate JWT' };
  }
}

export async function verifyJwt(
  jwt: string,
  secret: string,
  options?: jose.JWTVerifyOptions,
): Promise<
  | { status: true; data: jose.JWTPayload; error: null }
  | { status: false; data: null; error: string }
> {
  try {
    const { payload } = await jose.jwtVerify(
      jwt,
      new TextEncoder().encode(secret),
      {
        issuer: env.SERVICE_NAME,
        audience: env.CLIENT_DOMAIN,
        ...options,
      },
    );

    return { status: true, data: payload, error: null };
  } catch (error: unknown) {
    if (error instanceof jose.errors.JWTExpired) {
      return { status: false, data: null, error: 'Token has expired' };
    }
    if (error instanceof jose.errors.JWTClaimValidationFailed) {
      return { status: false, data: null, error: 'Invalid token claims' };
    }
    if (error instanceof jose.errors.JWSInvalid) {
      return { status: false, data: null, error: 'Invalid JWT format' };
    }
    if (error instanceof Error) {
      return { status: false, data: null, error: error.message };
    }
    return { status: false, data: null, error: 'Failed to verify JWT' };
  }
}
