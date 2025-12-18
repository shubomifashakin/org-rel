import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateOrganizationDto {
  @IsNotEmpty({ message: 'Organization name is required' })
  @IsString({ message: 'Invalid organization name' })
  @MinLength(3, { message: 'Organization name is too short' })
  name: string;
}
