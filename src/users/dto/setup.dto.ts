import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetupDto {
  @ApiProperty({ description: 'The name of the new company.' })
  @IsString()
  @IsNotEmpty()
  companyName: string;

  @ApiProperty({ description: 'A description for the new company.' })
  @IsString()
  @IsNotEmpty()
  companyDesc: string;

  @ApiProperty({ description: 'An abbreviation for the new user.' })
  @IsString()
  @IsNotEmpty()
  userAbbr: string;

  @ApiProperty({ description: 'The first name of the new user.' })
  @IsString()
  @IsNotEmpty()
  firstname: string;

  @ApiProperty({ description: 'The last name of the new user.' })
  @IsString()
  @IsNotEmpty()
  surname: string;

  @ApiProperty({ description: 'The role for the new user.' })
  @IsString()
  @IsNotEmpty()
  role: string;

  @ApiProperty({ description: 'The password for the new user.', minLength: 8 })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @ApiProperty({ description: 'The repeated password for confirmation.' })
  @IsString()
  @IsNotEmpty()
  passwordRepeat: string;
}
