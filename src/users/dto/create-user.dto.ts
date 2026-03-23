import { IsNotEmpty, IsString, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ description: 'The ID of the company the user belongs to.' })
  @IsNumber()
  @IsNotEmpty()
  companyId: number;

  @ApiProperty({ description: 'The role of the user.' })
  @IsString()
  @IsNotEmpty()
  role: string;

  @ApiProperty({ description: 'The first name of the user.' })
  @IsString()
  @IsNotEmpty()
  firstname: string;

  @ApiProperty({ description: 'The last name of the user.' })
  @IsString()
  @IsNotEmpty()
  surname: string;

  @ApiProperty({ description: 'The username for the user.' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ description: 'The password for the user.' })
  @IsString()
  @IsNotEmpty()
  password: string;
}
