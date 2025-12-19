import { IsNotEmpty, IsString } from 'class-validator';
import { Users } from '../../../../../generated/prisma/client.js';

export class SignInDto implements Pick<Users, 'password' | 'username'> {
  @IsString({ message: 'Invalid username' })
  @IsNotEmpty({ message: 'Username is required' })
  username: string;

  @IsString({ message: 'Invalid password' })
  @IsNotEmpty({ message: 'password is required' })
  password: string;
}
