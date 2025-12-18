import { IsNotEmpty, IsString } from 'class-validator';

export class CreateOrganizationDto {
  @IsNotEmpty({ message: 'organization name is required' })
  @IsString({ message: 'Invalid organization name' })
  name: string;
}
