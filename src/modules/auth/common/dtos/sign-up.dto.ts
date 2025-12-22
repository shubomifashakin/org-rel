import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsStrongPassword,
  MinLength,
} from 'class-validator';
import { Users } from '../../../../../generated/prisma/client.js';

export class SignUpDto implements Pick<
  Users,
  'fullname' | 'email' | 'username' | 'password'
> {
  @IsNotEmpty({ message: 'Fullname is required' })
  @IsString({ message: 'Invalid fullname' })
  @MinLength(3, { message: 'Fullname must be at least 3 characters long' })
  fullname: string;

  @IsEmail({}, { message: 'Invalid email' })
  email: string;

  @IsString({ message: 'Invalid username' })
  @IsNotEmpty({ message: 'Username is required' })
  @MinLength(3, { message: 'Username must be at least 3 characters long' })
  username: string;

  @IsStrongPassword(
    {
      minLength: 8,
      minSymbols: 1,
      minNumbers: 1,
      minLowercase: 1,
      minUppercase: 1,
    },
    {
      message:
        'Password must be at least 8 characters long and contain 1, lowercase, uppercase, number and symbol',
    },
  )
  password: string;
}
