import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginUserDto {
  @ApiProperty({ description: 'The name of the company the user belongs to.' })
  @IsString()
  @IsNotEmpty()
  company: string;

  @ApiProperty({ description: 'The username of the user.' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ description: 'The password of the user.' })
  @IsString()
  @IsNotEmpty()
  password: string;
}
