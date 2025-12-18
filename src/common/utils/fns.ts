import * as argon2 from 'argon2';

type HashResult =
  | { status: true; data: string; error: null }
  | { status: false; data: null; error: string };

export async function hashPassword(password: string): Promise<HashResult> {
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
