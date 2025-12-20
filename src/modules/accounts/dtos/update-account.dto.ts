import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class UpdateAccountDto {
  @IsOptional()
  @IsString({ message: 'Invalid fullname' })
  @IsNotEmpty({ message: 'Fullname is required' })
  @MinLength(3, { message: 'Fullname must be at least 3 characters long' })
  fullname?: string;

  @IsOptional()
  @IsString({ message: 'Invalid username' })
  @IsNotEmpty({ message: 'Username is required' })
  @MinLength(3, { message: 'Username must be at least 3 characters long' })
  username?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Invalid Email' })
  email?: string;
}
