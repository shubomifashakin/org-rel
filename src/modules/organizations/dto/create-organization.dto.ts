import {
  IsDefined,
  IsEmail,
  IsNotEmpty,
  IsString,
  IsStrongPassword,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class CreateUserDto {
  @IsString({ message: 'Invalid username' })
  @IsNotEmpty({ message: 'Username is required' })
  username: string;

  @IsEmail(undefined, { message: 'Invalid email' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @IsString({ message: 'Invalid fullname' })
  @IsNotEmpty({ message: 'Fullname is required' })
  fullname: string;

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
        'Password should must be at least 8 characters long and contain 1, lowercase, uppercase, number and symbol',
    },
  )
  @IsNotEmpty({ message: 'Password is required' })
  password: string;
}
export class CreateOrganizationDto {
  @IsNotEmpty({ message: 'organization name is required' })
  @IsString({ message: 'Invalid organization name' })
  name: string;

  @IsDefined({ message: 'user info is required' })
  @ValidateNested({ always: true })
  @Type(() => CreateUserDto)
  user: CreateUserDto;
}
