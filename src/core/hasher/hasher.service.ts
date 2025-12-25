import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

import { FnResult } from '../../types/fnResult.js';

@Injectable()
export class HasherService {
  async hashString(password: string): Promise<FnResult<string>> {
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

  async compareHashedString({
    plainString,
    hash,
  }: {
    plainString: string;
    hash: string;
  }) {
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
}
